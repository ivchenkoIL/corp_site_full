#!/usr/bin/env bash
# =====================================================================
# mac-baseline.sh — снять базу на Mac одной командой.
#
#   cd games/montazh-city-3d && bash tools/mac-baseline.sh
#   cd games/montazh-city-3d && bash tools/mac-baseline.sh --dry   # только проверка
#
# Сам разбирается, где лежит игра, ставит playwright и браузеры, если их
# нет, гоняет три сцены в Chromium и в WebKit, снимает профиль главного
# потока и складывает сравнительную таблицу.
#
# Результаты: docs/perf/mac-*.json, docs/perf/mac-compare.md,
#             docs/shots/00-base-mac/
# =====================================================================
set -u

DRY=0
for a in "$@"; do [ "$a" = "--dry" ] && DRY=1; done

SELF="${BASH_SOURCE[0]:-$0}"
HERE="$(cd "$(dirname "$SELF")" && pwd)"
GAME="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$GAME/../.." && pwd)"
cd "$GAME" || exit 1

echo "Игра:        $GAME"
echo "Репозиторий: $REPO"

if [ ! -f "$GAME/index.html" ]; then
  echo "Не вижу index.html рядом со скриптом. Запускать так:"
  echo "    cd <клон>/games/montazh-city-3d && bash tools/mac-baseline.sh"
  exit 1
fi

# --- playwright ---------------------------------------------------------
PW_CHECK='import("'"$GAME"'/tools/find-playwright.mjs").then(m=>console.log(m.loadPlaywright().from))'
if PW_AT=$(node --input-type=module -e "$PW_CHECK" 2>/dev/null); then
  echo "playwright:  $PW_AT"
else
  echo
  echo "playwright не найден — ставлю рядом с игрой."
  if [ "$DRY" = "1" ]; then echo "(--dry: пропускаю установку)"; else
    [ -f package.json ] || npm init -y >/dev/null
    npm i -D playwright || exit 1
  fi
fi

echo
if [ "$DRY" = "1" ]; then
  echo "--dry: браузеры не скачиваю, прогоны не запускаю."
  echo "Всё на месте — можно запускать без --dry."
  exit 0
fi
echo "Проверяю браузеры (если уже скачаны, шаг быстрый)…"
npx playwright install chromium webkit || {
  echo "Не удалось скачать браузеры. Chromium обычно уже есть; без WebKit"
  echo "сравнения движков не будет, остальное снимется."
}

# --- прогоны ------------------------------------------------------------
SHOTS="$REPO/docs/shots/00-base-mac"
PERF="$REPO/docs/perf"
mkdir -p "$SHOTS" "$PERF"

COMMON="--scene=all --warmup=12 --measure=40 --profile=15 --minFrames=60 --width=1440 --height=900 --dpr=2"

echo
echo "=== Chromium ==="
# shellcheck disable=SC2086
node tools/perf-probe.mjs --browser=chromium $COMMON \
  --shots="docs/shots/00-base-mac" --out="docs/perf/mac-chromium.json" || exit 1

echo
echo "=== WebKit (движок Safari) ==="
# shellcheck disable=SC2086
if node tools/perf-probe.mjs --browser=webkit $COMMON \
     --shots="docs/shots/00-base-mac" --out="docs/perf/mac-webkit.json"; then
  WEBKIT_OK=1
else
  echo "WebKit не отработал — сравнение пропускаю."
  WEBKIT_OK=0
fi

echo
echo "=== Профиль главного потока (Chromium) ==="
for s in street dense traffic; do
  node tools/perf-trace.mjs --scene=$s --seconds=20 --width=1440 --height=900 --dpr=2 \
    --out="docs/perf/mac-trace-$s.json" || true
done

if [ "${WEBKIT_OK:-0}" = "1" ]; then
  echo
  echo "=== Сводная таблица ==="
  node tools/compare.mjs "$PERF/mac-chromium.json" "$PERF/mac-webkit.json" \
    --out="$PERF/mac-compare.md" && sed -n '1,60p' "$PERF/mac-compare.md"
fi

echo
echo "Готово. Что получилось:"
ls -la "$PERF" | sed 's/^/    /'
echo
echo "Осталось снять настоящий Safari (WebKit из playwright — это не он):"
echo "    Safari → Настройки → Дополнения → «Показывать меню Разработка»"
echo "    открыть $GAME/index.html, Разработка → Веб-инспектор → Консоль"
echo "    вставить содержимое tools/ext-probe.js"
