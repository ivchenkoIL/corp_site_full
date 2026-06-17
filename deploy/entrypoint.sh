#!/bin/sh
set -e

echo "Applying database migrations..."
python manage.py migrate --no-input

echo "Loading initial data..."
python manage.py loaddata categories 2>/dev/null || true

echo "Starting server..."
exec "$@"
