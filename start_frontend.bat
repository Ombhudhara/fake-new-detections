@echo off
title Fake News Detection - Frontend Server
cd /d "%~dp0"

echo ============================================================
echo  Starting Fake News Detection Frontend Server
echo ============================================================

set FRONTEND_PORT=5500
set FRONTEND_URL=http://localhost:%FRONTEND_PORT%

echo  Frontend URL : %FRONTEND_URL%
echo  Backend API  : Configured in frontend/static/js/config.js (default: http://127.0.0.1:5000)
echo.
echo  Starting standalone frontend server (No Python backend loaded)...
echo  Press Ctrl+C in this window to stop the frontend server.
echo ============================================================
echo.

:: Open browser
start "" "%FRONTEND_URL%"

:: Start the standalone frontend HTTP server
python frontend\server.py %FRONTEND_PORT%

if errorlevel 1 (
    echo.
    echo [ERROR] Frontend server stopped with an error.
    pause
)
