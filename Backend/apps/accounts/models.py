"""
User model
"""
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings


class User(AbstractUser):
    """Custom User model"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.username


class Friendship(models.Model):
    """Friendship relationship between users"""
    STATUS_CHOICES = [
        ('pending', '대기중'),
        ('accepted', '수락됨'),
        ('blocked', '차단됨'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_friend_requests'
    )
    addressee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_friend_requests'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'friendships'
        unique_together = [['requester', 'addressee']]
        indexes = [
            models.Index(fields=['requester', 'status']),
            models.Index(fields=['addressee', 'status']),
        ]
    
    def __str__(self):
        return f"{self.requester.username} -> {self.addressee.username} ({self.status})"
    
    @classmethod
    def are_friends(cls, user1, user2):
        """Check if two users are friends"""
        return cls.objects.filter(
            status='accepted',
            requester__in=[user1, user2],
            addressee__in=[user1, user2]
        ).exists()
    
    @classmethod
    def get_friends(cls, user):
        """Get all friends of a user"""
        friendships = cls.objects.filter(
            status='accepted'
        ).filter(
            models.Q(requester=user) | models.Q(addressee=user)
        )
        
        friends = []
        for friendship in friendships:
            if friendship.requester == user:
                friends.append(friendship.addressee)
            else:
                friends.append(friendship.requester)
        
        return friends
