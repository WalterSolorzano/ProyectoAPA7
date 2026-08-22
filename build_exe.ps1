# Build script: --dir build + immediate 7z creation + NSIS installer
# Chains commands to minimize the window for Windows Defender interference
#
# La versión se lee DINÁMICAMENTE de package.json para que el nombre del
# archive .7z coincida con el que electron-builder espera. Antes estaba
# hardcodeada ("1.0.34"), desincronizando los nombres tras un bump de versión.

$ErrorActionPreference = "Continue"
$projectDir = $PSScriptRoot
$sevenZip = "$env:LOCALAPPDATA\electron-builder\Cache\7zip@1.0.0\7zip-win-x64-a34pt\bin\7za.exe"
$winUnpacked = "$projectDir\dist-electron-builder\win-unpacked"

# ── Versión desde package.json (fuente única de verdad) ─────────────────────
try {
    $pkg = Get-Content (Join-Path $projectDir "package.json") -Raw | ConvertFrom-Json
    $appVersion = $pkg.version
    if (-not $appVersion) { throw "version vacia" }
} catch {
    Write-Output "ERROR: No se pudo leer la version de package.json: $_"
    exit 1
}
Write-Output "Version: $appVersion"
$archiveFile = "$projectDir\dist-electron-builder\wordapa7-$appVersion-x64.nsis.7z"

# Kill any lingering processes
Get-Process WordAPA7,electron,7za -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Clean output directory
if (Test-Path "$projectDir\dist-electron-builder") {
    Remove-Item -Recurse -Force "$projectDir\dist-electron-builder"
}
New-Item -ItemType Directory -Path "$projectDir\dist-electron-builder" | Out-Null

Write-Output "=== Step 1: Building unpacked app (--dir) ==="
$dirResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx electron-builder --win --dir --config electron-builder.yml > build_step1.txt 2>&1" -NoNewWindow -Wait -PassThru
Write-Output "Step 1 exit code: $($dirResult.ExitCode)"

# Check if WordAPA7.exe exists (Defender may have already quarantined it)
$exePath = "$winUnpacked\WordAPA7.exe"
if (Test-Path $exePath) {
    $exeSize = (Get-Item $exePath).Length
    Write-Output "WordAPA7.exe exists: $exeSize bytes"
} else {
    Write-Output "WARNING: WordAPA7.exe not found! Defender may have quarantined it."
    # List what we do have
    Get-ChildItem $winUnpacked -File -ErrorAction SilentlyContinue | Select-Object Name,Length
}

Write-Output ""
Write-Output "=== Step 2: Creating 7z archive ==="
# Use the same 7za args that electron-builder uses for differential-aware archives:
# -bd (no progress bar), -mx=9 (max compression), -md=1m (1MB dict), -mtc=off (no NTFS timestamps),
# -ms=off (non-solid), -mtm=off -mta=off (no timestamps)
Push-Location $winUnpacked
& $sevenZip a -bd -mx=9 -md=1m -mtc=off -ms=off -mtm=off -mta=off $archiveFile . 2>&1 | ForEach-Object { Write-Output $_ }
$sevenZipExit = $LASTEXITCODE
Pop-Location
Write-Output "Step 2 exit code: $sevenZipExit"

if (Test-Path $archiveFile) {
    $archiveSize = (Get-Item $archiveFile).Length
    Write-Output "7z archive created: $archiveSize bytes ($([math]::Round($archiveSize / 1MB, 1)) MB)"
} else {
    Write-Output "ERROR: 7z archive was not created!"
    exit 1
}

Write-Output ""
Write-Output "=== Step 3: Creating NSIS installer (--prepackaged) ==="
$nsisResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx electron-builder --win --prepackaged dist-electron-builder/win-unpacked --config electron-builder.yml > build_step3.txt 2>&1" -NoNewWindow -Wait -PassThru
Write-Output "Step 3 exit code: $($nsisResult.ExitCode)"

# Check for installer (glob version-agnostic por si el nombre varia)
$installer = Get-ChildItem "$projectDir\dist-electron-builder" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($installer) {
    Write-Output ""
    Write-Output "=== SUCCESS ==="
    Write-Output "Installer: $($installer.Name)"
    Write-Output "Size: $($installer.Length) bytes ($([math]::Round($installer.Length / 1MB, 1)) MB)"
} else {
    Write-Output ""
    Write-Output "=== Checking for errors ==="
    if (Test-Path "$projectDir\build_step3.txt") {
        Get-Content "$projectDir\build_step3.txt" -Tail 30
    }
}
