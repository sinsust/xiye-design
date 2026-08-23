#!/bin/bash
# Xiye Builder - 桌面一键启动（macOS / Linux）
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "ERROR: node not found, please install Node 18+"; exit 1; }

if [ ! -d "node_modules" ]; then
  echo "INFO: node_modules not found, installing dependencies..."
  npm install || { echo "ERROR: npm install failed"; exit 1; }
fi

PORT=3000

# 若端口已在响应，假定 dev server 已运行，直接打开浏览器，避免重复启动导致端口跳变
if curl -s -o /dev/null --max-time 3 http://localhost:$PORT 2>/dev/null; then
  echo "INFO: port $PORT already responding, dev server may be running, opening browser."
  ( open http://localhost:$PORT 2>/dev/null || xdg-open http://localhost:$PORT 2>/dev/null )
  exit 0
fi

echo "INFO: starting Xiye Builder dev server..."
# 延迟 6 秒打开浏览器（子进程，不阻塞 dev 日志输出）
( sleep 6; open http://localhost:$PORT 2>/dev/null || xdg-open http://localhost:$PORT 2>/dev/null ) &
npm run dev
