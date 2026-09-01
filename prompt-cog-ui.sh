#!/usr/bin/env bash
# prompt-cog 可视化窗口入口（Git Bash / WSL，自动打开浏览器）。首次运行会自动编译。
# 可附加参数：--port <n>、--no-open、提示词等。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
if [ ! -f dist/cli.js ]; then
  echo "[prompt-cog] 首次运行，正在编译..."
  npm run build
fi
node dist/cli.js ui "$@"
