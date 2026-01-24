# 로컬 개발 가이드

로컬에서 개발할 때는 nginx 없이 직접 각 서비스의 포트로 접근합니다.

## 빠른 시작

### 1. Docker Compose로 인프라만 실행 (권장)

```bash
# 데이터베이스와 Redis만 Docker로 실행
docker-compose -f docker-compose.dev.yml up db redis -d

# Django는 로컬에서 직접 실행
python manage.py runserver

# Socket.IO는 로컬에서 직접 실행 (별도 터미널)
cd socketio-server
npm install
npm run dev
```

### 2. 모든 서비스를 Docker로 실행

```bash
# 모든 서비스 실행
docker-compose -f docker-compose.dev.yml up

# 백그라운드 실행
docker-compose -f docker-compose.dev.yml up -d

# 로그 확인
docker-compose -f docker-compose.dev.yml logs -f django
docker-compose -f docker-compose.dev.yml logs -f socketio
```

## 접속 주소

로컬 개발 모드에서는 nginx 없이 직접 접근:

- **Django API**: `http://localhost:8000/api/...`
- **Socket.IO**: `http://localhost:3000/socket.io/...`
- **Django Admin**: `http://localhost:8000/admin/`

## 개발 환경 설정

### Python 가상환경 설정 (Django)

```bash
# 가상환경 생성
python -m venv venv

# 가상환경 활성화
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

### Node.js 설정 (Socket.IO)

```bash
cd socketio-server

# 의존성 설치
npm install

# 개발 모드 실행 (nodemon으로 자동 재시작)
npm run dev
```

## 데이터베이스 마이그레이션

```bash
# Docker로 실행 중인 경우
docker-compose -f docker-compose.dev.yml exec django python manage.py migrate

# 로컬에서 직접 실행 중인 경우
python manage.py migrate
```

## 슈퍼유저 생성

```bash
# Docker로 실행 중인 경우
docker-compose -f docker-compose.dev.yml exec django python manage.py createsuperuser

# 로컬에서 직접 실행 중인 경우
python manage.py createsuperuser
```

## 환경 변수

로컬 개발용 `.env` 파일 (선택사항):

```env
# Django
SECRET_KEY=dev-secret-key
DEBUG=True
DJANGO_SETTINGS_MODULE=config.settings.development

# Database (Docker Compose 사용 시)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hexgame
DB_USER=hexgame
DB_PASSWORD=hexgame

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 개발 워크플로우

### 옵션 1: 하이브리드 (추천)
- **DB/Redis**: Docker Compose로 실행
- **Django**: 로컬에서 `runserver`로 실행 (핫 리로드)
- **Socket.IO**: 로컬에서 `npm run dev`로 실행 (핫 리로드)

```bash
# 터미널 1: 인프라만 실행
docker-compose -f docker-compose.dev.yml up db redis

# 터미널 2: Django 실행
python manage.py runserver

# 터미널 3: Socket.IO 실행
cd socketio-server && npm run dev
```

### 옵션 2: 전체 Docker
- 모든 서비스를 Docker로 실행
- 코드 변경 시 컨테이너 재시작 필요

```bash
docker-compose -f docker-compose.dev.yml up
```

## 디버깅

### Django 디버깅
- `DEBUG=True`로 설정되어 있어 에러 페이지에서 상세 정보 확인 가능
- VS Code나 PyCharm에서 브레이크포인트 설정 가능

### Socket.IO 디버깅
- 콘솔에 연결/이벤트 로그 출력
- 브라우저 개발자 도구에서 WebSocket 연결 확인

### 데이터베이스 접근
```bash
# PostgreSQL 접속
docker-compose -f docker-compose.dev.yml exec db psql -U hexgame -d hexgame

# Redis 접속
docker-compose -f docker-compose.dev.yml exec redis redis-cli
```

## 테스트

### API 테스트
```bash
# Health check
curl http://localhost:8000/api/health

# 로그인 테스트
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass"}'
```

### Socket.IO 테스트
브라우저 콘솔에서:
```javascript
const socket = io('http://localhost:3000', {
  path: '/socket.io/',
  auth: {
    token: 'your-jwt-token-here'
  }
});

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('join_session', { session_id: 'your-session-id' });
});
```

## 문제 해결

### 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# Mac/Linux
lsof -i :8000
lsof -i :3000
```

### 데이터베이스 연결 실패
- Docker Compose가 실행 중인지 확인: `docker-compose -f docker-compose.dev.yml ps`
- 데이터베이스가 준비될 때까지 대기 (healthcheck 완료)

### Socket.IO 연결 실패
- JWT 토큰이 올바른지 확인
- CORS 설정 확인 (`CORS_ORIGIN` 환경 변수)

## 프로덕션 배포

로컬 개발이 완료되면 프로덕션 배포:
```bash
# 프로덕션용 docker-compose.yml 사용
docker-compose up -d
```

자세한 내용은 [DEPLOYMENT.md](./DEPLOYMENT.md) 참조

