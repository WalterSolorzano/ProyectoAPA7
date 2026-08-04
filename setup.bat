@echo off
chcp 65001 >nul
setlocal
title WordAPA7 - Setup
cd /d "%~dp0"

echo ============================================
echo  WordAPA7 - Configuracion del proyecto
echo ============================================
echo.

rem --- [0] Verificar requisitos ---
where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python no encontrado en el PATH.
    echo Instala Python 3.11+ y vuelve a ejecutar setup.bat.
    pause
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js no encontrado en el PATH.
    echo Instala Node.js 18+ y vuelve a ejecutar setup.bat.
    pause
    exit /b 1
)

rem --- [1] Entorno virtual Python ---
if not exist "venv\Scripts\python.exe" (
    echo [1/5] Creando entorno virtual Python...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
) else (
    echo [1/5] Entorno virtual ya existe.
)

rem --- [2] Dependencias Python ---
echo [2/5] Instalando dependencias Python...
"venv\Scripts\python" -m pip install --disable-pip-version-check -q --upgrade pip
"venv\Scripts\python" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias Python.
    pause
    exit /b 1
)

rem --- [3] Variables de entorno ---
echo [3/5] Configurando variables de entorno...
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo Creado .env a partir de .env.example.
    echo   - Opcional: agrega tu NVIDIA_API_KEY para la clasificacion con IA.
) else (
    echo .env ya existe - sin cambios.
)

rem --- [4] Dependencias Node ---
echo [4/5] Instalando dependencias Node...
call npm install
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias Node.
    pause
    exit /b 1
)

rem --- [5] Plantilla APA7 y build ---
echo [5/5] Generando plantilla APA7...
"venv\Scripts\python" python\create_template.py
if errorlevel 1 (
    echo ERROR: Fallo la generacion de la plantilla APA7.
    pause
    exit /b 1
)

echo Construyendo interfaz estatica React...
call npm run build
if errorlevel 1 (
    echo ERROR: Fallo la compilacion del frontend.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Configuracion completada correctamente.
echo ============================================
echo.
echo Ejecuta start.bat y abre http://localhost:8742 en tu navegador.
echo (start.bat usara el entorno virtual creado en la carpeta venv\)
echo.
pause
