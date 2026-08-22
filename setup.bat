@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
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

rem --- [6] Modo de operacion del Word Add-in ---
echo.
echo ============================================
echo  Word Add-in: Configuracion HTTPS (opcional)
echo ============================================
echo.
echo El Word Add-in funciona en MODO PRODUCCION por defecto:
echo   - El backend corre en http://127.0.0.1:8742 (HTTP plano)
echo   - El Add-in se carga desde una URL HTTPS publica
echo   - No se necesitan certificados locales ni mkcert
echo   - Sin alertas de seguridad de Windows
echo.
echo MODO DESARROLLO AVANZADO (HTTPS local con mkcert):
echo   Solo necesario si desarrollas el Add-in localmente y necesitas
echo   que Word cargue el panel desde https://localhost:3000.
echo   Para activarlo, ejecuta: setup.bat --dev-https
echo.

rem --- Verificar si se solicito el modo de desarrollo con HTTPS ---
set "DEV_HTTPS=0"
for %%A in (%*) do (
    if /i "%%A"=="--dev-https" set "DEV_HTTPS=1"
)

if "!DEV_HTTPS!"=="1" (
    echo [DEV-HTTPS] Configurando mkcert para desarrollo local avanzado...
    where mkcert >nul 2>nul
    if errorlevel 1 (
        echo mkcert no esta instalado. Intentando instalar via winget...
        where winget >nul 2>nul
        if not errorlevel 1 (
            winget install --id FiloSottile.mkcert -e --silent >nul 2>nul
            if not errorlevel 1 (
                echo mkcert instalado correctamente via winget.
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
            echo OK: HTTPS de desarrollo configurado con mkcert.
            echo     El backend generara los certificados SSL al iniciar.
            echo     Activa WORDAPA7_USE_SSL=true en .env para usarlo.
        ) else (
            echo AVISO: mkcert -install fallo. El Add-in funcionara en HTTP.
        )
    ) else (
        echo.
        echo AVISO: mkcert no se pudo instalar.
        echo Para instalarlo manualmente:
        echo   1. Descarga mkcert: https://github.com/FiloSottile/mkcert/releases
        echo   2. Copia mkcert.exe a una carpeta en tu PATH
        echo   3. Ejecuta: setup.bat --dev-https
        echo.
    )
) else (
    echo [OK] Modo produccion: no se requieren certificados locales.
)

echo.
echo ============================================
echo  Configuracion completada correctamente.
echo ============================================
echo.
echo Ejecuta start.bat y abre http://localhost:8742 en tu navegador.
echo (start.bat usara el entorno virtual creado en la carpeta venv\)
echo.
echo Word Add-in (produccion):
echo   - El backend sirve el Add-in en http://127.0.0.1:8742/addin/
echo   - Para usarlo en Word, carga el manifest desde:
echo     http://127.0.0.1:8742/api/addin/manifest
echo   - Para produccion con URL publica, configura:
echo     WORDAPA7_ADDIN_PUBLIC_URL en .env
echo.
pause
