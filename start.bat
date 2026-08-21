@echo off
chcp 65001 >nul
echo ============================================================
echo  Iniciando WordAPA7...
echo ============================================================
echo El backend compila el frontend automaticamente si detecta cambios.
echo.
echo Abre http://localhost:8742 en tu navegador.
echo Cierra esta ventana para detener la aplicacion.
echo.
echo --- Complemento de Word (Add-in) ---
echo El complemento se sirve desde el propio backend (no necesita servidor aparte).
echo   Task Pane:  http://localhost:8742/addin/taskpane.html
echo   Manifest:   http://localhost:8742/api/addin/manifest
echo Para usarlo en Word: Insertar -^> Mis complementos -^> Cargar mi complemento
echo   y usar la URL del manifest de arriba.
echo.
if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python" python\main.py
) else (
    python python\main.py
)
pause
