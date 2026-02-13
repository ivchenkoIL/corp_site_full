import random
import string

from django.db import models
from django.utils import timezone


def generate_room_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


class GameRoom(models.Model):
    code = models.CharField("Код комнаты", max_length=6, unique=True, default=generate_room_code)
    status = models.CharField(
        "Статус",
        max_length=20,
        choices=[
            ("waiting", "Ожидание"),
            ("playing", "Игра"),
            ("finished", "Завершена"),
        ],
        default="waiting",
    )
    current_question_index = models.IntegerField("Текущий вопрос", default=0)
    question_started_at = models.DateTimeField("Вопрос начат в", null=True, blank=True)
    host_session = models.CharField("Сессия хоста", max_length=100)
    num_questions = models.IntegerField("Кол-во вопросов", default=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Игровая комната"
        verbose_name_plural = "Игровые комнаты"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Комната {self.code} ({self.get_status_display()})"


class Player(models.Model):
    name = models.CharField("Имя", max_length=50)
    room = models.ForeignKey(GameRoom, on_delete=models.CASCADE, related_name="players")
    score = models.IntegerField("Очки", default=0)
    session_key = models.CharField("Ключ сессии", max_length=100)

    class Meta:
        verbose_name = "Игрок"
        verbose_name_plural = "Игроки"
        unique_together = [("room", "session_key")]

    def __str__(self):
        return f"{self.name} ({self.score} очков)"


class Question(models.Model):
    text = models.CharField("Вопрос", max_length=500)
    option_a = models.CharField("Вариант A", max_length=200)
    option_b = models.CharField("Вариант B", max_length=200)
    option_c = models.CharField("Вариант C", max_length=200)
    option_d = models.CharField("Вариант D", max_length=200)
    correct = models.CharField(
        "Правильный ответ",
        max_length=1,
        choices=[("a", "A"), ("b", "B"), ("c", "C"), ("d", "D")],
    )
    category = models.CharField("Категория", max_length=100)

    class Meta:
        verbose_name = "Вопрос"
        verbose_name_plural = "Вопросы"

    def __str__(self):
        return self.text[:80]


class RoomQuestion(models.Model):
    """Links questions to a specific game room in order."""
    room = models.ForeignKey(GameRoom, on_delete=models.CASCADE, related_name="room_questions")
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    order = models.IntegerField("Порядок")

    class Meta:
        verbose_name = "Вопрос комнаты"
        verbose_name_plural = "Вопросы комнаты"
        ordering = ["order"]
        unique_together = [("room", "order")]


class PlayerAnswer(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="answers")
    room_question = models.ForeignKey(RoomQuestion, on_delete=models.CASCADE, related_name="player_answers")
    answer = models.CharField("Ответ", max_length=1)
    is_correct = models.BooleanField("Правильно")
    points = models.IntegerField("Очки", default=0)
    answered_at = models.DateTimeField("Время ответа", default=timezone.now)

    class Meta:
        verbose_name = "Ответ игрока"
        verbose_name_plural = "Ответы игроков"
        unique_together = [("player", "room_question")]
