# GPS 기반 런닝 "땅따먹기" 게임 - 전체 아키텍처 설계

## 1. 전체 아키텍처 요약

### 1.1 시스템 개요
- **서비스**: GPS 기반 런닝 "땅따먹기" 게임
- **지도 시스템**: H3 기반 육각형(hexagon) 그리드
- **운영 모드**: MVP 단일 서버 (1대)
- **실시간 통신**: WebSocket (Django Channels)
- **배포**: AWS (EC2/ECS + RDS + ElastiCache)

### 1.2 기술 스택
- **Backend Framework**: Django 4.2+ / Django REST Framework
- **WebSocket**: Django Channels (ASGI)
- **Database**: PostgreSQL (Amazon RDS)
- **Cache/Channel Layer**: Redis (Amazon ElastiCache)
- **지도 시스템**: Uber H3 (h3-py)
- **인증**: JWT (djangorestframework-simplejwt)
- **배포**: Docker + EC2 또는 ECS Fargate

### 1.3 아키텍처 다이어그램
```
┌─────────────────────────────────────────────────────────┐
│                    Client (Mobile App)                   │
│              WebSocket (WSS) + REST API (HTTPS)         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              AWS Application Load Balancer               │
│              (HTTPS/WSS Termination)                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              EC2 Instance (Single Server)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Django Application (ASGI: Daphne/Uvicorn)       │  │
│  │  - Django REST Framework (REST API)              │  │
│  │  - Django Channels (WebSocket)                   │  │
│  │  - Celery (Background Tasks, Optional)           │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│  RDS          │         │  ElastiCache  │
│  PostgreSQL   │         │  Redis        │
│  (Master)     │         │  (Channel     │
│               │         │   Layer +     │
│               │         │   Cache)      │
└───────────────┘         └───────────────┘
```

### 1.4 데이터 흐름
1. **실시간 위치 업데이트**: Client → WebSocket → Channels Consumer → Redis (상태) → DB (스냅샷)
2. **점령 판정**: Consumer → H3 변환 → 점령 로직 → Redis 업데이트 → WebSocket Broadcast
3. **루프 판정**: 주기적 또는 이벤트 기반 → 그래프 탐색 → Flood Fill → Redis/DB 업데이트
4. **초기 상태 로드**: Client → REST API → DB 조회 → Redis 캐시 확인

---

## 2. H3 해상도(Resolution) 추천

### 2.1 계산 근거

#### 가정 조건
- **러닝 평균 속도**: 2.5 ~ 3.3 m/s (9 ~ 12 km/h)
- **목표 이동 시간**: 2 ~ 3분
- **계산된 이동 거리**: 
  - 최소: 2.5 m/s × 120초 = 300m
  - 최대: 3.3 m/s × 180초 = 594m
  - 평균: 약 400 ~ 500m

#### H3 Resolution별 셀 크기
H3 공식 문서 기준 (지구 평균):

| Resolution | Edge Length (m) | Area (km²) | 설명 |
|------------|----------------|------------|------|
| 9          | ~174           | ~0.024     | **권장** |
| 8          | ~461           | ~0.17      | 너무 큼 |
| 7          | ~1228          | ~1.2       | 너무 큼 |

**Resolution 9의 Edge Length (~174m)**는:
- 2분 이동: 2.5 m/s × 120s = 300m → 약 0.65 edge
- 3분 이동: 3.3 m/s × 180s = 594m → 약 1.29 edge

**Resolution 9가 목표 범위와 가장 근접합니다 (작은 단위 점령 선호).**

### 2.2 최종 추천

#### **권장: Resolution 9**
- **Edge Length**: ~174m
- **이유**: 더 정밀하고 조밀한 점령 경험 제공
- **장점**: 빠른 땅따먹기 피드백, 좁은 구역에서의 경쟁 유리

