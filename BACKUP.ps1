#Requires -Version 5.1
<#
.SYNOPSIS
    Creates a full timestamped backup of configuration, templates, scripts and state files.
#>

$WorkspaceRoot = $PSScriptRoot
$BackupDir = Join-Path $WorkspaceRoot "backups"
$Timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$TargetBackup = Join-Path $BackupDir "backup-$Timestamp"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " [BACKUP] Discord AI Control & Hermes Configuration" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

if (-not (Test-Path $TargetBackup)) {
    New-Item -ItemType Directory -Path $TargetBackup -Force | Out-Null
}

$ItemsToBackup = @(
    ".env",
    ".env.example",
    "package.json",
    "tsconfig.json",
    "templates",
    "src",
    "hermes",
    "discord-gaming-verification\src",
    "discord-gaming-verification\package.json",
    "discord-gaming-verification\.env"
)

foreach ($item in $ItemsToBackup) {
    $sourcePath = Join-Path $WorkspaceRoot $item
    if (Test-Path $sourcePath) {
        $destPath = Join-Path $TargetBackup $item
        $parent = Split-Path $destPath -Parent
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
        Write-Host "  Backed up: $item" -ForegroundColor Green
    }
}

Write-Host "`nBackup completed successfully -> $TargetBackup" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

