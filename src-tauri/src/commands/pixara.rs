use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::models::pixara::{GeneratedImage, ImageGenParams};
use crate::state::AppState;

#[tauri::command]
pub async fn start_image_server(
    app: AppHandle,
    state: State<'_, AppState>,
    model_path: String,
    components: Vec<(String, String)>,
    server_flags: Vec<String>,
) -> Result<(), AppError> {
    let mut generator = state.image_generator.lock().await;
    generator
        .start(&app, &model_path, components, server_flags)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn stop_image_server(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut generator = state.image_generator.lock().await;
    generator.stop()?;
    Ok(())
}

#[tauri::command]
pub async fn generate_image(
    state: State<'_, AppState>,
    params: ImageGenParams,
) -> Result<GeneratedImage, AppError> {
    let generator = state.image_generator.lock().await;
    generator.generate(&params).await
}

#[tauri::command]
pub async fn list_generated_images(
    state: State<'_, AppState>,
) -> Result<Vec<GeneratedImage>, AppError> {
    let generator = state.image_generator.lock().await;
    generator.list_images()
}

#[tauri::command]
pub async fn delete_generated_image(
    state: State<'_, AppState>,
    image_id: String,
) -> Result<(), AppError> {
    let generator = state.image_generator.lock().await;
    generator.delete_image(&image_id)
}

#[tauri::command]
pub async fn get_images_directory(
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let generator = state.image_generator.lock().await;
    Ok(generator.images_dir().to_string_lossy().to_string())
}
