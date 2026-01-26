"""
Django Admin 설정 - Rooms 앱
"""
from django.contrib import admin
from .models import GameArea, Room, Participant, RunningRecord


@admin.register(GameArea)
class GameAreaAdmin(admin.ModelAdmin):
    """게임 구역 Admin"""
    list_display = ['name', 'city', 'h3_resolution', 'is_active', 'created_at']
    list_filter = ['city', 'is_active', 'h3_resolution']
    search_fields = ['name', 'city', 'description']
    fields = ['name', 'city', 'description', 'bounds', 'h3_resolution', 'is_active']
    readonly_fields = ['created_at', 'updated_at']
    
    def get_readonly_fields(self, request, obj=None):
        """생성 후에는 일부 필드를 읽기 전용으로"""
        if obj:  # 수정 모드
            return self.readonly_fields + ['id']
        return self.readonly_fields


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    """게임 방 Admin"""
    list_display = ['name', 'creator', 'status', 'game_area', 'total_participants', 'start_date', 'end_date', 'created_at']
    list_filter = ['status', 'start_date', 'game_area', 'winner_team']
    search_fields = ['name', 'creator__username', 'invite_code']
    readonly_fields = ['id', 'invite_code', 'created_at', 'updated_at']
    fieldsets = (
        ('기본 정보', {
            'fields': ('name', 'creator', 'status', 'invite_code')
        }),
        ('게임 설정', {
            'fields': ('game_area', 'total_participants', 'start_date', 'end_date')
        }),
        ('게임 결과', {
            'fields': ('winner_team', 'mvp', 'current_hex_ownerships'),
            'classes': ('collapse',)
        }),
        ('시스템 정보', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    """참가자 Admin"""
    list_display = ['user', 'room', 'team', 'is_host', 'is_recording', 'paintball_count', 'super_paintball_count']
    list_filter = ['team', 'is_host', 'is_recording', 'room__status']
    search_fields = ['user__username', 'room__name']
    readonly_fields = ['id', 'joined_at']


@admin.register(RunningRecord)
class RunningRecordAdmin(admin.ModelAdmin):
    """러닝 기록 Admin"""
    list_display = ['user', 'room', 'started_at', 'ended_at', 'distance_meters', 'duration_seconds', 'avg_pace_seconds_per_km']
    list_filter = ['room', 'started_at']
    search_fields = ['user__username', 'room__name']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'started_at'

