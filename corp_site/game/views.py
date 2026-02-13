import random

from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import GameRoom, Player, PlayerAnswer, Question, RoomQuestion

QUESTION_TIME = 15  # seconds to answer
REVEAL_TIME = 5  # seconds to show correct answer
MAX_POINTS = 1000  # max points for instant answer
MIN_POINTS = 100  # min points for correct answer at deadline


def _ensure_session(request):
    if not request.session.session_key:
        request.session.create()
    return request.session.session_key


def home(request):
    return render(request, "game/home.html")


def lobby(request, code):
    room = get_object_or_404(GameRoom, code=code.upper())
    session_key = _ensure_session(request)
    player = Player.objects.filter(room=room, session_key=session_key).first()
    if not player:
        return redirect("game:home")
    is_host = room.host_session == session_key
    return render(request, "game/lobby.html", {
        "room": room,
        "player": player,
        "is_host": is_host,
    })


def play(request, code):
    room = get_object_or_404(GameRoom, code=code.upper())
    session_key = _ensure_session(request)
    player = Player.objects.filter(room=room, session_key=session_key).first()
    if not player:
        return redirect("game:home")
    is_host = room.host_session == session_key
    return render(request, "game/play.html", {
        "room": room,
        "player": player,
        "is_host": is_host,
    })


def results(request, code):
    room = get_object_or_404(GameRoom, code=code.upper())
    session_key = _ensure_session(request)
    player = Player.objects.filter(room=room, session_key=session_key).first()
    players = room.players.order_by("-score")
    return render(request, "game/results.html", {
        "room": room,
        "player": player,
        "players": players,
    })


@csrf_exempt
@require_POST
def api_create_room(request):
    name = request.POST.get("name", "").strip()
    if not name:
        return JsonResponse({"error": "Введите имя"}, status=400)

    session_key = _ensure_session(request)
    room = GameRoom.objects.create(host_session=session_key)
    Player.objects.create(name=name, room=room, session_key=session_key)
    return JsonResponse({"code": room.code})


@csrf_exempt
@require_POST
def api_join_room(request):
    name = request.POST.get("name", "").strip()
    code = request.POST.get("code", "").strip().upper()
    if not name:
        return JsonResponse({"error": "Введите имя"}, status=400)
    if not code:
        return JsonResponse({"error": "Введите код комнаты"}, status=400)

    room = GameRoom.objects.filter(code=code).first()
    if not room:
        return JsonResponse({"error": "Комната не найдена"}, status=404)
    if room.status != "waiting":
        return JsonResponse({"error": "Игра уже началась"}, status=400)

    session_key = _ensure_session(request)
    player, created = Player.objects.get_or_create(
        room=room,
        session_key=session_key,
        defaults={"name": name},
    )
    if not created:
        player.name = name
        player.save()

    return JsonResponse({"code": room.code})


@csrf_exempt
@require_POST
def api_start_game(request, code):
    room = get_object_or_404(GameRoom, code=code.upper())
    session_key = _ensure_session(request)

    if room.host_session != session_key:
        return JsonResponse({"error": "Только хост может начать игру"}, status=403)
    if room.status != "waiting":
        return JsonResponse({"error": "Игра уже началась"}, status=400)
    if room.players.count() < 2:
        return JsonResponse({"error": "Нужно минимум 2 игрока"}, status=400)

    # Select random questions for this room
    all_questions = list(Question.objects.all())
    num = min(room.num_questions, len(all_questions))
    if num == 0:
        return JsonResponse({"error": "Нет вопросов в базе"}, status=500)

    selected = random.sample(all_questions, num)
    for i, q in enumerate(selected):
        RoomQuestion.objects.create(room=room, question=q, order=i)

    room.status = "playing"
    room.current_question_index = 0
    room.question_started_at = timezone.now()
    room.save()

    return JsonResponse({"ok": True})


