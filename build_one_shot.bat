@echo off
REM === build_one_shot.bat ===
REM Full build: --dir + 7z + NSIS in a single electron-builder process
REM Uses a unique output directory to avoid locked files from previous attempts

setlocal
set "APPVER=1.0.35"
set "OUTDIR=dist-release-final"

echo === Cleaning output directory ===
if exist "%OUTDIR%" rmdir /s /q "%OUTDIR%" 2>nul
mkdir "%OUTDIR%" 2>nul

echo === Running full electron-builder --win ===
npx electron-builder --win --config electron-builder.yml --config.directories.output=%OUTDIR%

if errorlevel 1 (
    echo.
    echo === FIRST ATTEMPT FAILED - Retrying immediately ===
    echo Defender may have locked the .7z. Retrying...
    npx electron-builder --win --config electron-builder.yml --config.directories.output=%OUTDIR%
)

if errorlevel 1 (
    echo.
    echo === SECOND ATTEMPT FAILED - Retrying ===
    npx electron-builder --win --config electron-builder.yml --config.directories.output=%OUTDIR%
)

echo.
echo === Checking for installer ===
dir /b "%OUTDIR%\*Setup*.exe" 2>nul
if exist "%OUTDIR%\WordAPA7 Setup %APPVER%.exe" (
    echo === SUCCESS! ===
    for %%I in ("%OUTDIR%\WordAPA7 Setup %APPVER%.exe") do echo Size: %%~zI bytes
) else (
    echo === FAILED ===
    dir /b "%OUTDIR%" 2>nul
)

endlocal
