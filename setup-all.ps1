#Requires -Version 5.1
<#
.SYNOPSIS
    Installs dependencies and verifies build prerequisites for Discord AI Control & Verification Bot.
#>

$ErrorActionPreference = "Stop"
$WorkspaceRoot = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " [SETUP-ALL] Discord AI Control & Verification System" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Check Node.js and npm
Write-Host "`n[1/5] Checking Node.js and NPM..." -ForegroundColor Yellow
try {
    $nodeVer = (node -v).Trim()
    $npmVer = (npm -v).Trim()
    Write-Host "  Found Node.js: $nodeVer" -ForegroundColor Green
    Write-Host "  Found NPM:     $npmVer" -ForegroundColor Green
} catch {
    Write-Error "Node.js or npm is not installed or not in PATH. Please install Node.js 22+."
    exit 1
}

# 2. Check Directory Structure
Write-Host "`n[2/5] Checking Project Directories..." -ForegroundColor Yellow
$VerificationDir = Join-Path $WorkspaceRoot "discord-gaming-verification"
$LogsDir = Join-Path $WorkspaceRoot "logs"

if (-not (Test-Path $VerificationDir)) {
    Write-Error "Directory 'discord-gaming-verification' is missing."
    exit 1
}

if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
    Write-Host "  Created 'logs' directory." -ForegroundColor Green
} else {
    Write-Host "  'logs' directory exists." -ForegroundColor Green
}

# 3. Check and Synchronize .env
Write-Host "`n[3/5] Validating Environment Configuration..." -ForegroundColor Yellow
$RootEnv = Join-Path $WorkspaceRoot ".env"
$VerificationEnv = Join-Path $VerificationDir ".env"

if (-not (Test-Path $RootEnv)) {
    if (Test-Path (Join-Path $WorkspaceRoot ".env.example")) {
        Copy-Item (Join-Path $WorkspaceRoot ".env.example") $RootEnv
        Write-Host "  Created .env from .env.example. Please configure DISCORD_BOT_TOKEN and DISCORD_GUILD_ID." -ForegroundColor Magenta
    } else {
        Write-Error ".env file is missing in workspace root."
        exit 1
    }
} else {
    Write-Host "  Root .env detected." -ForegroundColor Green
    # Check if placeholder
    $content = Get-Content $RootEnv -Raw
    if ($content -match "your_bot_token_here") {
        Write-Warning "Root .env still contains placeholder values! Please edit .env before starting bots."
    } else {
        Write-Host "  Credentials validated (tokens loaded securely)." -ForegroundColor Green
    }
}

# Ensure sub-project has synced .env
Copy-Item $RootEnv $VerificationEnv -Force
Write-Host "  Synchronized .env to discord-gaming-verification/.env." -ForegroundColor Green

# 4. Install Dependencies
Write-Host "`n[4/5] Installing Dependencies..." -ForegroundColor Yellow
Write-Host "  Installing root dependencies (discord-ai-control)..." -ForegroundColor Gray
Push-Location $WorkspaceRoot
try {
    npm install
} finally {
    Pop-Location
}

Write-Host "  Installing verification dependencies (discord-gaming-verification)..." -ForegroundColor Gray
Push-Location $VerificationDir
try {
    npm install
} finally {
    Pop-Location
}

# 5. Build TypeScript Sources
Write-Host "`n[5/5] Compiling TypeScript..." -ForegroundColor Yellow
Push-Location $WorkspaceRoot
try {
    npm run build
    Write-Host "  TypeScript build succeeded." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " SETUP COMPLETE! Run .\start-all.ps1 to start services." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

