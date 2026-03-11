use chrono::{DateTime, Utc};

use crate::error::AppError;
use crate::models::ModelMetadata;
use crate::services::settings_manager;

#[tauri::command]
pub fn list_local_models() -> Result<Vec<ModelMetadata>, AppError> {
    let settings = settings_manager::load_settings();
    let models_dir = settings_manager::get_models_dir(&settings);

    let mut models = Vec::new();

    if !models_dir.exists() {
        return Ok(models);
    }

    let entries = std::fs::read_dir(&models_dir)?;
    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if let Some(ext) = path.extension() {
            if ext == "gguf" {
                let metadata = entry.metadata()?;
                let filename = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                // Try to extract quantization from filename (e.g., Q4_K_M)
                let quantization = extract_quantization(&filename);

                // Use file modified time as downloaded_at
                let downloaded_at: DateTime<Utc> = metadata
                    .modified()
                    .map(|t| t.into())
                    .unwrap_or_else(|_| Utc::now());

                models.push(ModelMetadata {
                    id: uuid::Uuid::new_v4().to_string(),
                    filename: filename.clone(),
                    filepath: path.to_string_lossy().to_string(),
                    size_bytes: metadata.len(),
                    quantization,
                    downloaded_at,
                });
            }
        }
    }

    Ok(models)
}

fn extract_quantization(filename: &str) -> String {
    let upper = filename.to_uppercase();
    let patterns = [
        "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_0", "Q4_1", "Q4_K_S", "Q4_K_M",
        "Q5_0", "Q5_1", "Q5_K_S", "Q5_K_M", "Q6_K", "Q8_0", "F16", "F32",
        "IQ1_S", "IQ1_M", "IQ2_XXS", "IQ2_XS", "IQ2_S", "IQ2_M",
        "IQ3_XXS", "IQ3_XS", "IQ3_S", "IQ3_M", "IQ4_NL", "IQ4_XS",
    ];

    for pattern in &patterns {
        if upper.contains(pattern) {
            return pattern.to_string();
        }
    }

    "Unknown".to_string()
}

#[tauri::command]
pub fn delete_model(filename: String) -> Result<(), AppError> {
    let settings = settings_manager::load_settings();
    let models_dir = settings_manager::get_models_dir(&settings);
    let filepath = models_dir.join(&filename);

    if !filepath.exists() {
        return Err(AppError::ModelNotFound(filename));
    }

    std::fs::remove_file(&filepath)?;
    Ok(())
}

#[tauri::command]
pub fn get_storage_usage() -> Result<(u64, u64), AppError> {
    let settings = settings_manager::load_settings();
    let models_dir = settings_manager::get_models_dir(&settings);

    let mut used_bytes: u64 = 0;

    if models_dir.exists() {
        for entry in std::fs::read_dir(&models_dir)? {
            let entry = entry?;
            if let Ok(metadata) = entry.metadata() {
                used_bytes += metadata.len();
            }
        }
    }

    // If max_storage_gb is set, use that as the total; otherwise use total disk space
    let total_bytes = if let Some(max_gb) = settings.storage.max_storage_gb {
        (max_gb as u64) * 1024 * 1024 * 1024
    } else {
        get_available_space(&models_dir)
    };

    Ok((used_bytes, total_bytes))
}

#[cfg(target_os = "windows")]
fn get_available_space(path: &std::path::Path) -> u64 {
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_bytes: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut _total_free: u64 = 0;

    unsafe {
        let result = GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_bytes,
            &mut total_bytes,
            &mut _total_free,
        );
        if result != 0 {
            return free_bytes;
        }
    }
    0
}

#[cfg(not(target_os = "windows"))]
fn get_available_space(path: &std::path::Path) -> u64 {
    // Use `df` to get available disk space (avoids adding libc dependency)
    let output = std::process::Command::new("df")
        .args(["--output=avail", "-B1"])
        .arg(path)
        .output()
        .ok();
    if let Some(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Skip header line, parse the available bytes
        if let Some(line) = stdout.lines().nth(1) {
            return line.trim().parse::<u64>().unwrap_or(0);
        }
    }
    0
}
