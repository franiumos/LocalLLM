use std::path::PathBuf;

use base64::Engine;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

use crate::error::AppError;
use crate::models::pixara::{GeneratedImage, ImageGenParams};

pub struct ImageGenerator {
    pub port: u16,
    child: Option<CommandChild>,
    model_path: Option<String>,
    images_dir: PathBuf,
}

impl ImageGenerator {
    pub fn new(images_dir: PathBuf) -> Self {
        Self {
            port: 8392,
            child: None,
            model_path: None,
            images_dir,
        }
    }

    pub async fn start(
        &mut self,
        app: &AppHandle,
        model_path: &str,
        components: Vec<(String, String)>,
        server_flags: Vec<String>,
    ) -> Result<(), AppError> {
        // Stop any existing server first
        self.stop()?;

        // Ensure images directory exists
        std::fs::create_dir_all(&self.images_dir)
            .map_err(|e| AppError::ImageGenFailed(format!("Failed to create images dir: {}", e)))?;

        let mut args = Vec::new();

        // Detect FLUX models (use --diffusion-model instead of -m)
        let is_flux = model_path.to_lowercase().contains("flux");

        if is_flux {
            args.push("--diffusion-model".to_string());
        } else {
            args.push("-m".to_string());
        }
        args.push(model_path.to_string());

        // Add component paths (clip_l, clip_g, t5xxl, vae, etc.)
        for (comp_type, comp_path) in &components {
            match comp_type.as_str() {
                "clip_l" => {
                    args.push("--clip_l".to_string());
                    args.push(comp_path.clone());
                }
                "clip_g" => {
                    args.push("--clip_g".to_string());
                    args.push(comp_path.clone());
                }
                "t5xxl" => {
                    args.push("--t5xxl".to_string());
                    args.push(comp_path.clone());
                }
                "vae" => {
                    args.push("--vae".to_string());
                    args.push(comp_path.clone());
                }
                _ => {
                    eprintln!("[pixara] Unknown component type: {}", comp_type);
                }
            }
        }

        // Add extra server flags (--clip-on-cpu, --diffusion-fa, etc.)
        for flag in &server_flags {
            args.push(flag.clone());
        }

        // Standard network args
        args.push("--listen-port".to_string());
        args.push(self.port.to_string());
        args.push("-l".to_string());
        args.push("127.0.0.1".to_string());
        args.push("-v".to_string());

        let sidecar_command = app
            .shell()
            .sidecar("sd-server")
            .map_err(|e| AppError::ImageGenFailed(format!("Failed to create sd-server sidecar: {}", e)))?;

        // On Linux, shared libraries (.so) are installed to the resource dir
        // (e.g. /usr/lib/LocalLLM/). Set LD_LIBRARY_PATH so the sidecar can find them.
        // LOCALLLM_RESOURCE_DIR tells the wrapper script where the real binary lives.
        #[cfg(target_os = "linux")]
        let sidecar_command = {
            let resource_dir = app.path().resource_dir()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let existing = std::env::var("LD_LIBRARY_PATH").unwrap_or_default();
            let ld_path = if existing.is_empty() {
                resource_dir.clone()
            } else {
                format!("{}:{}", resource_dir, existing)
            };
            sidecar_command
                .env("LD_LIBRARY_PATH", ld_path)
                .env("LOCALLLM_RESOURCE_DIR", &resource_dir)
        };

        let sidecar_command = sidecar_command.args(&args);

        self.log(&format!("Starting sd-server with args: {:?}", args));

        let (rx, child) = sidecar_command
            .spawn()
            .map_err(|e| AppError::ImageGenFailed(format!("Failed to spawn sd-server: {}", e)))?;

        // Log sidecar output in background (write to log file)
        let log_path = self.images_dir.join("sd-server.log");
        tauri::async_runtime::spawn(async move {
            let mut rx = rx;
            while let Some(event) = rx.recv().await {
                let line_opt = match &event {
                    CommandEvent::Stderr(data) => {
                        let line = String::from_utf8_lossy(data);
                        let trimmed = line.trim();
                        if !trimmed.is_empty() { Some(trimmed.to_string()) } else { None }
                    }
                    CommandEvent::Stdout(data) => {
                        let line = String::from_utf8_lossy(data);
                        let trimmed = line.trim();
                        if !trimmed.is_empty() { Some(trimmed.to_string()) } else { None }
                    }
                    CommandEvent::Terminated(payload) => {
                        Some(format!("Process exited with code: {:?}", payload.code))
                    }
                    _ => None,
                };
                if let Some(line) = line_opt {
                    eprintln!("[sd-server] {}", line);
                    // Also append to log file
                    let _ = std::fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(&log_path)
                        .and_then(|mut f| {
                            use std::io::Write;
                            writeln!(f, "[{}] {}", chrono::Local::now().format("%H:%M:%S"), line)
                        });
                }
                if matches!(event, CommandEvent::Terminated(_)) {
                    break;
                }
            }
        });

        self.child = Some(child);
        self.model_path = Some(model_path.to_string());

        // Wait for the server to become healthy (300s — multi-component models can take a while)
        self.wait_for_healthy(300).await?;

        Ok(())
    }

