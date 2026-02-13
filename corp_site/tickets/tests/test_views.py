from datetime import date

from django.test import TestCase
from django.urls import reverse

from tickets.models import Comment, Ticket


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


class TicketUpdateViewTests(TestCase):
    def setUp(self):
        self.ticket = Ticket.objects.create(
            title="Старое название",
            description="Описание",
        )

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

    def test_delete_ticket(self):
        response = self.client.post(
            reverse("ticket_delete", args=[self.ticket.pk])
        )
        self.assertEqual(Ticket.objects.count(), 0)
        self.assertRedirects(response, "/tickets/")


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
