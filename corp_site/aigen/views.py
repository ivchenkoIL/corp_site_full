"""Прокси к Reve Image API (https://api.reve.com/v1/image/create).

Ключ REVE_API_KEY хранится только на сервере (переменная окружения),
в браузер он никогда не попадает. Дневной лимит генераций защищает
баланс кредитов от случайного/злонамеренного расхода.
"""

import base64
import json
import os
import urllib.error
import urllib.request

from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import GenerationLog

REVE_CREATE_URL = 'https://api.reve.com/v1/image/create'
ALLOWED_ASPECT_RATIOS = {'16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '1:1'}
MAX_PROMPT_LENGTH = 2560
UPSTREAM_TIMEOUT = 90  # секунд; генерация обычно занимает 10–30 с


def _daily_limit():
    try:
        return max(0, int(os.environ.get('AI_DAILY_LIMIT', '40')))
    except ValueError:
        return 40


def _used_today():
    today_start = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    return GenerationLog.objects.filter(created_at__gte=today_start).count()


def _cors(response, request):
    """ColorFlow живёт на GitHub Pages — другой origin, поэтому CORS.

    AI_CORS_ORIGINS: список разрешённых origin через запятую, либо `*`.
    """
    allowed = os.environ.get('AI_CORS_ORIGINS', '*')
    origin = request.headers.get('Origin', '')
    if allowed == '*':
        response['Access-Control-Allow-Origin'] = '*'
    elif origin and origin in [o.strip() for o in allowed.split(',')]:
        response['Access-Control-Allow-Origin'] = origin
        response['Vary'] = 'Origin'
    response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


def _json(request, payload, status=200):
    return _cors(JsonResponse(payload, status=status), request)


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS', 'GET'])
def generate_image(request):
    if request.method == 'OPTIONS':
        return _cors(HttpResponse(status=204), request)

    limit = _daily_limit()
    used = _used_today()

    # GET — статус: настроен ли ключ и сколько генераций осталось сегодня.
    if request.method == 'GET':
        return _json(request, {
            'configured': bool(os.environ.get('REVE_API_KEY')),
            'daily_limit': limit,
            'used_today': used,
            'remaining_today': max(0, limit - used),
        })

    api_key = os.environ.get('REVE_API_KEY')
    if not api_key:
        return _json(request, {'error': 'REVE_API_KEY не настроен на сервере.'}, status=503)

    if used >= limit:
        return _json(request, {
            'error': f'Дневной лимит генераций исчерпан ({limit} в сутки). Попробуйте завтра.',
            'remaining_today': 0,
        }, status=429)

    try:
        body = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return _json(request, {'error': 'Некорректный JSON.'}, status=400)

    prompt = (body.get('prompt') or '').strip()
    if not prompt:
        return _json(request, {'error': 'Поле prompt обязательно.'}, status=400)
    if len(prompt) > MAX_PROMPT_LENGTH:
        return _json(request, {'error': f'Prompt длиннее {MAX_PROMPT_LENGTH} символов.'}, status=400)

    aspect_ratio = body.get('aspect_ratio') or '1:1'
    if aspect_ratio not in ALLOWED_ASPECT_RATIOS:
        return _json(request, {'error': f'Недопустимый aspect_ratio. Разрешены: {", ".join(sorted(ALLOWED_ASPECT_RATIOS))}.'}, status=400)

    upstream_payload = {
        'prompt': prompt,
        'aspect_ratio': aspect_ratio,
        'version': 'latest',
    }

    req = urllib.request.Request(
        REVE_CREATE_URL,
        data=json.dumps(upstream_payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        method='POST',
    )

    try:
        with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        detail = ''
        try:
            detail = exc.read().decode('utf-8')[:500]
        except Exception:
            pass
        return _json(request, {
            'error': f'Reve API вернул ошибку {exc.code}.',
            'detail': detail,
        }, status=502)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return _json(request, {'error': f'Не удалось связаться с Reve API: {exc}'}, status=502)
    except json.JSONDecodeError:
        return _json(request, {'error': 'Reve API вернул неожиданный ответ.'}, status=502)

    image_b64 = data.get('image')
    if not image_b64:
        return _json(request, {'error': 'В ответе Reve API нет изображения.', 'detail': str(data)[:500]}, status=502)

    # Проверяем, что это валидный base64, прежде чем отдавать клиенту.
    try:
        base64.b64decode(image_b64, validate=True)
    except Exception:
        return _json(request, {'error': 'Reve API вернул повреждённое изображение.'}, status=502)

    GenerationLog.objects.create(
        prompt=prompt[:255],
        credits_used=data.get('credits_used'),
        request_id=str(data.get('request_id') or '')[:128],
    )

    return _json(request, {
        'image': image_b64,
        'content_type': 'image/png',
        'credits_used': data.get('credits_used'),
        'credits_remaining': data.get('credits_remaining'),
        'remaining_today': max(0, limit - used - 1),
    })
