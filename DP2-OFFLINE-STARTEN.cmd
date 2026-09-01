@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte Node.js installieren oder DP2 auf dem vorbereiteten PC starten.
  pause
  exit /b 1
)
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8765/index.html?build=205&offline=1'"
echo KC DP2 Build 205 wird lokal gestartet.
echo Dieses Fenster waehrend der Nutzung bitte geoeffnet lassen.
echo Beenden: Strg+C
node tools\static-server.mjs
pause