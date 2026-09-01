@echo off
chcp 65001 >nul 2>&1
setlocal

:: 切换到脚本所在目录（支持桌面/任意位置双击，不再写死路径）
cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] 未检测到 Node.js，请先安装 Node 18+ 并加入 PATH。
    pause
    exit /b 1
)

:: 缺失依赖则自动安装
if not exist "node_modules" (
    echo [INFO] 未检测到 node_modules，正在自动安装依赖...
    call npm install
    if errorlevel 1 (
        echo [ERROR] 依赖安装失败，请检查网络或 npm 配置。
        pause
        exit /b 1
    )
)

set PORT=3200

:: 若端口已在响应，假定 dev server 已运行，直接打开浏览器，避免重复启动导致端口跳变
powershell -NoProfile -Command "if(Test-NetConnection -ComputerName localhost -Port 3200 -InformationLevel Quiet -WarningAction SilentlyContinue){ exit 0 } else { exit 1 }"
if not errorlevel 1 (
    echo [INFO] 端口 %PORT% 已在响应，dev server 可能已运行，直接打开浏览器。
    start http://localhost:%PORT%
    exit /b 0
)

:: 新窗口启动 dev server（独立进程，关闭该窗口即停止服务）
echo [INFO] 正在启动 Xiye Builder dev server ...
start "Xiye Builder Dev" cmd /c "npm run dev"

:: 等待并自动打开浏览器
echo [INFO] 6 秒后自动打开浏览器 http://localhost:%PORT% ...
timeout /t 6 /nobreak >nul
start http://localhost:%PORT%

exit /b 0
