"""
Session models
"""
import uuid
from django.db import models
from django.conf import settings
from apps.rooms.models import Room


class Session(models.Model):
    """Game session"""
    STATUS_CHOICES = [
        ('waiting', '대기중'),
        ('active', '진행중'),
        ('finished', '종료'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='sessions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting', db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    game_area_bounds = models.JSONField(default=dict, blank=True)  # {"north": ..., "south": ..., "east": ..., "west": ...}
    h3_resolution = models.IntegerField(default=8)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sessions'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Session {self.id} ({self.status})"


class Team(models.Model):
    """Team in a session"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7)  # HEX color
    score = models.IntegerField(default=0)  # Claimed hex count
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'teams'
        ordering = ['-score']
    
    def __str__(self):
        return f"{self.name} ({self.session})"


class Participant(models.Model):
    """Session participant"""
    STATUS_CHOICES = [
        ('joined', '참가'),
        ('active', '활동중'),
        ('left', '나감'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='participations')
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, related_name='members')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='joined', db_index=True)
    last_lat = models.FloatField(null=True, blank=True)
    last_lng = models.FloatField(null=True, blank=True)
    last_h3_id = models.CharField(max_length=20, null=True, blank=True, db_index=True)
    last_location_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'participants'
        unique_together = [['session', 'user']]
        indexes = [
            models.Index(fields=['session', 'status']),
            models.Index(fields=['session', 'last_h3_id']),
        ]
    
    def __str__(self):
        return f"{self.user.username} in {self.session}"


class HexOwnership(models.Model):
    """Hex ownership in a session"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='hex_ownerships')
    h3_id = models.CharField(max_length=20, db_index=True)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, related_name='owned_hexes')
    claimed_at = models.DateTimeField(auto_now_add=True)
    claimed_by = models.ForeignKey(Participant, on_delete=models.SET_NULL, null=True, related_name='claimed_hexes')
    visit_count = models.IntegerField(default=1)  # Revisit count (for efficiency reduction)
    
    class Meta:
        db_table = 'hex_ownerships'
        unique_together = [['session', 'h3_id']]
        indexes = [
            models.Index(fields=['session', 'h3_id']),
            models.Index(fields=['session', 'team']),
        ]
    
    def __str__(self):
        return f"Hex {self.h3_id} owned by {self.team}"


class EventLog(models.Model):
    """Event log"""
    EVENT_TYPES = [
        ('claim', '점령'),
        ('loop', '루프 완성'),
        ('join', '참가'),
        ('leave', '나감'),
        ('match_end', '게임 종료'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='event_logs')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, db_index=True)
    participant = models.ForeignKey(Participant, on_delete=models.SET_NULL, null=True, related_name='events')
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, related_name='events')
    data = models.JSONField(default=dict, blank=True)  # Event-specific data
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'event_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session', 'event_type', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.event_type} at {self.created_at}"


class PlayerStats(models.Model):
    """Player statistics for a session"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='player_stats')
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='stats')
    distance_m = models.FloatField(default=0.0)
    duration_sec = models.IntegerField(default=0)
    hexes_claimed = models.IntegerField(default=0)
    hexes_in_loops = models.IntegerField(default=0)
    is_mvp = models.BooleanField(default=False)
    mvp_score = models.FloatField(default=0.0)  # MVP calculation score
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'player_stats'
        unique_together = [['session', 'participant']]
    
    def __str__(self):
        return f"Stats for {self.participant.user.username} in {self.session}"


class ChatMessage(models.Model):
    """Team chat message in a session"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='chat_messages')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='chat_messages', null=True, blank=True)
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='chat_messages')
    message = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'chat_messages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session', 'team', 'created_at']),
            models.Index(fields=['session', 'created_at']),
        ]
    
    def __str__(self):
        return f"Chat from {self.participant.user.username} in {self.session}"


class SessionStateSnapshot(models.Model):
    """Session state snapshot for recovery"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='snapshots')
    snapshot_data = models.JSONField()  # Full state JSON
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'session_state_snapshots'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Snapshot for {self.session} at {self.created_at}"
