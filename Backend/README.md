# HexGame Backend - Django 기반 GPS 런닝 게임

## 빠른 시작

### 로컬 개발 (추천)

로컬에서 개발할 때는 nginx 없이 직접 포트로 접근합니다.

```bash
# 방법 1: 하이브리드 (DB/Redis만 Docker, Django/Socket.IO는 로컬)
# 터미널 1: 인프라만 실행
docker-compose -f docker-compose.dev.yml up db redis -d

# 터미널 2: Django 실행
python manage.py runserver

# 터미널 3: Socket.IO 실행
cd socketio-server && npm install && npm run dev
```

접속 주소:
- Django API: `http://localhost:8000/api/...`
- Socket.IO: `http://localhost:3000/socket.io/...`

### Docker Compose로 전체 실행

```bash
# 개발 모드 (nginx 없음)
docker-compose -f docker-compose.dev.yml up

# 프로덕션 모드 (nginx 포함)
docker-compose up -d

# 마이그레이션
docker-compose exec django python manage.py migrate

# 슈퍼유저 생성
docker-compose exec django python manage.py createsuperuser
```

자세한 내용은 [로컬 개발 가이드](./LOCAL_DEVELOPMENT.md) 참조

## 프로젝트 구조

```
Backend/
├── config/              # Django 설정
│   ├── settings/       # 환경별 설정
│   ├── asgi.py         # ASGI 설정 (Channels)
│   └── urls.py         # URL 라우팅
├── apps/
│   ├── accounts/       # 사용자 인증
│   ├── rooms/          # 게임 방
│   ├── sessions/       # 게임 세션
│   ├── realtime/       # WebSocket (Channels)
│   ├── hexmap/         # H3 헥사곤 로직
│   ├── leaderboard/    # 랭킹
│   └── debugtools/     # 디버깅 도구
├── manage.py
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## 주요 기능

### 1. REST API
- 사용자 인증 (JWT)
- 방 생성/조회
- 세션 참가/상태 조회
- 랭킹 조회

### 2. WebSocket (Django Channels)
- 실시간 위치 업데이트
- Hex 점령 이벤트
- 루프 완성 이벤트
- 점수 업데이트

### 3. H3 헥사곤 시스템
- GPS 좌표 → H3 인덱스 변환
- 점령 판정 (GPS 오차 고려)
- 루프 검출 및 내부 영역 채우기

### 4. 디버깅 시뮬레이터
```bash
python manage.py simulate_run \
  --session_id <uuid> \
  --route_file apps/debugtools/fixtures/sample_routes/seoul_hangang.json \
  --bots 4 \
  --speed_mps 2.8 \
  --tick 1 \
  --jitter 3 \
  --seed 42
```

## API 엔드포인트

### 인증
- `POST /api/auth/register/` - 회원가입
- `POST /api/auth/login/` - 로그인
- `GET /api/auth/me/` - 현재 사용자

### 방
- `POST /api/rooms/` - 방 생성
- `GET /api/rooms/` - 방 목록
- `GET /api/rooms/{id}/` - 방 조회
- `POST /api/rooms/{id}/invite/` - 초대 링크

### 세션
- `POST /api/sessions/` - 세션 생성
- `GET /api/sessions/{id}/` - 세션 조회
- `POST /api/sessions/{id}/join/` - 세션 참가
- `GET /api/sessions/{id}/state/` - 세션 상태
- `POST /api/sessions/{id}/leave/` - 세션 나가기

### 랭킹
- `GET /api/leaderboard/` - 랭킹 조회

## WebSocket / Socket.IO 연결

### 로컬 개발
```javascript
// Socket.IO 클라이언트
const socket = io('http://localhost:3000', {
  path: '/socket.io/',
  auth: {
    token: 'your-jwt-token'
  }
});
```

### 프로덕션 (nginx 사용)
```javascript
const socket = io('https://api.yourdomain.com', {
  path: '/socket.io/',
  auth: {
    token: 'your-jwt-token'
  }
});
```

### 이벤트 타입
- `join_session` - 세션 참가 (클라이언트 → 서버)
- `loc` - 위치 업데이트 (클라이언트 → 서버)
- `leave_session` - 세션 나가기 (클라이언트 → 서버)
- `claim_hex` - Hex 점령 (서버 → 클라이언트)
- `loop_complete` - 루프 완성 (서버 → 클라이언트)
- `score_update` - 점수 업데이트 (서버 → 클라이언트)
- `match_end` - 게임 종료 (서버 → 클라이언트)

## 환경 변수

`.env` 파일에 다음 변수 설정:

```env
DJANGO_ENV=development
SECRET_KEY=your-secret-key
DEBUG=True

DB_NAME=hexgame
DB_USER=hexgame
DB_PASSWORD=hexgame
DB_HOST=localhost
DB_PORT=5432

REDIS_HOST=localhost
REDIS_PORT=6379

H3_DEFAULT_RESOLUTION=9
H3_CLAIM_MIN_SAMPLES=2
H3_CLAIM_MIN_DWELL_SEC=30
```

## 배포

자세한 내용은 [배포 가이드](./DEPLOYMENT.md) 참조

## 문서

- [로컬 개발 가이드](./LOCAL_DEVELOPMENT.md) - 로컬에서 개발하는 방법
- [배포 가이드](./DEPLOYMENT.md) - EC2 + Docker Compose 배포
- [전체 아키텍처 설계](./ARCHITECTURE.md)
- [데이터베이스 스키마](./DB_SCHEMA.md)

