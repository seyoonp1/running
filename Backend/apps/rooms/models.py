"""
Room models - MVP 버전
Session이 Room에 병합됨
"""
import uuid
import secrets
from django.db import models
from django.conf import settings


class GameArea(models.Model):
    """
    게임 구역 (미리 지정된 구역)
    - 개발자가 미리 정의한 게임 가능 지역
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text='구역 이름 (예: 한강공원)')
    city = models.CharField(max_length=100, help_text='도시 (예: 서울)')
    description = models.TextField(blank=True, help_text='구역 설명')
    
    # 게임 영역 설정
    bounds = models.JSONField(
        default=dict, 
        help_text='게임 영역 경계 (GeoJSON polygon)'
    )
    h3_resolution = models.IntegerField(default=8, help_text='H3 해상도 (기본: 8)')
    
    # 활성화 여부
    is_active = models.BooleanField(default=True, help_text='활성화 여부 (비활성화 시 선택 불가)')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'game_areas'
        ordering = ['city', 'name']
        indexes = [
            models.Index(fields=['city', 'is_active']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(h3_resolution__gte=0) & models.Q(h3_resolution__lte=15),
                name='game_area_h3_resolution_valid'
            ),
        ]
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if not (0 <= self.h3_resolution <= 15):
            raise ValidationError('H3 해상도는 0~15 사이의 값이어야 합니다.')
    
    def __str__(self):
        return f"{self.name} ({self.city})"


class Room(models.Model):
    """
    게임 방 (Nike Run Club + 땅따먹기)
    - Room = 하나의 게임 (Session 개념이 병합됨)
    """
    STATUS_CHOICES = [
        ('ready', '준비'),
        ('active', '진행중'),
        ('finished', '완료'),
    ]
    
    TEAM_CHOICES = [
        ('A', 'A팀'),
        ('B', 'B팀'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text='방 이름')
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='created_rooms',
        help_text='방장'
    )
    
    # 참가자 설정
    total_participants = models.IntegerField(
        default=4, 
        help_text='총 인원수 (짝수, A팀 절반 + B팀 절반)'
    )
    
    # 일정 설정
    start_date = models.DateTimeField(help_text='게임 시작 일시')
    end_date = models.DateTimeField(help_text='게임 종료 일시')
    
    # 게임 영역 설정 (미리 지정된 구역 선택)
    game_area = models.ForeignKey(
        GameArea,
        on_delete=models.PROTECT,
        related_name='rooms',
        help_text='선택한 게임 구역'
    )
    
    @property
    def game_area_bounds(self):
        """게임 구역의 경계 반환 (하위 호환성)"""
        return self.game_area.bounds if self.game_area else {}
    
    @property
    def h3_resolution(self):
        """게임 구역의 H3 해상도 반환 (하위 호환성)"""
        return self.game_area.h3_resolution if self.game_area else 8
    
    # 현재 Hex 점령 상태 (실시간 업데이트)
    current_hex_ownerships = models.JSONField(
        default=dict, 
        blank=True,
        help_text='현재 hex 점령 상태 {h3_id: {team: "A"|"B", user_id, claimed_at}}'
    )
    
    # 방 상태
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ready',
        db_index=True,
        help_text='방 상태'
    )
    
    # 초대 코드
    invite_code = models.CharField(max_length=20, unique=True, db_index=True)
    
    # MVP 사용자
    mvp = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mvp_rooms',
        help_text='게임 종료 시 MVP'
    )
    
    # 승리 팀
    winner_team = models.CharField(
        max_length=1,
        choices=TEAM_CHOICES,
        null=True,
        blank=True,
        help_text='승리 팀'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'rooms'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['creator', 'status']),
            models.Index(fields=['status', 'start_date']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(total_participants__gt=0) & models.Q(total_participants__lte=100),
                name='room_total_participants_valid'
            ),
        ]
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.total_participants <= 0:
            raise ValidationError('총 인원수는 1 이상이어야 합니다.')
        if self.total_participants % 2 != 0:
            raise ValidationError('총 인원수는 짝수여야 합니다.')
        if self.game_area and not self.game_area.is_active:
            raise ValidationError('비활성화된 게임 구역은 선택할 수 없습니다.')
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError('시작 일시가 종료 일시보다 늦을 수 없습니다.')
    
    def __str__(self):
        return f"{self.name} ({self.invite_code})"
    
    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = self.generate_invite_code()
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_invite_code():
        """고유한 초대 코드 생성"""
        while True:
            code = secrets.token_urlsafe(6).upper()[:6]
            if not Room.objects.filter(invite_code=code).exists():
                return code
    
    @property
    def current_participants_count(self):
        """현재 참가자 수"""
        return self.participants.count()
    
    @property
    def team_a_count(self):
        """A팀 인원수"""
        return self.participants.filter(team='A').count()
    
    @property
    def team_b_count(self):
        """B팀 인원수"""
        return self.participants.filter(team='B').count()
    
    @property
    def is_full(self):
        """방이 꽉 찼는지"""
        return self.current_participants_count >= self.total_participants
    
    def get_team_hex_count(self, team):
        """특정 팀의 점령한 hex 개수"""
        return sum(1 for hex_data in self.current_hex_ownerships.values() 
                   if hex_data.get('team') == team)
    
    def determine_winner(self):
        """승리 팀 결정"""
        team_a_hexes = self.get_team_hex_count('A')
        team_b_hexes = self.get_team_hex_count('B')
        
        if team_a_hexes > team_b_hexes:
            self.winner_team = 'A'
        elif team_b_hexes > team_a_hexes:
            self.winner_team = 'B'
        else:
            self.winner_team = None  # 무승부
        
        self.save(update_fields=['winner_team'])
        return self.winner_team


class Participant(models.Model):
    """
    방 참가자
    - 팀 (A/B), 방장 여부, 기록 중 여부, 페인트볼 등
    """
    TEAM_CHOICES = [
        ('A', 'A팀'),
        ('B', 'B팀'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='participations'
    )
    
    # 팀 & 방장
    team = models.CharField(max_length=1, choices=TEAM_CHOICES, default='A', help_text='팀')
    is_host = models.BooleanField(default=False, help_text='방장 여부')
    
    # 기록 상태
    is_recording = models.BooleanField(default=False, help_text='현재 기록 중인지')
    
    # 페인트볼
    paintball_count = models.IntegerField(default=0, help_text='페인트볼 개수')
    super_paintball_count = models.IntegerField(default=0, help_text='슈퍼 페인트볼 개수')
    paintball_gauge = models.IntegerField(default=0, help_text='페인트볼 게이지 (0-100)')

    # 게임 결과 통계
    hexes_claimed = models.IntegerField(default=0, help_text='점령한 땅 수')
    rating_change = models.IntegerField(default=0, help_text='레이팅 변동')
    is_mvp = models.BooleanField(default=False, help_text='MVP 여부')
    
    # 출석 보상
    consecutive_attendance_days = models.IntegerField(default=0, help_text='연속 출석일')
    last_attendance_date = models.DateField(null=True, blank=True, help_text='마지막 출석일')
    
    # 위치 정보
    last_lat = models.FloatField(null=True, blank=True, help_text='마지막 위도')
    last_lng = models.FloatField(null=True, blank=True, help_text='마지막 경도')
    last_h3_id = models.CharField(max_length=20, null=True, blank=True, db_index=True, help_text='마지막 H3 ID')
    last_location_at = models.DateTimeField(null=True, blank=True, help_text='마지막 위치 업데이트 시간')
    
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'participants'
        unique_together = [['room', 'user']]
        indexes = [
            models.Index(fields=['room', 'team']),
            models.Index(fields=['room', 'is_host']),
            models.Index(fields=['room', 'is_recording']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(paintball_count__gte=0),
                name='participant_paintball_non_negative'
            ),
            models.CheckConstraint(
                check=models.Q(super_paintball_count__gte=0),
                name='participant_super_paintball_non_negative'
            ),
            models.CheckConstraint(
                check=models.Q(paintball_gauge__gte=0) & models.Q(paintball_gauge__lte=100),
                name='participant_gauge_valid'
            ),
            models.CheckConstraint(
                check=(models.Q(last_lat__isnull=True) | (models.Q(last_lat__gte=-90) & models.Q(last_lat__lte=90))),
                name='participant_lat_range'
            ),
            models.CheckConstraint(
                check=(models.Q(last_lng__isnull=True) | (models.Q(last_lng__gte=-180) & models.Q(last_lng__lte=180))),
                name='participant_lng_range'
            ),
        ]
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.paintball_count < 0:
            raise ValidationError('페인트볼 개수는 0 이상이어야 합니다.')
        if self.super_paintball_count < 0:
            raise ValidationError('슈퍼 페인트볼 개수는 0 이상이어야 합니다.')
        if not (0 <= self.paintball_gauge <= 100):
            raise ValidationError('페인트볼 게이지는 0~100 사이의 값이어야 합니다.')
    
    def __str__(self):
        return f"{self.user.username} in {self.room.name} (Team {self.team})"
    
    def add_gauge(self, amount):
        """게이지 추가 (100이 차면 페인트볼 +1)"""
        self.paintball_gauge += amount
        while self.paintball_gauge >= 100:
            self.paintball_gauge -= 100
            self.paintball_count += 1
        self.save(update_fields=['paintball_gauge', 'paintball_count'])
    
    def use_paintball(self):
        """페인트볼 사용"""
        if self.paintball_count > 0:
            self.paintball_count -= 1
            self.save(update_fields=['paintball_count'])
            return True
        return False
    
    def use_super_paintball(self):
        """슈퍼 페인트볼 사용"""
        if self.super_paintball_count > 0:
            self.super_paintball_count -= 1
            self.save(update_fields=['super_paintball_count'])
            return True
        return False
    
    def exchange_paintballs_to_super(self):
        """페인트볼 3개 → 슈퍼 페인트볼 1개 교환"""
        if self.paintball_count >= 3:
            self.paintball_count -= 3
            self.super_paintball_count += 1
            self.save(update_fields=['paintball_count', 'super_paintball_count'])
            return True
        return False


class RunningRecord(models.Model):
    """
    러닝 기록
    - 시작 버튼 ~ 종료 버튼 사이의 기록
    - 시간, 거리, 페이스
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='running_records'
    )
    room = models.ForeignKey(
        Room, 
        on_delete=models.CASCADE, 
        related_name='running_records',
        null=True, 
        blank=True,
        help_text='관련 방 (방 밖에서 뛸 수도 있음)'
    )
    participant = models.ForeignKey(
        Participant, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='running_records'
    )
    
    # 기록 데이터
    duration_seconds = models.IntegerField(default=0, help_text='달린 시간 (초)')
    distance_meters = models.FloatField(default=0.0, help_text='달린 거리 (미터)')
    avg_pace_seconds_per_km = models.FloatField(
        null=True, 
        blank=True, 
        help_text='평균 페이스 (초/km)'
    )
    
    # 시작/종료 시간
    started_at = models.DateTimeField(help_text='기록 시작 시간')
    ended_at = models.DateTimeField(null=True, blank=True, help_text='기록 종료 시간')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'running_records'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', '-started_at']),
            models.Index(fields=['room', 'user']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(duration_seconds__gte=0),
                name='record_duration_non_negative'
            ),
            models.CheckConstraint(
                check=models.Q(distance_meters__gte=0),
                name='record_distance_non_negative'
            ),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.distance_meters}m in {self.duration_seconds}s"
    
    def calculate_pace(self):
        """평균 페이스 계산"""
        if self.distance_meters > 0:
            self.avg_pace_seconds_per_km = (self.duration_seconds / self.distance_meters) * 1000
        else:
            self.avg_pace_seconds_per_km = None
        return self.avg_pace_seconds_per_km
    
    @property
    def pace_display(self):
        """페이스를 '분:초/km' 형식으로 반환"""
        if self.avg_pace_seconds_per_km:
            minutes = int(self.avg_pace_seconds_per_km // 60)
            seconds = int(self.avg_pace_seconds_per_km % 60)
            return f"{minutes}:{seconds:02d}/km"
        return None
