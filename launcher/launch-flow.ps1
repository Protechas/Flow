# Flow desktop launcher — fast open, minimal cache churn, no console window.
$ErrorActionPreference = "Stop"

$FlowDir = (Join-Path $PSScriptRoot ".." | Resolve-Path).Path
$AppUrl = "http://127.0.0.1:3000/operations"
$HealthUrl = "http://127.0.0.1:3000/login"
$Port = 3000
$LogDir = Join-Path $PSScriptRoot "logs"
$ServerLog = Join-Path $LogDir "server.log"
$PidFile = Join-Path $LogDir "server.pid"
$SplashPath = Join-Path $PSScriptRoot "launch-splash.html"
$MutexName = "Global\FlowDesktopLauncher"

$NodeDir = "C:\Program Files\nodejs"
if (Test-Path $NodeDir) {
    $env:PATH = "$NodeDir;$env:PATH"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Test-FlowReady {
    param([int]$TimeoutSec = 2)

    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec $TimeoutSec
        return $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

function Test-FlowStylesOk {
    try {
        $page = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 8
        $cssPaths = [regex]::Matches($page.Content, 'href="(/_next/static/[^"]+\.css[^"]*)"') |
            ForEach-Object { $_.Groups[1].Value } |
            Select-Object -Unique

        if ($cssPaths.Count -eq 0) { return $false }

        foreach ($path in $cssPaths) {
            $css = Invoke-WebRequest -Uri "http://127.0.0.1:$Port$path" -UseBasicParsing -TimeoutSec 8
            if ($css.StatusCode -ge 400) { return $false }
            if ($css.Content.Length -ge 50000) { return $true }
        }

        return $false
    }
    catch {
        return $false
    }
}

function Get-FlowListenerPid {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($conn) { return $conn.OwningProcess }
    return $null
}

function Stop-FlowServer {
    if (Test-Path $PidFile) {
        $savedPid = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($savedPid) {
            Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }

    foreach ($i in 1..4) {
        $listenerPid = Get-FlowListenerPid
        if (-not $listenerPid) { break }
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

function Clear-FlowCache {
    $nextDir = Join-Path $FlowDir ".next"
    if (Test-Path $nextDir) {
        Remove-Item -Recurse -Force $nextDir -ErrorAction SilentlyContinue
    }
}

function Ensure-Dependencies {
    if (-not (Test-Path (Join-Path $FlowDir "node_modules"))) {
        Push-Location $FlowDir
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
        Pop-Location
    }
}

function Start-FlowServer {
    Ensure-Dependencies

    # Dev mode keeps client bundles in sync with source (production start can break clicks).
    $startCmd = "cd /d `"$FlowDir`" && npm run dev > `"$ServerLog`" 2>&1"
    $server = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", $startCmd `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -Path $PidFile -Value $server.Id
}

function Wait-ForFlowReady {
    param(
        [int]$MaxSeconds = 240,
        [switch]$OpenEarly
    )

    $deadline = (Get-Date).AddSeconds($MaxSeconds)
    $opened = $false
    $attempt = 0

    while ((Get-Date) -lt $deadline) {
        if (Test-FlowReady -TimeoutSec 2) {
            if ($OpenEarly -and -not $opened) {
                Open-FlowApp
                $opened = $true
            }
            if (Test-FlowStylesOk) { return $true }
        }

        $attempt += 1
        if ($attempt -le 20) {
            Start-Sleep -Milliseconds 300
        }
        elseif ($attempt -le 60) {
            Start-Sleep -Milliseconds 700
        }
        else {
            Start-Sleep -Seconds 1
        }
    }

    return (Test-FlowReady -TimeoutSec 3)
}

function Open-FlowApp {
    if (Test-FlowReady -TimeoutSec 1) {
        Start-Process $AppUrl
        return
    }

    if (Test-Path $SplashPath) {
        Start-Process $SplashPath
        return
    }

    Start-Process $AppUrl
}

function Show-StartingNotice {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.Visible = $true
        $notify.ShowBalloonTip(2500, "Flow", "Starting Flow…", [System.Windows.Forms.ToolTipIcon]::Info)
        Start-Sleep -Milliseconds 350
        $notify.Dispose()
    }
    catch {
        # Non-critical if toast cannot be shown.
    }
}

function Show-LauncherError {
    param([string]$Message)

    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        "Flow",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Enter-LauncherLock {
    $createdNew = $false
    $mutex = New-Object System.Threading.Mutex($false, $MutexName, [ref]$createdNew)
    if (-not $mutex.WaitOne(0)) {
        return @{
            IsOwner = $false
            Mutex = $mutex
        }
    }

    return @{
        IsOwner = $true
        Mutex = $mutex
    }
}

$lock = Enter-LauncherLock

try {
    if (Test-FlowReady -TimeoutSec 1) {
        Open-FlowApp
        exit 0
    }

    if (-not $lock.IsOwner) {
        Show-StartingNotice
        if (Wait-ForFlowReady -MaxSeconds 180 -OpenEarly) {
            exit 0
        }
        Open-FlowApp
        exit 0
    }

    Show-StartingNotice
    Open-FlowApp

    $listenerPid = Get-FlowListenerPid
    if ($listenerPid) {
        Stop-FlowServer
    }

    Start-FlowServer

    if (-not (Wait-ForFlowReady -MaxSeconds 240)) {
        Stop-FlowServer
        Clear-FlowCache
        Start-FlowServer

        if (-not (Wait-ForFlowReady -MaxSeconds 240)) {
            throw "Flow did not start correctly. Check $ServerLog"
        }
    }
}
catch {
    Show-LauncherError $_.Exception.Message
    exit 1
}
finally {
    if ($lock.Mutex) {
        try { $lock.Mutex.ReleaseMutex() | Out-Null } catch {}
        $lock.Mutex.Dispose()
    }
}
