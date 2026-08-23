import os
import sys


def main():
    try:
        import win32com.client
    except ImportError:
        print("ERROR: pywin32 not installed")
        sys.exit(1)

    shell = win32com.client.Dispatch("WScript.Shell")
    try:
        desktop = shell.SpecialFolders("Desktop")
    except Exception:
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")

    target = r"D:\workspace\xiye\xiye-dev.exe"
    lnk_path = os.path.join(desktop, "Xiye Builder.lnk")
    lnk = shell.CreateShortcut(lnk_path)
    lnk.TargetPath = target
    lnk.WorkingDirectory = r"D:\workspace\xiye"
    lnk.Description = "Xiye Builder 开发服务器一键启动"
    lnk.IconLocation = target + ",0"
    lnk.Save()
    print("LNK created:", lnk_path)


if __name__ == "__main__":
    main()
