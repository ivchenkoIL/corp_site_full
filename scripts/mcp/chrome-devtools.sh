#!/usr/bin/env bash
# Обёртка Chrome DevTools MCP для Claude Code (см. .mcp.json).
# Даёт агенту настоящие DevTools: трассировка производительности (FPS, долгие
# кадры), консоль, сеть, эмуляция CPU/сети, скриншоты, выполнение JS.
# На Mac открывает установленный Chrome с окном; в облаке — headless.
set -u
cd "$(dirname "$0")/../.." || exit 1
ROOT="$PWD"
# shellcheck source=ensure-chrome.sh
. "$ROOT/scripts/mcp/ensure-chrome.sh"

set -- \
  --isolated \
  --viewport 1280x720 \
  --no-usage-statistics \
  --no-performance-crux \
  --no-page-id-routing \
  --screenshotFormat jpeg \
  --screenshotQuality 80 \
  "$@"

for a in $MCP_CHROME_ARGS; do set -- "--chromeArg=$a" "$@"; done
[ -n "$MCP_HEADLESS" ]    && set -- --headless "$@"
[ -n "$MCP_CHROME_PATH" ] && set -- --executablePath "$MCP_CHROME_PATH" "$@"

exec npx -y chrome-devtools-mcp@latest "$@"
