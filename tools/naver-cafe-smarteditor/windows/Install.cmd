@echo off
setlocal EnableExtensions
title GNLAW SmartEditor Installer
set "TARGET=%LOCALAPPDATA%\GNLAW-SmartEditor"
set "NODE_ZIP=node-v24.15.0-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v24.15.0/node-v24.15.0-win-x64.zip"
set "NODE_FOLDER=node-v24.15.0-win-x64"
set "TEMP_NODE=%TEMP%\gnlaw-node-runtime"

echo [GNLAW] Installing SmartEditor automation...
if not exist "%TARGET%" mkdir "%TARGET%"
xcopy "%~dp0app\*" "%TARGET%\" /E /I /Y >nul
if errorlevel 1 goto install_error

if not exist "%TARGET%\runtime\node.exe" (
  echo [GNLAW] Downloading the required runtime. Please wait...
  curl.exe -L --fail --retry 3 -o "%TEMP%\%NODE_ZIP%" "%NODE_URL%"
  if errorlevel 1 goto download_error
  if exist "%TEMP_NODE%" rmdir /S /Q "%TEMP_NODE%"
  mkdir "%TEMP_NODE%"
  tar.exe -xf "%TEMP%\%NODE_ZIP%" -C "%TEMP_NODE%"
  if errorlevel 1 goto download_error
  if exist "%TARGET%\runtime" rmdir /S /Q "%TARGET%\runtime"
  move "%TEMP_NODE%\%NODE_FOLDER%" "%TARGET%\runtime" >nul
  if errorlevel 1 goto install_error
  del "%TEMP%\%NODE_ZIP%" >nul 2>&1
  rmdir /S /Q "%TEMP_NODE%" >nul 2>&1
)

cscript.exe //nologo "%~dp0CreateShortcut.vbs" "%TARGET%\GNLAWSmartEditor.exe" "%USERPROFILE%\Desktop\GNLAW SmartEditor.lnk"
if errorlevel 1 goto install_error
echo [GNLAW] Installation completed.
start "" "%TARGET%\GNLAWSmartEditor.exe"
exit /b 0

:download_error
echo [ERROR] Runtime download failed. Check the Internet connection and run Install.cmd again.
pause
exit /b 1

:install_error
echo [ERROR] Installation failed. Close the running GNLAW program and run Install.cmd again.
pause
exit /b 1
