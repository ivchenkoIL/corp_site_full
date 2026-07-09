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

## Политика доступа

- Просмотр, создание заявок и комментарии доступны **без входа** — это осознанное
  решение для внутреннего инструмента с низким порогом подачи заявки.
  Анонимные записи ограничены по частоте с одного IP (`tickets/throttle.py`),
  политика зафиксирована тестами (`TicketAuthorTests`).
- Редактирование и перенос в архив — только для залогиненных.
- Удаление мягкое: заявка уходит в архив (`is_archived`) вместе с комментариями
  и может быть восстановлена; физического удаления из интерфейса нет.

## Деплой на Render

Проект деплоится по Blueprint из `render.yaml`.

- **`DATABASE_URL` обязателен.** Без него приложение намеренно не стартует
  (fail-fast в `settings.py`): на эфемерном диске Render SQLite терял бы данные
  при каждом деплое. Создайте бесплатный Postgres (например, [Neon](https://neon.tech)
  или [Supabase](https://supabase.com)) и добавьте `DATABASE_URL` в переменные
  окружения сервиса: `postgresql://user:password@host/dbname`.
- **Деплой гейтится на CI.** `autoDeploy` в `render.yaml` выключен; после зелёных
  тестов на `main` job `deploy` в `.github/workflows/django.yml` дёргает deploy-хук.
  Для этого добавьте секрет `RENDER_DEPLOY_HOOK_URL` (Render Dashboard → corp-site →
  Settings → Deploy Hook) в GitHub → Settings → Secrets → Actions.

Домен `*.onrender.com` подхватывается автоматически (через `RENDER_EXTERNAL_HOSTNAME`), отдельно настраивать `ALLOWED_HOSTS` и `CSRF_TRUSTED_ORIGINS` не нужно.

### Администратор на проде

Редактирование и удаление заявок доступны только залогиненным пользователям. Чтобы создать администратора на Render, добавьте в переменные окружения сервиса `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_PASSWORD` (и опционально `DJANGO_SUPERUSER_EMAIL`) — пользователь создастся автоматически при следующем деплое. Локально: `python manage.py createsuperuser`.

## Частые проблемы

- Ошибка `ModuleNotFoundError: No module named 'django'` означает, что зависимости не установлены. Проверьте, что из корня репозитория выполнили `pip install -r requirements.txt` и активировали виртуальное окружение.
- Если команда `python manage.py ...` не находится, убедитесь, что перед запуском перешли в директорию `corp_site` (см. шаг 3 в инструкции выше).
