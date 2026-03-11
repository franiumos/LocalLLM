use tauri::State;

use crate::error::AppError;
use crate::models::conversation::{Conversation, Message};
use crate::services::database;
use crate::state::AppState;

#[tauri::command]
pub async fn list_conversations(
    state: State<'_, AppState>,
) -> Result<Vec<Conversation>, AppError> {
    let conn = state.db.lock().await;
    database::list_conversations(&conn)
}

#[tauri::command]
pub async fn create_conversation_cmd(
    state: State<'_, AppState>,
    conversation: Conversation,
) -> Result<(), AppError> {
    let conn = state.db.lock().await;
    database::create_conversation(&conn, &conversation)
}

#[tauri::command]
pub async fn get_conversation_messages(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<Message>, AppError> {
    let conn = state.db.lock().await;
    database::get_messages(&conn, &conversation_id)
}

#[tauri::command]
pub async fn save_message(
    state: State<'_, AppState>,
    message: Message,
) -> Result<(), AppError> {
    let conn = state.db.lock().await;
    database::insert_message(&conn, &message)
}

#[tauri::command]
pub async fn update_conversation_title_cmd(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().await;
    database::update_conversation_title(&conn, &id, &title)
}

#[tauri::command]
pub async fn delete_conversation_cmd(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let conn = state.db.lock().await;
    database::delete_conversation(&conn, &id)
}

#[tauri::command]
pub async fn delete_all_conversations_cmd(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let conn = state.db.lock().await;
    database::delete_all_conversations(&conn)
}
