use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub inference: InferenceSettings,
    pub hardware: HardwareSettings,
    pub storage: StorageSettings,
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub privacy: PrivacySettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            inference: InferenceSettings::default(),
            hardware: HardwareSettings::default(),
            storage: StorageSettings::default(),
            appearance: AppearanceSettings::default(),
            privacy: PrivacySettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceSettings {
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default = "default_top_p")]
    pub top_p: f32,
    #[serde(default = "default_context_size")]
    pub context_size: u32,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default)]
    pub system_prompt: String,
}

fn default_temperature() -> f32 {
    0.7
}

fn default_top_p() -> f32 {
    0.9
}

fn default_context_size() -> u32 {
    4096
}

fn default_max_tokens() -> u32 {
    2048
}

impl Default for InferenceSettings {
    fn default() -> Self {
        Self {
            temperature: default_temperature(),
            top_p: default_top_p(),
            context_size: default_context_size(),
            max_tokens: default_max_tokens(),
            system_prompt: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareSettings {
    #[serde(default = "default_gpu_layers")]
    pub gpu_layers: i32,
    #[serde(default)]
    pub threads: u32,
    #[serde(default = "default_flash_attention")]
    pub flash_attention: bool,
    #[serde(default)]
    pub ram_limit_gb: Option<f32>,
}

fn default_gpu_layers() -> i32 {
    -1
}

fn default_flash_attention() -> bool {
    true
}

impl Default for HardwareSettings {
    fn default() -> Self {
        Self {
            gpu_layers: default_gpu_layers(),
            threads: 0,
            flash_attention: default_flash_attention(),
            ram_limit_gb: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageSettings {
    #[serde(default = "default_models_directory")]
    pub models_directory: String,
    #[serde(default)]
    pub max_storage_gb: Option<f32>,
}

fn default_models_directory() -> String {
    let home = dirs::home_dir().unwrap_or_default();
    home.join(".localllm")
        .join("models")
        .to_string_lossy()
        .to_string()
}

impl Default for StorageSettings {
    fn default() -> Self {
        Self {
            models_directory: default_models_directory(),
            max_storage_gb: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettings {
    #[serde(default)]
    pub theme: Theme,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
}

fn default_font_size() -> u32 {
    14
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: Theme::default(),
            font_size: default_font_size(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    Light,
    Dark,
    System,
}

fn default_save_chat_history() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySettings {
    #[serde(default = "default_save_chat_history")]
    pub save_chat_history: bool,
}

impl Default for PrivacySettings {
    fn default() -> Self {
        Self {
            save_chat_history: default_save_chat_history(),
        }
    }
}
