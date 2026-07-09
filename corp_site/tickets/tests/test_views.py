from datetime import date

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from tickets.models import Comment, Ticket
from tickets.views import ANON_TICKETS_PER_HOUR


class TicketListViewTests(TestCase):
    def setUp(self):
        self.ticket = Ticket.objects.create(
            title="Сломан принтер",
            description="Не печатает ни одна страница",
            status=Ticket.Status.IN_PROGRESS,
            priority=Ticket.Priority.HIGH,
            due_date=date(2024, 8, 1),
        )

    def test_list_displays_ticket_fields(self):
        response = self.client.get(reverse("ticket_list"))

        self.assertContains(response, self.ticket.title)
        self.assertContains(response, self.ticket.get_status_display())
        self.assertContains(response, self.ticket.get_priority_display())
        self.assertContains(response, "01.08.2024")

    def test_empty_state_when_no_tickets(self):
        Ticket.objects.all().delete()

        response = self.client.get(reverse("ticket_list"))

        self.assertContains(response, "Заявок пока нет")


class TicketDetailViewTests(TestCase):
    def setUp(self):
        self.ticket = Ticket.objects.create(
            title="Не работает интернет",
            description="На втором этаже нет подключения",
            status=Ticket.Status.NEW,
            priority=Ticket.Priority.MEDIUM,
            due_date=date(2024, 8, 5),
        )

    def test_detail_shows_ticket_info_and_comments(self):
        comment = Comment.objects.create(
            ticket=self.ticket,
            author_name="Алексей",
            message="Проверю сегодня",
        )

        response = self.client.get(reverse("ticket_detail", args=[self.ticket.pk]))

        self.assertContains(response, self.ticket.title)
        self.assertContains(response, self.ticket.description)
        self.assertContains(response, self.ticket.get_status_display())
        self.assertContains(response, self.ticket.get_priority_display())
        self.assertContains(response, "05.08.2024")
        self.assertContains(response, comment.author_name)
        self.assertContains(response, comment.message)

    def test_empty_state_when_no_comments(self):
        response = self.client.get(reverse("ticket_detail", args=[self.ticket.pk]))

        self.assertContains(response, "Комментариев пока нет")


class TicketCreateViewTests(TestCase):
    def test_create_page_loads(self):
        response = self.client.get(reverse("ticket_create"))
        self.assertEqual(response.status_code, 200)

    def test_create_ticket(self):
        data = {
            "title": "Новая заявка",
            "description": "Описание заявки",
            "status": "new",
            "priority": 2,
        }
        response = self.client.post(reverse("ticket_create"), data)
        self.assertEqual(Ticket.objects.count(), 1)
        ticket = Ticket.objects.first()
        self.assertEqual(ticket.title, "Новая заявка")
        self.assertRedirects(response, reverse("ticket_detail", args=[ticket.pk]))

    def test_create_ticket_shows_success_message(self):
        data = {
            "title": "Новая заявка",
            "description": "Описание заявки",
            "status": "new",
            "priority": 2,
        }
        response = self.client.post(reverse("ticket_create"), data, follow=True)
        self.assertContains(response, "Заявка создана.")

    def test_create_invalid_shows_errors(self):
        response = self.client.post(reverse("ticket_create"), {"title": ""})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Ticket.objects.count(), 0)
        self.assertContains(response, "Обязательное поле")


class TicketListFilterTests(TestCase):
    def setUp(self):
        self.printer = Ticket.objects.create(
            title="Сломан принтер",
            description="Не печатает",
            status=Ticket.Status.NEW,
            priority=Ticket.Priority.HIGH,
        )
        self.internet = Ticket.objects.create(
            title="Нет интернета",
            description="Второй этаж без сети",
            status=Ticket.Status.IN_PROGRESS,
            priority=Ticket.Priority.LOW,
        )

    def test_search_by_title(self):
        response = self.client.get(reverse("ticket_list"), {"q": "принтер"})
        self.assertContains(response, self.printer.title)
        self.assertNotContains(response, self.internet.title)

    def test_search_by_description(self):
        # Регистр совпадает с описанием: SQLite сравнивает кириллицу
        # в LIKE с учётом регистра (на Postgres поиск регистронезависимый).
        response = self.client.get(reverse("ticket_list"), {"q": "Второй этаж"})
        self.assertContains(response, self.internet.title)
        self.assertNotContains(response, self.printer.title)

    def test_filter_by_status(self):
        response = self.client.get(reverse("ticket_list"), {"status": "in_progress"})
        self.assertContains(response, self.internet.title)
        self.assertNotContains(response, self.printer.title)

    def test_filter_by_priority(self):
        response = self.client.get(reverse("ticket_list"), {"priority": "3"})
        self.assertContains(response, self.printer.title)
        self.assertNotContains(response, self.internet.title)

    def test_no_results_message(self):
        response = self.client.get(reverse("ticket_list"), {"q": "несуществующее"})
        self.assertContains(response, "По вашему запросу ничего не найдено")


