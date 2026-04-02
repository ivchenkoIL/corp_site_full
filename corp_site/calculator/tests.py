from django.test import TestCase


class CableMaterialsViewTests(TestCase):
    def test_page_loads_with_defaults(self):
        response = self.client.get('/calculator/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Калькулятор материалов')
        self.assertIn('results', response.context)

    def test_default_calculation(self):
        """4 форта, 150 м, 1 опора между фортами."""
        response = self.client.get('/calculator/')
        results = response.context['results']
        # 3 пролёта × 150 м = 450 м
        self.assertEqual(results['sip_length_raw'], 450)
        # с запасом 3%: ceil(450 * 1.03) = 464
        self.assertEqual(results['sip_length'], 464)
        # анкерные: 2 крайних + 2×2 промежуточных = 6
        self.assertEqual(results['anchor_clamps'], 6)
        # поддерживающие: 3 опоры
        self.assertEqual(results['support_clamps'], 3)
        # ЗОИ: 4
        self.assertEqual(results['zoi_count'], 4)
        # ВВГнг: 4 × 15 = 60
        self.assertEqual(results['vvg_total'], 60)

    def test_custom_parameters(self):
        response = self.client.get('/calculator/', {
            'num_forts': 3,
            'distance': 100,
            'supports_per_span': 2,
            'sip_slack_percent': 5,
            'vvg_length_per_fort': 20,
        })
        results = response.context['results']
        self.assertEqual(results['sip_length_raw'], 200)
        self.assertEqual(results['sip_length'], 210)  # ceil(200*1.05)
        self.assertEqual(results['anchor_clamps'], 4)  # 2 + 1*2
        self.assertEqual(results['support_clamps'], 4)  # 2 spans × 2
        self.assertEqual(results['zoi_count'], 3)
        self.assertEqual(results['vvg_total'], 60)  # 3 × 20