#### **대안: Resolution 7**
- **Edge Length**: ~1228m
- **이유**: 더 느린 게임 속도 원할 경우
- **단점**: 셀이 커서 점령이 느려 보일 수 있음

### 2.3 GPS 오차 고려 파라미터

#### 점령 판정 최소 체류 조건
- **연속 샘플 수 (N)**: 2 ~ 3회
- **최소 거리 (R)**: 20 ~ 30m (GPS 오차 범위)
- **체류 시간**: 30 ~ 60초 (옵션)

**권장 설정**:
```python
CLAIM_MIN_SAMPLES = 2  # 같은 h3_id가 2회 연속
CLAIM_MIN_DWELL_SEC = 30  # 최소 30초 체류 (옵션)
GPS_ERROR_RADIUS_M = 25  # GPS 오차 반경 25m
```

---

## 3. AWS 배포 구성도

### 3.1 인프라 구성

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│  Route 53 (DNS)                     │
│  game.example.com                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Application Load Balancer (ALB)    │
│  - HTTPS (443)                      │
│  - WSS (443)                        │
│  - ACM Certificate                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  VPC (10.0.0.0/16)                  │
│  ┌──────────────────────────────┐  │
│  │ Public Subnet (10.0.1.0/24)  │  │
│  │  ┌────────────────────────┐  │  │
│  │  │ EC2 Instance           │  │  │
│  │  │ - Django App (Docker)  │  │  │
│  │  │ - Security Group:      │  │  │
│  │  │   Inbound: 80,443(ALB) │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Private Subnet (10.0.2.0/24)│  │
│  │  ┌────────────────────────┐  │  │
│  │  │ RDS PostgreSQL         │  │  │
│  │  │ - Security Group:      │  │  │
│  │  │   Inbound: 5432(EC2)   │  │  │
│  │  └────────────────────────┘  │  │
│  │  ┌────────────────────────┐  │  │
│  │  │ ElastiCache Redis      │  │  │
│  │  │ - Security Group:      │  │  │
│  │  │   Inbound: 6379(EC2)   │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 3.2 Security Group 규칙

#### EC2 Instance (Django App)
- **Inbound**:
  - 80, 443: ALB Security Group만 허용
- **Outbound**:
  - 5432: RDS Security Group
  - 6379: ElastiCache Security Group
  - 443: Internet (외부 API, 패키지 다운로드)

#### RDS PostgreSQL
- **Inbound**:
  - 5432: EC2 Security Group만 허용
- **Outbound**: 없음 (내부 통신만)

#### ElastiCache Redis
- **Inbound**:
  - 6379: EC2 Security Group만 허용
- **Outbound**: 없음 (내부 통신만)

### 3.3 배포 옵션 비교

#### 옵션 A: EC2 + Docker (권장)
- **장점**: 
  - 비용 효율적 (MVP)
  - 유연한 설정
  - 로컬 개발과 유사한 환경
- **단점**: 
  - 수동 스케일링
  - 서버 관리 필요

#### 옵션 B: ECS Fargate
- **장점**: 
  - 서버리스 (관리 불필요)
  - 자동 스케일링 가능
- **단점**: 
  - 비용이 더 높음 (MVP 초기)
  - 설정 복잡도 증가

**MVP 권장: EC2 + Docker**

---

## 4. DB 모델 정의

### 4.1 ERD 개요
```
User ──┬── Participant ──┬── Session
       │                  │
       │                  └── Team
       │
       └── PlayerStats

Session ──┬── HexOwnership
          │
          └── EventLog
```

### 4.2 Django Models 상세

#### User (기본 사용자)
```python
class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ready')
```

#### Room (방 설정)
```python
class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=200)
    creator = models.ForeignKey(User, on_delete=models.CASCADE)
    invite_code = models.CharField(max_length=20, unique=True)
    max_participants = models.IntegerField(default=20)
    game_duration_minutes = models.IntegerField(default=60)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    rules = models.JSONField(default=dict)  # 커스텀 규칙
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ready')
    created_at = models.DateTimeField(auto_now_add=True)
```

