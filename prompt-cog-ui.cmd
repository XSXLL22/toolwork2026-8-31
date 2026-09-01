@echo off
rem prompt-cog 可视化窗口入口（自动打开浏览器）。首次运行会自动编译。
rem 可附加参数：--port <n>、--no-open、提示词等。
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
node "%ROOT%dist\cli.js" ui %*
endlocal
