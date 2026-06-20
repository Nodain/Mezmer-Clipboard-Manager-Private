# Push to https://github.com/Nodain/Mezmer-Clipboard-Manager
# Usage: .\scripts\push-repos.ps1

$ErrorActionPreference = "Stop"
$GitHubUser = "Nodain"
$Repo = "Mezmer-Clipboard-Manager"
$RepoUrl = "https://github.com/$GitHubUser/$Repo.git"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ReleasePublic = Join-Path $ProjectRoot "release-public"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git not found. Restart PowerShell after installing Git for Windows."
}

Write-Host @"

Push target: https://github.com/$GitHubUser/$Repo
When prompted for a password, use a GitHub Personal Access Token (not your account password):
  https://github.com/settings/tokens

"@ -ForegroundColor Yellow

Set-Location $ProjectRoot
if (-not (Test-Path ".git")) { throw "Run from project with git initialized." }

git remote set-url origin $RepoUrl
git add -A
git diff --cached --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    git -c user.name=$GitHubUser -c user.email="$GitHubUser@users.noreply.github.com" commit -m "Update Mezmer Clipboard"
}
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "Push failed." }

Write-Host ""
Write-Host "Code pushed: https://github.com/$GitHubUser/$Repo" -ForegroundColor Green
Write-Host ""
Write-Host "Upload the installer (Release, not git push):" -ForegroundColor Cyan
Write-Host "  https://github.com/$GitHubUser/$Repo/releases/new"
Write-Host "  Tag: v0.1.0"
Write-Host "  File: $ReleasePublic\artifacts\Mezmer-Clipboard-0.1.0-x64.msi"
Write-Host ""
