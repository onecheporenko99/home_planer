@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 22.12+ or 24 LTS first.
 pause
 exit /b 1
)
if not exist node_modules (
 call npm install
 if errorlevel 1 exit /b 1
)
call npm run dev
pause
