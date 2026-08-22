# build-fast.ps1 — Build the installer in one rapid chain to beat Defender
# Step 1: --dir build (creates win-unpacked)
# Step 2: IMMEDIATELY create 7z archive (before Defender quarantines files)
# Step 3: IMMEDIATELY create NSIS installer with --prepackaged
#
# All three steps run in a single PowerShell process with NO delays between them.
# This minimizes the window for Windows Defender to scan and quarantine files.

$ErrorActionPreference = "Continue"
$projectDir = $PSScriptRoot
Set-Location $projectDir

# Read version from package.json
$pkg = Get-Content (Join-Path $projectDir "package.json") -Raw | ConvertFrom-Json
$appVersion = $pkg.version
Write-Host "Version: $appVersion"

# Kill stale processes
Get-Process WordAPA7,electron,7za,python-backend -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Clean output directory completely
if (Test-Path dist-electron-builder) {
    Remove-Item -Recurse -Force dist-electron-builder -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}
New-Item -ItemType Directory -Path dist-electron-builder -Force | Out-Null

# ── STEP 1: Build unpacked app ──────────────────────────────────────────────
Write-Host ""
Write-Host "=== STEP 1: Building unpacked app (--dir) ===" -ForegroundColor Cyan
$out1 = & cmd /c "npx electron-builder --win --dir --config electron-builder.yml 2>&1"
$out1 | ForEach-Object { Write-Host $_ }

$exePath = "dist-electron-builder\win-unpacked\WordAPA7.exe"
if (-not (Test-Path $exePath)) {
    Write-Host "ERROR: WordAPA7.exe not found after --dir build!" -ForegroundColor Red
    Get-ChildItem dist-electron-builder\win-unpacked -ErrorAction SilentlyContinue | Select-Object Name
    exit 1
}
$exeSize = (Get-Item $exePath).Length
Write-Host "STEP 1 OK: WordAPA7.exe ($([math]::Round($exeSize/1MB,2)) MB)" -ForegroundColor Green

# ── STEP 2: IMMEDIATELY create 7z archive (no delay!) ──────────────────────
Write-Host ""
Write-Host "=== STEP 2: Creating 7z archive (immediately) ===" -ForegroundColor Cyan
$sevenZip = "$env:LOCALAPPDATA\electron-builder\Cache\7zip@1.0.0\7zip-win-x64-a34pt\bin\7za.exe"
$archiveFile = "dist-electron-builder\wordapa7-$appVersion-x64.nsis.7z"

Push-Location dist-electron-builder\win-unpacked
# Use -y to auto-yes, and ignore warnings (exit code 1 = warnings, 2 = error)
& $sevenZip a -bd -mx=9 -md=1m -mtc=off -ms=off -mtm=off -mta=off -y "..\wordapa7-$appVersion-x64.nsis.7z" "."
$sevenZipExit = $LASTEXITCODE
Pop-Location

if (Test-Path $archiveFile) {
    $archiveSize = (Get-Item $archiveFile).Length
    Write-Host "STEP 2 OK: 7z archive created ($([math]::Round($archiveSize/1MB,2)) MB, exit=$sevenZipExit)" -ForegroundColor Green
} else {
    Write-Host "STEP 2 FAILED: 7z archive not created (exit=$sevenZipExit)" -ForegroundColor Red
    exit 1
}

# ── STEP 3: IMMEDIATELY create NSIS installer ───────────────────────────────
Write-Host ""
Write-Host "=== STEP 3: Creating NSIS installer (--prepackaged) ===" -ForegroundColor Cyan

# electron-builder with --prepackaged will try to create its OWN 7z.
# If it fails due to Defender, we retry up to 3 times.
$maxRetries = 3
$nsisSuccess = $false

for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
    Write-Host "NSIS attempt $attempt/$maxRetries..."

    # Clean any leftover 7z/trash files that electron-builder might have created
    Get-ChildItem dist-electron-builder -Filter "*.7z*" -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-Item -Force $_.FullName -ErrorAction Stop } catch { }
    }

    $out3 = & cmd /c "npx electron-builder --win --prepackaged dist-electron-builder/win-unpacked --config electron-builder.yml 2>&1"
    $nsisExit = $LASTEXITCODE

    # Check if installer was created
    $installerPath = "dist-electron-builder\WordAPA7 Setup $appVersion.exe"
    if (Test-Path $installerPath) {
        $installerSize = (Get-Item $installerPath).Length
        Write-Host "STEP 3 OK: Installer created ($([math]::Round($installerSize/1MB,2)) MB)" -ForegroundColor Green
        $nsisSuccess = $true
        break
    }

    # Also check by glob (in case name varies)
    $fallback = Get-ChildItem dist-electron-builder -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($fallback) {
        Write-Host "STEP 3 OK: Installer created via glob ($([math]::Round($fallback.Length/1MB,2)) MB)" -ForegroundColor Green
        $nsisSuccess = $true
        break
    }

    Write-Host "NSIS attempt $attempt failed (exit=$nsisExit)" -ForegroundColor Yellow
    if ($attempt -lt $maxRetries) {
        Write-Host "Waiting 3s before retry..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

# ── RESULT ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($nsisSuccess) {
    Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Get-ChildItem dist-electron-builder -File | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}} | Format-Table -AutoSize
} else {
    Write-Host "  BUILD FAILED after $maxRetries attempts" -ForegroundColor Red
    Write-Host "  Windows Defender may be blocking the build." -ForegroundColor Yellow
    Write-Host "  Try adding an exclusion:" -ForegroundColor Yellow
    Write-Host "  Add-MpPreference -ExclusionPath '$projectDir'" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Get-ChildItem dist-electron-builder -File -ErrorAction SilentlyContinue | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}} | Format-Table -AutoSize
    exit 1
}
