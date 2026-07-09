from django.conf import settings
from django.db import models
from django.urls import reverse


class Ticket(models.Model):
    class Status(models.TextChoices):
        NEW = 'new', 'Новая'
        IN_PROGRESS = 'in_progress', 'В работе'
        DONE = 'done', 'Завершена'

    class Priority(models.IntegerChoices):
        LOW = 1, 'Низкий'
        MEDIUM = 2, 'Средний'
        HIGH = 3, 'Высокий'

    title = models.CharField('Заголовок', max_length=255)
    description = models.TextField('Описание')
    status = models.CharField(
        'Статус',
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
    )
    priority = models.IntegerField(
        'Приоритет',
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    due_date = models.DateField('Крайний срок', null=True, blank=True)
    # Автор остаётся null для заявок, созданных без входа (анонимная подача
    # разрешена политикой доступа, см. README) и для исторических записей.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='Автор',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_tickets',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='Исполнитель',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_tickets',
    )
    is_archived = models.BooleanField('В архиве', default=False)
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлено', auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Заявка'
        verbose_name_plural = 'Заявки'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['is_archived', '-created_at']),
        ]

    def __str__(self) -> str:
        return self.title

    def get_absolute_url(self):
        return reverse('ticket_detail', kwargs={'pk': self.pk})

    @property
    def status_badge_class(self) -> str:
        return {
            self.Status.NEW: 'bg-primary',
            self.Status.IN_PROGRESS: 'bg-warning text-dark',
            self.Status.DONE: 'bg-success',
        }.get(self.status, 'bg-secondary')

    @property
    def priority_badge_class(self) -> str:
        return {
            self.Priority.HIGH: 'bg-danger',
            self.Priority.MEDIUM: 'bg-warning text-dark',
            self.Priority.LOW: 'bg-secondary',
        }.get(self.priority, 'bg-secondary')


class Comment(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Заявка',
    )
    # Для залогиненных заполняется author (FK) и author_name-снимок; для
    # анонимных — только author_name. Снимок сохраняет подпись, даже если
    # учётную запись потом удалят.
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='Автор (пользователь)',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='ticket_comments',
    )
    author_name = models.CharField('Автор', max_length=150)
    message = models.TextField('Комментарий')
    created_at = models.DateTimeField('Создано', auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Комментарий'
        verbose_name_plural = 'Комментарии'

    def __str__(self) -> str:
        return f"Комментарий от {self.author_name}"
