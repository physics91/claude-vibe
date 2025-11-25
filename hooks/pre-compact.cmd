@echo off
REM Cross-platform wrapper for pre-compact hook (Windows CMD)
powershell.exe -ExecutionPolicy Bypass -File "%~dp0pre-compact.ps1"
