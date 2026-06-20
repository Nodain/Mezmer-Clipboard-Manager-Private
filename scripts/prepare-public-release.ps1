# Builds Mezmer Clipboard and stages the MSI for GitHub Releases (public repo).
# Run from the project root: .\scripts\prepare-public-release.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ReleasePublic = Join-Path $ProjectRoot "release-public"
$ArtifactsDir = Join-Path $ReleasePublic "artifacts"

Set-Location $ProjectRoot

Write-Host "Reading version from tauri.conf.json..." -ForegroundColor Cyan
$TauriConf = Get-Content (Join-Path $ProjectRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$Version = $TauriConf.version
$ProductName = $TauriConf.productName

Write-Host "Building Mezmer Clipboard v$Version (this may take several minutes)..." -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    throw "Build failed."
}

$MsiDir = Join-Path $ProjectRoot "src-tauri\target\release\bundle\msi"
if (-not (Test-Path $MsiDir)) {
    throw "MSI output folder not found: $MsiDir"
}

$MsiFile = Get-ChildItem -Path $MsiDir -Filter "*.msi" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $MsiFile) {
    throw "No .msi file found in $MsiDir"
}

New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
$DestName = "Mezmer-Clipboard-$Version-x64.msi"
$DestPath = Join-Path $ArtifactsDir $DestName
Copy-Item -Path $MsiFile.FullName -Destination $DestPath -Force

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Staged: $DestPath" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Bump version in src-tauri/tauri.conf.json + package.json when ready for a new release."
Write-Host "  2. Open GitHub -> Mesmer-Clipboard-Manager-Releases -> Releases -> Draft new release"
Write-Host "  3. Tag: v$Version"
Write-Host "  4. Upload: $DestName"
Write-Host "  5. Publish (do not commit the .msi to git)"
Write-Host ""
Write-Host "See scripts/PUBLISH-PUBLIC-RELEASE.md for full instructions." -ForegroundColor DarkGray
