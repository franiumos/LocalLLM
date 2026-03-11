use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::services::settings_manager;
use crate::state::AppState;

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
    filename: String,
) -> Result<String, AppError> {
    // Read current models directory from settings (respects user changes)
    let settings = state.settings.lock().await;
    let models_dir = settings_manager::get_models_dir(&settings);
    drop(settings);

    state
        .download_manager
        .start_download(app, url, filename, models_dir)
        .await
}

#[tauri::command]
pub async fn pause_download(
    state: State<'_, AppState>,
    download_id: String,
) -> Result<(), AppError> {
    state.download_manager.pause_download(&download_id).await
}

#[tauri::command]
pub async fn resume_download(
    state: State<'_, AppState>,
    download_id: String,
) -> Result<(), AppError> {
    state.download_manager.resume_download(&download_id).await
}

#[tauri::command]
pub async fn cancel_download(
    state: State<'_, AppState>,
    download_id: String,
) -> Result<(), AppError> {
    state.download_manager.cancel_download(&download_id).await
}
