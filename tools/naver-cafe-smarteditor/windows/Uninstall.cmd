@echo off
setlocal EnableExtensions
set "TARGET=%LOCALAPPDATA%\GNLAW-SmartEditor"
del "%USERPROFILE%\Desktop\GNLAW SmartEditor.lnk" >nul 2>&1
if exist "%TARGET%" rmdir /S /Q "%TARGET%"
echo GNLAW SmartEditor was removed.
pause
