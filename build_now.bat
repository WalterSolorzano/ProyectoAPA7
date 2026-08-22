@echo off
setlocal enabledelayedexpansion
cd /d "C:\Users\--X\.gemini\antigravity\scratch\wordapa7"

set SEVENZIP=%LOCALAPPDATA%\electron-builder\Cache\7zip@1.0.0\7zip-win-x64-a34pt\bin\7za.exe
set VERSION=1.0.35
set ARCHIVE=dist-electron-builder\wordapa7-%VERSION%-x64.nsis.7z

echo === Killing ALL processes ===
taskkill /F /IM WordAPA7.exe 2>nul
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM python-backend.exe 2>nul
taskkill /F /IM pythonw.exe 2>nul
taskkill /F /IM python.exe 2>nul
taskkill /F /IM 7za.exe 2>nul
taskkill /F /IM makensis.exe 2>nul
ping -n 6 127.0.0.1 >nul

echo === Force-clean output (remove readonly + delete) ===
if exist dist-electron-builder (
    attrib -r "dist-electron-builder\*.7z" 2>nul
    attrib -r "dist-electron-builder\*" 2>nul
    rmdir /S /Q dist-electron-builder 2>nul
    if exist dist-electron-builder (
        echo Retrying delete after delay...
        ping -n 4 127.0.0.1 >nul
        rmdir /S /Q dist-electron-builder 2>nul
    )
)
mkdir dist-electron-builder 2>nul

echo === STEP 1: --dir build ===
call npx electron-builder --win --dir --config electron-builder.yml
if %errorlevel% neq 0 (
    echo STEP 1 FAILED
    exit /b 1
)
echo STEP 1 DONE

if not exist "dist-electron-builder\win-unpacked\WordAPA7.exe" (
    echo ERROR: WordAPA7.exe missing!
    exit /b 1
)
echo WordAPA7.exe exists.

echo === STEP 2: 7z archive (FAST compression -mx=1) ===
if exist "%ARCHIVE%" (
    attrib -r "%ARCHIVE%" 2>nul
    del /F /Q "%ARCHIVE%" 2>nul
)
pushd dist-electron-builder\win-unpacked
"%SEVENZIP%" a -bd -mx=1 -md=1m -mtc=off -ms=off -mtm=off -mta=off "..\wordapa7-%VERSION%-x64.nsis.7z" "*"
set ZIPEXIT=!errorlevel!
popd
echo 7z exit: !ZIPEXIT!
if not exist "%ARCHIVE%" (
    echo ERROR: 7z not created!
    exit /b 1
)
for %%A in ("%ARCHIVE%") do echo 7z size: %%~zA bytes

echo === Making 7z READ-ONLY ===
attrib +r "%ARCHIVE%"

echo === STEP 3: NSIS installer (--prepackaged) ===
call npx electron-builder --win --prepackaged dist-electron-builder/win-unpacked --config electron-builder.yml
set NSIS_EXIT=!errorlevel!

if !NSIS_EXIT! neq 0 (
    echo STEP 3 attempt 1 failed (exit !NSIS_EXIT!), retrying...
    ping -n 5 127.0.0.1 >nul
    call npx electron-builder --win --prepackaged dist-electron-builder/win-unpacked --config electron-builder.yml
    set NSIS_EXIT=!errorlevel!
)

attrib -r "%ARCHIVE%" 2>nul

if !NSIS_EXIT! neq 0 (
    echo STEP 3 FAILED
    exit /b 1
)

echo === SUCCESS ===
dir dist-electron-builder\*.exe
