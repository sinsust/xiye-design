@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: 双击即用：后台起服务（无黑窗口、无弹窗）+ 自动打开浏览器。
:: 优先使用 PowerShell 7（pwsh），没有则用系统自带 powershell。
where pwsh >nul 2>nul
if not errorlevel 1 (
    start "" pwsh -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0launcher.ps1"
) else (
    start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0launcher.ps1"
)
exit /b 0