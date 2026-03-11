use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    pub size_bytes: u64,
    pub quantization: String,
    pub downloaded_at: DateTime<Utc>,
}
