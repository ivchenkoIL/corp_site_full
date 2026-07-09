from django.contrib import admin

from .models import Comment, Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "status",
        "priority",
        "assigned_to",
        "created_by",
        "is_archived",
        "due_date",
        "created_at",
    )
    list_filter = ("status", "priority", "is_archived", "due_date", "created_at")
    search_fields = ("title", "description")
    ordering = ("-created_at",)
    raw_id_fields = ("created_by", "assigned_to")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author_name", "author", "created_at")
    list_filter = ("created_at",)
    search_fields = ("author_name", "message", "ticket__title")
    ordering = ("-created_at",)
    raw_id_fields = ("author",)
