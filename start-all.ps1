#Requires -Version 5.1
<#
.SYNOPSIS
    One-click startup for Discord AI Control & Verification System.
    Validates environment, installs dependencies, provisions server resources,
    starts services, and monitors health.
#>

$ErrorActionPreference = "Stop"
$WorkspaceRoot = $PSScriptRoot
$VerificationDir = Join-Path $WorkspaceRoot "discord-gaming-verification"
$LogsDir = Join-Path $WorkspaceRoot "logs"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " [START-ALL] Discord AI Control & Verification System" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Environment & Setup Verification
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

$RootEnv = Join-Path $WorkspaceRoot ".env"
if (-not (Test-Path $RootEnv)) {
    Write-Host "No .env found. Running setup-all.ps1..." -ForegroundColor Yellow
    & (Join-Path $WorkspaceRoot "setup-all.ps1")
}

# 2. Check Prerequisites
Write-Host "`n[Step 1/6] Verifying Dependencies & Build..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $WorkspaceRoot "node_modules")) -or -not (Test-Path (Join-Path $WorkspaceRoot "dist\index.js"))) {
    Write-Host "  Building and preparing workspace..." -ForegroundColor Gray
    & (Join-Path $WorkspaceRoot "setup-all.ps1")
} else {
    Write-Host "  Dependencies and build verified." -ForegroundColor Green
}

# 3. Prevent duplicate instances
Write-Host "`n[Step 2/6] Checking for Existing Instances..." -ForegroundColor Yellow
$VerificationPidFile = Join-Path $LogsDir "verification-bot.pid"
if (Test-Path $VerificationPidFile) {
    $existingPid = (Get-Content $VerificationPidFile).Trim()
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        Write-Host "  Verification Bot is already running (PID: $existingPid)." -ForegroundColor Cyan
    } else {
        Remove-Item $VerificationPidFile -Force -ErrorAction SilentlyContinue
    }
}

# 4. Automate Discord Server Provisioning
Write-Host "`n[Step 3/6] Idempotent Discord Server Provisioning..." -ForegroundColor Yellow
Write-Host "  Ensuring categories, channels, roles, and permissions exist..." -ForegroundColor Gray
Push-Location $WorkspaceRoot
$provisionSucceeded = $false
try {
    node dist/provision-cli.js
    if ($LASTEXITCODE -eq 0) {
        $provisionSucceeded = $true
        Write-Host "  Discord server structure is up-to-date and provisioned." -ForegroundColor Green
    } else {
        Write-Host "  CRITICAL: Provisioner exited with code $LASTEXITCODE." -ForegroundColor Red
    }
} catch {
    Write-Host "  CRITICAL: Provisioner threw an exception: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

if (-not $provisionSucceeded) {
    Write-Host "`n========================================================" -ForegroundColor Red
    Write-Host " STARTUP HALTED: Discord Server Provisioning Failed!" -ForegroundColor Red
    Write-Host " Please resolve the provisioning issues above before starting services." -ForegroundColor Yellow
    Write-Host "========================================================" -ForegroundColor Red
    exit 1
}

# 5. Start Verification Bot
Write-Host "`n[Step 4/6] Starting Discord Gaming Verification Bot..." -ForegroundColor Yellow
$vLog = Join-Path $LogsDir "verification-bot.log"
$vErr = Join-Path $LogsDir "verification-bot.err.log"

$alreadyRunning = $false
if (Test-Path $VerificationPidFile) {
    $existingPid = (Get-Content $VerificationPidFile).Trim()
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        $alreadyRunning = $true
    }
}

if (-not $alreadyRunning) {
    # Check if another node instance is already running src/index.js
    $runningNode = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match "discord-gaming-verification[\\/]src[\\/]index\.js" -or $_.CommandLine -match "src/index.js" }
    if ($runningNode) {
        $vPid = $runningNode[0].ProcessId
        Set-Content -Path $VerificationPidFile -Value $vPid
        Write-Host "  Attached to running Verification Bot (PID: $vPid)." -ForegroundColor Green
    } else {
        $vProc = Start-Process -FilePath "node" `
            -ArgumentList "src/index.js" `
            -WorkingDirectory $VerificationDir `
            -RedirectStandardOutput $vLog `
            -RedirectStandardError $vErr `
            -WindowStyle Hidden `
            -PassThru

        Set-Content -Path $VerificationPidFile -Value $vProc.Id
        Start-Sleep -Seconds 2

        if ($vProc.HasExited) {
            Write-Host "  WARNING: Verification Bot exited immediately. Checking error log..." -ForegroundColor Red
            if (Test-Path $vErr) {
                Get-Content $vErr -Tail 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
            }
        } else {
            Write-Host "  Verification Bot started successfully (PID: $($vProc.Id))." -ForegroundColor Green
        }
    }
} else {
    Write-Host "  Verification Bot is already running." -ForegroundColor Cyan
}

