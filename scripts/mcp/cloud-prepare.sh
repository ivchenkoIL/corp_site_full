#!/usr/bin/env bash
# Подготовка облачной сессии Claude Code к работе с игрой:
#   1) Chrome for Testing (если в образе нет Chrome) — нужен обоим браузерным MCP;
#   2) прогрев npx-кэша @playwright/mcp и chrome-devtools-mcp, чтобы серверы
#      поднимались за секунды, а не качали пакеты при первом вызове.
#
# Запускается хуком SessionStart из .claude/settings.json. Без флага --force
# работает ТОЛЬКО в облаке (CLAUDE_CODE_REMOTE=true); на Mac молча выходит.
#
# Рекомендуется также вставить в поле «Setup script» окружения на claude.ai/code
# (результат кэшируется между сессиями, и скачивание не повторяется):
#   bash scripts/mcp/cloud-prepare.sh --force
set -u
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi
cd "$(dirname "$0")/../.." || exit 1

# shellcheck source=ensure-chrome.sh
. scripts/mcp/ensure-chrome.sh

{
  npx -y @playwright/mcp@latest --version
  npx -y chrome-devtools-mcp@latest --version
} >&2 2>&1 || true

# Единственная строка в stdout — попадает в контекст Claude Code как подсказка.
if [ -n "$MCP_CHROME_PATH" ]; then
  echo "montazh-mcp: браузер для MCP готов ($MCP_CHROME_PATH, headless=${MCP_HEADLESS:-0}). Игра: games/montazh-city-3d/index.html и games/montazh-city/index.html — открывать через playwright/chrome-devtools по file://."
else
  echo "montazh-mcp: Chrome не найден и не скачался — браузерные MCP работать не будут. Проверь сеть (storage.googleapis.com) или выполни: npx -y @puppeteer/browsers install chrome@stable --path ~/.cache/montazh-mcp/chrome"
fi
exit 0
