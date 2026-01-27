"""
Account serializers
"""
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Friendship


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'created_at',
            'rating', 'games_played', 'games_won', 'games_lost',
            'games_draw', 'mvp_count', 'highest_rating'
        ]
        read_only_fields = [
            'id', 'created_at', 'rating', 'games_played',
            'games_won', 'games_lost', 'games_draw', 'mvp_count', 'highest_rating'
        ]


class RegisterSerializer(serializers.ModelSerializer):
    """Registration serializer"""
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password']
    
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user


class LoginSerializer(serializers.Serializer):
    """Login serializer"""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if username and password:
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Must include username and password')
        
        return attrs


class FriendshipSerializer(serializers.ModelSerializer):
    """Friendship serializer"""
    requester = UserSerializer(read_only=True)
    addressee = UserSerializer(read_only=True)
    requester_id = serializers.UUIDField(write_only=True, required=False)
    addressee_id = serializers.UUIDField(write_only=True, required=False)
    
    class Meta:
        model = Friendship
        fields = ['id', 'requester', 'addressee', 'requester_id', 'addressee_id', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class FriendRequestSerializer(serializers.Serializer):
    """Friend request serializer"""
    username = serializers.CharField(required=False)
    user_id = serializers.UUIDField(required=False)
    
    def validate(self, attrs):
        if not attrs.get('username') and not attrs.get('user_id'):
            raise serializers.ValidationError('Either username or user_id must be provided')
        return attrs
