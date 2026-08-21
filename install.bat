@echo off
chcp 65001 >nul
echo ============================================
echo  WordAPA7 - Instalacion inicial
echo ============================================
echo.

echo [1/5] Instalando dependencias Python...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias Python.
    echo Asegurate de tener Python 3.11+ instalado.
    pause
    exit /b 1
)

echo.
echo [2/5] Instalando dependencias Node...
npm install
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias Node.
    echo Asegurate de tener Node.js 18+ instalado.
    pause
    exit /b 1
)

echo.
echo [3/5] Generando plantilla APA7...
python python\create_template.py

echo.
echo [4/5] Construyendo interfaz estatica React...
npm run build

echo.
echo [5/5] Construyendo complemento de Word...
cd word-addin && npm install && npm run build && cd ..
if errorlevel 1 (
    echo WARNING: Fallo la construccion del complemento de Word.
    echo El complemento no es obligatorio para el funcionamiento principal.
    echo Puedes construirlo mas tarde con: cd word-addin ^&^& npm install ^&^& npm run build
) else (
    echo [OK] Complemento de Word construido correctamente.
)

echo.
echo ============================================
echo  Instalacion completada correctamente.
echo ============================================
echo.
echo Ejecuta start.bat y abre http://localhost:8742 en tu navegador.
echo.
echo Complemento de Word (Add-in):
echo   - Task Pane: http://localhost:8742/addin/taskpane.html
echo   - Manifest:  http://localhost:8742/api/addin/manifest
echo.
pause
