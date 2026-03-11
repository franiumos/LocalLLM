use std::path::PathBuf;

use crate::error::AppError;
use crate::models::AppSettings;

fn settings_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_default();
    home.join(".localllm").join("settings.json")
}

pub fn load_settings() -> AppSettings {
    let path = settings_path();
    if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str(&contents) {
                Ok(settings) => settings,
                Err(_) => AppSettings::default(),
            },
            Err(_) => AppSettings::default(),
        }
    } else {
        AppSettings::default()
    }
}

pub fn save_settings(settings: &AppSettings) -> Result<(), AppError> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(settings)?;
    std::fs::write(&path, json)?;
    Ok(())
}

pub fn get_models_dir(settings: &AppSettings) -> PathBuf {
    let dir = PathBuf::from(&settings.storage.models_directory);
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}
