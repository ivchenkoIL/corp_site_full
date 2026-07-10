import base64
import json
from unittest import mock

from django.test import TestCase
from django.urls import reverse

from .models import GenerationLog

FAKE_PNG_B64 = base64.b64encode(b'\x89PNG fake image bytes').decode()


def fake_reve_response(payload):
    """Возвращает context-manager, имитирующий urllib.request.urlopen."""
    resp = mock.MagicMock()
    resp.read.return_value = json.dumps(payload).encode()
    cm = mock.MagicMock()
    cm.__enter__.return_value = resp
    return cm


class GenerateImageViewTests(TestCase):
    url = reverse('ai_generate_image')

    def post_json(self, payload):
        return self.client.post(self.url, json.dumps(payload), content_type='application/json')

    def test_get_status_without_key(self):
        with mock.patch.dict('os.environ', {}, clear=False):
            import os
            os.environ.pop('REVE_API_KEY', None)
            res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data['configured'])
        self.assertEqual(data['used_today'], 0)

    def test_post_without_key_returns_503(self):
        import os
        os.environ.pop('REVE_API_KEY', None)
        res = self.post_json({'prompt': 'кот'})
        self.assertEqual(res.status_code, 503)

    @mock.patch.dict('os.environ', {'REVE_API_KEY': 'papi.test'})
    def test_empty_prompt_rejected(self):
        res = self.post_json({'prompt': '   '})
        self.assertEqual(res.status_code, 400)

    @mock.patch.dict('os.environ', {'REVE_API_KEY': 'papi.test'})
    def test_bad_aspect_ratio_rejected(self):
        res = self.post_json({'prompt': 'кот', 'aspect_ratio': '21:9'})
        self.assertEqual(res.status_code, 400)

    @mock.patch.dict('os.environ', {'REVE_API_KEY': 'papi.test'})
    @mock.patch('aigen.views.urllib.request.urlopen')
    def test_successful_generation(self, urlopen):
        urlopen.return_value = fake_reve_response({
            'image': FAKE_PNG_B64,
            'credits_used': 18,
            'credits_remaining': 82,
            'request_id': 'req-1',
        })
        res = self.post_json({'prompt': 'кот в сапогах', 'aspect_ratio': '1:1'})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['image'], FAKE_PNG_B64)
        self.assertEqual(data['credits_used'], 18)
        self.assertEqual(GenerationLog.objects.count(), 1)
        # Ключ ушёл в заголовок Authorization апстрима.
        req = urlopen.call_args[0][0]
        self.assertEqual(req.get_header('Authorization'), 'Bearer papi.test')

    @mock.patch.dict('os.environ', {'REVE_API_KEY': 'papi.test', 'AI_DAILY_LIMIT': '2'})
    @mock.patch('aigen.views.urllib.request.urlopen')
    def test_daily_limit_enforced(self, urlopen):
        urlopen.return_value = fake_reve_response({'image': FAKE_PNG_B64})
        self.assertEqual(self.post_json({'prompt': 'раз'}).status_code, 200)
        urlopen.return_value = fake_reve_response({'image': FAKE_PNG_B64})
        self.assertEqual(self.post_json({'prompt': 'два'}).status_code, 200)
        res = self.post_json({'prompt': 'три'})
        self.assertEqual(res.status_code, 429)
        self.assertEqual(GenerationLog.objects.count(), 2)

    @mock.patch.dict('os.environ', {'REVE_API_KEY': 'papi.test'})
    @mock.patch('aigen.views.urllib.request.urlopen')
    def test_upstream_error_becomes_502(self, urlopen):
        import urllib.error
        urlopen.side_effect = urllib.error.URLError('boom')
        res = self.post_json({'prompt': 'кот'})
        self.assertEqual(res.status_code, 502)
        self.assertEqual(GenerationLog.objects.count(), 0)

    def test_options_preflight_has_cors_headers(self):
        res = self.client.options(self.url)
        self.assertEqual(res.status_code, 204)
        self.assertEqual(res['Access-Control-Allow-Origin'], '*')
