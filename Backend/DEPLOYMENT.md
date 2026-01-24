# 배포 가이드 (Deployment Guide)

## 아키텍처 개요

```
                    ┌─────────────┐
                    │   Nginx     │
                    │ (Port 80/443)│
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼──────┐ ┌─────▼──────┐ ┌────▼─────┐
    │   Django     │ │  Socket.IO │ │  Redis   │
    │  (Port 8000) │ │ (Port 3000)│ │ (Port 6379)│
    └───────┬──────┘ └────────────┘ └────┬─────┘
            │                            │
            └────────────┬───────────────┘
                         │
                    ┌────▼─────┐
                    │PostgreSQL│
                    │ (Port 5432)│
                    └──────────┘
```

## 경로 라우팅

- `https://api.yourdomain.com/api/...` → Django API
- `https://api.yourdomain.com/socket.io/...` → Node.js Socket.IO
- `https://api.yourdomain.com/admin/...` → Django Admin
- `https://api.yourdomain.com/static/...` → Static Files

## 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```bash
# Django
SECRET_KEY=your-secret-key-here
DEBUG=False
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Database (Docker Compose 내부에서는 서비스 이름 사용)
DB_HOST=db
DB_PORT=5432
DB_NAME=hexgame
DB_USER=hexgame
DB_PASSWORD=your-db-password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT (Django와 Socket.IO가 같은 값 사용)
JWT_SECRET=your-jwt-secret-key
```

## 배포 단계

### 1. EC2 인스턴스 준비

```bash
# Docker 및 Docker Compose 설치
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 프로젝트 배포

```bash
# 프로젝트 클론
git clone <your-repo-url>
cd running_app/running/Backend

# .env 파일 생성
cp .env.example .env
# .env 파일 편집

# Docker Compose로 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 3. Nginx 설정 (프로덕션)

프로덕션에서는 HTTPS를 사용해야 합니다. Let's Encrypt를 사용한 SSL 설정:

```bash
# Certbot 설치
sudo yum install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d api.yourdomain.com

# 자동 갱신 설정
sudo certbot renew --dry-run
```

`nginx/nginx.conf`의 HTTPS 부분 주석을 해제하고 인증서 경로를 설정하세요.

### 4. 도메인 DNS 설정

EC2 인스턴스의 퍼블릭 IP를 가리키도록 DNS A 레코드를 설정:

```
api.yourdomain.com → EC2_PUBLIC_IP
```

### 5. 방화벽 설정

EC2 Security Group에서 다음 포트를 열어주세요:

- **80** (HTTP)
- **443** (HTTPS)
- **22** (SSH)

내부 포트(8000, 3000, 5432, 6379)는 외부에 노출하지 않아도 됩니다.

## 모니터링

### 로그 확인

```bash
# 모든 서비스 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f django
docker-compose logs -f socketio
docker-compose logs -f nginx

# Nginx 액세스 로그
docker-compose exec nginx tail -f /var/log/nginx/access.log
```

### Health Check

```bash
# Django
curl http://localhost/api/health

# Socket.IO
curl http://localhost:3000/health

# Nginx
curl http://localhost/health
```

## 업데이트 및 재배포

```bash
# 코드 업데이트
git pull

# 이미지 재빌드
docker-compose build

# 서비스 재시작
docker-compose up -d

# 특정 서비스만 재시작
docker-compose restart django
docker-compose restart socketio
```

## 트러블슈팅

### Socket.IO 연결 실패

1. **인증 토큰 확인**: JWT 토큰이 올바른지 확인
2. **CORS 설정**: `CORS_ORIGIN` 환경 변수 확인
3. **Nginx 설정**: WebSocket 업그레이드 헤더 확인

### Django API 502 에러

1. Django 서비스 상태 확인: `docker-compose ps`
2. Django 로그 확인: `docker-compose logs django`
3. 데이터베이스 연결 확인

### 정적 파일 404

1. Static 파일 수집: `docker-compose exec django python manage.py collectstatic`
2. Nginx 볼륨 마운트 확인

## 보안 체크리스트

- [ ] `SECRET_KEY`를 강력한 랜덤 값으로 설정
- [ ] `DEBUG=False` 설정
- [ ] HTTPS 사용 (Let's Encrypt)
- [ ] CORS 설정을 특정 도메인으로 제한
- [ ] 데이터베이스 비밀번호 강력하게 설정
- [ ] 방화벽에서 불필요한 포트 차단
- [ ] 정기적인 보안 업데이트

## 확장성

### 수평 확장 (Multiple Instances)

Socket.IO 서버를 여러 인스턴스로 확장할 때는 Redis Adapter를 사용:

```javascript
// socketio-server/server.js에 추가
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ host: 'redis', port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

### 로드 밸런서 설정

여러 EC2 인스턴스를 사용할 경우, ALB(Application Load Balancer)를 앞단에 두고 각 인스턴스의 nginx로 트래픽을 분산시킬 수 있습니다.

