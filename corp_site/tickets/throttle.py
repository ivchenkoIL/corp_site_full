"""Простейший rate-limiting на кеше Django.

Анонимное создание заявок и комментариев разрешено политикой доступа
(см. README), но сайт доступен из интернета, поэтому частоту анонимных
записей ограничиваем по IP. Залогиненных пользователей не троттлим.
"""

from django.core.cache import cache


def client_ip(request) -> str:
    # За прокси Render реальный адрес приходит в X-Forwarded-For.
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def rate_limited(request, action: str, limit: int, window_seconds: int) -> bool:
    """True, если с этого IP действий больше limit за окно window_seconds."""
    key = f'throttle:{action}:{client_ip(request)}'
    if cache.add(key, 1, timeout=window_seconds):
        return False
    try:
        count = cache.incr(key)
    except ValueError:
        # Ключ истёк между add и incr — начинаем новое окно.
        cache.add(key, 1, timeout=window_seconds)
        return False
    return count > limit
