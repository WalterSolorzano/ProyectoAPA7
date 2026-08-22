# build-installer.ps1 - Chained build script to work around Windows Defender interference
# Step 1: Build unpacked app (--dir)
# Step 2: Immediately create 7z archive before Defender quarantines files
# Step 3: Create NSIS installer using --prepackaged

$ErrorActionPreference = "Continue"
$projectDir = $PSScriptRoot
Set-Location $projectDir

# ── Versión dinámica desde package.json ──────────────────────────────────────
# ANTES la versión estaba hardcodeada (1.0.34), lo que rompía el build cuando
# package.json se actualizaba (ej. a 1.0.35): electron-builder nombra el 7z y el
# instalador con la versión de package.json, pero este script buscaba el nombre
# viejo y reportaba "FAILED: Installer not created" aunque el build hubiera ido
# bien. Ahora se lee dinámicamente para que siempre coincidan.
try {
    $pkg = Get-Content "$projectDir\package.json" -Raw | ConvertFrom-Json
    $appVersion = $pkg.version
    if (-not $appVersion) { throw "version vacía en package.json" }
} catch {
    Write-Output "ERROR: No se pudo leer la versión desde package.json: $_"
    exit 1
}
Write-Output "Versión detectada desde package.json: $appVersion"

$sevenZip = "$env:LOCALAPPDATA\electron-builder\Cache\7zip@1.0.0\7zip-win-x64-a34pt\bin\7za.exe"
$archiveFile = "dist-electron-builder\wordapa7-$appVersion-x64.nsis.7z"
$installerPath = "dist-electron-builder\WordAPA7 Setup $appVersion.exe"

# Kill any leftover processes
Get-Process WordAPA7,electron,7za -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Clean output directory
if (Test-Path dist-electron-builder) { Remove-Item -Recurse -Force dist-electron-builder }
New-Item -ItemType Directory -Path dist-electron-builder | Out-Null
Write-Output "=== STEP 1: Building unpacked app (--dir) ==="

# Step 1: Build unpacked app
$out = & cmd /c "npx electron-builder --win --dir --config electron-builder.yml 2>&1"
Write-Output $out

# Check if WordAPA7.exe exists (Defender might have quarantined it)
$exePath = "dist-electron-builder\win-unpacked\WordAPA7.exe"
if (-not (Test-Path $exePath)) {
    Write-Output "ERROR: WordAPA7.exe not found after --dir build! Defender may have quarantined it."
    Write-Output "=== Files in win-unpacked ==="
    Get-ChildItem dist-electron-builder\win-unpacked -ErrorAction SilentlyContinue | Select-Object Name
    exit 1
}

$exeSize = (Get-Item $exePath).Length
Write-Output "=== STEP 1 COMPLETE: WordAPA7.exe exists ($exeSize bytes) ==="

# Step 2: Immediately create 7z archive
Write-Output "=== STEP 2: Creating 7z archive ==="
# Delete existing 7z if any (con la versión correcta)
if (Test-Path $archiveFile) { Remove-Item -Force $archiveFile }

Push-Location dist-electron-builder\win-unpacked
& $sevenZip a -bd -mx=9 -md=1m -mtc=off -ms=off -mtm=off -mta=off "..\wordapa7-$appVersion-x64.nsis.7z" .
$sevenZipExit = $LASTEXITCODE
Pop-Location

if ($sevenZipExit -ne 0) {
    Write-Output "ERROR: 7za failed with exit code $sevenZipExit"
    exit 1
}

$archiveSize = (Get-Item $archiveFile).Length
Write-Output "=== STEP 2 COMPLETE: 7z archive created ($archiveSize bytes) ==="

# Step 3: Create NSIS installer using --prepackaged
Write-Output "=== STEP 3: Creating NSIS installer (--prepackaged) ==="
$out2 = & cmd /c "npx electron-builder --win --prepackaged dist-electron-builder/win-unpacked --config electron-builder.yml 2>&1"
Write-Output $out2

# Check if installer was created (con la versión correcta de package.json)
if (Test-Path $installerPath) {
    $installerSize = (Get-Item $installerPath).Length
    Write-Output "=== SUCCESS: Installer created ==="
    Write-Output "Installer: $installerPath"
    Write-Output "Size: $installerSize bytes ($([math]::Round($installerSize / 1MB, 2)) MB)"
    
    # List all output files
    Write-Output "=== Output files ==="
    Get-ChildItem dist-electron-builder -File | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length / 1MB, 2)}} | Format-Table -AutoSize
} else {
    # Fallback: buscar cualquier *Setup*.exe por si el nombre difiere
    $fallback = Get-ChildItem dist-electron-builder -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($fallback) {
        Write-Output "=== SUCCESS: Installer created (nombre detectado por glob) ==="
        Write-Output "Installer: $($fallback.FullName)"
        Write-Output "Size: $($fallback.Length) bytes ($([math]::Round($fallback.Length / 1MB, 2)) MB)"
        Write-Output "NOTA: el nombre no coincide con el esperado ($installerPath). Verificá electron-builder.yml / package.json."
    } else {
        Write-Output "=== FAILED: Installer not created ==="
        Write-Output "=== Files in dist-electron-builder ==="
        Get-ChildItem dist-electron-builder -File | Select-Object Name, Length | Format-Table -AutoSize
        exit 1
    }
}
