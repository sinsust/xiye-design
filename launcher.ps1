# 夕夜 Xiye · Windows 启动器（无窗口 + 系统托盘）
# 由 start.bat 以「隐藏窗口」方式调起：
#   ① 后台起 dev server（无黑窗口）→ ② 自动打开浏览器 → ③ 常驻系统托盘。
# 托盘右键可「打开界面 / 退出（停止服务）」；双击图标亦可打开界面。
# 另可双击 stop.bat 直接停止（会一并清掉托盘图标）。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$PORT = 3200
$appUrl = "http://localhost:$PORT"
$logOut = Join-Path $root 'dev.log'
$logErr = Join-Path $root 'dev.err.log'
$pidFile = Join-Path $root '.xiye-dev.pid'
$trayPidFile = Join-Path $root '.xiye-tray.pid'

function Show-Msg([string]$text, [string]$title = '夕夜 Xiye') {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($text, $title) | Out-Null
  } catch {
    Write-Host $text
  }
}

function Test-Port([int]$p) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $p)
    $c.Close()
    return $true
  } catch { return $false }
}

function Get-LogTail([int]$lines = 12) {
  if (Test-Path $logErr) {
    $e = Get-Content $logErr -Tail $lines -ErrorAction SilentlyContinue
    if ($e) { return ($e -join "`n") }
  }
  if (Test-Path $logOut) {
    $o = Get-Content $logOut -Tail $lines -ErrorAction SilentlyContinue
    if ($o) { return ($o -join "`n") }
  }
  return '（暂无日志）'
}

# PID 文件里的进程是否还活着（文件不存在 / 进程已退出 → false）
function Test-Alive([string]$path) {
  try {
    $id = (Get-Content $path -TotalCount 1 -ErrorAction Stop).Trim()
    if (-not $id) { return $false }
    return $null -ne (Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue)
  } catch { return $false }
}

# 停止 dev server：优先按 PID 文件整棵树杀；没有 PID 文件则按端口兜底
function Stop-DevServer {
  if (Test-Path $pidFile) {
    $id = (Get-Content $pidFile -TotalCount 1 -ErrorAction SilentlyContinue).Trim()
    if ($id) { taskkill /PID $id /T /F 2>$null | Out-Null }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    return
  }
  Get-NetTCPConnection -State Listen -LocalPort $PORT -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

# 托盘图标：按 app/icon.svg 的品牌图形（红底白 X）在内存里绘制，免外部素材
function New-TrayIcon {
  $size = 32
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # 圆角方块（红）
  $r = 8
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
  $path.AddArc($size - $r * 2, 0, $r * 2, $r * 2, 270, 90)
  $path.AddArc($size - $r * 2, $size - $r * 2, $r * 2, $r * 2, 0, 90)
  $path.AddArc(0, $size - $r * 2, $r * 2, $r * 2, 90, 90)
  $path.CloseFigure()
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(239, 68, 68))
  $g.FillPath($bg, $path)

  # 白色 X（两道斜线）+ 右上角小圆点
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White, 3.4)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, 11.9, 6.1, 20.1, 25.9)
  $g.DrawLine($pen, 20.1, 6.1, 11.9, 25.9)
  $dot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillEllipse($dot, 20.5, 2.7, 4, 4)

  $g.Dispose()
  $pen.Dispose()
  $bg.Dispose()
  $dot.Dispose()
  $path.Dispose()
  return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}

# 单实例：已有托盘常驻 → 只开浏览器，避免出现重复图标
if (Test-Alive $trayPidFile) {
  Start-Process $appUrl
  exit 0
}

# 1) 检查 Node / npm
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Show-Msg "未检测到 Node.js。`n请先安装 Node 18+（https://nodejs.org）后重试。"
  exit 1
}
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { $npm = (Get-Command npm -ErrorAction SilentlyContinue).Source }
if (-not $npm) {
  Show-Msg "未检测到 npm，请重新安装 Node.js。"
  exit 1
}

# 2) 缺依赖则安装（首次会弹出一个可见窗口，便于看到进度）
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Start-Process -FilePath $npm -ArgumentList 'install' -WorkingDirectory $root -Wait -NoNewWindow
  if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Show-Msg "依赖安装失败。`n请检查网络后重试，或在项目目录手动运行 npm install。"
    exit 1
  }
}

# 3) 端口已在响应 → 直接开浏览器，不重复起服务
if (-not (Test-Port $PORT)) {
  $proc = Start-Process -FilePath $npm -ArgumentList 'run', 'dev' `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $logOut -RedirectStandardError $logErr
  Set-Content -Path $pidFile -Value $proc.Id -Encoding ascii

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    if (Test-Port $PORT) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    Show-Msg "服务启动失败（端口 $PORT 未就绪）。`n`n最近日志：`n$(Get-LogTail)"
    taskkill /PID $proc.Id /T /F 2>$null | Out-Null
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    exit 1
  }
}

Start-Process $appUrl

# 4) 常驻系统托盘
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$icon = New-TrayIcon
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icon
$tray.Text = "Xiye - running  $appUrl"
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$title = New-Object System.Windows.Forms.ToolStripMenuItem
$title.Text = "夕夜 Xiye · 服务运行中"
$title.Enabled = $false
$open = New-Object System.Windows.Forms.ToolStripMenuItem
$open.Text = "打开界面"
$quit = New-Object System.Windows.Forms.ToolStripMenuItem
$quit.Text = "退出（停止服务）"
$menu.Items.Add($title) | Out-Null
$menu.Items.Add($open) | Out-Null
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$menu.Items.Add($quit) | Out-Null
$tray.ContextMenuStrip = $menu

$ctx = New-Object System.Windows.Forms.ApplicationContext

$open.add_Click({ Start-Process $appUrl })
$tray.add_DoubleClick({ Start-Process $appUrl })

$quit.add_Click({
  # 无论停止过程是否报错，都必须收掉图标并结束消息循环，避免托盘残留
  try { Stop-DevServer } finally {
    $tray.Visible = $false
    $tray.Dispose()
    Remove-Item $trayPidFile -ErrorAction SilentlyContinue
    $ctx.ExitThread()
  }
})

Set-Content -Path $trayPidFile -Value $PID -Encoding ascii
[System.Windows.Forms.Application]::Run($ctx)
Remove-Item $trayPidFile -ErrorAction SilentlyContinue