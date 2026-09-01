@echo off
rem prompt-cog 命令行入口（透传所有参数）。首次运行会自动编译。
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
if not exist "%ROOT%dist\cli.js" (
  echo [prompt-cog] 首次运行，正在编译...
  call npm run build
  if errorlevel 1 (
    echo [prompt-cog] 编译失败，请先执行 npm install。
    exit /b 1
  )
)
node "%ROOT%dist\cli.js" %*
endlocal
