@echo off
title Fake News Detection - Service Launcher
cd /d "%~dp0"

echo ============================================================
echo  Launching Frontend and Backend in Separate Terminals
echo ============================================================
echo  1. Starting Backend and Chatbot service window...
start "Fake News - Backend" cmd /k "call start_backend.bat"

echo  2. Starting Independent Frontend service window...
start "Fake News - Frontend" cmd /k "call start_frontend.bat"

echo.
echo  Both services launched independently!
echo  - Frontend : http://localhost:5500
echo  - Backend  : http://127.0.0.1:5000
echo  - Chatbot  : http://127.0.0.1:8000
echo.
echo  Closing or stopping either window will NOT terminate the other.
echo ============================================================
