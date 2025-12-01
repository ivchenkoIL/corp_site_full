from django.db import models


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
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлено', auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Заявка'
        verbose_name_plural = 'Заявки'

    def __str__(self) -> str:
        return self.title


class Comment(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Заявка',
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
