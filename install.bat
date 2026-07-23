@echo off
chcp 65001 >nul
echo ============================================
echo  WordAPA7 - Instalacion inicial
echo ============================================
echo.

echo [1/3] Instalando dependencias Python...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias Python.
    echo Asegurate de tener Python 3.11+ instalado.
    pause
    exit /b 1
)

echo.
echo [2/3] Instalando dependencias Node...
npm install
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias Node.
    echo Asegurate de tener Node.js 18+ instalado.
    pause
    exit /b 1
)

echo.
echo [3/4] Generando plantilla APA7...
python python\create_template.py

echo.
echo [4/4] Construyendo interfaz estatica React...
npm run build

echo.
echo ============================================
echo  Instalacion completada correctamente.
echo ============================================
echo.
echo Ejecuta start.bat y abre http://localhost:8742 en tu navegador.
echo.
pause
