"""
Room serializers
"""
from rest_framework import serializers
from django.db import models
from .models import Room
from apps.accounts.serializers import UserSerializer


class RoomSerializer(serializers.ModelSerializer):
    """Room serializer"""
    creator = UserSerializer(read_only=True)
    
    class Meta:
        model = Room
        fields = [
            'id', 'name', 'creator', 'invite_code', 'max_participants',
            'game_duration_minutes', 'scheduled_start', 'rules',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'creator', 'invite_code', 'created_at', 'updated_at']


class RoomCreateSerializer(serializers.ModelSerializer):
    """Room creation serializer"""
    friend_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True,
        help_text="List of friend user IDs to invite"
    )
    
    class Meta:
        model = Room
        fields = ['name', 'max_participants', 'game_duration_minutes', 'scheduled_start', 'rules', 'friend_ids']
    
    def validate_friend_ids(self, value):
        """Validate that all friend IDs are valid friends"""
        if not value:
            return value
        
        user = self.context['request'].user
        from apps.accounts.models import Friendship
        
        # Get all friend IDs
        friendships = Friendship.objects.filter(
            status='accepted'
        ).filter(
            models.Q(requester=user) | models.Q(addressee=user)
        )
        
        friend_ids = set()
        for friendship in friendships:
            if friendship.requester == user:
                friend_ids.add(friendship.addressee.id)
            else:
                friend_ids.add(friendship.requester.id)
        
        # Check if all provided IDs are friends
        invalid_ids = set(value) - friend_ids
        if invalid_ids:
            raise serializers.ValidationError(
                f"Users {invalid_ids} are not your friends"
            )
        
        return value
