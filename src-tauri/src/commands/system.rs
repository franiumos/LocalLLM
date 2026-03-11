use crate::models::{GpuInfo, SystemInfo};
use crate::services::detect_gpus;

#[tauri::command]
pub fn detect_gpu() -> Vec<GpuInfo> {
    detect_gpus()
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    let gpus = detect_gpus();

    // Get basic system info
    let cpu_cores = std::thread::available_parallelism()
        .map(|p| p.get() as u32)
        .unwrap_or(1);

    // For RAM info, we use a simple approach on Windows
    let (total_ram_mb, available_ram_mb) = get_ram_info();

    SystemInfo {
        gpus,
        total_ram_mb,
        available_ram_mb,
        cpu_cores,
    }
}

#[cfg(target_os = "windows")]
fn get_ram_info() -> (u64, u64) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Use PowerShell Get-CimInstance (reliable on all Windows 10/11 versions)
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_OperatingSystem | ForEach-Object { \"$($_.TotalVisibleMemorySize),$($_.FreePhysicalMemory)\" }",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
            if parts.len() >= 2 {
                let total_kb = parts[0].parse::<u64>().unwrap_or(0);
                let free_kb = parts[1].parse::<u64>().unwrap_or(0);
                if total_kb > 0 {
                    return (total_kb / 1024, free_kb / 1024);
                }
            }
        }
    }

    (0, 0)
}

#[cfg(not(target_os = "windows"))]
fn get_ram_info() -> (u64, u64) {
    if let Ok(contents) = std::fs::read_to_string("/proc/meminfo") {
        let mut total_kb: u64 = 0;
        let mut available_kb: u64 = 0;

        for line in contents.lines() {
            if line.starts_with("MemTotal:") {
                total_kb = line.split_whitespace().nth(1)
                    .and_then(|s| s.parse().ok()).unwrap_or(0);
            } else if line.starts_with("MemAvailable:") {
                available_kb = line.split_whitespace().nth(1)
                    .and_then(|s| s.parse().ok()).unwrap_or(0);
            }
            if total_kb > 0 && available_kb > 0 { break; }
        }

        if total_kb > 0 {
            return (total_kb / 1024, available_kb / 1024);
        }
    }
    (0, 0)
}
