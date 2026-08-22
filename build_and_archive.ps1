# build_and_archive.ps1
# Step 1: Build unpacked app with --dir
# Step 2: Immediately create 7z archive (before Defender quarantines files)
# Step 3: Create NSIS installer with --prepackaged
#
# La versión se lee DINÁMICAMENTE de package.json para que los nombres del
# archive .7z y del installer .exe coincidan con los que electron-builder
# genera internamente. Antes estaba hardcodeada ("1.0.34"), lo que
# desincronizaba los nombres al bumpar la versión y rompía la verificación.

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot
Set-Location $projectDir

# ── Versión desde package.json (fuente única de verdad) ─────────────────────
try {
    $pkg = Get-Content (Join-Path $projectDir "package.json") -Raw | ConvertFrom-Json
    $appVersion = $pkg.version
    if (-not $appVersion) { throw "version vacia" }
} catch {
    throw "No se pudo leer la version de package.json: $_"
}
Write-Output "Version de package.json: $appVersion"

# Kill stale processes
Get-Process WordAPA7,electron,7za -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Clean output
if (Test-Path dist-electron-builder) { Remove-Item -Recurse -Force dist-electron-builder }
New-Item -ItemType Directory -Path dist-electron-builder | Out-Null

Write-Output "=== STEP 1: Building unpacked app (--dir) ==="
npx electron-builder --win --dir --config electron-builder.yml 2>&1 | Tee-Object -FilePath build_step1_log.txt
if ($LASTEXITCODE -ne 0) { throw "Step 1 (dir build) failed with exit code $LASTEXITCODE" }

# Verify win-unpacked has the exe
$exePath = "dist-electron-builder\win-unpacked\WordAPA7.exe"
if (-not (Test-Path $exePath)) { throw "WordAPA7.exe not found after dir build - Defender may have quarantined it" }
$exeSize = (Get-Item $exePath).Length
Write-Output "WordAPA7.exe exists, size: $exeSize bytes"

Write-Output "=== STEP 2: Creating 7z archive ==="
$sevenZip = "$env:LOCALAPPDATA\electron-builder\Cache\7zip@1.0.0\7zip-win-x64-a34pt\bin\7za.exe"
$archiveFile = "dist-electron-builder\wordapa7-$appVersion-x64.nsis.7z"

# Use the same args as electron-builder for differential-aware archives:
# a -bd -mx=9 -md=1m -mtc=off -ms=off -mtm=off -mta=off
Set-Location dist-electron-builder\win-unpacked
& $sevenZip a -bd -mx=9 -md=1m -mtc=off -ms=off -mtm=off -mta=off "..\wordapa7-$appVersion-x64.nsis.7z" "."
$sevenZExit = $LASTEXITCODE
Set-Location $projectDir

if ($sevenZExit -ne 0) { throw "Step 2 (7z creation) failed with exit code $sevenZExit" }
$archiveSize = (Get-Item $archiveFile).Length
Write-Output "7z archive created, size: $archiveSize bytes"

Write-Output "=== STEP 3: Creating NSIS installer (--prepackaged) ==="
npx electron-builder --win --prepackaged dist-electron-builder/win-unpacked --config electron-builder.yml 2>&1 | Tee-Object -FilePath build_step3_log.txt
if ($LASTEXITCODE -ne 0) { throw "Step 3 (prepackaged build) failed with exit code $LASTEXITCODE" }

Write-Output "=== DONE ==="
Get-ChildItem dist-electron-builder -File | Select-Object Name,Length | Format-Table -AutoSize
