# Flow desktop launcher — starts the app and opens the browser (no Cursor required).
$ErrorActionPreference = "Stop"

$FlowDir = Join-Path $PSScriptRoot ".." | Resolve-Path
$AppUrl = "http://localhost:3000/operations"
$HealthUrl = "http://127.0.0.1:3000/operations"
$Port = 3000
$LogDir = Join-Path $PSScriptRoot "logs"
$ServerLog = Join-Path $LogDir "server.log"
$PidFile = Join-Path $LogDir "server.pid"
$BuildIdFile = Join-Path $LogDir "running-build-id.txt"
$CurrentBuildIdPath = Join-Path $FlowDir ".next\BUILD_ID"

$NodeDir = "C:\Program Files\nodejs"
if (Test-Path $NodeDir) {
    $env:PATH = "$NodeDir;$env:PATH"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Get-CurrentBuildId {
    if (Test-Path $CurrentBuildIdPath) {
        return (Get-Content $CurrentBuildIdPath -Raw).Trim()
    }
    return $null
}

function Get-RunningBuildId {
    if (Test-Path $BuildIdFile) {
        return (Get-Content $BuildIdFile -Raw).Trim()
    }
    return $null
}

function Test-FlowServer {
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 8
        return $response.StatusCode -lt 500
    }
    catch {
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            return $code -ge 200 -and $code -lt 500
        }
        return $false
    }
}

function Get-FlowListenerPid {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($conn) {
        return $conn.OwningProcess
    }
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

    foreach ($i in 1..3) {
        $listenerPid = Get-FlowListenerPid
        if (-not $listenerPid) {
            break
        }
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }

    Remove-Item $BuildIdFile -Force -ErrorAction SilentlyContinue
}

function Ensure-ProductionBuild {
    $buildId = Get-CurrentBuildId
    if ($buildId) {
        return
    }

    if (-not (Test-Path (Join-Path $FlowDir "node_modules"))) {
        Push-Location $FlowDir
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
        Pop-Location
    }

    Push-Location $FlowDir
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed. See $LogDir" }
    Pop-Location
}

function Start-FlowServer {
    Ensure-ProductionBuild

    $startCmd = "cd /d `"$FlowDir`" && npm run start > `"$ServerLog`" 2>&1"
    $server = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", $startCmd `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -Path $PidFile -Value $server.Id

    $deadline = (Get-Date).AddMinutes(3)
    while ((Get-Date) -lt $deadline) {
        if (Test-FlowServer) {
            $buildId = Get-CurrentBuildId
            if ($buildId) {
                Set-Content -Path $BuildIdFile -Value $buildId
            }
            return
        }
        Start-Sleep -Seconds 1
    }

    throw "Flow server did not start in time. Check $ServerLog"
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

try {
    $currentBuildId = Get-CurrentBuildId
    $runningBuildId = Get-RunningBuildId
    $serverHealthy = Test-FlowServer
    $needsRestart = (-not $serverHealthy) -or ($currentBuildId -ne $runningBuildId)

    if ($needsRestart) {
        Stop-FlowServer
        Start-FlowServer
    }

    if (-not (Test-FlowServer)) {
        throw "Flow is not responding on port $Port."
    }

    Start-Process $AppUrl
}
catch {
    Show-LauncherError $_.Exception.Message
    exit 1
}
