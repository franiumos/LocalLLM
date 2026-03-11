use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::StreamExt;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use tokio::sync::{Mutex, Notify};

use crate::error::AppError;
use crate::models::download::{DownloadProgress, DownloadStatus};

struct DownloadTask {
    #[allow(dead_code)]
    id: String,
    filename: String,
    cancel: Arc<AtomicBool>,
    pause_flag: Arc<AtomicBool>,
    pause_notify: Arc<Notify>,
}

pub struct DownloadManager {
    downloads: Arc<Mutex<HashMap<String, DownloadTask>>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            downloads: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_download(
        &self,
        app: AppHandle,
        url: String,
        filename: String,
        models_dir: PathBuf,
    ) -> Result<String, AppError> {
        let id = uuid::Uuid::new_v4().to_string();
        let dest_path = models_dir.join(&filename);
        let part_path = dest_path.with_extension("gguf.part");

        // Check if already downloading this file
        {
            let tasks = self.downloads.lock().await;
            for task in tasks.values() {
                if task.filename == filename {
                    return Err(AppError::DownloadFailed(format!(
                        "Already downloading: {}",
                        filename
                    )));
                }
            }
        }

        let cancel = Arc::new(AtomicBool::new(false));
        let pause_flag = Arc::new(AtomicBool::new(false));
        let pause_notify = Arc::new(Notify::new());

        let task = DownloadTask {
            id: id.clone(),
            filename: filename.clone(),
            cancel: cancel.clone(),
            pause_flag: pause_flag.clone(),
            pause_notify: pause_notify.clone(),
        };

        self.downloads.lock().await.insert(id.clone(), task);

        let downloads = self.downloads.clone();
        let return_id = id.clone();

        // Check for existing .part file to resume
        let initial_offset = if part_path.exists() {
            tokio::fs::metadata(&part_path)
                .await
                .map(|m| m.len())
                .unwrap_or(0)
        } else {
            0
        };

        tokio::spawn(async move {
            let result = download_loop(
                &app,
                &id,
                &url,
                &filename,
                &dest_path,
                &part_path,
                initial_offset,
                cancel,
                pause_flag,
                pause_notify,
            )
            .await;

            // Clean up task entry
            downloads.lock().await.remove(&id);

            if let Err(e) = result {
                let _ = app.emit(
                    "download:failed",
                    serde_json::json!({ "id": id, "filename": filename, "error": e.to_string() }),
                );
            }
        });

        Ok(return_id)
    }

