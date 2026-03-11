fn main() {
    // Copy DLLs from binaries/ to the Cargo target directory so they sit
    // next to the sidecar exe during dev mode (bundle.resources only works
    // for production builds).
    let profile = std::env::var("PROFILE").unwrap_or_default();
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let target_dir = std::path::Path::new(&manifest_dir)
        .join("target")
        .join(&profile);
    let binaries_dir = std::path::Path::new(&manifest_dir).join("binaries");

    if binaries_dir.exists() {
        for entry in std::fs::read_dir(&binaries_dir).into_iter().flatten().flatten() {
            let path = entry.path();
            let should_copy = if cfg!(target_os = "windows") {
                    path.extension().and_then(|e| e.to_str()) == Some("dll")
                } else {
                    path.file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n.contains(".so"))
                        .unwrap_or(false)
                };
            if should_copy {
                let dest = target_dir.join(path.file_name().unwrap());
                if let Err(e) = std::fs::copy(&path, &dest) {
                    println!("cargo:warning=Failed to copy {}: {}", path.display(), e);
                }
            }
        }
    }

    println!("cargo:rerun-if-changed=binaries");

    tauri_build::build()
}
