@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
set PORT=3200

:: 先关掉常驻托盘进程（若有），否则图标会与实际服务状态脱节
if exist ".xiye-tray.pid" (
    for /f %%i in (.xiye-tray.pid) do (
        taskkill /PID %%i /T /F >nul 2>nul
        echo [OK] 已关闭托盘（PID=%%i）
    )
    del /q ".xiye-tray.pid" >nul 2>nul
)

:: 优先按 PID 文件精确停止；否则按端口兜底
if exist ".xiye-dev.pid" (
    for /f %%i in (.xiye-dev.pid) do (
        taskkill /PID %%i /T /F >nul 2>nul
        echo [OK] 已停止 dev server（PID=%%i）
    )
    del /q ".xiye-dev.pid" >nul 2>nul
    exit /b 0
)

powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('[OK] 已停止 dev server  PID=' + $_.OwningProcess) }"
echo [INFO] 停止完成（端口 %PORT%）。
exit /b 0