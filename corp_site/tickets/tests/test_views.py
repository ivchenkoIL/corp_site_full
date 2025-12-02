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
        self.assertContains(response, str(self.ticket.due_date))

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
        self.assertContains(response, str(self.ticket.due_date))
        self.assertContains(response, comment.author_name)
        self.assertContains(response, comment.message)

    def test_empty_state_when_no_comments(self):
        response = self.client.get(reverse("ticket_detail", args=[self.ticket.pk]))

        self.assertContains(response, "Комментариев пока нет")
