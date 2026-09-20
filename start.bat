@echo off
REM ============================================================
REM Fifth Aeon one-click launcher (double-click entry)
REM Delegates all logic to start.ps1 (PowerShell)
REM ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
pause