    pub async fn pause_download(&self, id: &str) -> Result<(), AppError> {
        let tasks = self.downloads.lock().await;
        let task = tasks
            .get(id)
            .ok_or_else(|| AppError::DownloadNotFound(id.to_string()))?;
        task.pause_flag.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub async fn resume_download(&self, id: &str) -> Result<(), AppError> {
        let tasks = self.downloads.lock().await;
        let task = tasks
            .get(id)
            .ok_or_else(|| AppError::DownloadNotFound(id.to_string()))?;
        task.pause_flag.store(false, Ordering::SeqCst);
        task.pause_notify.notify_one();
        Ok(())
    }

    pub async fn cancel_download(&self, id: &str) -> Result<(), AppError> {
        let tasks = self.downloads.lock().await;
        let task = tasks
            .get(id)
            .ok_or_else(|| AppError::DownloadNotFound(id.to_string()))?;
        // Unblock if paused so the loop can exit
        task.pause_flag.store(false, Ordering::SeqCst);
        task.cancel.store(true, Ordering::SeqCst);
        task.pause_notify.notify_one();
        Ok(())
    }
}

async fn download_loop(
    app: &AppHandle,
    id: &str,
    url: &str,
    filename: &str,
    dest_path: &PathBuf,
    part_path: &PathBuf,
    initial_offset: u64,
    cancel: Arc<AtomicBool>,
    pause_flag: Arc<AtomicBool>,
    pause_notify: Arc<Notify>,
) -> Result<(), AppError> {
    let client = reqwest::Client::builder()
        .user_agent("LocalLLM/0.1.0")
        .build()?;

    let mut request = client.get(url);
    if initial_offset > 0 {
        request = request.header("Range", format!("bytes={}-", initial_offset));
    }

    let response = request.send().await?;

    if !response.status().is_success() && response.status().as_u16() != 206 {
        return Err(AppError::DownloadFailed(format!(
            "HTTP {}",
            response.status()
        )));
    }

    let total_bytes = if initial_offset > 0 {
        // For range requests, total = offset + remaining content length
        initial_offset + response.content_length().unwrap_or(0)
    } else {
        response.content_length().unwrap_or(0)
    };

    // Open file for appending (or create if new)
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(part_path)
        .await?;

    let mut stream = response.bytes_stream();
    let mut bytes_downloaded = initial_offset;
    let mut speed_tracker = SpeedTracker::new();
    let mut last_emit = Instant::now();

    // Emit initial progress
    let _ = app.emit(
        "download:progress",
        DownloadProgress {
            id: id.to_string(),
            filename: filename.to_string(),
            bytes_downloaded,
            total_bytes,
            speed_bps: 0,
            eta_seconds: 0,
            status: DownloadStatus::Downloading,
        },
    );

    while let Some(chunk_result) = stream.next().await {
        // Check cancel
        if cancel.load(Ordering::SeqCst) {
            drop(file);
            let _ = tokio::fs::remove_file(part_path).await;
            let _ = app.emit(
                "download:failed",
                serde_json::json!({ "id": id, "filename": filename }),
            );
            return Ok(());
        }

        // Check pause
        if pause_flag.load(Ordering::SeqCst) {
            let _ = app.emit(
                "download:progress",
                DownloadProgress {
                    id: id.to_string(),
                    filename: filename.to_string(),
                    bytes_downloaded,
                    total_bytes,
                    speed_bps: 0,
                    eta_seconds: 0,
                    status: DownloadStatus::Paused,
                },
            );
            file.flush().await?;
            pause_notify.notified().await;

            // After resume, check if we were actually cancelled
            if cancel.load(Ordering::SeqCst) {
                drop(file);
                let _ = tokio::fs::remove_file(part_path).await;
                let _ = app.emit(
                    "download:failed",
                    serde_json::json!({ "id": id, "filename": filename }),
                );
                return Ok(());
            }

            speed_tracker = SpeedTracker::new(); // Reset speed after pause
        }

        let chunk = chunk_result?;
        file.write_all(&chunk).await?;
        bytes_downloaded += chunk.len() as u64;
        speed_tracker.record(chunk.len() as u64);

        // Throttle event emission to every 500ms
        if last_emit.elapsed() >= Duration::from_millis(500) {
            let speed = speed_tracker.speed_bps();
            let eta = if speed > 0 {
                ((total_bytes.saturating_sub(bytes_downloaded)) as f64 / speed as f64) as u64
            } else {
                0
            };

            let _ = app.emit(
                "download:progress",
                DownloadProgress {
                    id: id.to_string(),
                    filename: filename.to_string(),
                    bytes_downloaded,
                    total_bytes,
                    speed_bps: speed,
                    eta_seconds: eta,
                    status: DownloadStatus::Downloading,
                },
            );
            last_emit = Instant::now();
        }
    }

    // Flush and close
    file.flush().await?;
    drop(file);

    // Rename .part to final file
    tokio::fs::rename(part_path, dest_path).await?;

    // Emit completion
    let _ = app.emit(
        "download:complete",
        serde_json::json!({ "id": id }),
    );

    Ok(())
}

/// Rolling-window speed tracker for smooth speed/ETA display.
struct SpeedTracker {
    samples: VecDeque<(Instant, u64)>,
    cumulative: u64,
    window: Duration,
}

impl SpeedTracker {
    fn new() -> Self {
        Self {
            samples: VecDeque::new(),
            cumulative: 0,
            window: Duration::from_secs(5),
        }
    }

    fn record(&mut self, bytes: u64) {
        self.cumulative += bytes;
        self.samples.push_back((Instant::now(), self.cumulative));
        self.prune();
    }

    fn prune(&mut self) {
        let cutoff = Instant::now() - self.window;
        while let Some((t, _)) = self.samples.front() {
            if *t < cutoff {
                self.samples.pop_front();
            } else {
                break;
            }
        }
    }

    fn speed_bps(&self) -> u64 {
        if self.samples.len() < 2 {
            return 0;
        }
        let (t_first, b_first) = self.samples.front().unwrap();
        let (t_last, b_last) = self.samples.back().unwrap();
        let elapsed = t_last.duration_since(*t_first).as_secs_f64();
        if elapsed > 0.0 {
            ((b_last - b_first) as f64 / elapsed) as u64
        } else {
            0
        }
    }
}
