#!/usr/bin/env bash
# Общая часть для обёрток MCP-серверов (scripts/mcp/*.sh).
# Подбирает браузер и флаги под платформу, ничего не пишет в stdout
# (stdout принадлежит MCP-протоколу — любой лишний вывод ломает соединение).
#
# Результат — переменные окружения:
#   MCP_CHROME_PATH   путь к бинарнику Chrome/Chromium ("" = пусть сервер ищет сам)
#   MCP_HEADLESS      "1" — без окна (облако/Linux), "" — с окном (Mac)
#   MCP_CHROME_ARGS   доп. аргументы Chrome через пробел (WebGL без GPU, sandbox)
#
# Переопределения:
#   MCP_HEADLESS=1|0         принудительно headless / с окном
#   MCP_CHROME_PATH=/путь    свой браузер

set -u

_os="$(uname -s 2>/dev/null || echo unknown)"
_cache="${XDG_CACHE_HOME:-$HOME/.cache}/montazh-mcp"
mkdir -p "$_cache" 2>/dev/null || true

: "${MCP_CHROME_PATH:=}"
: "${MCP_HEADLESS:=}"
MCP_CHROME_ARGS=""

# --- поиск браузера -------------------------------------------------------
_find_mac_chrome() {
  local c
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
}

_find_linux_chrome() {
  local c
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    command -v "$c" >/dev/null 2>&1 && { command -v "$c"; return; }
  done
  # Chrome for Testing, скачанный этим скриптом ранее
  c="$(ls -d "$_cache"/chrome/chrome/linux-*/chrome-linux64/chrome 2>/dev/null | head -1)"
  [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return; }
  # Chromium из Playwright, если уже скачан (типовые места)
  local pw
  for pw in "${PLAYWRIGHT_BROWSERS_PATH:-}" "$HOME/.cache/ms-playwright" /opt/pw-browsers /ms-playwright; do
    [ -n "$pw" ] && [ -d "$pw" ] || continue
    c="$(ls -d "$pw"/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1)"
    [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return; }
  done
  # Chrome for Testing из кэша puppeteer
  c="$(ls -d "$HOME"/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome 2>/dev/null | head -1)"
  [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return; }
}

_install_linux_chrome() {
  # Chrome for Testing качается со storage.googleapis.com — этот домен есть в
  # списке разрешённых для облачных сессий Claude Code (уровень Trusted).
  # flock: если параллельно качает хук SessionStart — ждём его, а не качаем дважды.
  (
    flock 9 || exit 1
    c="$(ls -d "$_cache"/chrome/chrome/linux-*/chrome-linux64/chrome 2>/dev/null | head -1)"
    if [ -z "$c" ]; then
      echo "[montazh-mcp] Chrome не найден — скачиваю Chrome for Testing в $_cache/chrome (~170 МБ, 1–3 мин) ..." >&2
      npx -y @puppeteer/browsers install chrome@stable --path "$_cache/chrome" >&2 2>&1 || exit 1
    fi
  ) 9>"$_cache/chrome.lock" || return 1
  ls -d "$_cache"/chrome/chrome/linux-*/chrome-linux64/chrome 2>/dev/null | head -1
}

case "$_os" in
  Darwin)
    [ -z "$MCP_CHROME_PATH" ] && MCP_CHROME_PATH="$(_find_mac_chrome)"
    # На Mac по умолчанию показываем окно: настоящий GPU, видно, что делает агент.
    [ "$MCP_HEADLESS" = "0" ] && MCP_HEADLESS=""
    ;;
  *)
    [ -z "$MCP_CHROME_PATH" ] && MCP_CHROME_PATH="$(_find_linux_chrome)"
    [ -z "$MCP_CHROME_PATH" ] && MCP_CHROME_PATH="$(_install_linux_chrome || true)"
    # В облаке дисплея нет — всегда headless.
    [ "$MCP_HEADLESS" = "0" ] || MCP_HEADLESS="1"
    # WebGL2 без видеокарты: программный рендер SwiftShader.
    MCP_CHROME_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist"
    # В контейнере процесс идёт от root — песочница Chrome не стартует.
    if [ "$(id -u)" = "0" ]; then
      MCP_CHROME_ARGS="$MCP_CHROME_ARGS --no-sandbox --disable-setuid-sandbox"
    fi
    ;;
esac

# Пустую строку headless приводим к "" (а не "0"), чтобы работало ${VAR:+...}
[ "$MCP_HEADLESS" = "1" ] || MCP_HEADLESS=""

export MCP_CHROME_PATH MCP_HEADLESS MCP_CHROME_ARGS
