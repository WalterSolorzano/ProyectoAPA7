@echo off
REM ===========================================================================
REM  WordAPA7 — Lanzador del Add-in de Word (servidor de desarrollo)
REM  -------------------------------------------------------------------------
REM  Levanta el servidor HTTPS en https://localhost:3000 que sirve el Task Pane
REM  (el asistente APA 7 en vivo) dentro de Microsoft Word.
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

echo [WordAPA7 Add-in] Iniciando servidor en https://localhost:3000 ...
echo [WordAPA7 Add-in] En Word: Insertar -^> Mis complementos -^> Cargar mi complemento -^> manifest.xml
echo.
call npm run dev

endlocal
