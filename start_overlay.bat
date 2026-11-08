@echo off
title Live Stream Overlay Server
color 0C
echo ======================================================================
echo              LIVE STREAM OVERLAY SUITE (SERVER)
echo           - Live YouTube Like Counter & Goal Overlay
echo           - Chess.com Live Session Score Overlay
echo ======================================================================
echo.
echo  [!] IMPORTANT: Keep this terminal window OPEN (or MINIMIZED)
echo      while you are streaming so it can auto-track likes and games.
echo.
echo ======================================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python detected. Launching local overlay server...
    python server.py
) else (
    echo [Notice] Python is not in system PATH.
    echo Opening Like Counter Dashboard directly in your default browser...
    start likes-control.html
    echo.
)

echo.
echo Server closed. Press any key to exit.
pause >nul
