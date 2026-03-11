# Download pre-built sd-server binary for Windows
# Usage: .\download-sd-server.ps1
# This downloads from stable-diffusion.cpp releases (AVX2 build by default)

param(
    [string]$Version = "master-525-d6dd6d7",
    [string]$OutputDir = "$PSScriptRoot\..\src-tauri\binaries"
)

$ErrorActionPreference = "Stop"

$TargetTriple = "x86_64-pc-windows-msvc"
$OutputExe = Join-Path $OutputDir "sd-server-$TargetTriple.exe"

if (Test-Path $OutputExe) {
    Write-Host "sd-server already exists at $OutputExe"
    Write-Host "Delete it first if you want to re-download."
    exit 0
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# stable-diffusion.cpp release archive naming convention
$BaseUrl = "https://github.com/leejet/stable-diffusion.cpp/releases/download/$Version"

# Try multiple variants (prefer AVX2, fall back to others)
$ShortHash = ($Version -split "-")[-1]
$ZipCandidates = @(
    "sd-$Version-bin-win-avx2-x64.zip",
    "sd-$Version-bin-win-avx-x64.zip",
    "sd-$Version-bin-win-noavx-x64.zip"
)

$Downloaded = $false
$TempZip = $null

foreach ($ZipName in $ZipCandidates) {
    $DownloadUrl = "$BaseUrl/$ZipName"
    $TempZip = Join-Path $env:TEMP $ZipName

    Write-Host "Trying: $ZipName..."
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempZip -UseBasicParsing
        Write-Host "Downloaded: $ZipName"
        $Downloaded = $true
        break
    } catch {
        Write-Host "  Not found, trying next..."
    }
}

if (-not $Downloaded) {
    Write-Error "Could not find any stable-diffusion.cpp release archive for version $Version. Tried: $($ZipCandidates -join ', ')"
    Write-Host ""
    Write-Host "Check available releases at: https://github.com/leejet/stable-diffusion.cpp/releases"
    Write-Host "Then re-run with: .\download-sd-server.ps1 -Version <tag>"
    exit 1
}

$TempDir = Join-Path $env:TEMP "sd-server-extract"

Write-Host "Extracting..."
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
Expand-Archive -Path $TempZip -DestinationPath $TempDir

# Find sd.exe (the main binary — we rename it to sd-server for Tauri sidecar)
$SdExe = Get-ChildItem -Path $TempDir -Recurse -Filter "sd.exe" | Select-Object -First 1

if (-not $SdExe) {
    # Some releases name it sd-cli.exe
    $SdExe = Get-ChildItem -Path $TempDir -Recurse -Filter "sd-cli.exe" | Select-Object -First 1
}

if (-not $SdExe) {
    Write-Error "sd.exe / sd-cli.exe not found in archive! Contents:"
    Get-ChildItem -Path $TempDir -Recurse | ForEach-Object { Write-Host "  $($_.FullName)" }
    exit 1
}

# Copy as sd-server with the target triple suffix
Copy-Item $SdExe.FullName $OutputExe
Write-Host "Installed sd-server to: $OutputExe"

# Copy stable-diffusion.dll if present
$SdDll = Get-ChildItem -Path $TempDir -Recurse -Filter "stable-diffusion.dll" | Select-Object -First 1
if ($SdDll) {
    $dest = Join-Path $OutputDir "stable-diffusion.dll"
    Copy-Item $SdDll.FullName $dest
    Write-Host "Copied dependency: stable-diffusion.dll"
} else {
    Write-Warning "stable-diffusion.dll not found in archive — sd-server may not work without it."
}

# Copy any other DLLs from the archive (ggml, etc.)
$Dlls = Get-ChildItem -Path $TempDir -Recurse -Filter "*.dll" | Where-Object { $_.Name -ne "stable-diffusion.dll" }
$CopiedDlls = @()
foreach ($dll in $Dlls) {
    $dest = Join-Path $OutputDir $dll.Name
    # Don't overwrite DLLs already downloaded by llama-server script
    if (-not (Test-Path $dest)) {
        Copy-Item $dll.FullName $dest
        $CopiedDlls += $dll.Name
        Write-Host "Copied dependency: $($dll.Name)"
    } else {
        Write-Host "Skipped (already exists): $($dll.Name)"
    }
}

# Cleanup
Remove-Item -Recurse -Force $TempDir
Remove-Item -Force $TempZip

Write-Host ""
Write-Host "Done! sd-server is ready."
