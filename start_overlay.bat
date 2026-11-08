@echo off
title Chess.com Stream Overlay Server
color 0A
echo ======================================================================
echo              CHESS.COM LIVE STREAM OVERLAY SERVER
echo ======================================================================
echo.
echo  [!] IMPORTANT: Keep this terminal window OPEN (or MINIMIZE it)
echo      while you are streaming so it can auto-track your Chess.com games.
echo.
echo ======================================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python detected. Launching local tracker server...
    python server.py
) else (
    echo [Notice] Python is not in system PATH.
    echo Opening Control Dashboard directly in your default browser...
    start control.html
    echo.
)

echo.
echo Server closed. Press any key to exit.
pause >nul
