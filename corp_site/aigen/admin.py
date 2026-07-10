from django.contrib import admin

from .models import GenerationLog


@admin.register(GenerationLog)
class GenerationLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'prompt', 'credits_used', 'request_id')
    readonly_fields = ('created_at', 'prompt', 'credits_used', 'request_id')
    date_hierarchy = 'created_at'
