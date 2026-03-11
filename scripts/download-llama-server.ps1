# Download pre-built llama-server binary for Windows
# Usage: .\download-llama-server.ps1
# This downloads the CPU-enabled Windows build from llama.cpp releases

param(
    [string]$Version = "b8215",
    [string]$OutputDir = "$PSScriptRoot\..\src-tauri\binaries"
)

$ErrorActionPreference = "Stop"

$TargetTriple = "x86_64-pc-windows-msvc"
$OutputFile = Join-Path $OutputDir "llama-server-$TargetTriple.exe"

if (Test-Path $OutputFile) {
    Write-Host "llama-server already exists at $OutputFile"
    Write-Host "Delete it first if you want to re-download."
    exit 0
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Download from llama.cpp GitHub releases
$BaseUrl = "https://github.com/ggml-org/llama.cpp/releases/download/$Version"

# Try multiple archive naming conventions (varies across llama.cpp releases)
$ZipCandidates = @(
    "llama-${Version}-bin-win-cuda-cu12.4-x64.zip",
    "llama-${Version}-bin-win-cpu-x64.zip",
    "llama-${Version}-bin-win-avx2-x64.zip",
    "llama-${Version}-bin-win-x64.zip"
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
    Write-Error "Could not find any llama.cpp release archive for version $Version. Tried: $($ZipCandidates -join ', ')"
    exit 1
}

$TempDir = Join-Path $env:TEMP "llama-server-extract"

Write-Host "Extracting..."
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
Expand-Archive -Path $TempZip -DestinationPath $TempDir

# Find llama-server.exe in the extracted files
$ServerExe = Get-ChildItem -Path $TempDir -Recurse -Filter "llama-server.exe" | Select-Object -First 1

if (-not $ServerExe) {
    Write-Error "llama-server.exe not found in archive!"
    exit 1
}

Copy-Item $ServerExe.FullName $OutputFile
Write-Host "Installed llama-server to: $OutputFile"

# Copy ALL DLLs found anywhere in the archive (recursive search)
$Dlls = Get-ChildItem -Path $TempDir -Recurse -Filter "*.dll"
$CopiedDlls = @()
foreach ($dll in $Dlls) {
    $dest = Join-Path $OutputDir $dll.Name
    Copy-Item $dll.FullName $dest
    $CopiedDlls += $dll.Name
    Write-Host "Copied dependency: $($dll.Name)"
}

# Validate critical DLLs are present
$CriticalDlls = @("ggml-base.dll", "ggml.dll", "llama.dll")
$Missing = $CriticalDlls | Where-Object { $_ -notin $CopiedDlls }
if ($Missing.Count -gt 0) {
    Write-Warning "Missing critical DLLs: $($Missing -join ', ')"
    Write-Warning "llama-server.exe may not run without these. Check the archive contents."
} else {
    Write-Host "All critical DLLs found."
}

Write-Host ""
Write-Host "Summary: copied $($CopiedDlls.Count) DLL(s): $($CopiedDlls -join ', ')"

# Cleanup
Remove-Item -Recurse -Force $TempDir
Remove-Item -Force $TempZip

Write-Host "Done! llama-server is ready."
