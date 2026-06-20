# One-shot: push private source repo, push public release repo, build MSI, create GitHub release.
# Usage: .\scripts\publish-all.ps1 -GitHubUser "Nodain" -SkipBuild

param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUser,
    [string]$GitName = $GitHubUser,
    [string]$GitEmail = "$GitHubUser@users.noreply.github.com",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ReleasePublic = Join-Path $ProjectRoot "release-public"
$PrivateRemote = "https://github.com/$GitHubUser/Mesmer-Clipboard-Manager.git"
$PublicRemote = "https://github.com/$GitHubUser/Mesmer-Clipboard-Manager-Releases.git"
$GitExe = (Get-Command git -ErrorAction Stop).Source

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [string]$WorkDir = (Get-Location).Path,
        [switch]$AllowFailure
    )
    Push-Location $WorkDir
    try {
        & $GitExe @Args
        if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
            throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
        }
        return $LASTEXITCODE
    } finally {
        Pop-Location
    }
}

function Invoke-GitCommit {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkDir,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )
    Invoke-Git -WorkDir $WorkDir -Args @(
        "-c", "user.name=$GitName",
        "-c", "user.email=$GitEmail",
        "commit", "-m", $Message
    ) | Out-Null
}

function Test-GitHasMain {
    param([Parameter(Mandatory = $true)][string]$WorkDir)
    Invoke-Git -WorkDir $WorkDir -Args @("rev-parse", "--verify", "main") -AllowFailure | Out-Null
    return $LASTEXITCODE -eq 0
}

function Push-Repo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkDir,
        [Parameter(Mandatory = $true)]
        [string[]]$AddPaths,
        [Parameter(Mandatory = $true)]
        [string]$CommitMessage,
        [Parameter(Mandatory = $true)]
        [string]$RemoteUrl
    )

    if (-not (Test-Path (Join-Path $WorkDir ".git"))) {
        Invoke-Git -WorkDir $WorkDir -Args @("init") | Out-Null
    }

    Invoke-Git -WorkDir $WorkDir -Args (@("add", "--") + $AddPaths) | Out-Null
    Invoke-Git -WorkDir $WorkDir -Args @("diff", "--cached", "--quiet") -AllowFailure | Out-Null
    $hasStagedChanges = $LASTEXITCODE -ne 0

    if ($hasStagedChanges) {
        Invoke-GitCommit -WorkDir $WorkDir -Message $CommitMessage
    } elseif (-not (Test-GitHasMain -WorkDir $WorkDir)) {
        throw "No commit exists in $WorkDir and nothing is staged to commit."
    }

    Invoke-Git -WorkDir $WorkDir -Args @("branch", "-M", "main") | Out-Null

    Push-Location $WorkDir
    $remotes = & $GitExe remote
    Pop-Location
    if ($remotes -notcontains "origin") {
        Invoke-Git -WorkDir $WorkDir -Args @("remote", "add", "origin", $RemoteUrl) | Out-Null
    } else {
        Invoke-Git -WorkDir $WorkDir -Args @("remote", "set-url", "origin", $RemoteUrl) | Out-Null
    }

    Invoke-Git -WorkDir $WorkDir -Args @("push", "-u", "origin", "main") | Out-Null
}

Write-Host "==> Updating public README links for $GitHubUser" -ForegroundColor Cyan
$readme = Join-Path $ReleasePublic "README.md"
$readmeText = Get-Content $readme -Raw
$readmeText = $readmeText.Replace("YOUR_USERNAME", $GitHubUser)
Set-Content -Path $readme -Value $readmeText -NoNewline

Write-Host "==> Step 3: Private repo (full source)" -ForegroundColor Cyan
Push-Repo `
    -WorkDir $ProjectRoot `
    -AddPaths @(".") `
    -CommitMessage "Prepare Mezmer Clipboard for release" `
    -RemoteUrl $PrivateRemote

Write-Host "==> Step 4: Public repo (README only)" -ForegroundColor Cyan
Push-Repo `
    -WorkDir $ReleasePublic `
    -AddPaths @("README.md", ".gitignore") `
    -CommitMessage "Add release page" `
    -RemoteUrl $PublicRemote

if (-not $SkipBuild) {
    Write-Host "==> Step 5: Build MSI" -ForegroundColor Cyan
    Set-Location $ProjectRoot
    & (Join-Path $ProjectRoot "scripts\prepare-public-release.ps1")
} else {
    Write-Host "==> Step 5: Skipping MSI build (-SkipBuild)" -ForegroundColor Cyan
}

$TauriConf = Get-Content (Join-Path $ProjectRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$Version = $TauriConf.version
$MsiPath = Join-Path $ReleasePublic "artifacts\Mezmer-Clipboard-$Version-x64.msi"
if (-not (Test-Path $MsiPath)) {
    throw "Expected MSI not found: $MsiPath"
}

if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "==> Creating GitHub release with gh" -ForegroundColor Cyan
    gh release create "v$Version" `
        --repo "$GitHubUser/Mesmer-Clipboard-Manager-Releases" `
        --title "Mezmer Clipboard $Version" `
        --notes "Windows installer for Mezmer Clipboard." `
        $MsiPath
    Write-Host "Release published." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "GitHub CLI (gh) not found. Upload the MSI manually:" -ForegroundColor Yellow
    Write-Host "  https://github.com/$GitHubUser/Mesmer-Clipboard-Manager-Releases/releases/new"
    Write-Host "  Tag: v$Version"
    Write-Host "  File: $MsiPath"
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
