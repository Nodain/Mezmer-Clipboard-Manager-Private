# Upload the staged MSI to GitHub Releases on the public Mezmerize repo.
# Usage: .\scripts\publish-github-release.ps1 -GitHubUser Nodain

param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUser,
    [string]$PublicRepo = "Mezmerize"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$TauriConf = Get-Content (Join-Path $ProjectRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$Version = $TauriConf.version
$MsiPath = Join-Path $ProjectRoot "release-public\artifacts\Mezmerize-$Version-x64.msi"

if (-not (Test-Path $MsiPath)) {
    throw "MSI not found: $MsiPath`nRun .\scripts\prepare-public-release.ps1 first."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) not found. Install from https://cli.github.com/"
}

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Run: gh auth login"
}

$Tag = "v$Version"
$Notes = @"
## Mezmerize $Version

- Emoji picker with header search
- Klipy GIF library (API key in Settings)
- Expanded theme colors
- Separate window position per list/carousel mode
- Pinned delete confirmation
- Animated GIF paste
- Default hotkey Ctrl+Shift+V
"@

Write-Host "Publishing $Tag to $GitHubUser/$PublicRepo ..." -ForegroundColor Cyan
gh release create $Tag `
    --repo "$GitHubUser/$PublicRepo" `
    --title "Mezmerize $Version" `
    --notes $Notes `
    $MsiPath

Write-Host "Release published: https://github.com/$GitHubUser/$PublicRepo/releases/tag/$Tag" -ForegroundColor Green
