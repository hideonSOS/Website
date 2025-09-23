from django.contrib import admin

# Register your models here.
from .models import Post, MotorComment, RaceDay, Event, Title

@admin.register(Title)
class TitleAdmin(admin.ModelAdmin):
    list_display = ("id", "start_date", "end_date", "title", "organizer", "days")
    search_fields = ("title",)
    list_filter = ("organizer", "start_date")

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "created_at")
    search_fields = ("title",)
    list_filter = ("created_at",)

@admin.register(MotorComment)
class MotorCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "machine_no", "author", "racer", "title", "created_at")
    search_fields = ("author", "racer", "content", "title")
    list_filter = ("machine_no", "created_at")

@admin.register(RaceDay)
class RaceDayAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "type", "title")
    search_fields = ("title",)
    list_filter = ("type", "date")

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "role", "title")
    search_fields = ("title", "description")
    list_filter = ("role", "date")