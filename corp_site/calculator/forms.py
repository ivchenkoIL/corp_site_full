from django import forms


class CableMaterialsForm(forms.Form):
    num_forts = forms.IntegerField(
        label='Количество фортов',
        min_value=2,
        initial=4,
        widget=forms.NumberInput(attrs={'class': 'form-control'}),
    )
    distance = forms.IntegerField(
        label='Расстояние между фортами (м)',
        min_value=1,
        initial=150,
        widget=forms.NumberInput(attrs={'class': 'form-control'}),
    )
    supports_per_span = forms.IntegerField(
        label='Количество опор между фортами',
        min_value=0,
        initial=1,
        widget=forms.NumberInput(attrs={'class': 'form-control'}),
    )
    sip_slack_percent = forms.FloatField(
        label='Запас СИП на провис и отходы (%)',
        min_value=0,
        max_value=50,
        initial=3,
        widget=forms.NumberInput(attrs={'class': 'form-control', 'step': '0.5'}),
    )
    vvg_length_per_fort = forms.FloatField(
        label='Длина ВВГнг 3×2,5 на каждый форт (м)',
        min_value=0,
        initial=15,
        widget=forms.NumberInput(attrs={'class': 'form-control', 'step': '0.5'}),
    )
