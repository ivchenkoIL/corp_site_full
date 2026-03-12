from django.contrib import admin

from .models import Category, ContactRequest


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'short_name', 'slug', 'order']
    list_editable = ['order']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name', 'short_name']


@admin.register(ContactRequest)
class ContactRequestAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'phone', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'email', 'phone']
    readonly_fields = ['created_at']
