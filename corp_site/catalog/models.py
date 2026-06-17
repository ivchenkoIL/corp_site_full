from django.db import models


class Category(models.Model):
    name = models.CharField('Название', max_length=255)
    slug = models.SlugField('URL-идентификатор', unique=True, max_length=100)
    short_name = models.CharField('Аббревиатура', max_length=20, blank=True)
    description = models.TextField('Краткое описание')
    full_description = models.TextField('Полное описание', blank=True)
    icon = models.CharField(
        'CSS-класс иконки (Bootstrap Icons)', max_length=100, blank=True
    )
    order = models.PositiveIntegerField('Порядок отображения', default=0)

    class Meta:
        verbose_name = 'Категория оборудования'
        verbose_name_plural = 'Категории оборудования'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class ContactRequest(models.Model):
    name = models.CharField('Имя', max_length=150)
    email = models.EmailField('Электронная почта')
    phone = models.CharField('Телефон', max_length=30, blank=True)
    message = models.TextField('Сообщение')
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)

    class Meta:
        verbose_name = 'Заявка'
        verbose_name_plural = 'Заявки'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} — {self.created_at:%d.%m.%Y %H:%M}'
