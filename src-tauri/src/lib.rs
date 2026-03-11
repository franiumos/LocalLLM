mod commands;
mod error;
mod models;
mod services;
mod state;

use std::sync::Arc;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::Manager;

use services::{detect_gpus, load_settings, get_models_dir, open_database, DownloadManager};

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Ensure ~/.localllm/models/ exists
            let settings = load_settings();
            let _models_dir = get_models_dir(&settings);

            // Detect GPU
            let gpus = detect_gpus();

            // Open conversations database
            let db = open_database().expect("Failed to open conversations database");

            // Create images directory
            let localllm_dir = dirs::home_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join(".localllm");
            let images_dir = localllm_dir.join("images");
            std::fs::create_dir_all(&images_dir).ok();

            // Create app state
            let state = AppState {
                inference_server: Arc::new(tokio::sync::Mutex::new(
                    services::InferenceServer::default(),
                )),
                image_generator: Arc::new(tokio::sync::Mutex::new(
                    services::ImageGenerator::new(images_dir),
                )),
                settings: Arc::new(tokio::sync::Mutex::new(settings)),
                gpu_info: Arc::new(gpus),
                download_manager: Arc::new(DownloadManager::new()),
                db: Arc::new(tokio::sync::Mutex::new(db)),
            };

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_server,
            commands::stop_server,
            commands::server_status,
            commands::detect_gpu,
            commands::get_system_info,
            commands::get_settings,
            commands::save_settings_cmd,
            commands::list_local_models,
            commands::delete_model,
            commands::get_storage_usage,
            commands::start_download,
            commands::pause_download,
            commands::resume_download,
            commands::cancel_download,
            commands::move_models_directory,
            commands::list_conversations,
            commands::create_conversation_cmd,
            commands::get_conversation_messages,
            commands::save_message,
            commands::update_conversation_title_cmd,
            commands::delete_conversation_cmd,
            commands::delete_all_conversations_cmd,
            commands::execute_tool,
            commands::select_folder,
            commands::start_image_server,
            commands::stop_image_server,
            commands::generate_image,
            commands::list_generated_images,
            commands::delete_generated_image,
            commands::get_images_directory,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                eprintln!("[app] Exit event — cleaning up servers...");

                // Stop inference server (llama-server)
                let state = app.state::<AppState>();
                if let Ok(mut server) = state.inference_server.try_lock() {
                    if let Err(e) = server.stop() {
                        eprintln!("[app] Failed to stop inference server: {}", e);
                    }
                }

                // Stop image generator (sd-server)
                if let Ok(mut generator) = state.image_generator.try_lock() {
                    if let Err(e) = generator.stop() {
                        eprintln!("[app] Failed to stop image generator: {}", e);
                    }
                }

                // Safety net: kill any orphaned processes by name
                kill_orphaned_processes();
            }
        });
}

/// Kill any leftover llama-server or sd-server processes spawned by this app.
fn kill_orphaned_processes() {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        for name in &["llama-server.exe", "sd-server.exe"] {
            let _ = Command::new("taskkill")
                .args(["/F", "/IM", name])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output();
        }
        eprintln!("[app] Orphaned process cleanup done");
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        for name in &["llama-server", "sd-server"] {
            let _ = Command::new("pkill")
                .args(["-f", name])
                .output();
        }
        eprintln!("[app] Orphaned process cleanup done");
    }
}
