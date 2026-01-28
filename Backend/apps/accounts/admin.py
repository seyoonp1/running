from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Friendship, Mailbox

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """사용자 관리자 설정"""
    list_display = ('username', 'email', 'rating', 'games_played', 'is_staff', 'created_at')
    list_filter = ('is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'email')
    ordering = ('-created_at',)
    
    # Custom fieldsets to include rating, games info
    fieldsets = UserAdmin.fieldsets + (
        ('Game Info', {'fields': ('rating', 'games_played', 'games_won', 'games_lost', 'games_draw', 'mvp_count', 'highest_rating')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Game Info', {'fields': ('rating', 'games_played', 'games_won', 'games_lost', 'games_draw', 'mvp_count', 'highest_rating')}),
    )

@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    """친구 관계 관리자 설정"""
    list_display = ('requester', 'addressee', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('requester__username', 'addressee__username')

@admin.register(Mailbox)
class MailboxAdmin(admin.ModelAdmin):
    """우편함 관리자 설정"""
    list_display = ('sender', 'receiver', 'mail_type', 'status', 'created_at')
    list_filter = ('mail_type', 'status')
    search_fields = ('sender__username', 'receiver__username')
