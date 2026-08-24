@echo off
REM === build_fast.bat ===
REM Full build in a single process to race against Windows Defender
REM Uses a unique output directory to avoid locked files from previous attempts

setlocal
set "APPVER=1.0.35"
set "OUTDIR=dist-final-%RANDOM%"
set "PREPACKAGED=win-unpacked-clean"

echo === Output directory: %OUTDIR% ===
mkdir "%OUTDIR%" 2>nul

echo === Building NSIS installer (full process) ===
npx electron-builder --win --prepackaged "%PREPACKAGED%" --config electron-builder.yml --config.directories.output="%OUTDIR%"

if errorlevel 1 (
    echo.
    echo === First attempt failed, retrying in 5s ===
    timeout /t 5 /nobreak >nul
    set "OUTDIR2=dist-final-retry-%RANDOM%"
    mkdir "%OUTDIR2%" 2>nul
    npx electron-builder --win --prepackaged "%PREPACKAGED%" --config electron-builder.yml --config.directories.output="%OUTDIR2%"
    if errorlevel 1 (
        echo === RETRY ALSO FAILED ===
        dir "%OUTDIR2%\*.exe" 2>nul
        exit /b 1
    )
    echo === SUCCESS on retry ===
    dir "%OUTDIR2%\*Setup*.exe"
    exit /b 0
)

echo === Checking for installer ===
if exist "%OUTDIR%\WordAPA7 Setup %APPVER%.exe" (
    echo === SUCCESS ===
    echo Installer: %OUTDIR%\WordAPA7 Setup %APPVER%.exe
    for %%I in ("%OUTDIR%\WordAPA7 Setup %APPVER%.exe") do echo Size: %%~zI bytes
) else (
    echo === Checking for any Setup exe ===
    dir /b "%OUTDIR%\*Setup*.exe" 2>nul
    if errorlevel 1 (
        echo === FAILED: No installer found ===
        dir "%OUTDIR%"
        exit /b 1
    )
)

endlocal
