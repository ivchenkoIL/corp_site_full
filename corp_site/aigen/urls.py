from django.urls import path

from . import views

urlpatterns = [
    path('generate/', views.generate_image, name='ai_generate_image'),
]
