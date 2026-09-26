@echo off
chcp 65001 >nul
set "TARGET=%LOCALAPPDATA%\GNLAW SmartEditor"
del "%USERPROFILE%\Desktop\GNLAW SmartEditor.lnk" >nul 2>&1
if exist "%TARGET%" rmdir /S /Q "%TARGET%"
echo GNLAW SmartEditor가 제거되었습니다.
pause
