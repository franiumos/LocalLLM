use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Failed to spawn sidecar process: {0}")]
    SidecarSpawnFailed(String),

    #[error("Server did not become healthy within the timeout period")]
    ServerStartTimeout,

    #[allow(dead_code)]
    #[error("No model is currently loaded")]
    NoModelLoaded,

    #[allow(dead_code)]
    #[error("Download failed: {0}")]
    DownloadFailed(String),

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Download not found: {0}")]
    DownloadNotFound(String),

    #[error("Tool execution failed: {0}")]
    ToolExecutionFailed(String),

    #[error("Path access denied: {0}")]
    PathAccessDenied(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Image generation failed: {0}")]
    ImageGenFailed(String),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
