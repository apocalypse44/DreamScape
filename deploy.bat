@echo off
rem Build dist/ and publish it to Cloudflare (settings in wrangler.jsonc).
rem First time only: run "npx wrangler login".
setlocal
cd /d "%~dp0"
python tools\build_dist.py
if errorlevel 1 goto failed
call npx wrangler deploy
if errorlevel 1 goto failed
echo.
echo Deployed. Hard-refresh the site with Ctrl+Shift+R.
pause
exit /b 0

:failed
echo.
echo Deploy failed. Check the error above.
pause
exit /b 1
