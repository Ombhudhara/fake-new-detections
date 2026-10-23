@echo off
title Fake News Detection - Backend and Chatbot Server
cd /d "%~dp0"

echo ============================================================
echo  Starting Fake News Detection Backend and Chatbot Services
echo ============================================================

:: Check and activate virtual environment if present
if exist ".venv\Scripts\activate.bat" (
    echo [*] Activating virtual environment: .venv
    call .venv\Scripts\activate.bat
    goto :venv_ready
)
if exist "venv\Scripts\activate.bat" (
    echo [*] Activating virtual environment: venv
    call venv\Scripts\activate.bat
    goto :venv_ready
)
if exist "env\Scripts\activate.bat" (
    echo [*] Activating virtual environment: env
    call env\Scripts\activate.bat
    goto :venv_ready
)
echo [*] Using system Python environment.

:venv_ready
set PORT=5000
set CHATBOT_PORT=8000
set BACKEND_URL=http://127.0.0.1:%PORT%
set CHATBOT_URL=http://127.0.0.1:%CHATBOT_PORT%

echo.
echo  Backend API URL : %BACKEND_URL%
echo  Chatbot API URL : %CHATBOT_URL%
echo.
echo  Initializing chatbot and backend API services...
echo  (Note: Starts ONLY backend and chatbot, not frontend)
echo  Press Ctrl+C in this window to stop backend services.
echo ============================================================
echo.
set PYTHONUNBUFFERED=1
python -u run.py

if errorlevel 1 (
    echo.
    echo [ERROR] Backend service stopped with an error.
    echo Keeping terminal open for inspection.
    pause
)
