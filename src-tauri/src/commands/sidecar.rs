use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn start_server(
    app: AppHandle,
    state: State<'_, AppState>,
    model_path: String,
    gpu_layers: i32,
    context_size: u32,
    threads: u32,
    flash_attention: bool,
) -> Result<(), AppError> {
    let mut server = state.inference_server.lock().await;
    server
        .start(&app, &model_path, gpu_layers, context_size, threads, flash_attention)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn stop_server(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut server = state.inference_server.lock().await;
    server.stop()?;
    Ok(())
}

#[tauri::command]
pub async fn server_status(state: State<'_, AppState>) -> Result<String, AppError> {
    let server = state.inference_server.lock().await;
    if server.is_running() {
        Ok("running".to_string())
    } else {
        Ok("stopped".to_string())
    }
}
