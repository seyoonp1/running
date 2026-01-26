"""
User model - MVP 버전
"""
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings


class User(AbstractUser):
    """사용자 모델"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # AbstractUser에서 불필요한 필드 제거
    first_name = None
    last_name = None
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.username


class Friendship(models.Model):
    """친구 관계"""
    STATUS_CHOICES = [
        ('pending', '대기중'),
        ('accepted', '수락됨'),
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
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='pending', 
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'friendships'
        unique_together = [['requester', 'addressee']]
        indexes = [
            models.Index(fields=['requester', 'status']),
            models.Index(fields=['addressee', 'status']),
        ]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(requester=models.F('addressee')),
                name='friendship_no_self_request'
            ),
        ]
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.requester == self.addressee:
            raise ValidationError('자기 자신에게 친구 요청을 보낼 수 없습니다.')
    
    def __str__(self):
        return f"{self.requester.username} -> {self.addressee.username} ({self.status})"
    
    @classmethod
    def are_friends(cls, user1, user2):
        """두 사용자가 친구인지 확인"""
        return cls.objects.filter(
            status='accepted',
            requester__in=[user1, user2],
            addressee__in=[user1, user2]
        ).exists()
    
    @classmethod
    def get_friends(cls, user):
        """사용자의 친구 목록 반환"""
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


class Mailbox(models.Model):
    """
    우편함
    - 친구 요청 및 방 초대
    """
    MAIL_TYPE_CHOICES = [
        ('friend_request', '친구 요청'),
        ('room_invite', '방 초대'),
    ]
    STATUS_CHOICES = [
        ('unread', '안읽음'),
        ('read', '읽음'),
        ('accepted', '수락됨'),
        ('rejected', '거절됨'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_mails',
        help_text='보낸 사람'
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_mails',
        help_text='받는 사람'
    )
    mail_type = models.CharField(
        max_length=20,
        choices=MAIL_TYPE_CHOICES,
        default='room_invite',
        db_index=True,
        help_text='메일 타입'
    )
    room = models.ForeignKey(
        'rooms.Room',
        on_delete=models.CASCADE,
        related_name='invites',
        null=True,
        blank=True,
        help_text='초대하는 방 (방 초대일 때만)'
    )
    friendship = models.ForeignKey(
        'accounts.Friendship',
        on_delete=models.CASCADE,
        related_name='mails',
        null=True,
        blank=True,
        help_text='친구 요청 (친구 요청일 때만)'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='unread',
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'mailbox'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['receiver', 'status']),
            models.Index(fields=['receiver', 'mail_type']),
            models.Index(fields=['receiver', '-created_at']),
        ]
    
    def __str__(self):
        target = self.room.name if self.room else 'friend_request'
        return f"{self.mail_type} from {self.sender.username} to {self.receiver.username} ({target})"
    
    def mark_as_read(self):
        """읽음 표시"""
        if self.status == 'unread':
            from django.utils import timezone
            self.status = 'read'
            self.read_at = timezone.now()
            self.save(update_fields=['status', 'read_at'])
