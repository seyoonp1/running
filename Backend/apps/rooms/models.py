"""
Room models
"""
import uuid
import secrets
from django.db import models
from django.conf import settings


class Room(models.Model):
    """Game room/room settings"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_rooms')
    invite_code = models.CharField(max_length=20, unique=True, db_index=True)
    max_participants = models.IntegerField(default=20)
    game_duration_minutes = models.IntegerField(default=60)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    rules = models.JSONField(default=dict, blank=True)  # Custom rules
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'rooms'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.invite_code})"
    
    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = self.generate_invite_code()
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_invite_code():
        """Generate unique invite code"""
        while True:
            code = secrets.token_urlsafe(6).upper()[:6]
            if not Room.objects.filter(invite_code=code).exists():
                return code

