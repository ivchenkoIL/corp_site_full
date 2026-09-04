#!/usr/bin/env bash
# Обёртка Playwright MCP для Claude Code (см. .mcp.json).
# Открывает игру (file:// или http://), снимает скриншоты, жмёт клавиши,
# читает консоль, выполняет JS в странице. Работает и на Mac (с окном),
# и в облачной сессии Claude Code (headless, WebGL через SwiftShader).
set -u
cd "$(dirname "$0")/../.." || exit 1
ROOT="$PWD"
# shellcheck source=ensure-chrome.sh
. "$ROOT/scripts/mcp/ensure-chrome.sh"

CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/montazh-mcp"
CFG="$CACHE/playwright-config.json"

# Аргументы Chrome (WebGL без GPU, sandbox) передаются только через config-файл.
{
  printf '{"browser":{"launchOptions":{"args":['
  first=1
  for a in $MCP_CHROME_ARGS; do
    [ $first = 1 ] || printf ','
    printf '"%s"' "$a"; first=0
  done
  printf ']}}}\n'
} > "$CFG"

set -- \
  --config "$CFG" \
  --viewport-size 1280x720 \
  --isolated \
  --allow-unrestricted-file-access \
  --output-dir "$ROOT/.playwright-mcp" \
  --timeout-settle 800 \
  --console-level info \
  "$@"

[ -n "$MCP_HEADLESS" ]    && set -- --headless "$@"
[ -n "$MCP_CHROME_PATH" ] && set -- --executable-path "$MCP_CHROME_PATH" "$@"
case " $MCP_CHROME_ARGS " in *" --no-sandbox "*) set -- --no-sandbox "$@";; esac

exec npx -y @playwright/mcp@latest "$@"
