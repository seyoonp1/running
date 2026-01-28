from django.contrib import admin
from .models import GameArea, Room, Participant, RunningRecord

@admin.register(GameArea)
class GameAreaAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'h3_resolution', 'is_active', 'created_at')
    list_filter = ('city', 'is_active', 'h3_resolution')
    search_fields = ('name', 'city', 'description')
    readonly_fields = ('created_at', 'updated_at')

class ParticipantInline(admin.TabularInline):
    model = Participant
    extra = 1

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'creator', 'status', 'invite_code', 'start_date', 'end_date', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'invite_code', 'creator__username')
    inlines = [ParticipantInline]
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ('user', 'room', 'team', 'is_host', 'is_recording', 'paintball_count')
    list_filter = ('team', 'is_host', 'is_recording')
    search_fields = ('user__username', 'room__name')

@admin.register(RunningRecord)
class RunningRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'room', 'distance_meters', 'duration_seconds', 'started_at')
    list_filter = ('started_at',)
    search_fields = ('user__username', 'room__name')