class TicketUpdateViewTests(TestCase):
    def setUp(self):
        self.ticket = Ticket.objects.create(
            title="Старое название",
            description="Описание",
        )
        self.user = User.objects.create_user("employee", password="test-pass-123")
        self.client.force_login(self.user)

    def test_anonymous_redirected_to_login(self):
        self.client.logout()
        url = reverse("ticket_update", args=[self.ticket.pk])
        response = self.client.get(url)
        self.assertRedirects(response, f"{reverse('login')}?next={url}")

    def test_update_ticket(self):
        data = {
            "title": "Новое название",
            "description": "Описание",
            "status": "in_progress",
            "priority": 3,
        }
        response = self.client.post(
            reverse("ticket_update", args=[self.ticket.pk]), data
        )
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, "Новое название")
        self.assertEqual(self.ticket.status, "in_progress")
        self.assertRedirects(response, reverse("ticket_detail", args=[self.ticket.pk]))


class TicketDeleteViewTests(TestCase):
    def setUp(self):
        self.ticket = Ticket.objects.create(
            title="Удалить меня",
            description="Описание",
        )
        self.user = User.objects.create_user("employee", password="test-pass-123")
        self.client.force_login(self.user)

    def test_anonymous_redirected_to_login(self):
        self.client.logout()
        url = reverse("ticket_delete", args=[self.ticket.pk])
        response = self.client.post(url)
        self.assertRedirects(response, f"{reverse('login')}?next={url}")
        self.assertEqual(Ticket.objects.count(), 1)

    def test_delete_archives_ticket(self):
        # Удаление мягкое: запись остаётся в БД, но помечается архивной.
        response = self.client.post(
            reverse("ticket_delete", args=[self.ticket.pk])
        )
        self.assertEqual(Ticket.objects.count(), 1)
        self.ticket.refresh_from_db()
        self.assertTrue(self.ticket.is_archived)
        self.assertRedirects(response, "/tickets/")

    def test_archived_hidden_from_list_but_shown_in_archive(self):
        self.client.post(reverse("ticket_delete", args=[self.ticket.pk]))

        response = self.client.get(reverse("ticket_list"))
        self.assertNotContains(response, self.ticket.title)

        response = self.client.get(reverse("ticket_list"), {"archived": "1"})
        self.assertContains(response, self.ticket.title)

    def test_restore_ticket(self):
        self.client.post(reverse("ticket_delete", args=[self.ticket.pk]))

        response = self.client.post(reverse("ticket_restore", args=[self.ticket.pk]))

        self.ticket.refresh_from_db()
        self.assertFalse(self.ticket.is_archived)
        self.assertRedirects(response, reverse("ticket_detail", args=[self.ticket.pk]))

    def test_archive_view_hidden_for_anonymous(self):
        self.client.post(reverse("ticket_delete", args=[self.ticket.pk]))
        self.client.logout()

        # Аноним не видит архив даже с параметром archived=1.
        response = self.client.get(reverse("ticket_list"), {"archived": "1"})
        self.assertNotContains(response, self.ticket.title)


class AddCommentTests(TestCase):
    def setUp(self):
        self.ticket = Ticket.objects.create(
            title="Тикет",
            description="Описание",
        )

    def test_add_comment(self):
        data = {
            "author_name": "Иван",
            "message": "Тестовый комментарий",
        }
        response = self.client.post(
            reverse("ticket_add_comment", args=[self.ticket.pk]), data
        )
        self.assertEqual(self.ticket.comments.count(), 1)
        comment = self.ticket.comments.first()
        self.assertEqual(comment.author_name, "Иван")
        self.assertRedirects(
            response, reverse("ticket_detail", args=[self.ticket.pk])
        )

    def test_get_redirects(self):
        response = self.client.get(
            reverse("ticket_add_comment", args=[self.ticket.pk])
        )
        self.assertRedirects(
            response, reverse("ticket_detail", args=[self.ticket.pk])
        )

    def test_invalid_comment_shows_errors_and_keeps_text(self):
        data = {
            "author_name": "",
            "message": "Текст без автора",
        }
        response = self.client.post(
            reverse("ticket_add_comment", args=[self.ticket.pk]), data
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ticket.comments.count(), 0)
        self.assertContains(response, "Текст без автора")
        self.assertContains(response, "Обязательное поле")


