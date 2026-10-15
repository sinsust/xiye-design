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

    here = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(here, "start.vbs")
    lnk_path = os.path.join(desktop, "Xiye Builder.lnk")
    lnk = shell.CreateShortcut(lnk_path)
    lnk.TargetPath = target
    lnk.WorkingDirectory = here
    lnk.Description = "Xiye Builder 开发服务器一键启动（无窗口）"
    lnk.IconLocation = os.path.join(here, "app", "icon.svg") + ",0"
    lnk.Save()
    print("LNK created:", lnk_path)


if __name__ == "__main__":
    main()
