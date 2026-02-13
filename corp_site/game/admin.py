from django.contrib import admin

from .models import GameRoom, Player, PlayerAnswer, Question, RoomQuestion


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("text", "category", "correct")
    list_filter = ("category",)
    search_fields = ("text",)


@admin.register(GameRoom)
class GameRoomAdmin(admin.ModelAdmin):
    list_display = ("code", "status", "current_question_index", "created_at")
    list_filter = ("status",)


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("name", "room", "score")


admin.site.register(RoomQuestion)
admin.site.register(PlayerAnswer)
