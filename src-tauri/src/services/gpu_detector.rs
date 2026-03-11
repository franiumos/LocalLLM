use crate::models::{GpuBackend, GpuInfo, GpuVendor};

pub fn detect_gpus() -> Vec<GpuInfo> {
    // Try nvidia-smi first (most precise VRAM info)
    if let Some(gpus) = detect_nvidia_gpus() {
        if !gpus.is_empty() {
            return gpus;
        }
    }

    // Fallback: WMI detection (AMD, Intel, any GPU)
    if let Some(gpus) = detect_wmi_gpus() {
        if !gpus.is_empty() {
            return gpus;
        }
    }

    Vec::new()
}

fn detect_nvidia_gpus() -> Option<Vec<GpuInfo>> {
    #[cfg(target_os = "windows")]
    let output = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("nvidia-smi")
            .args([
                "--query-gpu=name,memory.total,driver_version",
                "--format=csv,noheader",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?
    };

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total,driver_version",
            "--format=csv,noheader",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let gpus: Vec<GpuInfo> = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let vram_str = parts[1].replace(" MiB", "").replace(" MB", "");
                let vram_mb = vram_str.trim().parse::<u64>().unwrap_or(0);

                Some(GpuInfo {
                    name,
                    vendor: GpuVendor::Nvidia,
                    vram_mb,
                    backend: GpuBackend::Cuda,
                })
            } else {
                None
            }
        })
        .collect();

    Some(gpus)
}

#[cfg(target_os = "windows")]
fn detect_wmi_gpus() -> Option<Vec<GpuInfo>> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Use PowerShell's Get-CimInstance for correct 64-bit VRAM values
    // Also query CurrentBitsPerPixel to detect active/real adapters (inactive = null)
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, CurrentBitsPerPixel, AdapterDACType | ForEach-Object { \"$($_.Name),$($_.AdapterRAM),$($_.CurrentBitsPerPixel),$($_.AdapterDACType)\" }",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let gpus: Vec<GpuInfo> = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
            if parts.is_empty() {
                return None;
            }

            let name = parts[0].to_string();
            let vram_bytes = parts.get(1).and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
            let vram_mb = vram_bytes / (1024 * 1024);

            // Skip virtual/basic display adapters
            let name_lower = name.to_lowercase();
            if name_lower.contains("basic display")
                || name_lower.contains("microsoft remote")
                || name_lower.contains("virtual")
                || name_lower.contains("vnc")
                || name_lower.contains("parsec")
            {
                return None;
            }

            let (vendor, backend) = classify_gpu(&name_lower);

            Some(GpuInfo {
                name,
                vendor,
                vram_mb,
                backend,
            })
        })
        .collect();

    Some(gpus)
}

#[cfg(not(target_os = "windows"))]
fn detect_wmi_gpus() -> Option<Vec<GpuInfo>> {
    // On Linux, use lspci to detect GPUs
    let output = std::process::Command::new("lspci")
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let gpus: Vec<GpuInfo> = stdout
        .lines()
        .filter(|line| {
            let lower = line.to_lowercase();
            lower.contains("vga") || lower.contains("3d controller") || lower.contains("display controller")
        })
        .filter_map(|line| {
            // lspci format: "XX:XX.X Category: Name"
            let name = line.splitn(2, ": ").nth(1)
                .map(|s| s.trim().to_string())
                .unwrap_or_default();
            if name.is_empty() { return None; }

            let name_lower = name.to_lowercase();
            if name_lower.contains("virtual") || name_lower.contains("vnc")
                || name_lower.contains("qxl") || name_lower.contains("bochs") {
                return None;
            }

            let (vendor, backend) = classify_gpu(&name_lower);
            let vram_mb = detect_linux_vram(&vendor);

            Some(GpuInfo { name, vendor, vram_mb, backend })
        })
        .collect();

    if gpus.is_empty() { None } else { Some(gpus) }
}

#[cfg(not(target_os = "windows"))]
fn detect_linux_vram(vendor: &GpuVendor) -> u64 {
    // For AMD: try /sys/class/drm/card*/device/mem_info_vram_total
    if *vendor == GpuVendor::Amd {
        if let Ok(entries) = std::fs::read_dir("/sys/class/drm") {
            for entry in entries.flatten() {
                let vram_path = entry.path().join("device").join("mem_info_vram_total");
                if vram_path.exists() {
                    if let Ok(contents) = std::fs::read_to_string(&vram_path) {
                        if let Ok(bytes) = contents.trim().parse::<u64>() {
                            return bytes / (1024 * 1024);
                        }
                    }
                }
            }
        }
    }
    // NVIDIA VRAM is already detected via nvidia-smi in detect_nvidia_gpus()
    // Intel iGPUs share system RAM — return 0
    0
}

fn classify_gpu(name_lower: &str) -> (GpuVendor, GpuBackend) {
    if name_lower.contains("nvidia")
        || name_lower.contains("geforce")
        || name_lower.contains("quadro")
        || name_lower.contains("tesla")
        || name_lower.contains("rtx")
        || name_lower.contains("gtx")
    {
        (GpuVendor::Nvidia, GpuBackend::Vulkan)
    } else if name_lower.contains("amd")
        || name_lower.contains("radeon")
        || name_lower.contains("rx ")
        || name_lower.contains("vega")
        || name_lower.contains("navi")
    {
        (GpuVendor::Amd, GpuBackend::Vulkan)
    } else if name_lower.contains("intel")
        || name_lower.contains("arc ")
        || name_lower.contains("iris")
        || name_lower.contains("uhd ")
        || name_lower.contains("hd graphics")
    {
        (GpuVendor::Intel, GpuBackend::Vulkan)
    } else {
        (GpuVendor::Unknown, GpuBackend::Vulkan)
    }
}
