from django.contrib import admin

from .models import Comment, Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "status",
        "priority",
        "due_date",
        "created_at",
    )
    list_filter = ("status", "priority", "due_date", "created_at")
    search_fields = ("title", "description")
    ordering = ("-created_at",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author_name", "created_at")
    list_filter = ("created_at",)
    search_fields = ("author_name", "message", "ticket__title")
    ordering = ("-created_at",)