    pub async fn wait_for_healthy(&self, timeout_secs: u64) -> Result<(), AppError> {
        // sd-server doesn't have a /health endpoint, so we try a lightweight request
        // We'll try GET on the root endpoint
        let url = format!("http://127.0.0.1:{}/", self.port);
        let client = reqwest::Client::new();
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(timeout_secs);

        loop {
            if start.elapsed() > timeout {
                return Err(AppError::ImageGenFailed(
                    "sd-server did not become healthy within timeout".to_string(),
                ));
            }

            match client.get(&url).send().await {
                Ok(_) => {
                    self.log("sd-server is ready");
                    return Ok(());
                }
                _ => {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
        }
    }

    pub async fn generate(
        &self,
        params: &ImageGenParams,
    ) -> Result<GeneratedImage, AppError> {
        if !self.is_running() {
            return Err(AppError::ImageGenFailed("sd-server is not running".to_string()));
        }

        let model_filename = self
            .model_path
            .as_ref()
            .and_then(|p| {
                std::path::Path::new(p)
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string())
            })
            .unwrap_or_else(|| "unknown".to_string());

        let url = format!("http://127.0.0.1:{}/v1/images/generations", self.port);

        let size = format!("{}x{}", params.width, params.height);

        // Build the request body — all params at top level for sd-server compatibility
        let mut body = serde_json::json!({
            "prompt": params.prompt,
            "size": size,
            "response_format": "b64_json",
            "n": 1,
            "sample_steps": params.steps,
            "cfg_scale": params.cfg_scale,
        });

        if !params.negative_prompt.is_empty() {
            body["negative_prompt"] = serde_json::Value::String(params.negative_prompt.clone());
        }

        if params.seed >= 0 {
            body["seed"] = serde_json::Value::Number(serde_json::Number::from(params.seed));
        }

        if !params.sampling_method.is_empty() {
            body["sample_method"] = serde_json::Value::String(params.sampling_method.clone());
        }

        self.log(&format!("Generating image with params: {}", body));

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(600)) // 10 min timeout for generation
            .build()
            .map_err(|e| AppError::ImageGenFailed(format!("HTTP client error: {}", e)))?;

        let response = client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ImageGenFailed(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AppError::ImageGenFailed(format!(
                "sd-server returned {}: {}",
                status, text
            )));
        }

        let resp_text = response
            .text()
            .await
            .map_err(|e| AppError::ImageGenFailed(format!("Failed to read response: {}", e)))?;

        // Write raw response to debug log file (console output is invisible on Windows GUI apps)
        let debug_log = self.images_dir.join("last_response.json");
        let _ = std::fs::write(&debug_log, &resp_text);
        self.log(&format!("Raw response written to {} ({} bytes)", debug_log.display(), resp_text.len()));

        let resp_json: serde_json::Value = serde_json::from_str(&resp_text)
            .map_err(|e| AppError::ImageGenFailed(format!("Failed to parse response JSON: {} — raw: {}", e, &resp_text[..resp_text.len().min(500)])))?;

        // Extract base64 image data — try multiple formats
        // Format 1: OpenAI standard { "data": [{ "b64_json": "..." }] }
        // Format 2: Some sd.cpp versions { "data": [{ "b64": "..." }] }
        // Format 3: Some sd.cpp versions return data items as strings
        let b64_data = resp_json["data"][0]["b64_json"]
            .as_str()
            .or_else(|| resp_json["data"][0]["b64"].as_str())
            .or_else(|| resp_json["data"][0]["base64"].as_str())
            .or_else(|| {
                // Some versions return data items as plain strings
                resp_json["data"][0].as_str()
            })
            .ok_or_else(|| {
                // Build a detailed diagnostic message
                let data_info = if let Some(arr) = resp_json["data"].as_array() {
                    if arr.is_empty() {
                        "data is empty array []".to_string()
                    } else {
                        let first = &arr[0];
                        if let Some(obj) = first.as_object() {
                            format!("data[0] keys: {:?}, values preview: {}",
                                obj.keys().collect::<Vec<_>>(),
                                // Show truncated preview of each value
                                obj.iter().map(|(k, v)| {
                                    let vs = v.to_string();
                                    format!("{}={}", k, &vs[..vs.len().min(100)])
                                }).collect::<Vec<_>>().join(", ")
                            )
                        } else {
                            format!("data[0] type: {}, value: {}",
                                if first.is_string() { "string" }
                                else if first.is_number() { "number" }
                                else if first.is_null() { "null" }
                                else { "other" },
                                &first.to_string()[..first.to_string().len().min(200)]
                            )
                        }
                    }
                } else {
                    format!("data is not an array: {}", &resp_json["data"].to_string()[..resp_json["data"].to_string().len().min(200)])
                };

                AppError::ImageGenFailed(format!(
                    "No image data in response. Top keys: {:?}. {}",
                    resp_json.as_object().map(|o| o.keys().collect::<Vec<_>>()).unwrap_or_default(),
                    data_info
                ))
            })?;

