@echo off
rem Abre o NeuroPlanner SO neste computador (Windows). De dois cliques neste arquivo.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo O Node.js nao esta instalado. Instale a versao 22 LTS em https://nodejs.org e abra este arquivo de novo.
  echo.
  pause
  exit /b 1
)
node scripts\local.mjs
pause
