@echo off
CHCP 65001 >nul
if /i "%1"=="ui" (
    node "%~dp0ui\launch.js"
) else (
    node "%~dp0clai.js" %*
)