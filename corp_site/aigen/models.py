from django.db import models


class GenerationLog(models.Model):
    """Одна запись — один успешный запрос к Reve API.

    По записям считается дневной лимит генераций (AI_DAILY_LIMIT),
    чтобы публичная кнопка в ColorFlow не сожгла все кредиты за день.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    prompt = models.CharField(max_length=255, blank=True)
    credits_used = models.IntegerField(null=True, blank=True)
    request_id = models.CharField(max_length=128, blank=True)

    class Meta:
        verbose_name = 'генерация'
        verbose_name_plural = 'генерации'

    def __str__(self):
        return f'{self.created_at:%Y-%m-%d %H:%M} — {self.prompt[:40]}'
