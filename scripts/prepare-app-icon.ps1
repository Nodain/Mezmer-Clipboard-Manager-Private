# Crops padding and builds UI + systray icons.
# Systray uses a center-crop on the spiral/clip (no full clipboard frame) for 16px clarity.
# Usage: .\scripts\prepare-app-icon.ps1 [-Source path\to\logo.png]

param(
    [string]$Source = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Source) {
    $Source = Join-Path $ProjectRoot "public\mezmerize-logo.png"
}
if (-not (Test-Path $Source)) {
    throw "Source image not found: $Source"
}

function Get-ContentBounds {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [switch]$TrayMode
    )

    $minX = $Bitmap.Width
    $minY = $Bitmap.Height
    $maxX = 0
    $maxY = 0

    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
        for ($x = 0; $x -lt $Bitmap.Width; $x++) {
            $p = $Bitmap.GetPixel($x, $y)
            $luma = 0.2126 * $p.R + 0.7152 * $p.G + 0.0722 * $p.B
            $sat = [Math]::Max($p.R, [Math]::Max($p.G, $p.B)) - [Math]::Min($p.R, [Math]::Min($p.G, $p.B))

            $keep = if ($TrayMode) {
                $p.A -gt 20 -and ($sat -gt 22 -or $luma -gt 55)
            } else {
                $p.A -gt 24 -and $luma -gt 18
            }

            if ($keep) {
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($maxX -le $minX) { throw "Could not detect icon content in $Source" }

    return [PSCustomObject]@{
        X      = $minX
        Y      = $minY
        Width  = $maxX - $minX + 1
        Height = $maxY - $minY + 1
    }
}

function Get-SpiralTrayBounds {
    param([System.Drawing.Bitmap]$Bitmap)

    $full = Get-ContentBounds -Bitmap $Bitmap
    $minX = $Bitmap.Width
    $minY = $Bitmap.Height
    $maxX = 0
    $maxY = 0

    # Purple / lavender spiral + clip — ignore dark gray frame and bottom buttons.
    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
        for ($x = 0; $x -lt $Bitmap.Width; $x++) {
            $p = $Bitmap.GetPixel($x, $y)
            if ($p.A -lt 20) { continue }

            $sat = [Math]::Max($p.R, [Math]::Max($p.G, $p.B)) - [Math]::Min($p.R, [Math]::Min($p.G, $p.B))
            $isPurple = $p.B -gt 70 -and $p.R -gt 55 -and $sat -gt 28
            $isBright = ($p.R + $p.G + $p.B) / 3.0 -gt 120 -and $sat -gt 15

            if ($isPurple -or $isBright) {
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($maxX -le $minX) {
        # Fallback: center square on upper clipboard body.
        $side = [int][Math]::Min($full.Width, $full.Height * 0.55)
        $cx = $full.X + [int]($full.Width / 2)
        $cy = $full.Y + [int]($full.Height * 0.38)
        return [PSCustomObject]@{
            X      = $cx - [int]($side / 2)
            Y      = $cy - [int]($side / 2)
            Width  = $side
            Height = $side
        }
    }

    $cx = [int](($minX + $maxX) / 2)
    $cy = [int](($minY + $maxY) / 2)
    $w = $maxX - $minX + 1
    $h = $maxY - $minY + 1
    $side = [int][Math]::Max($w, $h) * 1.12
    $side = [int][Math]::Min($side, $full.Width)
    $side = [int][Math]::Min($side, $full.Height * 0.72)

    $x0 = $cx - [int]($side / 2)
    $y0 = $cy - [int]($side / 2)

    if ($x0 -lt $full.X) { $x0 = $full.X }
    if ($y0 -lt $full.Y) { $y0 = $full.Y }
    if ($x0 + $side -gt $full.X + $full.Width) { $x0 = $full.X + $full.Width - $side }
    if ($y0 + $side -gt $full.Y + [int]($full.Height * 0.82)) {
        $y0 = $full.Y + [int]($full.Height * 0.82) - $side
    }

    return [PSCustomObject]@{
        X      = [Math]::Max(0, $x0)
        Y      = [Math]::Max(0, $y0)
        Width  = $side
        Height = $side
    }
}

function Export-CroppedIcon {
    param(
        [System.Drawing.Bitmap]$SourceBitmap,
        [object]$Bounds,
        [string]$DestPath,
        [int]$Size,
        [double]$ScaleBoost = 1.0
    )

    $crop = New-Object System.Drawing.Bitmap $Bounds.Width, $Bounds.Height
    $gCrop = [System.Drawing.Graphics]::FromImage($crop)
    $gCrop.DrawImage(
        $SourceBitmap,
        0, 0,
        (New-Object System.Drawing.Rectangle $Bounds.X, $Bounds.Y, $Bounds.Width, $Bounds.Height),
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $gCrop.Dispose()

    $out = New-Object System.Drawing.Bitmap $Size, $Size
    $out.SetResolution(96, 96)
    $g = [System.Drawing.Graphics]::FromImage($out)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $side = $Size * $ScaleBoost
    $scale = $side / [Math]::Max($Bounds.Width, $Bounds.Height)
    $drawW = [int][Math]::Round($Bounds.Width * $scale)
    $drawH = [int][Math]::Round($Bounds.Height * $scale)
    $dx = [int][Math]::Round(($Size - $drawW) / 2)
    $dy = [int][Math]::Round(($Size - $drawH) / 2)
    $g.DrawImage($crop, $dx, $dy, $drawW, $drawH)
    $g.Dispose()
    $crop.Dispose()

    $dir = Split-Path -Parent $DestPath
    if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $out.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
}

function Export-FilledSquareIcon {
    param(
        [System.Drawing.Bitmap]$SourceBitmap,
        [string]$DestPath,
        [int]$Size = 512,
        [double]$Fill = 0.92,
        [double]$ScaleBoost = 1.0,
        [switch]$TrayMode
    )

    $bounds = Get-ContentBounds -Bitmap $SourceBitmap -TrayMode:$TrayMode
    if ($TrayMode) {
        $bounds.Height = [int][Math]::Max(1, [Math]::Floor($bounds.Height * 0.9))
    }

    Export-CroppedIcon -SourceBitmap $SourceBitmap -Bounds $bounds -DestPath $DestPath -Size $Size -ScaleBoost ($Fill * $ScaleBoost)
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($Source)
try {
    $publicOut = Join-Path $ProjectRoot "public\mezmerize-logo.png"
    $iconOut = Join-Path $ProjectRoot "src-tauri\icons\icon.png"
    $trayOut = Join-Path $ProjectRoot "src-tauri\icons\tray-icon.png"

    Export-FilledSquareIcon -SourceBitmap $srcBmp -DestPath $publicOut -Size 512 -Fill 0.92
    Export-FilledSquareIcon -SourceBitmap $srcBmp -DestPath $iconOut -Size 512 -Fill 0.92

    # Systray: spiral + clip only, zoomed to fill 32px (Windows tray native size).
    $spiralBounds = Get-SpiralTrayBounds -Bitmap $srcBmp
    Export-CroppedIcon -SourceBitmap $srcBmp -Bounds $spiralBounds -DestPath $trayOut -Size 32 -ScaleBoost 1.22

    Write-Host "Wrote: $publicOut" -ForegroundColor Green
    Write-Host "Wrote: $iconOut" -ForegroundColor Green
    Write-Host "Wrote: $trayOut (32x32 spiral tray)" -ForegroundColor Green
} finally {
    $srcBmp.Dispose()
}
