@echo off
chcp 65001 >nul
setlocal
set "TARGET=%LOCALAPPDATA%\GNLAW SmartEditor"
set "NODE_VERSION=v24.15.0"
set "NODE_ZIP=node-%NODE_VERSION%-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_ZIP%"

echo GNLAW SmartEditor를 설치합니다.
if not exist "%TARGET%" mkdir "%TARGET%"
xcopy "%~dp0app\*" "%TARGET%\" /E /I /Y >nul

if not exist "%TARGET%\runtime\node.exe" (
  echo 실행 환경을 내려받는 중입니다. 잠시 기다려주세요.
  curl.exe -L --fail --retry 3 -o "%TEMP%\%NODE_ZIP%" "%NODE_URL%"
  if errorlevel 1 goto download_error
  if exist "%TEMP%\gnlaw-node" rmdir /S /Q "%TEMP%\gnlaw-node"
  mkdir "%TEMP%\gnlaw-node"
  tar.exe -xf "%TEMP%\%NODE_ZIP%" -C "%TEMP%\gnlaw-node"
  if errorlevel 1 goto download_error
  if exist "%TARGET%\runtime" rmdir /S /Q "%TARGET%\runtime"
  move "%TEMP%\gnlaw-node\node-%NODE_VERSION%-win-x64" "%TARGET%\runtime" >nul
  del "%TEMP%\%NODE_ZIP%" >nul 2>&1
  rmdir /S /Q "%TEMP%\gnlaw-node" >nul 2>&1
)

cscript.exe //nologo "%~dp0바로가기.vbs" "%TARGET%\GNLAWSmartEditor.exe" "%USERPROFILE%\Desktop\GNLAW SmartEditor.lnk"
echo 설치가 완료되었습니다.
start "" "%TARGET%\GNLAWSmartEditor.exe"
exit /b 0

:download_error
echo 실행 환경 다운로드에 실패했습니다. 인터넷 연결을 확인한 뒤 설치.cmd를 다시 실행해주세요.
pause
exit /b 1
