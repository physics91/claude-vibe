@echo off
REM Cross-platform wrapper for user-prompt-submit hook (Windows CMD)
powershell.exe -ExecutionPolicy Bypass -File "%~dp0user-prompt-submit.ps1"
