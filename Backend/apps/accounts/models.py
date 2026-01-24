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
    
    # Remove first_name and last_name from AbstractUser
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


class UserStats(models.Model):
    """사용자 통계 정보 - 플레이어 기록"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stats',
        help_text='사용자'
    )
    rank = models.IntegerField(default=0, help_text='랭크')
    total_hexes_claimed = models.IntegerField(default=0, help_text='역대 차지한 hex 횟수')
    mvp_count = models.IntegerField(default=0, help_text='MVP 횟수')
    win_count = models.IntegerField(default=0, help_text='승리 횟수')
    lose_count = models.IntegerField(default=0, help_text='패배 횟수')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_stats'
        verbose_name = 'User Statistics'
        verbose_name_plural = 'User Statistics'
        indexes = [
            models.Index(fields=['rank']),
            models.Index(fields=['total_hexes_claimed']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - Rank: {self.rank}"


class UserDailyRecord(models.Model):
    """사용자 세션별 기록 - 사용자와 세션 조합별 활동 기록"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_records',
        help_text='사용자'
    )
    session = models.ForeignKey(
        'sessions.Session',
        on_delete=models.CASCADE,
        related_name='user_daily_records',
        help_text='세션'
    )
    date = models.DateField(db_index=True, help_text='기록 날짜')
    distance_km = models.FloatField(default=0.0, help_text='그날 뛴 거리 (km)')
    average_speed = models.FloatField(default=0.0, help_text='평균 속력 (km/h)')
    hexes_claimed = models.IntegerField(default=0, help_text='점령한 땅 개수')
    total_duration_sec = models.IntegerField(default=0, help_text='총 시간 (초)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_daily_records'
        verbose_name = 'User Daily Record'
        verbose_name_plural = 'User Daily Records'
        unique_together = [['user', 'session']]
        indexes = [
            models.Index(fields=['user', 'session']),
            models.Index(fields=['user', 'date']),
            models.Index(fields=['session', 'user']),
            models.Index(fields=['date']),
            models.Index(fields=['user', '-date']),  # 최신 날짜부터 조회용
        ]
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.user.username} - {self.date} ({self.distance_km}km)"


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


class Mailbox(models.Model):
    """우편함 - 친구 추가 요청 메일 등이 도착하는 곳"""
    MAIL_TYPE_CHOICES = [
        ('friend_request', '친구 추가 요청'),
        # 추후 다른 메일 타입 추가 가능
    ]
    
    STATUS_CHOICES = [
        ('unread', '안읽음'),
        ('read', '읽음'),
        ('accepted', '수락됨'),
        ('rejected', '거절됨'),
        ('deleted', '삭제됨'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_mails',
        null=True,
        blank=True,
        help_text='보낸 사람 (시스템 메일의 경우 null)'
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_mails',
        help_text='받는 사람'
    )
    mail_type = models.CharField(
        max_length=50,
        choices=MAIL_TYPE_CHOICES,
        default='friend_request',
        db_index=True,
        help_text='메일 타입'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='unread',
        db_index=True,
        help_text='상태'
    )
    title = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        help_text='메일 제목'
    )
    content = models.TextField(
        null=True,
        blank=True,
        help_text='메일 내용'
    )
    related_friendship = models.ForeignKey(
        Friendship,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mails',
        help_text='관련된 친구 요청 (친구 추가 요청 메일의 경우)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    read_at = models.DateTimeField(null=True, blank=True, help_text='읽은 시간')
    
    class Meta:
        db_table = 'mailbox'
        verbose_name = 'Mailbox'
        verbose_name_plural = 'Mailboxes'
        indexes = [
            models.Index(fields=['receiver', 'status']),
            models.Index(fields=['receiver', 'mail_type']),
            models.Index(fields=['receiver', 'created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.mail_type} from {self.sender.username if self.sender else 'System'} to {self.receiver.username} ({self.status})"
    
    def mark_as_read(self):
        """메일을 읽음으로 표시"""
        if self.status == 'unread':
            from django.utils import timezone
            self.status = 'read'
            self.read_at = timezone.now()
            self.save(update_fields=['status', 'read_at'])