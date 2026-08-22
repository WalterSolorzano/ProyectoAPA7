@echo off
REM === build_chain.bat ===
REM Step 1: --dir build
REM Step 2: 7z archive (anti-Defender workaround)
REM Step 3: --prepackaged NSIS installer
REM
REM La version se lee DINAMICAMENTE de package.json (via node) para que el
REM nombre del archive .7z coincida con el que electron-builder espera.
REM Antes estaba hardcodeada ("1.0.34"), lo que rompia la cadena tras un bump.

setlocal

REM ── Leer version de package.json con node (fuente unica de verdad) ─────────
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "APPVER=%%v"
if not defined APPVER (
    echo ERROR: No se pudo leer la version de package.json. ¿node esta en el PATH?
    exit /b 1
)
echo Version detectada: %APPVER%

echo === STEP 1: --dir build ===
npx electron-builder --win --dir --config electron-builder.yml > build_chain_log.txt 2>&1
if %errorlevel% neq 0 (echo STEP 1 FAILED & type build_chain_log.txt & exit /b 1)
echo STEP 1 DONE

echo === STEP 2: 7z archive ===
pushd dist-electron-builder\win-unpacked
"%LOCALAPPDATA%\electron-builder\Cache\7zip@1.0.0\7zip-win-x64-a34pt\bin\7za.exe" a -bd -mx=9 -md=1m -mtc=off -ms=off -mtm=off -mta=off "..\wordapa7-%APPVER%-x64.nsis.7z" "." >> ..\..\build_chain_log.txt 2>&1
if %errorlevel% neq 0 (popd & echo STEP 2 FAILED & exit /b 1)
popd
echo STEP 2 DONE

echo === STEP 3: --prepackaged ===
npx electron-builder --win --prepackaged dist-electron-builder/win-unpacked --config electron-builder.yml >> build_chain_log.txt 2>&1
if %errorlevel% neq 0 (echo STEP 3 FAILED & type build_chain_log.txt & exit /b 1)

echo === DONE ===
dir dist-electron-builder\*.exe

endlocal
