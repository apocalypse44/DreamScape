@echo off
setlocal
cd /d "%~dp0"
python --version >nul 2>&1
if not errorlevel 1 (
    python "%~dp0serve.py"
) else (
    py -3 "%~dp0serve.py"
)
if errorlevel 1 (
    echo.
    echo Could not run the demo. Check the error above and make sure Python 3 is installed.
    pause
)
