"""
Session serializers
"""
from rest_framework import serializers
from .models import Session, Team, Participant, HexOwnership, PlayerStats, ChatMessage
from apps.accounts.serializers import UserSerializer
from apps.rooms.serializers import RoomSerializer


class TeamSerializer(serializers.ModelSerializer):
    """Team serializer"""
    class Meta:
        model = Team
        fields = ['id', 'session', 'name', 'color', 'score', 'created_at']
        read_only_fields = ['id', 'session', 'score', 'created_at']


class ParticipantSerializer(serializers.ModelSerializer):
    """Participant serializer"""
    user = UserSerializer(read_only=True)
    team = TeamSerializer(read_only=True)
    
    class Meta:
        model = Participant
        fields = [
            'id', 'session', 'user', 'team', 'status',
            'last_lat', 'last_lng', 'last_h3_id', 'last_location_at', 'joined_at'
        ]
        read_only_fields = ['id', 'session', 'user', 'status', 'joined_at']


class HexOwnershipSerializer(serializers.ModelSerializer):
    """Hex ownership serializer"""
    team = TeamSerializer(read_only=True)
    
    class Meta:
        model = HexOwnership
        fields = ['id', 'session', 'h3_id', 'team', 'claimed_at', 'claimed_by', 'visit_count']
        read_only_fields = ['id', 'session', 'claimed_at']


class SessionSerializer(serializers.ModelSerializer):
    """Session serializer"""
    room = RoomSerializer(read_only=True)
    teams = TeamSerializer(many=True, read_only=True)
    
    class Meta:
        model = Session
        fields = [
            'id', 'room', 'status', 'started_at', 'ended_at',
            'game_area_bounds', 'h3_resolution', 'created_at', 'updated_at', 'teams'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SessionStateSerializer(serializers.Serializer):
    """Session state serializer for initial load"""
    session = SessionSerializer()
    teams = TeamSerializer(many=True)
    participants = ParticipantSerializer(many=True)
    hex_ownerships = HexOwnershipSerializer(many=True)


class SessionJoinSerializer(serializers.Serializer):
    """Session join serializer"""
    team_id = serializers.UUIDField(required=False, allow_null=True)


class PlayerStatsSerializer(serializers.ModelSerializer):
    """Player stats serializer"""
    participant = ParticipantSerializer(read_only=True)
    
    class Meta:
        model = PlayerStats
        fields = [
            'id', 'session', 'participant', 'distance_m', 'duration_sec',
            'hexes_claimed', 'is_mvp',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'session', 'created_at', 'updated_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    """Chat message serializer"""
    participant = ParticipantSerializer(read_only=True)
    team = TeamSerializer(read_only=True)
    
    class Meta:
        model = ChatMessage
        fields = ['id', 'session', 'team', 'participant', 'message', 'created_at']
        read_only_fields = ['id', 'session', 'participant', 'created_at']


class ChatMessageCreateSerializer(serializers.Serializer):
    """Chat message creation serializer"""
    message = serializers.CharField(max_length=500, required=True)
    team_id = serializers.UUIDField(required=False, allow_null=True)
