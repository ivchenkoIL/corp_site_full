from django.test import TestCase
from django.urls import reverse

from tickets.models import Comment, Ticket


class TicketModelTests(TestCase):
    def setUp(self):
        self.ticket = Ticket.objects.create(
            title="Сломан сканер",
            description="Не сканирует",
            status=Ticket.Status.NEW,
            priority=Ticket.Priority.HIGH,
        )

    def test_str(self):
        self.assertEqual(str(self.ticket), "Сломан сканер")

    def test_get_absolute_url(self):
        self.assertEqual(
            self.ticket.get_absolute_url(),
            reverse("ticket_detail", args=[self.ticket.pk]),
        )

    def test_status_badge_class(self):
        self.assertEqual(self.ticket.status_badge_class, "bg-primary")
        self.ticket.status = Ticket.Status.DONE
        self.assertEqual(self.ticket.status_badge_class, "bg-success")

    def test_priority_badge_class(self):
        self.assertEqual(self.ticket.priority_badge_class, "bg-danger")
        self.ticket.priority = Ticket.Priority.LOW
        self.assertEqual(self.ticket.priority_badge_class, "bg-secondary")

    def test_not_archived_by_default(self):
        self.assertFalse(self.ticket.is_archived)


class CommentModelTests(TestCase):
    def test_str(self):
        ticket = Ticket.objects.create(title="Тикет", description="Текст")
        comment = Comment.objects.create(
            ticket=ticket, author_name="Мария", message="Ок"
        )
        self.assertEqual(str(comment), "Комментарий от Мария")
