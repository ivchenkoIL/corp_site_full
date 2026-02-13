from django.urls import path

from . import views

app_name = "game"

urlpatterns = [
    path("", views.home, name="home"),
    path("lobby/<str:code>/", views.lobby, name="lobby"),
    path("play/<str:code>/", views.play, name="play"),
    path("results/<str:code>/", views.results, name="results"),
    # API
    path("api/create/", views.api_create_room, name="api_create"),
    path("api/join/", views.api_join_room, name="api_join"),
    path("api/start/<str:code>/", views.api_start_game, name="api_start"),
    path("api/state/<str:code>/", views.api_game_state, name="api_state"),
    path("api/answer/<str:code>/", views.api_answer, name="api_answer"),
]
