use std::path::Path;

use tauri::State;

use crate::error::AppError;
use crate::models::AppSettings;
use crate::services::settings_manager;
use crate::state::AppState;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    let settings = state.settings.lock().await;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn save_settings_cmd(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), AppError> {
    settings_manager::save_settings(&settings)?;
    let mut current = state.settings.lock().await;
    *current = settings;
    Ok(())
}

#[tauri::command]
pub async fn move_models_directory(
    state: State<'_, AppState>,
    old_dir: String,
    new_dir: String,
) -> Result<(), AppError> {
    let old_path = Path::new(&old_dir);
    let new_path = Path::new(&new_dir);

    // Create new directory if it doesn't exist
    std::fs::create_dir_all(new_path)?;

    // Move all .gguf and .gguf.part files
    if old_path.exists() {
        for entry in std::fs::read_dir(old_path)? {
            let entry = entry?;
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            let name = path.file_name().unwrap_or_default().to_string_lossy();

            if ext == "gguf" || name.ends_with(".gguf.part") {
                let dest = new_path.join(path.file_name().unwrap());
                // Try rename first (same drive), fall back to copy+delete (cross-drive)
                if std::fs::rename(&path, &dest).is_err() {
                    std::fs::copy(&path, &dest)?;
                    std::fs::remove_file(&path)?;
                }
            }
        }
    }

    // Update settings with new directory
    let mut settings = state.settings.lock().await;
    settings.storage.models_directory = new_dir;
    settings_manager::save_settings(&settings)?;

    Ok(())
}
