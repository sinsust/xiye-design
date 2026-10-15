' 夕夜 Xiye · 无窗口启动器
' 双击本文件：完全不弹任何命令行窗口，后台静默起 dev server + 自动开浏览器。
' 原理：wscript 以隐藏窗口（参数 0）调起 powershell -WindowStyle Hidden 运行 launcher.ps1。
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "\launcher.ps1""", 0, False
