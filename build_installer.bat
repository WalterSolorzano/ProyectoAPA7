@echo off
set CSC_IDENTITY_AUTO_DISCOVERY=false
set MAX_RETRIES=4
set RETRY=0

:RETRY_LOOP
set /a RETRY+=1
echo === Intento %RETRY% de %MAX_RETRIES% ===

echo Limpiando directorio de salida...
rmdir /s /q dist-electron-builder 2>nul
if exist dist-electron-builder (
    echo El directorio aun existe, intentando fuerza bruta...
    rmdir /s /q dist-electron-builder 2>nul
)

echo Esperando 15 segundos para que se liberen los handles...
timeout /t 15 /nobreak >nul

if exist dist-electron-builder (
    echo ERROR: No se pudo eliminar dist-electron-builder
    if %RETRY% lss %MAX_RETRIES% (
        echo Reintentando...
        goto RETRY_LOOP
    )
    echo Fallo despues de %MAX_RETRIES% intentos.
    exit /b 1
)

echo Directorio limpio. Iniciando electron-builder --dir...
npx electron-builder --win --dir --publish never 2>&1
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% equ 0 (
    echo === EXITO: win-unpacked creado correctamente ===
    exit /b 0
)

echo Build fallo con codigo %EXIT_CODE%
if %RETRY% lss %MAX_RETRIES% (
    echo Reintentando en 10 segundos...
    timeout /t 10 /nobreak >nul
    goto RETRY_LOOP
)

echo Fallo despues de %MAX_RETRIES% intentos.
exit /b %EXIT_CODE%
