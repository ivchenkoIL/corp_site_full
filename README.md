# Corp Site

Учебный проект с системой заявок.

## Запуск проекта локально

1. Создайте и активируйте виртуальное окружение (пример для bash/zsh):
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
2. Установите зависимости из корня репозитория:
   ```bash
   pip install -r requirements.txt
   ```
3. Перейдите в директорию проекта `corp_site`:
   ```bash
   cd corp_site
   ```
4. Примените миграции перед работой и загрузкой фикстур:
   ```bash
   python manage.py migrate
   ```
5. (Опционально) Загрузите демонстрационные данные, чтобы сразу увидеть заявки и комментарии:
   ```bash
   python manage.py loaddata tickets/fixtures/sample.json
   ```
6. Запустите dev-сервер и откройте сайт в браузере по адресу http://127.0.0.1:8000/tickets/:
   ```bash
   python manage.py runserver
   ```

## Полезные команды

Все команды выполняются из директории `corp_site`:

- Применить миграции перед работой и загрузкой фикстур: `python manage.py migrate`.
- Импорт демонстрационных данных: `python manage.py loaddata tickets/fixtures/sample.json`.
- Запуск dev-сервера: `python manage.py runserver`.
- Запуск тестов: `python manage.py test`.

## Деплой на Render

Проект деплоится по Blueprint из `render.yaml`. Важно про базу данных:

- Без переменной `DATABASE_URL` используется SQLite на диске контейнера. На Render диск **эфемерный** — данные стираются при каждом деплое и рестарте.
- Чтобы данные сохранялись, создайте бесплатный Postgres (например, [Neon](https://neon.tech) или [Supabase](https://supabase.com)) и добавьте `DATABASE_URL` в переменные окружения сервиса в дашборде Render, например: `postgresql://user:password@host/dbname`.

Домен `*.onrender.com` подхватывается автоматически (через `RENDER_EXTERNAL_HOSTNAME`), отдельно настраивать `ALLOWED_HOSTS` и `CSRF_TRUSTED_ORIGINS` не нужно.

### AI-генерация изображений (Reve API)

Эндпоинт `POST /api/ai/generate/` проксирует запросы к [Reve Image API](https://api.reve.com/console) — используется кнопкой «AI-картинка» в ColorFlow. Ключ API живёт **только на сервере**:

- В Render Dashboard → Environment добавьте `REVE_API_KEY` (значение вида `papi.…`). Локально: `export REVE_API_KEY=...` перед `runserver`.
- `AI_DAILY_LIMIT` — максимум генераций в сутки через наш сервер (по умолчанию 40). Лимит защищает баланс кредитов: одна генерация стоит 18 кредитов ≈ $0.024, минимальное пополнение $10 = 7500 кредитов ≈ 415 картинок.
- `AI_CORS_ORIGINS` — список origin через запятую, которым разрешён доступ (по умолчанию `*`; для продакшена укажите адрес GitHub Pages, например `https://username.github.io`).
- `GET /api/ai/generate/` возвращает статус: настроен ли ключ и сколько генераций осталось сегодня.

**Никогда не коммитьте ключ в репозиторий.** Если ключ засветился (в чате, логах, коммите) — сразу перевыпустите его в консоли Reve.

### Администратор на проде

Редактирование и удаление заявок доступны только залогиненным пользователям. Чтобы создать администратора на Render, добавьте в переменные окружения сервиса `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_PASSWORD` (и опционально `DJANGO_SUPERUSER_EMAIL`) — пользователь создастся автоматически при следующем деплое. Локально: `python manage.py createsuperuser`.

## Частые проблемы

- Ошибка `ModuleNotFoundError: No module named 'django'` означает, что зависимости не установлены. Проверьте, что из корня репозитория выполнили `pip install -r requirements.txt` и активировали виртуальное окружение.
- Если команда `python manage.py ...` не находится, убедитесь, что перед запуском перешли в директорию `corp_site` (см. шаг 3 в инструкции выше).
