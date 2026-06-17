from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('equipment/', views.equipment_list, name='equipment_list'),
    path('equipment/<slug:slug>/', views.equipment_detail, name='equipment_detail'),
    path('services/', views.services, name='services'),
    path('contacts/', views.contacts, name='contacts'),
    path('contacts/success/', views.contact_success, name='contact_success'),
]
