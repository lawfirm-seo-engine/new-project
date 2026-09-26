Set shell = CreateObject("WScript.Shell")
Set shortcut = shell.CreateShortcut(WScript.Arguments(1))
shortcut.TargetPath = WScript.Arguments(0)
shortcut.WorkingDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.Arguments(0))
shortcut.Description = "법무법인 선린 카페 원고·릴스 자동화"
shortcut.Save
