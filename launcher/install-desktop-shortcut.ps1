# Creates a Flow desktop shortcut with a crisp multi-size icon.
$ErrorActionPreference = "Stop"

$LauncherDir = $PSScriptRoot
$VbsLauncher = Join-Path $LauncherDir "launch-flow.vbs"
$IconPath = Join-Path $LauncherDir "flow-icon.ico"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Flow.lnk"

function New-FlowBitmap {
    param([int]$Size)

    Add-Type -AssemblyName System.Drawing

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $padding = [Math]::Max(2, [int]($Size * 0.09))
    $diameter = $Size - ($padding * 2)
    $background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
    $graphics.FillEllipse($background, $padding, $padding, $diameter, $diameter)

    $fontSize = [Math]::Max(8, [int]($Size * 0.46))
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
    $graphics.DrawString("F", $font, [System.Drawing.Brushes]::White, $rect, $format)

    $graphics.Dispose()
    $font.Dispose()
    $background.Dispose()

    return $bitmap
}

function Save-MultiSizeIcon {
    param([string]$Path)

    Add-Type -AssemblyName System.Drawing

    $sizes = @(16, 32, 48, 64, 128, 256)
    $bitmaps = @()

    foreach ($size in $sizes) {
        $bitmaps += New-FlowBitmap -Size $size
    }

    $iconHandle = $bitmaps[-1].GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $stream = [System.IO.File]::Create($Path)
    $icon.Save($stream)
    $stream.Close()

    foreach ($bitmap in $bitmaps) {
        $bitmap.Dispose()
    }

    $icon.Dispose()
}

if (-not (Test-Path $IconPath)) {
    Save-MultiSizeIcon -Path $IconPath
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = $VbsLauncher
$shortcut.WorkingDirectory = $LauncherDir
$shortcut.IconLocation = "$IconPath,0"
$shortcut.Description = "Open Flow - Workforce Productivity"
$shortcut.WindowStyle = 7
$shortcut.Save()

Write-Host "Desktop shortcut created: $ShortcutPath"
Write-Host "Tip: First launch may take longer while the dev server warms up. Later launches open much faster."
