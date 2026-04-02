import math

from django.views.generic import FormView

from .forms import CableMaterialsForm


class CableMaterialsView(FormView):
    template_name = 'calculator/cable_materials.html'
    form_class = CableMaterialsForm

    def get(self, request, *args, **kwargs):
        form = self.get_form()
        if form.is_valid():
            results = self.calculate(form.cleaned_data)
            return self.render_to_response(self.get_context_data(form=form, results=results))
        return self.render_to_response(self.get_context_data(form=form))

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'GET' and self.request.GET:
            kwargs['data'] = self.request.GET
        elif self.request.method == 'GET':
            kwargs['data'] = {
                'num_forts': 6,
                'distance': 150,
                'supports_per_span': 1,
                'sip_slack_percent': 5,
                'zoi_per_fort': 2,
                'vvg_length_per_fort': 8,
            }
        return kwargs

    def form_valid(self, form):
        results = self.calculate(form.cleaned_data)
        return self.render_to_response(
            self.get_context_data(form=form, results=results)
        )

    def calculate(self, data):
        num_forts = data['num_forts']
        distance = data['distance']
        supports_per_span = data['supports_per_span']
        sip_slack_percent = data['sip_slack_percent']
        zoi_per_fort = data['zoi_per_fort']
        vvg_length_per_fort = data['vvg_length_per_fort']

        num_spans = num_forts - 1

        # Длина СИП (с запасом на провис)
        sip_length_raw = num_spans * distance
        sip_length = math.ceil(sip_length_raw * (1 + sip_slack_percent / 100))

        # Общее количество промежуточных опор
        total_supports = num_spans * supports_per_span

        # Анкерные (проходные) зажимы — на каждом TFortis:
        # крайние: по 1, промежуточные: по 2 (вход + выход)
        if num_forts <= 2:
            anchor_clamps = num_forts
        else:
            anchor_clamps = 2 + (num_forts - 2) * 2

        # Поддерживающие зажимы — по 1 на каждую промежуточную опору
        support_clamps = total_supports

        # Кронштейн (вылет) L-300 — по 1 на каждую промежуточную опору
        bracket_l300 = total_supports

        # ЗОИ — по zoi_per_fort на каждый TFortis
        zoi_count = num_forts * zoi_per_fort

        # Кабель ВВГнг 2×2,5 — для ввода в каждый TFortis
        vvg_total = num_forts * vvg_length_per_fort

        # Бандажная лента — ~1 м на каждое крепление на опоре
        # (поддерживающие + кронштейны крепятся лентой)
        band_tape_meters = total_supports * 2

        # Скрепы для бандажной ленты — по 2 на каждое крепление
        band_buckles = total_supports * 4

        # Фасадные крепления — по 2 на каждый TFortis (ввод по стене)
        facade_mounts = num_forts * 2

        # Изолирующие колпачки — по 1 на конец каждой жилы СИП
        # (на начало и конец линии; 4 жилы у СИП-4)
        insulating_caps = 2 * 4

        return {
            'num_spans': num_spans,
            'total_supports': total_supports,
            'sip_length_raw': sip_length_raw,
            'sip_length': sip_length,
            'sip_slack_percent': sip_slack_percent,
            'anchor_clamps': anchor_clamps,
            'support_clamps': support_clamps,
            'bracket_l300': bracket_l300,
            'zoi_count': zoi_count,
            'zoi_per_fort': zoi_per_fort,
            'vvg_total': vvg_total,
            'vvg_length_per_fort': vvg_length_per_fort,
            'band_tape_meters': band_tape_meters,
            'band_buckles': band_buckles,
            'facade_mounts': facade_mounts,
            'insulating_caps': insulating_caps,
        }
