from django import forms


class CableMaterialsForm(forms.Form):
    num_forts = forms.IntegerField(
        label='Количество TFortis',
        min_value=2,
        initial=6,
        widget=forms.NumberInput(attrs={'class': 'form-control'}),
    )
    distance = forms.IntegerField(
        label='Расстояние между TFortis (м)',
        min_value=1,
        initial=150,
        widget=forms.NumberInput(attrs={'class': 'form-control'}),
    )
    supports_per_span = forms.IntegerField(
        label='Количество промежуточных опор между TFortis',
        min_value=0,
        initial=1,
        widget=forms.NumberInput(attrs={'class': 'form-control'}),
    )
    sip_slack_percent = forms.FloatField(
        label='Запас СИП на провис (%)',
        min_value=0,
        max_value=50,
        initial=5,
        help_text='Рекомендуется 3–5% для пролётов свыше 100 м',
        widget=forms.NumberInput(attrs={'class': 'form-control', 'step': '0.5'}),
    )
    zoi_per_fort = forms.IntegerField(
        label='ЗОИ на каждый TFortis (шт.)',
        min_value=1,
        initial=2,
        widget=forms.NumberInput(attrs={'class': 'form-control'}),
    )
    vvg_length_per_fort = forms.FloatField(
        label='Длина ВВГнг 2×2,5 на каждый TFortis (м)',
        min_value=0,
        initial=8,
        widget=forms.NumberInput(attrs={'class': 'form-control', 'step': '0.5'}),
    )
