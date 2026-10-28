@echo off
rem Double-click: setup window (install, upgrade, repair, verify, uninstall). With arguments: Install-PBIBuilder.ps1.
rem Runs under your existing PowerShell execution policy; it never bypasses it.
setlocal
if "%~1"=="" (
  powershell.exe -NoProfile -STA -File "%~dp0PBI-Builder-Setup.ps1"
) else (
  powershell.exe -NoProfile -File "%~dp0Install-PBIBuilder.ps1" %*
)
set "code=%ERRORLEVEL%"
if "%code%"=="1" echo.& echo If PowerShell said running scripts is disabled or the file is not signed, your execution policy blocks this installer. Ask IT, or use Akzo-SDD-PBI-Builder.html instead.
if "%~1"=="" if not "%code%"=="0" pause
exit /b %code%