# 6. Start Remote MCP Server (for ChatGPT)
Write-Host "`n[Step 5/6] Checking Remote MCP Server Configuration..." -ForegroundColor Yellow
$HttpPidFile = Join-Path $LogsDir "remote-mcp.pid"
$hLog = Join-Path $LogsDir "remote-mcp.log"
$hErr = Join-Path $LogsDir "remote-mcp.err.log"

$envContent = Get-Content $RootEnv -Raw
if ($envContent -match "MCP_AUTH_TOKEN=(.+)" -and -not ($Matches[1] -match "your_strong_secret")) {
    $mcpRunning = $false
    if (Test-Path $HttpPidFile) {
        $hPid = (Get-Content $HttpPidFile).Trim()
        if (Get-Process -Id $hPid -ErrorAction SilentlyContinue) {
            $mcpRunning = $true
        }
    }

    if (-not $mcpRunning) {
        Write-Host "  Starting Remote MCP HTTP Server (SSE on port 3000)..." -ForegroundColor Gray
        $hProc = Start-Process -FilePath "node" `
            -ArgumentList "dist/http-server.js" `
            -WorkingDirectory $WorkspaceRoot `
            -RedirectStandardOutput $hLog `
            -RedirectStandardError $hErr `
            -PassThru

        Set-Content -Path $HttpPidFile -Value $hProc.Id
        Start-Sleep -Seconds 2

        if ($hProc.HasExited) {
            Write-Host "  WARNING: Remote MCP Server failed to start." -ForegroundColor Red
            if (Test-Path $hErr) {
                Get-Content $hErr -Tail 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
            }
        } else {
            Write-Host "  Remote MCP Server started (PID: $($hProc.Id)) on http://localhost:3000." -ForegroundColor Green
        }
    } else {
        Write-Host "  Remote MCP Server is already running." -ForegroundColor Cyan
    }
} else {
    Write-Host "  Remote MCP HTTP Server is not enabled (Set MCP_AUTH_TOKEN in .env to activate)." -ForegroundColor Gray
}

# 7. Start Hermes Autonomous Bridge (if configured)
Write-Host "`n[Step 6/7] Checking Hermes Autonomous Administrator..." -ForegroundColor Yellow
$HermesPidFile = Join-Path $LogsDir "hermes-bridge.pid"
$hermesLog = Join-Path $LogsDir "hermes-bridge.log"
$hermesErr = Join-Path $LogsDir "hermes-bridge.err.log"

if ($envContent -match "HERMES_DISCORD_TOKEN=(.+)" -and -not [string]::IsNullOrWhiteSpace($Matches[1])) {
    $hermesRunning = $false
    if (Test-Path $HermesPidFile) {
        $hermesPid = (Get-Content $HermesPidFile).Trim()
        if (Get-Process -Id $hermesPid -ErrorAction SilentlyContinue) {
            $hermesRunning = $true
        }
    }

    if (-not $hermesRunning) {
        Write-Host "  Starting Hermes Autonomous Administrator Bridge..." -ForegroundColor Gray
        $hermesProc = Start-Process -FilePath "node" `
            -ArgumentList "dist/hermes-bridge.js" `
            -WorkingDirectory $WorkspaceRoot `
            -RedirectStandardOutput $hermesLog `
            -RedirectStandardError $hermesErr `
            -PassThru

        Set-Content -Path $HermesPidFile -Value $hermesProc.Id
        Start-Sleep -Seconds 2

        if ($hermesProc.HasExited) {
            Write-Host "  NOTICE: Hermes Autonomous Bridge did not stay active. Check logs/hermes-bridge.err.log." -ForegroundColor Yellow
        } else {
            Write-Host "  Hermes Autonomous Administrator started (PID: $($hermesProc.Id))." -ForegroundColor Green
        }
    } else {
        Write-Host "  Hermes Autonomous Administrator is already running." -ForegroundColor Cyan
    }
} else {
    Write-Host "  Hermes Autonomous Bot is in standby (Set HERMES_DISCORD_TOKEN in .env when ready)." -ForegroundColor Gray
}

# 8. AI MCP Clients Notice (Claude & Antigravity)
Write-Host "`n[Step 7/7] AI Management MCP Status:" -ForegroundColor Yellow
Write-Host "  Claude Desktop & Google Antigravity use Local STDIO transport." -ForegroundColor Gray
Write-Host "  They launch instances of 'dist/index.js' automatically via their client configuration." -ForegroundColor Gray
Write-Host "  Stdio instances do NOT run as standalone daemons (this avoids pipe conflicts)." -ForegroundColor Green

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " SYSTEM ONLINE & RUNNING!" -ForegroundColor Green
Write-Host " Check status anytime: .\health-check.ps1" -ForegroundColor Cyan
Write-Host " Stop all services:    .\stop-all.ps1" -ForegroundColor Cyan
Write-Host " Logs available in:    $LogsDir" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
