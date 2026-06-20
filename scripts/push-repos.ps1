# Push PRIVATE source repo and PUBLIC release README (never push src/ to the public repo).
# Usage: .\scripts\push-repos.ps1 -GitHubUser "Nodain"

param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUser
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ReleasePublic = Join-Path $ProjectRoot "release-public"
$PrivateUrl = "https://github.com/$GitHubUser/Mezmer-Clipboard-Manager-Private.git"
$PublicUrl = "https://github.com/$GitHubUser/Mezmer-Clipboard-Manager.git"
$GitName = $GitHubUser
$GitEmail = "$GitHubUser@users.noreply.github.com"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git not found. Restart PowerShell after installing Git for Windows."
}

Write-Host @"

Private (source): $PrivateUrl
Public (README):  $PublicUrl

Use a GitHub Personal Access Token when prompted for a password:
  https://github.com/settings/tokens

"@ -ForegroundColor Yellow

Set-Location $ProjectRoot
if (-not (Test-Path ".git")) { throw "Run from project with git initialized." }

# Never commit internal design docs
if (Test-Path "clipboard_manager.md") {
    git rm --cached -f clipboard_manager.md 2>$null
}

git remote set-url origin $PrivateUrl
git add -A
git diff --cached --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    git -c user.name=$GitName -c user.email=$GitEmail commit -m "Update Mezmer Clipboard"
}
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "Private push failed. Create the private repo first: $PrivateUrl" }

Write-Host "Private source pushed." -ForegroundColor Green

Set-Location $ReleasePublic
if (-not (Test-Path ".git")) { git init | Out-Null }
git remote set-url origin $PublicUrl 2>$null
if ($LASTEXITCODE -ne 0) { git remote add origin $PublicUrl }
git add README.md .gitignore
git diff --cached --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    git -c user.name=$GitName -c user.email=$GitEmail commit -m "Update public release page"
}
git branch -M main
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "Public push failed." }

Write-Host "Public README pushed (no source)." -ForegroundColor Green
Write-Host ""
Write-Host "Upload installer (not git push):" -ForegroundColor Cyan
Write-Host "  https://github.com/$GitHubUser/Mezmer-Clipboard-Manager/releases/new"
