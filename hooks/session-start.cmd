@echo off
REM Cross-platform wrapper for session-start hook (Windows CMD)
powershell.exe -ExecutionPolicy Bypass -File "%~dp0session-start.ps1"
