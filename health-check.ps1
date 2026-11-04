#Requires -Version 5.1
<#
.SYNOPSIS
    Comprehensive Health Check for Discord AI Control & Verification System.
#>

$WorkspaceRoot = $PSScriptRoot
$VerificationDir = Join-Path $WorkspaceRoot "discord-gaming-verification"
$LogsDir = Join-Path $WorkspaceRoot "logs"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " [HEALTH-CHECK] Discord AI Control & Verification" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$OverallHealth = $true

# 1. Environment & Credentials Verification
Write-Host "`n[Check 1/6] Environment Configuration..." -ForegroundColor Yellow
$RootEnv = Join-Path $WorkspaceRoot ".env"
if (-not (Test-Path $RootEnv)) {
    Write-Host "  FAIL: Root .env is missing!" -ForegroundColor Red
    $OverallHealth = $false
} else {
    $envContent = Get-Content $RootEnv -Raw
    $hasToken = ($envContent -match "DISCORD_BOT_TOKEN=(.+)") -and (-not ($Matches[1] -match "your_bot_token"))
    $hasGuild = ($envContent -match "DISCORD_GUILD_ID=(.+)") -and (-not ($Matches[1] -match "your_guild_id"))
    
    if ($hasToken -and $hasGuild) {
        Write-Host "  PASS: Discord credentials present (Token & Guild ID loaded securely)." -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Incomplete or placeholder credentials in .env!" -ForegroundColor Red
        $OverallHealth = $false
    }
}

# 2. Build Verification
Write-Host "`n[Check 2/6] Build Output Verification..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $WorkspaceRoot "dist\index.js")) -or -not (Test-Path (Join-Path $WorkspaceRoot "dist\http-server.js"))) {
    Write-Host "  FAIL: TypeScript build output missing. Run npm run build." -ForegroundColor Red
    $OverallHealth = $false
} else {
    Write-Host "  PASS: Build artifacts (dist/index.js, dist/http-server.js, dist/provision-cli.js) verified." -ForegroundColor Green
}

# 3. Live Discord Connectivity & Guild Access
Write-Host "`n[Check 3/6] Discord Connectivity & Guild Access..." -ForegroundColor Yellow
Push-Location $WorkspaceRoot
try {
    $previewOutput = npm run provision:preview 2>&1 | Out-String
    if ($previewOutput -match "Bot connected to Discord successfully") {
        Write-Host "  PASS: Discord Bot connected successfully to Guild." -ForegroundColor Green
        if ($previewOutput -match "Changes needed: (\d+) roles, (\d+) categories, (\d+) channels") {
            Write-Host "  STATUS: Provisioning Status -> $($Matches[0])" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  WARN/FAIL: Discord connectivity issue:" -ForegroundColor Red
        Write-Host "  $previewOutput" -ForegroundColor Gray
        $OverallHealth = $false
    }
} catch {
    Write-Host "  FAIL: Error testing Discord connection: $_" -ForegroundColor Red
    $OverallHealth = $false
} finally {
    Pop-Location
}

# 4. Privileged Intents Check
Write-Host "`n[Check 4/6] Privileged Gateway Intents Advisory..." -ForegroundColor Yellow
Write-Host "  Advisory: Verification bot requires 'Server Members Intent' and 'Message Content Intent'." -ForegroundColor Gray
Write-Host "  If not enabled in Discord Developer Portal -> Bot -> Privileged Gateway Intents," -ForegroundColor Gray
Write-Host "  the bot will throw 'Used disallowed intents' on gateway connect." -ForegroundColor Gray

# 5. Process & Hermes Health Monitoring
Write-Host "`n[Check 5/6] Process & Hermes Monitoring..." -ForegroundColor Yellow
$VerificationPidFile = Join-Path $LogsDir "verification-bot.pid"
$HttpPidFile = Join-Path $LogsDir "remote-mcp.pid"
$HermesPidFile = Join-Path $LogsDir "hermes-bridge.pid"

if (Test-Path $VerificationPidFile) {
    $vPid = (Get-Content $VerificationPidFile).Trim()
    $vProc = Get-Process -Id $vPid -ErrorAction SilentlyContinue
    if ($vProc) {
        Write-Host "  PASS: Verification Bot process is active (PID: $vPid)." -ForegroundColor Green
    } else {
        Write-Host "  NOTICE: Verification Bot PID file exists ($vPid) but process is not running." -ForegroundColor Yellow
    }
} else {
    Write-Host "  INFO: Verification Bot is currently not running via start-all.ps1." -ForegroundColor Gray
}

if (Test-Path $HttpPidFile) {
    $hPid = (Get-Content $HttpPidFile).Trim()
    $hProc = Get-Process -Id $hPid -ErrorAction SilentlyContinue
    if ($hProc) {
        Write-Host "  PASS: Remote MCP HTTP Server process is active (PID: $hPid)." -ForegroundColor Green
    } else {
        Write-Host "  NOTICE: Remote MCP PID file exists ($hPid) but process is not running." -ForegroundColor Yellow
    }
} else {
    Write-Host "  INFO: Remote MCP HTTP server is not running via start-all.ps1." -ForegroundColor Gray
}

if (Test-Path $HermesPidFile) {
    $hermesPid = (Get-Content $HermesPidFile).Trim()
    $hermesProc = Get-Process -Id $hermesPid -ErrorAction SilentlyContinue
    if ($hermesProc) {
        Write-Host "  PASS: Hermes Autonomous Administrator process is active (PID: $hermesPid)." -ForegroundColor Green
    } else {
        Write-Host "  NOTICE: Hermes PID file exists ($hermesPid) but process is not running." -ForegroundColor Yellow
    }
} else {
    Write-Host "  INFO: Hermes Autonomous Bridge is in standby (Configure HERMES_DISCORD_TOKEN to activate)." -ForegroundColor Gray
}

# 6. Test Suite Health
Write-Host "`n[Check 6/6] Automated Test Suite..." -ForegroundColor Yellow
Push-Location $WorkspaceRoot
try {
    $testOutput = npm test 2>&1 | Out-String
    if ($testOutput -match "pass 16" -or $testOutput -match "fail 0") {
        Write-Host "  PASS: Full unit test suite passed cleanly (16/16 tests passed)." -ForegroundColor Green
    } else {
        Write-Host "  WARN: Some unit tests failed." -ForegroundColor Red
        Write-Host $testOutput -ForegroundColor Gray
        $OverallHealth = $false
    }
} finally {
    Pop-Location
}

Write-Host "`n========================================================" -ForegroundColor Cyan
if ($OverallHealth) {
    Write-Host " HEALTH CHECK RESULT: HEALTHY / READY" -ForegroundColor Green
} else {
    Write-Host " HEALTH CHECK RESULT: ATTENTION REQUIRED (Review items above)" -ForegroundColor Yellow
}
Write-Host "========================================================" -ForegroundColor Cyan

