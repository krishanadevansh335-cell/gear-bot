#Requires -Version 5.1
<#
.SYNOPSIS
    Stops all background Discord bots and remote MCP servers managed by discord-ai-control.
#>

$WorkspaceRoot = $PSScriptRoot
$LogsDir = Join-Path $WorkspaceRoot "logs"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " [STOP-ALL] Stopping Discord AI Control & Verification" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$VerificationPidFile = Join-Path $LogsDir "verification-bot.pid"
$HttpPidFile = Join-Path $LogsDir "remote-mcp.pid"

$stoppedCount = 0

# 1. Stop Verification Bot
if (Test-Path $VerificationPidFile) {
    $vPid = (Get-Content $VerificationPidFile).Trim()
    $vProc = Get-Process -Id $vPid -ErrorAction SilentlyContinue
    if ($vProc) {
        Write-Host "Stopping Verification Bot (PID: $vPid)..." -ForegroundColor Yellow
        Stop-Process -Id $vPid -Force -ErrorAction SilentlyContinue
        $stoppedCount++
    }
    Remove-Item $VerificationPidFile -Force -ErrorAction SilentlyContinue
}

# 2. Stop Remote MCP Server
if (Test-Path $HttpPidFile) {
    $hPid = (Get-Content $HttpPidFile).Trim()
    $hProc = Get-Process -Id $hPid -ErrorAction SilentlyContinue
    if ($hProc) {
        Write-Host "Stopping Remote MCP Server (PID: $hPid)..." -ForegroundColor Yellow
        Stop-Process -Id $hPid -Force -ErrorAction SilentlyContinue
        $stoppedCount++
    }
    Remove-Item $HttpPidFile -Force -ErrorAction SilentlyContinue
}

# 3. Stop Hermes Autonomous Administrator Bridge
$HermesPidFile = Join-Path $LogsDir "hermes-bridge.pid"
if (Test-Path $HermesPidFile) {
    $hermesPid = (Get-Content $HermesPidFile).Trim()
    $hermesProc = Get-Process -Id $hermesPid -ErrorAction SilentlyContinue
    if ($hermesProc) {
        Write-Host "Stopping Hermes Autonomous Administrator (PID: $hermesPid)..." -ForegroundColor Yellow
        Stop-Process -Id $hermesPid -Force -ErrorAction SilentlyContinue
        $stoppedCount++
    }
    Remove-Item $HermesPidFile -Force -ErrorAction SilentlyContinue
}

# 4. Clean up any orphaned node processes running src/index.js in discord-gaming-verification or hermes-bridge
$orphans = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { 
    ($_.CommandLine -match "discord-gaming-verification[\\/]src[\\/]index\.js" -or 
     $_.CommandLine -match "dist[\\/]http-server\.js" -or 
     $_.CommandLine -match "dist[\\/]hermes-bridge\.js" -or
     ($_.CommandLine -match "src[\\/]index\.js" -and $_.ProcessId -ne $PID))
}
foreach ($proc in $orphans) {
    Write-Host "Stopping lingering process $($proc.ProcessId) ($($proc.CommandLine))..." -ForegroundColor Yellow
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    $stoppedCount++
}

Write-Host "`nAll services stopped successfully. ($stoppedCount process(es) terminated)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

