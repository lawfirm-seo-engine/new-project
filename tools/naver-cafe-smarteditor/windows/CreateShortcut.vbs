Set shell = CreateObject("WScript.Shell")
Set shortcut = shell.CreateShortcut(WScript.Arguments(1))
shortcut.TargetPath = WScript.Arguments(0)
shortcut.WorkingDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.Arguments(0))
shortcut.Description = "GNLAW SmartEditor Automation"
shortcut.Save
