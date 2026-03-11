use std::sync::Arc;
use tokio::sync::Mutex;

use rusqlite::Connection;

use crate::models::{AppSettings, GpuInfo};
use crate::services::{DownloadManager, ImageGenerator, InferenceServer};

pub struct AppState {
    pub inference_server: Arc<Mutex<InferenceServer>>,
    pub image_generator: Arc<Mutex<ImageGenerator>>,
    pub settings: Arc<Mutex<AppSettings>>,
    #[allow(dead_code)]
    pub gpu_info: Arc<Vec<GpuInfo>>,
    pub download_manager: Arc<DownloadManager>,
    pub db: Arc<Mutex<Connection>>,
}
