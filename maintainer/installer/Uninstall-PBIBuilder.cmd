@echo off
rem Runs Uninstall-PBIBuilder.ps1 under your existing PowerShell execution policy; it never bypasses it.
setlocal
powershell.exe -NoProfile -File "%~dp0Uninstall-PBIBuilder.ps1" %*
set "code=%ERRORLEVEL%"
if "%code%"=="1" echo.& echo If PowerShell said running scripts is disabled or the file is not signed, your execution policy blocks this installer. Ask IT, or use Akzo-SDD-PBI-Builder.html instead.
if "%~1"=="" pause
exit /b %code%
