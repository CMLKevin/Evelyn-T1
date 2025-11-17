@echo off
REM Evelyn Chat - Batch Launcher for Windows
REM This is a simple wrapper that launches the PowerShell script

echo Starting Evelyn Chat...
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PowerShell is not available on this system.
    echo Please install PowerShell to run Evelyn Chat.
    pause
    exit /b 1
)

REM Launch the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"

REM If the script exits with an error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Script exited with an error.
    echo If you see an execution policy error, run PowerShell as Administrator and execute:
    echo   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
    echo.
    pause
)

