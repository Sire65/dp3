@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  echo KC DP2 startet unter http://localhost:8000/
  py -m http.server 8000
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo KC DP2 startet unter http://localhost:8000/
  python -m http.server 8000
  goto :eof
)
echo Python wurde nicht gefunden. Bitte Python installieren oder einen anderen statischen HTTP-Server verwenden.
pause
