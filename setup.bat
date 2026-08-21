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

rem Guardia de seguridad: si .env.example contiene claves REALES (no placeholders),
rem el setup se detiene - nunca se debe distribuir una clave de IA dentro del
rem instalador ni copiarla al .env local.
powershell -NoProfile -Command "$k = Get-Content '.env.example' -Raw; if ($k -match '(nvapi-[A-Za-z0-9]{25,}|sk-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{30,}|csk-[A-Za-z0-9]{20,})') { exit 1 } else { exit 0 }"
if errorlevel 1 (
    echo.
    echo ERROR DE SEGURIDAD: .env.example contiene una clave de API real.
    echo Reemplazala por un placeholder (ej. nvapi-TU_API_KEY_AQUI) antes de
    echo ejecutar el setup. Las claves reales NO deben distribuirse ni empaquetarse.
    pause
    exit /b 1
)

if not exist ".env" (
    copy ".env.example" ".env" >nul
    rem Restringir acceso al .env solo para el usuario actual (Windows ACL)
    icacls ".env" /inheritance:r /grant:r "%USERNAME%:(F)" >nul 2>nul
    echo Creado .env a partir de .env.example.
    echo   - Opcional: agrega tu NVIDIA_API_KEY para la clasificacion con IA.
) else (
    echo .env ya existe - sin cambios.
)
echo IMPORTANTE: .env es PRIVADO (contiene tus claves). No lo subas a git
echo ni lo compartas. Nunca se incluye en dist/, dist-electron/ ni en el
echo instalador Electron (empaquetado whitelist).

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

rem --- [6] mkcert para HTTPS del Word Add-in (opcional pero recomendado) ---
echo.
echo [6/6] Configurando HTTPS para el Word Add-in (mkcert)...
where mkcert >nul 2>nul
if errorlevel 1 (
    echo mkcert no esta instalado. Intentando instalar via winget...
    where winget >nul 2>nul
    if not errorlevel 1 (
        winget install --id FiloSottile.mkcert -e --silent >nul 2>nul
        if not errorlevel 1 (
            echo mkcert instalado correctamente via winget.
            rem Refrescar PATH en la sesion actual
            set "PATH=%PATH%;%LOCALAPPDATA%\Microsoft\WinGet\Packages\FiloSottile.mkcert_Microsoft.Winget.Source_8wekyb3d8bbwe"
            where mkcert >nul 2>nul
        )
    )
)

where mkcert >nul 2>nul
if not errorlevel 1 (
    echo Instalando autoridad de certificacion local (mkcert -install)...
    mkcert -install
    if not errorlevel 1 (
        echo.
        echo OK: HTTPS del Add-in configurado. Word podra cargar el panel automaticamente.
        echo     El backend generara los certificados SSL en storage\ssl\ al iniciar.
    ) else (
        echo AVISO: mkcert -install fallo. El Add-in funcionara en HTTP (Word puede rechazarlo).
    )
) else (
    echo.
    echo AVISO: mkcert no encontrado. El Word Add-in funcionara en modo HTTP.
    echo Para activar HTTPS (necesario para que Word confie en el Add-in):
    echo   1. Descarga mkcert: https://github.com/FiloSottile/mkcert/releases
    echo   2. Copia mkcert.exe a una carpeta en tu PATH (ej. C:\Windows\System32)
    echo   3. Ejecuta setup.bat nuevamente
    echo.
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
