@echo off
chcp 65001 >nul
echo ============================================================
echo  Iniciando WordAPA7...
echo ============================================================
echo El backend compila el frontend automaticamente si detecta cambios.
echo.
echo El backend corre en HTTP plano (sin certificados locales).
echo Abre http://localhost:8742 en tu navegador.
echo Cierra esta ventana para detener la aplicacion.
echo.
echo --- Complemento de Word (Add-in) ---
echo MODO PRODUCCION (recomendado):
echo   1. Hospeda los archivos del Add-in en una URL HTTPS publica
echo      (ej. GitHub Pages, Netlify, Vercel).
echo   2. Configura WORDAPA7_ADDIN_PUBLIC_URL en .env con esa URL.
echo   3. Carga el manifiesto desde: http://localhost:8742/api/addin/manifest
echo.
echo MODO LOCAL (sin SSL):
echo   El Add-in se sirve desde el propio backend en HTTP.
echo   Task Pane:  http://localhost:8742/addin/taskpane.html
echo   Manifest:   http://localhost:8742/api/addin/manifest
echo.
echo MODO DESARROLLO HTTPS (avanzado):
echo   Setea WORDAPA7_USE_SSL=true en .env para activar SSL local.
echo.
if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python" python\main.py
) else (
    python python\main.py
)
pause
