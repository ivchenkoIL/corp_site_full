# ColorFlow — браузерная разукрашка-рисовалка (PWA)

Чистый HTML5 + CSS3 + vanilla JavaScript, без фреймворков. Pointer Events с pressure sensitivity, многослойность, глубокий undo/redo, 6 инструментов, palette-tabs, pinch-zoom, импорт фото, symmetry/мандала, timelapse, шаблоны для раскрашивания, AI-mock и галерея. Полноценный PWA: service worker, IndexedDB-автосейв, install prompt, offline.

## Запуск локально

PWA-фичи требуют HTTPS (или `localhost`), поэтому из `file://` сервис-воркер не зарегистрируется. Достаточно любого локального HTTP-сервера:

```bash
cd colorflow
python -m http.server 8765
# открыть http://127.0.0.1:8765/
```

Или любой другой статический сервер: `npx serve`, `caddy file-server`, `php -S`, и т. д.

## Структура

```
colorflow/
├── index.html              ← layout, meta, ссылки на ресурсы
├── manifest.json           ← PWA manifest (icons + theme + start_url)
├── sw.js                   ← Service Worker (precache + stale-while-revalidate)
├── css/styles.css          ← mobile-first, темная/светлая/auto тема
├── js/
│   ├── app.js              ← bootstrap + горячие клавиши + PWA-регистрация
│   ├── canvas.js           ← движок: слои, инструменты, история, симметрия, timelapse
│   ├── ui.js               ← инициализация UI, биндинги, диалоги
│   └── storage.js          ← localStorage helper + IndexedDB scene autosave
└── assets/
    ├── icons/              ← icon.svg + PNG 180/192/512 + maskable + iOS splash
    └── templates/          ← SVG-контуры для раскрашивания + index.json каталог
```

Все пути относительные (`./...`), поэтому приложение работает на любом базовом URL.

## Публикация на GitHub Pages

В репозитории есть готовый workflow `.github/workflows/colorflow-pages.yml`. Он деплоит содержимое `colorflow/` как корень сайта, поэтому `index.html` оказывается по адресу `/index.html`.

Шаги:

1. Зайти в **Settings → Pages**.
2. В разделе «Build and deployment», поле **Source**, выбрать **GitHub Actions**.
3. Сделать push в ветку `main` (или вызвать workflow вручную: **Actions → Deploy ColorFlow → Run workflow**).
4. После завершения workflow URL приложения появится в шаге `deploy`.

Workflow триггерится автоматически на push в `main`, если изменены файлы под `colorflow/**`.

### Альтернатива без Actions

Если хотите развернуть без workflow — настройте Pages на ветку с PWA-файлами в корне (например, отдельная ветка `pages`) и просто скопируйте содержимое `colorflow/` в корень этой ветки. Все ресурсы используют относительные пути, поэтому работают и из подпапки.

## Регенерация иконок

PNG-иконки и iOS-сплеши собираются из `assets/icons/icon.svg`:

```bash
pip install cairosvg
python bin/generate_pwa_icons.py
```

## Поддержка браузеров

| Фича | Минимальная версия |
| --- | --- |
| Pointer Events + pressure | Chromium 70+, Safari 13+, Firefox 59+ |
| Service Worker / Cache API | Chromium 45+, Safari 11.1+, Firefox 44+ |
| Web Share Files API | Chromium 89+, Safari 15+ (iOS), нет в Firefox |
| `MediaRecorder` (timelapse) | Chromium 49+, Safari 14.1+, Firefox 25+ |
| `<dialog>` element | Chromium 37+, Safari 15.4+, Firefox 98+ |
| `navigator.storage.persist()` | Chromium 55+, Firefox 55+, Safari 15.2+ |

В iOS install через **Поделиться → На экран «Домой»**. Сценарии офлайн и автосейв работают одинаково на всех платформах.

## Хоткеи

| Действие | Сочетание |
| --- | --- |
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` или `Ctrl + Y` |
| Pinch-to-zoom / pan | 2 пальца на холсте |
| Сбросить масштаб | Тап на чип «100%» в углу |

## API расширения

* `window.CF_AI_ENDPOINT = 'https://your-backend/magic'` — если задано до загрузки UI, кнопка «Magic Fill» постит активный слой как PNG и заменяет его ответом сервера. По умолчанию работает локальный фоллбек (saturate + contrast filter).

## Лицензия

Используйте свободно в учебных целях.
