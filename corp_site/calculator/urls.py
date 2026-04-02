from django.urls import path

from . import views

urlpatterns = [
    path('', views.CableMaterialsView.as_view(), name='cable_materials'),
]
