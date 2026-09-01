#!/usr/bin/env bash
# prompt-cog 命令行入口（Git Bash / WSL，透传所有参数）。首次运行会自动编译。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
if [ ! -f dist/cli.js ]; then
  echo "[prompt-cog] 首次运行，正在编译..."
  npm run build
fi
node dist/cli.js "$@"
