# Download all sidecar binaries for LocalLLM
# Usage: .\download-binaries.ps1
# This downloads llama-server, sd-server, and all required DLLs.

param(
    [string]$LlamaVersion = "b8215",
    [string]$SdVersion = "master-525-d6dd6d7"
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot

Write-Host "========================================="
Write-Host "  LocalLLM — Sidecar Binary Downloader"
Write-Host "========================================="
Write-Host ""

# Step 1: Download llama-server + GGML DLLs
Write-Host "[1/2] Downloading llama-server (llama.cpp $LlamaVersion)..."
Write-Host "-------------------------------------------"
& "$ScriptDir\download-llama-server.ps1" -Version $LlamaVersion
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    Write-Error "llama-server download failed!"
    exit 1
}

Write-Host ""

# Step 2: Download sd-server + stable-diffusion.dll
Write-Host "[2/2] Downloading sd-server (stable-diffusion.cpp $SdVersion)..."
Write-Host "-------------------------------------------"
& "$ScriptDir\download-sd-server.ps1" -Version $SdVersion
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    Write-Error "sd-server download failed!"
    exit 1
}

Write-Host ""

# Verify
$BinDir = Join-Path $ScriptDir "..\src-tauri\binaries"
$TargetTriple = "x86_64-pc-windows-msvc"

$RequiredFiles = @(
    "llama-server-$TargetTriple.exe",
    "sd-server-$TargetTriple.exe",
    "llama.dll",
    "ggml.dll",
    "ggml-base.dll",
    "stable-diffusion.dll"
)

Write-Host "========================================="
Write-Host "  Verification"
Write-Host "========================================="

$AllGood = $true
foreach ($file in $RequiredFiles) {
    $path = Join-Path $BinDir $file
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        $sizeMB = [math]::Round($size / 1MB, 1)
        Write-Host "  [OK]  $file ($sizeMB MB)"
    } else {
        Write-Host "  [MISSING]  $file"
        $AllGood = $false
    }
}

$AllDlls = Get-ChildItem -Path $BinDir -Filter "*.dll" | Measure-Object
$AllExes = Get-ChildItem -Path $BinDir -Filter "*.exe" | Measure-Object
$TotalSize = (Get-ChildItem -Path $BinDir -File | Measure-Object -Property Length -Sum).Sum
$TotalMB = [math]::Round($TotalSize / 1MB, 1)

Write-Host ""
Write-Host "Total: $($AllExes.Count) executables, $($AllDlls.Count) DLLs ($TotalMB MB)"

if ($AllGood) {
    Write-Host ""
    Write-Host "All binaries are ready! You can now run: npm run tauri dev"
} else {
    Write-Host ""
    Write-Warning "Some files are missing. Check the errors above."
    exit 1
}
