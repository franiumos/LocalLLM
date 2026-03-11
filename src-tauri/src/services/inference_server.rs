use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

use crate::error::AppError;

pub struct InferenceServer {
    pub port: u16,
    child: Option<CommandChild>,
    model_path: Option<String>,
}

impl Default for InferenceServer {
    fn default() -> Self {
        Self {
            port: 8391,
            child: None,
            model_path: None,
        }
    }
}

impl InferenceServer {
    pub async fn start(
        &mut self,
        app: &AppHandle,
        model_path: &str,
        gpu_layers: i32,
        context_size: u32,
        threads: u32,
        flash_attention: bool,
    ) -> Result<(), AppError> {
        // Stop any existing server first
        self.stop()?;

        let mut args = vec![
            "-m".to_string(),
            model_path.to_string(),
            "--host".to_string(),
            "127.0.0.1".to_string(),
            "--port".to_string(),
            self.port.to_string(),
            "-c".to_string(),
            context_size.to_string(),
        ];

        // Only pass threads if explicitly set (0 = auto, let llama-server decide)
        if threads > 0 {
            args.push("-t".to_string());
            args.push(threads.to_string());
        }

        // Pass GPU layers if non-zero (-1 = all layers, >0 = specific count, 0 = CPU only)
        if gpu_layers != 0 {
            args.push("-ngl".to_string());
            args.push(gpu_layers.to_string());

            // Flash attention only makes sense with GPU offloading
            args.push("-fa".to_string());
            args.push(if flash_attention { "on".to_string() } else { "off".to_string() });
        }

        let sidecar_command = app
            .shell()
            .sidecar("llama-server")
            .map_err(|e| AppError::SidecarSpawnFailed(e.to_string()))?;

        // On Linux, shared libraries (.so) are installed to the resource dir
        // (e.g. /usr/lib/LocalLLM/). Set LD_LIBRARY_PATH so the sidecar can find them.
        // LOCALLLM_RESOURCE_DIR tells the wrapper script where the real binary lives
        // (the sidecar at /usr/bin/ is a wrapper that exec's the real binary from the
        // resource dir so the ggml backend loader finds .so files via /proc/self/exe).
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

        eprintln!("[inference] Starting llama-server with args: {:?}", args);

        let (rx, child) = sidecar_command
            .spawn()
            .map_err(|e| AppError::SidecarSpawnFailed(e.to_string()))?;

        // Log sidecar output in background (useful for debugging GPU/backend issues)
        tauri::async_runtime::spawn(async move {
            let mut rx = rx;
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stderr(data) => {
                        let line = String::from_utf8_lossy(&data);
                        let trimmed = line.trim();
                        if !trimmed.is_empty() {
                            eprintln!("[llama-server] {}", trimmed);
                        }
                    }
                    CommandEvent::Terminated(payload) => {
                        eprintln!("[llama-server] Process exited with code: {:?}", payload.code);
                        break;
                    }
                    _ => {}
                }
            }
        });

        self.child = Some(child);
        self.model_path = Some(model_path.to_string());

        // Wait for the server to become healthy (60s for large models on CPU)
        self.wait_for_healthy(60).await?;

        Ok(())
    }

    pub async fn wait_for_healthy(&self, timeout_secs: u64) -> Result<(), AppError> {
        let url = format!("http://127.0.0.1:{}/health", self.port);
        let client = reqwest::Client::new();
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(timeout_secs);

        loop {
            if start.elapsed() > timeout {
                return Err(AppError::ServerStartTimeout);
            }

            match client.get(&url).send().await {
                Ok(response) if response.status().is_success() => {
                    return Ok(());
                }
                _ => {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
        }
    }

    pub fn stop(&mut self) -> Result<(), AppError> {
        if let Some(child) = self.child.take() {
            child
                .kill()
                .map_err(|e| AppError::SidecarSpawnFailed(format!("Failed to kill process: {}", e)))?;
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
}
