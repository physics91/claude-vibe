@echo off
REM Cross-platform wrapper for post-tool-use hook (Windows CMD)
powershell.exe -ExecutionPolicy Bypass -File "%~dp0post-tool-use.ps1"