        // Decode and save to file
        let image_id = uuid::Uuid::new_v4().to_string();
        let filename = format!("img_{}.png", &image_id[..8]);
        let filepath = self.images_dir.join(&filename);

        let image_data = base64::engine::general_purpose::STANDARD
            .decode(b64_data)
            .map_err(|e| AppError::ImageGenFailed(format!("Failed to decode image: {}", e)))?;

        std::fs::write(&filepath, &image_data)
            .map_err(|e| AppError::ImageGenFailed(format!("Failed to save image: {}", e)))?;

        let generated = GeneratedImage {
            id: image_id,
            filename: filename.clone(),
            prompt: params.prompt.clone(),
            negative_prompt: params.negative_prompt.clone(),
            width: params.width,
            height: params.height,
            steps: params.steps,
            cfg_scale: params.cfg_scale,
            seed: params.seed,
            model_filename,
            created_at: chrono::Utc::now().to_rfc3339(),
            filepath: filepath.to_string_lossy().to_string(),
        };

        // Save metadata
        self.save_metadata(&generated)?;

        self.log(&format!("Image saved to {}", filepath.display()));

        Ok(generated)
    }

    fn save_metadata(&self, image: &GeneratedImage) -> Result<(), AppError> {
        let metadata_path = self.images_dir.join("metadata.json");
        let mut images: Vec<GeneratedImage> = if metadata_path.exists() {
            let data = std::fs::read_to_string(&metadata_path)?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Vec::new()
        };

        images.push(image.clone());

        let json = serde_json::to_string_pretty(&images)?;
        std::fs::write(&metadata_path, json)?;

        Ok(())
    }

    pub fn list_images(&self) -> Result<Vec<GeneratedImage>, AppError> {
        let metadata_path = self.images_dir.join("metadata.json");
        if !metadata_path.exists() {
            return Ok(Vec::new());
        }

        let data = std::fs::read_to_string(&metadata_path)?;
        let images: Vec<GeneratedImage> = serde_json::from_str(&data).unwrap_or_default();
        Ok(images)
    }

    pub fn delete_image(&self, image_id: &str) -> Result<(), AppError> {
        let metadata_path = self.images_dir.join("metadata.json");
        if !metadata_path.exists() {
            return Err(AppError::ImageGenFailed("No images found".to_string()));
        }

        let data = std::fs::read_to_string(&metadata_path)?;
        let mut images: Vec<GeneratedImage> = serde_json::from_str(&data).unwrap_or_default();

        let idx = images
            .iter()
            .position(|img| img.id == image_id)
            .ok_or_else(|| AppError::ImageGenFailed(format!("Image not found: {}", image_id)))?;

        let image = images.remove(idx);

        // Delete the image file
        let filepath = self.images_dir.join(&image.filename);
        if filepath.exists() {
            std::fs::remove_file(&filepath)?;
        }

        // Save updated metadata
        let json = serde_json::to_string_pretty(&images)?;
        std::fs::write(&metadata_path, json)?;

        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), AppError> {
        if let Some(child) = self.child.take() {
            child
                .kill()
                .map_err(|e| AppError::ImageGenFailed(format!("Failed to kill sd-server: {}", e)))?;
        }
        self.model_path = None;
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.child.is_some()
    }

    #[allow(dead_code)]
    pub fn current_model(&self) -> Option<&str> {
        self.model_path.as_deref()
    }

    pub fn images_dir(&self) -> &PathBuf {
        &self.images_dir
    }

    /// Write a log line to both stderr and a persistent log file in images_dir.
    /// On Windows GUI apps, stderr is invisible, so the file is the primary output.
    fn log(&self, msg: &str) {
        let line = format!("[pixara] {}", msg);
        eprintln!("{}", line);
        let log_path = self.images_dir.join("pixara.log");
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .and_then(|mut f| {
                use std::io::Write;
                writeln!(f, "[{}] {}", chrono::Local::now().format("%H:%M:%S"), msg)
            });
    }
}
