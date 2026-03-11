use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecResult {
    pub success: bool,
    pub output: String,
}

fn validate_path(working_dir: &str, relative_path: &str) -> Result<PathBuf, AppError> {
    let base = std::fs::canonicalize(working_dir)
        .map_err(|e| AppError::ToolExecutionFailed(format!("Invalid working directory: {e}")))?;

    let target = base.join(relative_path);

    // For new files, canonicalize the parent directory and append the filename
    let resolved = if target.exists() {
        std::fs::canonicalize(&target)
            .map_err(|e| AppError::ToolExecutionFailed(format!("Cannot resolve path: {e}")))?
    } else {
        let parent = target.parent().unwrap_or(&base);
        let parent_canonical = if parent.exists() {
            std::fs::canonicalize(parent)
                .map_err(|e| AppError::ToolExecutionFailed(format!("Cannot resolve parent: {e}")))?
        } else {
            // Parent doesn't exist yet — will be created by write_file
            // Just check that the base path prefix matches
            parent.to_path_buf()
        };
        match target.file_name() {
            Some(name) => parent_canonical.join(name),
            None => {
                return Err(AppError::PathAccessDenied(
                    "Invalid filename".to_string(),
                ))
            }
        }
    };

    if !resolved.starts_with(&base) {
        return Err(AppError::PathAccessDenied(format!(
            "Path escapes working directory: {}",
            relative_path
        )));
    }

    Ok(resolved)
}

fn handle_read_file(working_dir: &str, args: &serde_json::Value) -> Result<ToolExecResult, AppError> {
    let path = args["path"]
        .as_str()
        .ok_or_else(|| AppError::ToolExecutionFailed("Missing 'path' argument".into()))?;

    let resolved = validate_path(working_dir, path)?;

    let content = std::fs::read_to_string(&resolved)
        .map_err(|e| AppError::ToolExecutionFailed(format!("Failed to read file: {e}")))?;

    // Truncate large files to 8000 chars for context window
    let output = if content.len() > 8000 {
        format!("{}...\n\n[Truncated: {} total characters]", &content[..8000], content.len())
    } else {
        content
    };

    Ok(ToolExecResult {
        success: true,
        output,
    })
}

fn handle_write_file(working_dir: &str, args: &serde_json::Value) -> Result<ToolExecResult, AppError> {
    let path = args["path"]
        .as_str()
        .ok_or_else(|| AppError::ToolExecutionFailed("Missing 'path' argument".into()))?;
    let content = args["content"]
        .as_str()
        .ok_or_else(|| AppError::ToolExecutionFailed("Missing 'content' argument".into()))?;

    let resolved = validate_path(working_dir, path)?;

    // Create parent directories if needed
    if let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::ToolExecutionFailed(format!("Failed to create directories: {e}")))?;
    }

    std::fs::write(&resolved, content)
        .map_err(|e| AppError::ToolExecutionFailed(format!("Failed to write file: {e}")))?;

    Ok(ToolExecResult {
        success: true,
        output: format!("File written: {path}"),
    })
}

fn handle_list_directory(working_dir: &str, args: &serde_json::Value) -> Result<ToolExecResult, AppError> {
    let path = args["path"]
        .as_str()
        .ok_or_else(|| AppError::ToolExecutionFailed("Missing 'path' argument".into()))?;

    let resolved = validate_path(working_dir, path)?;

    let entries = std::fs::read_dir(&resolved)
        .map_err(|e| AppError::ToolExecutionFailed(format!("Failed to read directory: {e}")))?;

    let mut lines = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| AppError::ToolExecutionFailed(e.to_string()))?;
        let meta = entry.metadata().ok();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let name = entry.file_name().to_string_lossy().to_string();

        if is_dir {
            lines.push(format!("{name}/"));
        } else {
            lines.push(format!("{name}  ({size} bytes)"));
        }
    }

    lines.sort();

    Ok(ToolExecResult {
        success: true,
        output: lines.join("\n"),
    })
}

fn handle_run_command(working_dir: &str, args: &serde_json::Value) -> Result<ToolExecResult, AppError> {
    let command = args["command"]
        .as_str()
        .ok_or_else(|| AppError::ToolExecutionFailed("Missing 'command' argument".into()))?;

    let output = Command::new("cmd")
        .args(["/C", command])
        .current_dir(working_dir)
        .output()
        .map_err(|e| AppError::ToolExecutionFailed(format!("Failed to execute command: {e}")))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    let mut result = String::new();
    if !stdout.is_empty() {
        result.push_str(&stdout);
    }
    if !stderr.is_empty() {
        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str("[stderr] ");
        result.push_str(&stderr);
    }

    // Truncate large outputs
    if result.len() > 4000 {
        result = format!("{}...\n\n[Truncated: {} total characters]", &result[..4000], result.len());
    }

    Ok(ToolExecResult {
        success: output.status.success(),
        output: if result.is_empty() {
            format!("Command completed with exit code {}", output.status.code().unwrap_or(-1))
        } else {
            result
        },
    })
}

#[tauri::command]
pub async fn execute_tool(
    tool_name: String,
    arguments: String,
    working_directory: String,
) -> Result<ToolExecResult, AppError> {
    let args: serde_json::Value = serde_json::from_str(&arguments)
        .map_err(|e| AppError::ToolExecutionFailed(format!("Invalid arguments JSON: {e}")))?;

    match tool_name.as_str() {
        "read_file" => handle_read_file(&working_directory, &args),
        "write_file" => handle_write_file(&working_directory, &args),
        "list_directory" => handle_list_directory(&working_directory, &args),
        "run_command" => handle_run_command(&working_directory, &args),
        _ => Err(AppError::ToolExecutionFailed(format!(
            "Unknown tool: {tool_name}"
        ))),
    }
}

#[tauri::command]
pub async fn select_folder() -> Result<Option<String>, AppError> {
    // This uses a simple approach - the frontend will use the dialog plugin directly
    // This command is a fallback
    Ok(None)
}
