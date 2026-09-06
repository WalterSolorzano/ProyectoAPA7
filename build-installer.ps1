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
Get-Process WordAPA7,electron,7za,python,pythonw,WINWORD -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Clean output directory with retry loop
if (Test-Path dist-electron-builder) {
    for ($i = 0; $i -lt 5; $i++) {
        try {
            Remove-Item -Recurse -Force dist-electron-builder -ErrorAction Stop
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
}
New-Item -ItemType Directory -Path dist-electron-builder | Out-Null

Write-Output "=== STEP 0: Packaging AI API keys and syncing Python runtime ==="
& python "$projectDir\python\embed_payload.py"
& python -c "import shutil, sys; from pathlib import Path; sys.path.insert(0, '$($projectDir -replace '\\', '/')/python'); from build_embedded import _ignore_fn, PYTHON_SRC, OUTPUT_DIR; src_dest = OUTPUT_DIR / 'python'; shutil.copytree(str(PYTHON_SRC), str(src_dest), ignore=_ignore_fn, dirs_exist_ok=True); payload = PYTHON_SRC / '_embedded_payload.json'; shutil.copy2(str(payload), str(src_dest / '_embedded_payload.json')) if payload.exists() else None; print('Payload and Python sources synchronized to dist-python.')"

Write-Output "=== STEP 1: Building unpacked app (--dir) ==="

# Step 1: Build unpacked app
$out = & cmd /c "npx electron-builder --win --dir --config electron-builder.yml 2>&1"
Write-Output $out
if ($LASTEXITCODE -ne 0) {
    Write-Output "ERROR: electron-builder --dir failed with exit code $LASTEXITCODE"
    exit 1
}

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
