# build_installer_fast.ps1 — Crea el .7z y lanza NSIS inmediatamente
# Workaround para Windows Defender que bloquea el .7z escaneándolo
$ErrorActionPreference = "Continue"
$projectDir = $PSScriptRoot
Set-Location $projectDir

$appVersion = "1.0.35"
$sevenZip = "$env:LOCALAPPDATA\electron-builder\Cache\7zip@1.0.0\7zip-win-x64-a34pt\bin\7za.exe"
$outputDir = "dist-build-v3"
$prepackagedDir = "win-unpacked-clean"

# Limpiar directorio de salida
if (Test-Path $outputDir) { Remove-Item -Recurse -Force $outputDir }
New-Item -ItemType Directory -Path $outputDir | Out-Null

Write-Host "=== STEP 1: Creating 7z archive ===" -ForegroundColor Cyan

# Usar cmd /c para evitar problemas de parsing de argumentos en PowerShell
$archivePath = "$projectDir\$outputDir\wordapa7-$appVersion-x64.nsis.7z"
$cmd = "cd /d `"$projectDir\$prepackagedDir`" && `"$sevenZip`" a -bd -mx=9 -md=1m -mtc=off -ms=off -mtm=off -mta=off `"$archivePath`" `".`" -xr!*.avi -xr!*.mov -xr!*.m4v -xr!*.mp4 -xr!*.m4p -xr!*.qt -xr!*.mkv -xr!*.webm -xr!*.vmdk"
$result = & cmd /c $cmd 2>&1
Write-Host $result
$7zExit = $LASTEXITCODE

if ($7zExit -ne 0) {
    Write-Host "ERROR: 7za failed with exit code $7zExit" -ForegroundColor Red
    exit 1
}

if (Test-Path $archivePath) {
    $archiveSize = (Get-Item $archivePath).Length
    Write-Host "7z created: $([math]::Round($archiveSize / 1MB, 1)) MB" -ForegroundColor Green
} else {
    Write-Host "ERROR: 7z file not found at $archivePath" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== STEP 2: Creating NSIS installer ===" -ForegroundColor Cyan
$out = & cmd /c "npx electron-builder --win --prepackaged $prepackagedDir --config electron-builder.yml --config.directories.output=$outputDir 2>&1"
Write-Host $out

$installerPath = "$projectDir\$outputDir\WordAPA7 Setup $appVersion.exe"
if (Test-Path $installerPath) {
    $installerSize = (Get-Item $installerPath).Length
    Write-Host ""
    Write-Host "=== SUCCESS! ===" -ForegroundColor Green
    Write-Host "Installer: $installerPath"
    Write-Host "Size: $([math]::Round($installerSize / 1MB, 2)) MB"
} else {
    $fallback = Get-ChildItem $outputDir -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($fallback) {
        Write-Host ""
        Write-Host "=== SUCCESS (fallback)! ===" -ForegroundColor Green
        Write-Host "Installer: $($fallback.FullName)"
        Write-Host "Size: $([math]::Round($fallback.Length / 1MB, 2)) MB"
    } else {
        Write-Host ""
        Write-Host "=== FAILED ===" -ForegroundColor Red
        Write-Host "No installer found in $outputDir"
        Get-ChildItem $outputDir -File | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length / 1MB, 2)}} | Format-Table -AutoSize
        exit 1
    }
}
