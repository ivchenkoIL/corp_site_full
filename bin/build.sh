#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

cd corp_site
python manage.py collectstatic --no-input
python manage.py migrate

# Создаём администратора, если заданы DJANGO_SUPERUSER_USERNAME и
# DJANGO_SUPERUSER_PASSWORD (createsuperuser --noinput читает их сам).
# Повторный запуск не падает: существующий пользователь просто пропускается.
if [[ -n "${DJANGO_SUPERUSER_USERNAME:-}" && -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]]; then
  python manage.py createsuperuser --noinput || true
fi