class CommentAuthorTests(TestCase):
    def setUp(self):
        self.ticket = Ticket.objects.create(title="Тикет", description="Описание")
        self.user = User.objects.create_user(
            "employee", password="test-pass-123", first_name="Пётр", last_name="Иванов"
        )

    def test_authenticated_comment_uses_account_name(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("ticket_add_comment", args=[self.ticket.pk]),
            {"message": "Комментарий сотрудника"},
        )
        comment = self.ticket.comments.get()
        self.assertEqual(comment.author, self.user)
        self.assertEqual(comment.author_name, "Пётр Иванов")
        self.assertRedirects(response, reverse("ticket_detail", args=[self.ticket.pk]))

    def test_authenticated_form_has_no_author_field(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("ticket_detail", args=[self.ticket.pk]))
        self.assertNotContains(response, 'name="author_name"')


class TicketAuthorTests(TestCase):
    def test_authenticated_create_sets_created_by(self):
        user = User.objects.create_user("employee", password="test-pass-123")
        self.client.force_login(user)
        self.client.post(
            reverse("ticket_create"),
            {"title": "Заявка", "description": "Текст", "status": "new", "priority": 2},
        )
        ticket = Ticket.objects.get()
        self.assertEqual(ticket.created_by, user)

    def test_anonymous_create_allowed_without_author(self):
        # Политика доступа: анонимная подача заявок разрешена (см. README).
        # Тест фиксирует её, чтобы смена политики была осознанной.
        self.client.post(
            reverse("ticket_create"),
            {"title": "Анонимная заявка", "description": "Текст", "status": "new", "priority": 2},
        )
        ticket = Ticket.objects.get()
        self.assertIsNone(ticket.created_by)


class RateLimitTests(TestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_anonymous_ticket_creation_is_throttled(self):
        data = {"title": "Заявка", "description": "Текст", "status": "new", "priority": 2}
        for _ in range(ANON_TICKETS_PER_HOUR):
            self.client.post(reverse("ticket_create"), data)
        self.assertEqual(Ticket.objects.count(), ANON_TICKETS_PER_HOUR)

        response = self.client.post(reverse("ticket_create"), data, follow=True)

        self.assertEqual(Ticket.objects.count(), ANON_TICKETS_PER_HOUR)
        self.assertContains(response, "Слишком много заявок")

    def test_authenticated_user_not_throttled(self):
        user = User.objects.create_user("employee", password="test-pass-123")
        self.client.force_login(user)
        data = {"title": "Заявка", "description": "Текст", "status": "new", "priority": 2}
        for _ in range(ANON_TICKETS_PER_HOUR + 1):
            self.client.post(reverse("ticket_create"), data)
        self.assertEqual(Ticket.objects.count(), ANON_TICKETS_PER_HOUR + 1)


class PaginationTests(TestCase):
    def setUp(self):
        for i in range(11):
            Ticket.objects.create(
                title=f"Заявка {i}",
                description="Текст",
                priority=Ticket.Priority.HIGH,
            )

    def test_second_page_exists(self):
        response = self.client.get(reverse("ticket_list"), {"page": 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["tickets"]), 1)

    def test_pagination_preserves_filters(self):
        response = self.client.get(reverse("ticket_list"), {"priority": "3"})
        self.assertEqual(response.context["querystring"], "priority=3")
        self.assertContains(response, "?page=2&amp;priority=3")


class StaticAssetsTests(TestCase):
    def test_vendored_bootstrap_is_discoverable(self):
        # Регрессия: STATICFILES_DIRS должен включать каталог static/ проекта,
        # иначе вендоренный Bootstrap не отдаётся ни dev-сервером, ни collectstatic.
        from django.contrib.staticfiles import finders

        self.assertIsNotNone(finders.find("vendor/bootstrap/bootstrap.min.css"))
        self.assertIsNotNone(finders.find("vendor/bootstrap/bootstrap.bundle.min.js"))
