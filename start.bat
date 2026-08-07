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
if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python" python\main.py
) else (
    python python\main.py
)
pause