#### Session (실제 게임 세션)
```python
class Session(models.Model):
    STATUS_CHOICES = [
        ('waiting', '대기중'),
        ('active', '진행중'),
        ('finished', '종료'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    game_area_bounds = models.JSONField(default=dict)  # {"north": ..., "south": ..., ...}
    h3_resolution = models.IntegerField(default=9)
    created_at = models.DateTimeField(auto_now_add=True)
```

#### Team (세션 내 팀)
```python
class Team(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7)  # HEX color
    score = models.IntegerField(default=0)  # 점령 타일 수
    created_at = models.DateTimeField(auto_now_add=True)
```

#### Participant (세션 참가자)
```python
class Participant(models.Model):
    STATUS_CHOICES = [
        ('joined', '참가'),
        ('active', '활동중'),
        ('left', '나감'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='joined')
    last_lat = models.FloatField(null=True, blank=True)
    last_lng = models.FloatField(null=True, blank=True)
    last_h3_id = models.CharField(max_length=20, null=True, blank=True, db_index=True)
    last_location_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)
```

#### HexOwnership (Hex 소유 정보)
```python
class HexOwnership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='hex_ownerships')
    h3_id = models.CharField(max_length=20, db_index=True)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True)
    claimed_at = models.DateTimeField(auto_now_add=True)
    claimed_by = models.ForeignKey(Participant, on_delete=models.SET_NULL, null=True)
    visit_count = models.IntegerField(default=1)  # 재방문 횟수 (효율 감소용)
    
    class Meta:
        unique_together = [['session', 'h3_id']]
        indexes = [
            models.Index(fields=['session', 'h3_id']),
            models.Index(fields=['session', 'team']),
        ]
```

#### EventLog (중요 이벤트)
```python
class EventLog(models.Model):
    EVENT_TYPES = [
        ('claim', '점령'),
        ('loop', '루프 완성'),
        ('join', '참가'),
        ('leave', '나감'),
        ('match_end', '게임 종료'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='event_logs')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    participant = models.ForeignKey(Participant, on_delete=models.SET_NULL, null=True)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True)
    data = models.JSONField(default=dict)  # 이벤트별 상세 데이터
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
```

#### PlayerStats (플레이어 통계)
```python
class PlayerStats(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='player_stats')
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE)
    distance_m = models.FloatField(default=0.0)
    duration_sec = models.IntegerField(default=0)
    hexes_claimed = models.IntegerField(default=0)
    hexes_in_loops = models.IntegerField(default=0)
    is_mvp = models.BooleanField(default=False)
    mvp_score = models.FloatField(default=0.0)  # MVP 계산 점수
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```


## 5. WebSocket 이벤트 정의

### 5.1 Channels Consumer 구조

#### 라우팅 설정
```python
# routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/session/(?P<session_id>[^/]+)/$', consumers.SessionConsumer.as_asgi()),
]
```

#### Consumer 클래스
```python
# consumers.py
class SessionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.group_name = f'session_{self.session_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
    
    async def receive(self, text_data):
        data = json.loads(text_data)
        event_type = data.get('type')
        # 이벤트 처리...
```

### 5.2 이벤트 타입 및 JSON 예시

#### 1. join_session (클라이언트 → 서버)
```json
{
  "type": "join_session",
  "session_id": "uuid",
  "user_id": "uuid",
  "team_id": "uuid"
}
```

