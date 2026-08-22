@echo off
REM ===========================================================================
REM  WordAPA7 — Lanzador del Add-in de Word (servidor de desarrollo)
REM  -------------------------------------------------------------------------
REM  Por DEFECTO levanta el servidor en http://localhost:3000 (HTTP plano).
REM  El Add-in se sirve desde aquí en desarrollo.
REM
REM  Para desarrollo HTTPS avanzado (cuando Word necesita cargar el panel
REM  directamente desde :3000 en HTTPS), setear WORDAPA7_USE_SSL=true en .env
REM  del proyecto raíz antes de ejecutar este script.
REM
REM  REQUISITO PREVIO: el backend de Python de WordAPA7 debe estar corriendo
REM  (ejecutá start.bat en la raíz del proyecto, o `python python/main.py`).
REM  El add-in se conecta a http://127.0.0.1:8742 para detectar citas y armar
REM  la bibliografía. Sin backend, el asistente igual funciona en modo local
REM  (formato APA 7 + numeración de figuras/tablas al pegar).
REM
REM  DESPUÉS de ejecutar este script:
REM    1. Abrí Microsoft Word (Desktop) o Word Online (office.com)
REM    2. Insertar -> Mis complementos -> Cargar mi complemento (Upload)
REM    3. Seleccioná el archivo  manifest.xml  de esta carpeta (word-addin)
REM    4. Se abre el panel "WordAPA7" a la derecha. Listo: escribí o pegá
REM       imágenes/tablas y el asistente las formatea y numera en APA 7.
REM
REM  MODO PRODUCCIÓN (sin este script):
REM    En producción, el Add-in se carga desde una URL HTTPS pública y se
REM    comunica con el backend local en http://127.0.0.1:8742. No se necesita
REM    este servidor de desarrollo ni certificados locales.
REM ===========================================================================

setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo [WordAPA7 Add-in] Instalando dependencias (primera vez)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] No se pudieron instalar las dependencias del add-in.
    pause
    exit /b 1
  )
)

REM Detectar modo HTTPS
set "USE_HTTPS=0"
if exist "..\.env" (
  findstr /B /I "WORDAPA7_USE_SSL=true" "..\.env" >nul 2>nul
  if not errorlevel 1 (
    set "USE_HTTPS=1"
  )
)

if "!USE_HTTPS!"=="1" (
  echo [WordAPA7 Add-in] Iniciando servidor HTTPS en https://localhost:3000 ...
  echo [WordAPA7 Add-in] Modo: DESARROLLO HTTPS avanzado
) else (
  echo [WordAPA7 Add-in] Iniciando servidor HTTP en http://localhost:3000 ...
  echo [WordAPA7 Add-in] Modo: DESARROLLO HTTP (por defecto, sin certificados)
)

echo [WordAPA7 Add-in] En Word: Insertar -^> Mis complementos -^> Cargar mi complemento -^> manifest.xml
echo.
call npm run dev

endlocal
