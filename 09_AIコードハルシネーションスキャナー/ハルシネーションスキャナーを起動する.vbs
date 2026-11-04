Set shell = CreateObject("WScript.Shell")
scriptPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptPath
shell.Run """AIハルシネーションスキャナー.exe""", 0, False
shell.Run """AIハルシネーションスキャナー起動.html""", 1, False
