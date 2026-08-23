#!/usr/bin/env python3
# Xiye Builder - 无黑窗一键启动器（打包为 xiye-dev.exe 后使用）
# 逻辑与 start.bat 一致：定位项目 -> 检查 Node/npm -> 缺依赖自动装 -> 端口占用则直接开浏览器 -> 否则后台启动 dev 并自动开浏览器
#
# 与 start.bat 的关键差异：桌面双击 exe 启动时，进程环境 PATH 里通常没有 npm
# （npm 在 Windows 上是 npm.cmd，需要 cmd.exe 才能执行）。因此本脚本主动按多路径
# 定位 node / npm.cmd，并用 shell=True 调用，避免 FileNotFoundError。
import os
import sys
import time
import socket
import shutil
import subprocess
import webbrowser

PORT = 3200
DEFAULT_BASE = r"D:\workspace\xiye"

# 已知 Node 安装位置（用于 PATH 缺 npm 时兜底定位）
NODE_CANDIDATES = [
    r"C:\Program Files\nodejs\node.exe",
    r"C:\Program Files (x86)\nodejs\node.exe",
    r"C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe",
    r"C:\Users\Administrator\.workbuddy\binaries\node\versions\24.14.0\node.exe",
]
NPM_DIR_CANDIDATES = [
    r"C:\Program Files\nodejs",
    r"C:\Program Files (x86)\nodejs",
    r"C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2",
    r"C:\Users\Administrator\.workbuddy\binaries\node\versions\24.14.0",
]


def resolve_base():
    env = os.environ.get("XIYE_PROJECT")
    if env and os.path.isfile(os.path.join(env, "package.json")):
        return env
    if len(sys.argv) > 1 and os.path.isfile(os.path.join(sys.argv[1], "package.json")):
        return sys.argv[1]
    cwd = os.getcwd()
    if os.path.isfile(os.path.join(cwd, "package.json")):
        return cwd
    return DEFAULT_BASE


BASE = resolve_base()


def find_node():
    p = shutil.which("node")
    if p:
        return p
    for c in NODE_CANDIDATES:
        if os.path.isfile(c):
            return c
    return None


def find_npm():
    # 1) PATH 里直接找 npm.cmd / npm
    for name in ("npm.cmd", "npm"):
        p = shutil.which(name)
        if p:
            return p
    # 2) 紧挨 node.exe 的目录（managed node 常把 npm 放同目录）
    node = find_node()
    if node:
        d = os.path.dirname(node)
        for name in ("npm.cmd", "npm"):
            c = os.path.join(d, name)
            if os.path.isfile(c):
                return c
    # 3) 已知 Node 安装目录兜底
    for d in NPM_DIR_CANDIDATES:
        for name in ("npm.cmd", "npm"):
            c = os.path.join(d, name)
            if os.path.isfile(c):
                return c
    return None


def log_err(msg):
    try:
        with open(os.path.join(BASE, "launcher-error.log"), "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass


def show_error(msg):
    """无黑窗 exe 静默会看不到错误，改用系统弹窗（失败则写日志）。"""
    log_err(msg)
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, msg, "Xiye Builder 启动失败", 0x10)
    except Exception:
        pass


def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def kill_existing_xiye_dev():
    """Next.js 只允许一个 dev server（.next 锁）。若之前有本项目残留的 next dev
    （任何端口，如改端口前的 3001），新 next dev 会因
    'Another next dev server is already running' 拒绝启动，导致浏览器连到死端口。
    启动前先清掉命令行含 workspace\\xiye 且含 next 的 node 进程。"""
    try:
        ps = (
            "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" "
            "-ErrorAction SilentlyContinue | Where-Object { "
            "$_.CommandLine -like '*workspace\\xiye*' -and $_.CommandLine -like '*next*' "
            "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force "
            "-ErrorAction SilentlyContinue; Write-Host ('  killed stale xiye dev PID ' + $_.ProcessId) }"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True, text=True, timeout=30,
        )
    except Exception:
        pass


def main():
    node = find_node()
    if node is None:
        show_error("[ERROR] 未检测到 Node.js，请先安装 Node 18+。\n已尝试路径：" + "、".join(NODE_CANDIDATES))
        return

    npm = find_npm()
    if npm is None:
        show_error("[ERROR] 未检测到 npm（npm.cmd）。请确认 Node 安装完整，或把 Node 目录加入系统 PATH。")
        return

    # 把 node 所在目录注入 PATH，保证 npm 内部调用的 node 版本一致
    env = os.environ.copy()
    node_dir = os.path.dirname(node)
    env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")

    # 清掉本项目残留的 next dev（避免 "Another next dev server is already running"）
    kill_existing_xiye_dev()
    time.sleep(2)

    if not os.path.isdir(os.path.join(BASE, "node_modules")):
        try:
            subprocess.run(f'"{npm}" install', shell=True, cwd=BASE, env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
        except Exception as e:
            show_error(f"[ERROR] 依赖安装失败：{e}")

    if port_open(PORT):
        webbrowser.open(f"http://localhost:{PORT}")
        return

    # Windows: CREATE_NO_WINDOW = 0x08000000 隐藏子进程黑窗口
    flags = 0x08000000 if sys.platform == "win32" else 0
    subprocess.Popen(
        f'"{npm}" run dev',
        shell=True,
        cwd=BASE,
        env=env,
        creationflags=flags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    for _ in range(90):
        if port_open(PORT):
            break
        time.sleep(1)

    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    main()