@require_GET
def api_game_state(request, code):
    room = get_object_or_404(GameRoom, code=code.upper())
    session_key = _ensure_session(request)

    players_data = [
        {"name": p.name, "score": p.score, "id": p.id}
        for p in room.players.order_by("-score")
    ]

    if room.status == "waiting":
        return JsonResponse({
            "phase": "waiting",
            "players": players_data,
        })

    if room.status == "finished":
        return JsonResponse({
            "phase": "finished",
            "players": players_data,
        })

    # Game is playing
    room_questions = list(room.room_questions.select_related("question").order_by("order"))
    total = len(room_questions)
    idx = room.current_question_index

    if idx >= total:
        room.status = "finished"
        room.save()
        return JsonResponse({
            "phase": "finished",
            "players": players_data,
        })

    rq = room_questions[idx]
    now = timezone.now()
    elapsed = (now - room.question_started_at).total_seconds()

    # Determine phase
    if elapsed < QUESTION_TIME:
        phase = "question"
        time_left = max(0, QUESTION_TIME - elapsed)
    elif elapsed < QUESTION_TIME + REVEAL_TIME:
        phase = "reveal"
        time_left = max(0, QUESTION_TIME + REVEAL_TIME - elapsed)
    else:
        # Auto-advance to next question
        room.current_question_index += 1
        if room.current_question_index >= total:
            room.status = "finished"
            room.save()
            return JsonResponse({
                "phase": "finished",
                "players": [
                    {"name": p.name, "score": p.score, "id": p.id}
                    for p in room.players.order_by("-score")
                ],
            })
        room.question_started_at = now
        room.save()
        rq = room_questions[room.current_question_index]
        phase = "question"
        time_left = QUESTION_TIME

    q = rq.question

    # Check if current player already answered
    player = Player.objects.filter(room=room, session_key=session_key).first()
    my_answer = None
    if player:
        pa = PlayerAnswer.objects.filter(player=player, room_question=rq).first()
        if pa:
            my_answer = pa.answer

    # Count who answered
    answered_count = PlayerAnswer.objects.filter(room_question=rq).count()

    data = {
        "phase": phase,
        "question_num": idx + 1,
        "total_questions": total,
        "question": q.text,
        "category": q.category,
        "options": {
            "a": q.option_a,
            "b": q.option_b,
            "c": q.option_c,
            "d": q.option_d,
        },
        "time_left": round(time_left, 1),
        "my_answer": my_answer,
        "answered_count": answered_count,
        "total_players": room.players.count(),
        "players": [
            {"name": p.name, "score": p.score, "id": p.id}
            for p in room.players.order_by("-score")
        ],
    }

    if phase == "reveal":
        data["correct"] = q.correct
        # Include per-player answers for the reveal
        answers = PlayerAnswer.objects.filter(room_question=rq).select_related("player")
        data["answers"] = [
            {"player": a.player.name, "answer": a.answer, "is_correct": a.is_correct, "points": a.points}
            for a in answers
        ]

    return JsonResponse(data)


@csrf_exempt
@require_POST
def api_answer(request, code):
    room = get_object_or_404(GameRoom, code=code.upper())
    session_key = _ensure_session(request)
    player = Player.objects.filter(room=room, session_key=session_key).first()

    if not player:
        return JsonResponse({"error": "Вы не в этой комнате"}, status=403)
    if room.status != "playing":
        return JsonResponse({"error": "Игра не идёт"}, status=400)

    answer = request.POST.get("answer", "").lower()
    if answer not in ("a", "b", "c", "d"):
        return JsonResponse({"error": "Неверный вариант"}, status=400)

    room_questions = list(room.room_questions.select_related("question").order_by("order"))
    idx = room.current_question_index
    if idx >= len(room_questions):
        return JsonResponse({"error": "Вопросы закончились"}, status=400)

    rq = room_questions[idx]

    # Check timing
    now = timezone.now()
    elapsed = (now - room.question_started_at).total_seconds()
    if elapsed > QUESTION_TIME:
        return JsonResponse({"error": "Время вышло"}, status=400)

    # Check if already answered
    if PlayerAnswer.objects.filter(player=player, room_question=rq).exists():
        return JsonResponse({"error": "Вы уже ответили"}, status=400)

    q = rq.question
    is_correct = answer == q.correct

    points = 0
    if is_correct:
        # Faster answer = more points (linear interpolation)
        fraction = 1 - (elapsed / QUESTION_TIME)
        points = int(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * fraction)

    PlayerAnswer.objects.create(
        player=player,
        room_question=rq,
        answer=answer,
        is_correct=is_correct,
        points=points,
    )

    if points > 0:
        player.score += points
        player.save()

    return JsonResponse({"ok": True, "is_correct": is_correct, "points": points})
