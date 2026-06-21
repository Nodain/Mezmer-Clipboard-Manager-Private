# Remove all source from the PUBLIC GitHub repo and leave only the install README.
# Rewrites remote history (orphan branch + force push) so old commits are not browsable.
#
# Usage:
#   .\scripts\clean-public-repo.ps1 -GitHubUser "Nodain"
#   .\scripts\clean-public-repo.ps1 -GitHubUser "Nodain" -PublicRepo "Mezmerize"
#
# Before running:
#   1. Create a PRIVATE repo for source (e.g. Mezmer-Clipboard-Manager-Private) on GitHub.
#   2. Run with -PushPrivate first (or push private manually) so source is not lost.

param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUser,
    [string]$PublicRepo = "Mezmerize",
    [string]$PrivateRepo = "Mezmer-Clipboard-Manager-Private",
    [switch]$PushPrivate,
    [switch]$ForcePublicClean
)

$ErrorActionPreference = "Stop"
$GitExe = (Get-Command git -ErrorAction Stop).Source
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ReleasePublic = Join-Path $ProjectRoot "release-public"
$PublicUrl = "https://github.com/$GitHubUser/$PublicRepo.git"
$PrivateUrl = "https://github.com/$GitHubUser/$PrivateRepo.git"
$GitName = $GitHubUser
$GitEmail = "$GitHubUser@users.noreply.github.com"

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [string]$WorkDir = (Get-Location).Path
    )
    Push-Location $WorkDir
    try {
        & $GitExe @Args
        if ($LASTEXITCODE -ne 0) {
            throw "git $($Args -join ' ') failed (exit $LASTEXITCODE)"
        }
    } finally {
        Pop-Location
    }
}

Write-Host @"

This script will:
  1. (Optional) Push full source to PRIVATE repo: $PrivateUrl
  2. Force-push README-only history to PUBLIC repo:  $PublicUrl

Old commits on the public repo (source, clipboard_manager.md, scripts) will no longer
be reachable from the default branch after step 2.

"@ -ForegroundColor Yellow

if (-not $PushPrivate -and -not $ForcePublicClean) {
    Write-Host "Re-run with -PushPrivate to back up source, then -ForcePublicClean to wipe the public repo." -ForegroundColor Cyan
    Write-Host "  .\scripts\clean-public-repo.ps1 -GitHubUser `"$GitHubUser`" -PushPrivate -ForcePublicClean"
    exit 0
}

Set-Location $ProjectRoot

# Stop tracking internal docs if still committed (skip if already untracked)
if ($PushPrivate) {
    $tracked = & $GitExe -C $ProjectRoot ls-files -- clipboard_manager.md
    if ($tracked) {
        Invoke-Git -Args @("rm", "--cached", "-f", "clipboard_manager.md") -WorkDir $ProjectRoot
        Invoke-Git -Args @("add", ".gitignore") -WorkDir $ProjectRoot
        Invoke-Git -Args @("diff", "--cached", "--quiet") -WorkDir $ProjectRoot
        if ($LASTEXITCODE -ne 0) {
            Invoke-Git -Args @(
                "-c", "user.name=$GitName",
                "-c", "user.email=$GitEmail",
                "commit", "-m", "Stop tracking internal design docs"
            ) -WorkDir $ProjectRoot
        }
    }
}

if ($PushPrivate) {
    Write-Host "==> Pushing source to PRIVATE repo: $PrivateRepo" -ForegroundColor Cyan
    $remotes = & $GitExe -C $ProjectRoot remote
    if ($remotes -notcontains "private") {
        Invoke-Git -Args @("remote", "add", "private", $PrivateUrl) -WorkDir $ProjectRoot
    } else {
        Invoke-Git -Args @("remote", "set-url", "private", $PrivateUrl) -WorkDir $ProjectRoot
    }
    Invoke-Git -Args @("push", "-u", "private", "main") -WorkDir $ProjectRoot
    Write-Host "Private source pushed." -ForegroundColor Green
}

if ($ForcePublicClean) {
    Write-Host "==> Rewriting PUBLIC repo (README only): $PublicRepo" -ForegroundColor Cyan
    $staging = Join-Path $env:TEMP "mezmer-public-clean-$(Get-Random)"
    New-Item -ItemType Directory -Path $staging | Out-Null
    try {
        Copy-Item (Join-Path $ReleasePublic "README.md") (Join-Path $staging "README.md")
        Copy-Item (Join-Path $ReleasePublic ".gitignore") (Join-Path $staging ".gitignore")

        Invoke-Git -Args @("init") -WorkDir $staging
        Invoke-Git -Args @("checkout", "--orphan", "main") -WorkDir $staging
        Invoke-Git -Args @("add", "README.md", ".gitignore") -WorkDir $staging
        Invoke-Git -Args @(
            "-c", "user.name=$GitName",
            "-c", "user.email=$GitEmail",
            "commit", "-m", "Public install page only (no source)"
        ) -WorkDir $staging
        Invoke-Git -Args @("remote", "add", "origin", $PublicUrl) -WorkDir $staging
        Invoke-Git -Args @("push", "-u", "origin", "main", "--force") -WorkDir $staging
        Write-Host "Public repo cleaned. Only README.md and .gitignore remain on main." -ForegroundColor Green
    } finally {
        Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
    }

    # Point local project at private remote for future pushes
    $remotes = & $GitExe -C $ProjectRoot remote
    if ($remotes -contains "private") {
        Invoke-Git -Args @("remote", "set-url", "origin", $PrivateUrl) -WorkDir $ProjectRoot
        Write-Host "Local origin now points to private repo: $PrivateUrl" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Next: upload MSI at https://github.com/$GitHubUser/$PublicRepo/releases/new" -ForegroundColor Cyan
