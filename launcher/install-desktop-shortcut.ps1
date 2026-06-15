# Creates a Flow desktop shortcut with a custom icon.
$ErrorActionPreference = "Stop"

$LauncherDir = $PSScriptRoot
$VbsLauncher = Join-Path $LauncherDir "launch-flow.vbs"
$IconPath = Join-Path $LauncherDir "flow-icon.ico"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Flow.lnk"

function New-FlowIcon {
    Add-Type -AssemblyName System.Drawing

    $size = 256
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
    $graphics.FillEllipse($background, 24, 24, 208, 208)

    $font = New-Object System.Drawing.Font("Segoe UI", 118, [System.Drawing.FontStyle]::Bold)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
    $graphics.DrawString("F", $font, [System.Drawing.Brushes]::White, $rect, $format)

    $iconHandle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $stream = [System.IO.File]::Create($IconPath)
    $icon.Save($stream)
    $stream.Close()

    $graphics.Dispose()
    $bitmap.Dispose()
    $icon.Dispose()
}

if (-not (Test-Path $IconPath)) {
    New-FlowIcon
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = $VbsLauncher
$shortcut.WorkingDirectory = $LauncherDir
$shortcut.IconLocation = "$IconPath,0"
$shortcut.Description = "Open Flow - Workforce Productivity"
$shortcut.Save()

Write-Host "Desktop shortcut created: $ShortcutPath"
