from django.test import TestCase


class CableMaterialsViewTests(TestCase):
    def test_page_loads_with_defaults(self):
        response = self.client.get('/calculator/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Калькулятор материалов')
        self.assertIn('results', response.context)

    def test_default_calculation_6_forts(self):
        """6 TFortis, 150 м, 1 опора между ними."""
        response = self.client.get('/calculator/')
        results = response.context['results']
        self.assertEqual(results['sip_length_raw'], 750)
        self.assertEqual(results['sip_length'], 788)  # ceil(750 * 1.05)
        self.assertEqual(results['anchor_clamps'], 10)
        self.assertEqual(results['support_clamps'], 5)
        self.assertEqual(results['bracket_l300'], 5)
        self.assertEqual(results['zoi_count'], 12)  # 6 × 2
        self.assertEqual(results['vvg_total'], 48)  # 6 × 8
        self.assertEqual(results['band_tape_meters'], 50)
        self.assertEqual(results['band_buckles'], 30)
        self.assertEqual(results['insulating_caps'], 4)  # 2 жилы × 2 конца

    def test_excel_export(self):
        response = self.client.get('/calculator/', {
            'num_forts': 6,
            'distance': 150,
            'supports_per_span': 1,
            'sip_slack_percent': 5,
            'zoi_per_fort': 2,
            'vvg_length_per_fort': 8,
            'export': 'excel',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        self.assertIn('materials_sip.xlsx', response['Content-Disposition'])

    def test_custom_parameters(self):
        response = self.client.get('/calculator/', {
            'num_forts': 3,
            'distance': 100,
            'supports_per_span': 2,
            'sip_slack_percent': 5,
            'zoi_per_fort': 2,
            'vvg_length_per_fort': 10,
        })
        results = response.context['results']
        self.assertEqual(results['sip_length_raw'], 200)
        self.assertEqual(results['sip_length'], 210)
        self.assertEqual(results['anchor_clamps'], 4)
        self.assertEqual(results['support_clamps'], 4)
        self.assertEqual(results['bracket_l300'], 4)
        self.assertEqual(results['zoi_count'], 6)
        self.assertEqual(results['vvg_total'], 30)
