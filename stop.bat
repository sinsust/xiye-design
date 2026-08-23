@echo off
chcp 65001 >nul 2>&1
set PORT=3000

powershell -NoProfile -Command "$cs=Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if(-not $cs){Write-Host '[INFO] 没有运行中的 dev server（端口 3000 空闲）'; exit}; foreach($id in @($cs.OwningProcess|Sort-Object -Unique)){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Host ('[OK] 已停止 dev server  PID='+$id) }"

echo 按任意键退出...
pause >nul