**서버 응답 (broadcast)**:
```json
{
  "type": "participant_joined",
  "participant_id": "uuid",
  "user": {"id": "uuid", "username": "player1"},
  "team_id": "uuid",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### 2. leave_session (클라이언트 → 서버)
```json
{
  "type": "leave_session",
  "session_id": "uuid",
  "participant_id": "uuid"
}
```

**서버 응답**:
```json
{
  "type": "participant_left",
  "participant_id": "uuid",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### 3. loc (위치 업데이트, 클라이언트 → 서버)
```json
{
  "type": "loc",
  "session_id": "uuid",
  "participant_id": "uuid",
  "lat": 37.5665,
  "lng": 126.9780,
  "accuracy": 10.5,
  "speed": 2.8,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**서버 응답 (점령 발생 시)**:
```json
{
  "type": "claim_hex",
  "participant_id": "uuid",
  "team_id": "uuid",
  "h3_id": "87283082dffffff",
  "hex_count": 15,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### 4. claim_hex (서버 → 클라이언트, 브로드캐스트)
```json
{
  "type": "claim_hex",
  "participant_id": "uuid",
  "team_id": "uuid",
  "h3_id": "87283082dffffff",
  "visit_count": 1,
  "efficiency": 1.0,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### 5. loop_complete (서버 → 클라이언트, 브로드캐스트)
```json
{
  "type": "loop_complete",
  "team_id": "uuid",
  "loop_h3_ids": ["87283082dffffff", "87283082effffff", ...],
  "interior_h3_ids": ["87283082cffffff", ...],
  "interior_count": 25,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### 6. score_update (서버 → 클라이언트, 브로드캐스트)
```json
{
  "type": "score_update",
  "scores": [
    {"team_id": "uuid", "team_name": "Team A", "hex_count": 150, "area_km2": 0.25},
    {"team_id": "uuid", "team_name": "Team B", "hex_count": 120, "area_km2": 0.20}
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### 7. match_end (서버 → 클라이언트, 브로드캐스트)
```json
{
  "type": "match_end",
  "winner_team_id": "uuid",
  "final_scores": [
    {"team_id": "uuid", "hex_count": 200, "area_km2": 0.34}
  ],
  "mvp_participants": [
    {"participant_id": "uuid", "user": {"username": "player1"}, "mvp_score": 95.5}
  ],
  "ended_at": "2024-01-01T13:00:00Z"
}
```

### 5.3 Channels 설정 (settings.py)
```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('redis-host', 6379)],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}
```

---

## 6. REST API 목록

### 6.1 인증
- `POST /api/auth/register/` - 회원가입
- `POST /api/auth/login/` - 로그인
- `POST /api/auth/refresh/` - 토큰 갱신

### 6.2 Rooms
- `POST /api/rooms/` - 방 생성
- `GET /api/rooms/{id}/` - 방 조회
- `POST /api/rooms/{id}/invite/` - 초대 링크 생성/조회

### 6.3 Sessions
- `POST /api/sessions/` - 세션 생성/시작
- `GET /api/sessions/{id}/` - 세션 조회
- `POST /api/sessions/{id}/join/` - 세션 참가
- `GET /api/sessions/{id}/state/` - 초기 상태 조회
- `POST /api/sessions/{id}/leave/` - 세션 나가기

### 6.4 Leaderboard
- `GET /api/leaderboard/` - 랭킹 조회

### 6.5 Debug (관리자만)
- `POST /api/debug/simulate/` - 시뮬레이터 실행

### 6.6 API 예시 JSON

#### POST /api/rooms/
**Request**:
```json
{
  "name": "서울 한강 런",
  "max_participants": 20,
  "game_duration_minutes": 60,
  "scheduled_start": "2024-01-01T18:00:00Z"
}
```

**Response**:
```json
{
  "id": "uuid",
  "name": "서울 한강 런",
  "invite_code": "ABC123",
  "creator": {"id": "uuid", "username": "user1"},
  "max_participants": 20,
  "game_duration_minutes": 60,
  "created_at": "2024-01-01T12:00:00Z"
}
```

#### POST /api/sessions/{id}/join/
**Request**:
```json
{
  "team_id": "uuid"
}
```

**Response**:
```json
{
  "participant_id": "uuid",
  "session_id": "uuid",
  "team": {"id": "uuid", "name": "Team A", "color": "#FF0000"},
  "joined_at": "2024-01-01T12:00:00Z"
}
```

#### GET /api/sessions/{id}/state/
**Response**:
```json
{
  "session": {
    "id": "uuid",
    "status": "active",
    "started_at": "2024-01-01T12:00:00Z"
  },
  "teams": [
    {"id": "uuid", "name": "Team A", "hex_count": 50}
  ],
  "hex_ownerships": [
    {"h3_id": "87283082dffffff", "team_id": "uuid"}
  ],
  "participants": [
    {"id": "uuid", "user": {"username": "player1"}, "team_id": "uuid"}
  ]
}
```

---

## 7. 핵심 알고리즘/로직

### 7.1 H3 변환 함수
```python
import h3

def latlng_to_h3(lat: float, lng: float, res: int = 9) -> str:
    """위도/경도를 H3 인덱스로 변환"""
    return h3.geo_to_h3(lat, lng, res)

def h3_to_latlng(h3_id: str) -> tuple:
    """H3 인덱스를 위도/경도로 변환"""
    lat, lng = h3.h3_to_geo(h3_id)
    return lat, lng

def get_h3_neighbors(h3_id: str, k: int = 1) -> list:
    """H3 인덱스의 k-ring 이웃 반환"""
    return h3.k_ring(h3_id, k)
```

### 7.2 점령 판정 로직
```python
class ClaimValidator:
    MIN_SAMPLES = 2
    MIN_DWELL_SEC = 30
    GPS_ERROR_RADIUS_M = 25
    
    def __init__(self, participant_id: str):
        self.participant_id = participant_id
        self.sample_history = []  # Redis에 저장
    
    def add_location_sample(self, lat: float, lng: float, h3_id: str, timestamp: datetime):
        """위치 샘플 추가 및 점령 판정"""
        self.sample_history.append({
            'h3_id': h3_id,
            'timestamp': timestamp,
            'lat': lat,
            'lng': lng
        })
        
        # 최근 N개만 유지
        if len(self.sample_history) > self.MIN_SAMPLES:
            self.sample_history.pop(0)
        
        # 연속 샘플 확인
        if len(self.sample_history) >= self.MIN_SAMPLES:
            recent_h3_ids = [s['h3_id'] for s in self.sample_history[-self.MIN_SAMPLES:]]
            if len(set(recent_h3_ids)) == 1:  # 모두 같은 h3_id
                # 체류 시간 확인
                time_span = (self.sample_history[-1]['timestamp'] - 
                           self.sample_history[0]['timestamp']).total_seconds()
                if time_span >= self.MIN_DWELL_SEC:
                    return recent_h3_ids[0]  # 점령 확정
        return None
```

### 7.3 루프 판정 알고리즘
```python
class LoopDetector:
    def __init__(self, session_id: str):
        self.session_id = session_id
    
    def detect_loop(self, team_id: str) -> dict:
        """팀의 점령 타일로 루프 검출"""
        # 1. 팀의 모든 점령 타일 가져오기
        hex_ownerships = HexOwnership.objects.filter(
            session_id=self.session_id,
            team_id=team_id
        ).values_list('h3_id', flat=True)
        
        # 2. 그래프 구성 (H3 인접 관계)
        graph = self._build_hex_graph(hex_ownerships)
        
        # 3. 사이클 검출 (DFS)
        cycles = self._find_cycles(graph, hex_ownerships)
        
        # 4. 가장 큰 루프 선택 (또는 모든 루프)
        if cycles:
            largest_cycle = max(cycles, key=len)
            interior = self._flood_fill_interior(largest_cycle, hex_ownerships)
            return {
                'loop_h3_ids': largest_cycle,
                'interior_h3_ids': interior
            }
        return None
    
    def _build_hex_graph(self, h3_ids: list) -> dict:
        """H3 인덱스 간 인접 그래프 구성"""
        graph = {}
        for h3_id in h3_ids:
            neighbors = h3.k_ring(h3_id, 1)
            graph[h3_id] = [n for n in neighbors if n in h3_ids]
        return graph
    
    def _find_cycles(self, graph: dict, h3_ids: set) -> list:
        """DFS로 사이클 검출"""
        visited = set()
        cycles = []
        
        def dfs(node, path):
            if node in path:
                cycle_start = path.index(node)
                cycle = path[cycle_start:] + [node]
                if len(cycle) >= 3:  # 최소 3개 타일
                    cycles.append(cycle)
                return
            if node in visited:
                return
            
            visited.add(node)
            for neighbor in graph.get(node, []):
                if neighbor not in path or neighbor == path[-2]:
                    dfs(neighbor, path + [neighbor])
            visited.remove(node)
        
        for h3_id in h3_ids:
            if h3_id not in visited:
                dfs(h3_id, [h3_id])
        
        return cycles
    
    def _flood_fill_interior(self, loop_h3_ids: list, all_owned: set) -> list:
        """루프 내부 타일 채우기"""
        # 루프 경계 내부의 모든 H3 타일 찾기
        # H3 polygon fill 또는 k-ring 기반 탐색
        interior = []
        # 구현 생략 (H3 polygon API 사용)
        return interior
```

### 7.4 재방문 효율 감소 로직
```python
def calculate_claim_efficiency(hex_ownership: HexOwnership) -> float:
    """재방문 시 효율 감소 계산"""
    if hex_ownership.visit_count == 1:
        return 1.0  # 100%
    elif hex_ownership.visit_count == 2:
        return 0.7  # 70%
    else:
        return 0.6  # 60% (3회 이상)
```

---

## 8. 디버깅 시뮬레이터 설계

### 8.1 구조
```
apps/debugtools/
├── management/
│   └── commands/
│       └── simulate_run.py
├── simulators/
│   ├── route_parser.py
│   ├── bot_controller.py
│   └── websocket_client.py
└── fixtures/
    └── sample_routes/
        ├── seoul_hangang.json
        └── seoul_olympic_park.json
```

### 8.2 Management Command 시그니처
```python
# simulate_run.py
class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument('--session_id', type=str, required=True)
        parser.add_argument('--route_file', type=str, required=True)
        parser.add_argument('--bots', type=int, default=1)
        parser.add_argument('--speed_mps', type=float, default=2.8)
        parser.add_argument('--tick', type=float, default=1.0)
        parser.add_argument('--jitter', type=float, default=3.0)
        parser.add_argument('--seed', type=int, default=None)
        parser.add_argument('--loop_count', type=int, default=1)
        parser.add_argument('--duration_limit', type=int, default=None)
    
    def handle(self, *args, **options):
        # 시뮬레이션 실행
        pass
```

### 8.3 Route 파일 포맷 (JSON)
```json
{
  "name": "서울 한강 경로",
  "waypoints": [
    {"lat": 37.5665, "lng": 126.9780},
    {"lat": 37.5700, "lng": 126.9800},
    {"lat": 37.5750, "lng": 126.9820}
  ],
  "metadata": {
    "total_distance_m": 1500,
    "estimated_duration_sec": 600
  }
}
```

### 8.4 예시 실행 커맨드
```bash
python manage.py simulate_run \
  --session_id abc123 \
  --route_file fixtures/sample_routes/seoul_hangang.json \
  --bots 4 \
  --speed_mps 2.8 \
  --tick 1 \
  --jitter 3 \
  --seed 42 \
  --loop_count 1
```

### 8.5 예상 출력
```
[Simulator] Starting simulation...
[Simulator] Session: abc123
[Simulator] Bots: 4
[Simulator] Route: seoul_hangang.json (15 waypoints)
[Simulator] Speed: 2.8 m/s, Tick: 1.0s, Jitter: 3.0m

[Bot-1] Connected to WebSocket
[Bot-2] Connected to WebSocket
[Bot-3] Connected to WebSocket
[Bot-4] Connected to WebSocket

[Bot-1] Location: (37.5665, 126.9780) -> h3: 87283082dffffff
[Bot-1] Claimed hex: 87283082dffffff
[Bot-2] Location: (37.5670, 126.9785) -> h3: 87283082effffff
...

[Simulator] Simulation completed
[Simulator] Results:
  - Duration: 600s
  - Bot-1: 25 hexes claimed, 2 loops
  - Bot-2: 20 hexes claimed, 1 loop
  - Bot-3: 18 hexes claimed, 0 loops
  - Bot-4: 22 hexes claimed, 1 loop
  - Total events: 150
```

---

## 9. Django 폴더 구조

```
hexgame_backend/
├── config/
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── asgi.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── accounts/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── rooms/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── sessions/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── realtime/
│   │   ├── consumers.py
│   │   ├── routing.py
│   │   └── utils.py
│   ├── hexmap/
│   │   ├── h3_utils.py
│   │   ├── claim_validator.py
│   │   ├── loop_detector.py
│   │   └── efficiency.py
│   ├── leaderboard/
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   └── debugtools/
│       ├── management/
│       │   └── commands/
│       │       └── simulate_run.py
│       ├── simulators/
│       │   ├── route_parser.py
│       │   ├── bot_controller.py
│       │   └── websocket_client.py
│       └── fixtures/
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── manage.py
└── .env.example
```

---

## 10. Docker 설정

### 10.1 docker-compose.yml (로컬 개발)
```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: hexgame
      POSTGRES_USER: hexgame
      POSTGRES_PASSWORD: hexgame
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  web:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://hexgame:hexgame@db:5432/hexgame
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
```

### 10.2 Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
```

---

## 11. MVP 운영 체크리스트

### 11.1 로깅
- [ ] CloudWatch Logs 연동
- [ ] 로그 레벨 설정 (INFO/WARNING/ERROR)
- [ ] 구조화된 로깅 (JSON 포맷)
- [ ] WebSocket 연결/해제 로그
- [ ] 이벤트 로그 (claim/loop/match_end)

### 11.2 백업
- [ ] RDS 자동 백업 설정 (일 1회)
- [ ] 스냅샷 보관 기간 (7일)
- [ ] EventLog 테이블 정기 백업
- [ ] Redis 스냅샷 (선택)

### 11.3 모니터링
- [ ] CloudWatch Metrics (CPU, Memory, Network)
- [ ] RDS 모니터링 (연결 수, 쿼리 성능)
- [ ] ElastiCache 모니터링 (메모리 사용률)
- [ ] 알람 설정 (CPU > 80%, 메모리 > 90%)

### 11.4 장애 복구
- [ ] EventLog 기반 상태 복구 스크립트
- [ ] Redis 장애 시 DB 기반 복구
- [ ] 서버 재시작 시 자동 복구 프로세스

### 11.5 보안
- [ ] HTTPS/WSS 강제
- [ ] JWT 토큰 만료 시간 설정
- [ ] CORS 설정 (프론트엔드 도메인만)
- [ ] Rate Limiting (API/WebSocket)
- [ ] AWS Secrets Manager 연동
- [ ] Security Group 최소 권한 원칙

---

## 부록: H3 Resolution 참고

### H3 Resolution 8 상세
- **Average Hexagon Edge Length**: ~461m
- **Average Hexagon Area**: ~0.17 km²
- **Number of Hexagons**: ~122 per km²
- **적용 시나리오**: 도시 런닝, 공원 런닝

### H3 Resolution 7 (대안)
- **Average Hexagon Edge Length**: ~1228m
- **Average Hexagon Area**: ~1.2 km²
- **적용 시나리오**: 넓은 지역, 느린 게임 속도

