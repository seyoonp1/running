# AWS 배포 가이드

## 1. 인프라 구성

### 1.1 VPC 및 서브넷
- VPC CIDR: 10.0.0.0/16
- Public Subnet: 10.0.1.0/24 (EC2)
- Private Subnet: 10.0.2.0/24 (RDS, ElastiCache)

### 1.2 Security Groups

#### EC2 Security Group
- **Inbound**:
  - HTTP (80): ALB Security Group
  - HTTPS (443): ALB Security Group
- **Outbound**:
  - All traffic

#### RDS Security Group
- **Inbound**:
  - PostgreSQL (5432): EC2 Security Group
- **Outbound**: None

#### ElastiCache Security Group
- **Inbound**:
  - Redis (6379): EC2 Security Group
- **Outbound**: None

#### ALB Security Group
- **Inbound**:
  - HTTP (80): 0.0.0.0/0
  - HTTPS (443): 0.0.0.0/0
- **Outbound**: All traffic

## 2. RDS PostgreSQL 설정

### 2.1 생성 명령 (AWS CLI)
```bash
aws rds create-db-instance \
  --db-instance-identifier hexgame-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username hexgame \
  --master-user-password <password> \
  --allocated-storage 20 \
  --vpc-security-group-ids <ec2-sg-id> \
  --db-subnet-group-name hexgame-subnet-group \
  --backup-retention-period 7 \
  --storage-encrypted
```

### 2.2 자동 백업
- 백업 보관 기간: 7일
- 백업 윈도우: 03:00-04:00 UTC

## 3. ElastiCache Redis 설정

### 3.1 생성 명령
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id hexgame-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --vpc-security-group-ids <ec2-sg-id> \
  --subnet-group-name hexgame-subnet-group
```

## 4. EC2 인스턴스 설정

### 4.1 인스턴스 생성
- **Instance Type**: t3.medium (MVP)
- **AMI**: Amazon Linux 2023
- **Storage**: 20GB GP3

### 4.2 Docker 설치
```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user
```

### 4.3 Docker Compose 설치
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4.4 애플리케이션 배포
```bash
# Clone repository
git clone <repository-url>
cd running_app/running/Backend

# Create .env file
cat > .env << EOF
DJANGO_ENV=production
SECRET_KEY=$(aws ssm get-parameter --name /hexgame/prod/secret-key --with-decryption --query Parameter.Value --output text)
DB_NAME=hexgame
DB_USER=hexgame
DB_PASSWORD=$(aws ssm get-parameter --name /hexgame/prod/db-password --with-decryption --query Parameter.Value --output text)
DB_HOST=<rds-endpoint>
DB_PORT=5432
REDIS_HOST=<elasticache-endpoint>
REDIS_PORT=6379
ALLOWED_HOSTS=your-domain.com
EOF

# Build and run
docker-compose -f docker-compose.prod.yml up -d
```

## 5. Application Load Balancer 설정

### 5.1 ALB 생성
- **Scheme**: Internet-facing
- **Type**: Application Load Balancer
- **Listeners**:
  - HTTP (80) → HTTPS (443) redirect
  - HTTPS (443) → Target Group

### 5.2 Target Group
- **Protocol**: HTTP
- **Port**: 8000
- **Health Check**: /api/health

### 5.3 SSL/TLS 인증서
- ACM에서 인증서 발급
- Route53으로 도메인 연결

## 6. Route53 설정

### 6.1 DNS 레코드
- **Type**: A (Alias)
- **Alias Target**: ALB
- **Name**: game.example.com

## 7. AWS Systems Manager Parameter Store

### 7.1 비밀 저장
```bash
# Secret Key
aws ssm put-parameter \
  --name /hexgame/prod/secret-key \
  --value <secret-key> \
  --type SecureString

# DB Password
aws ssm put-parameter \
  --name /hexgame/prod/db-password \
  --value <db-password> \
  --type SecureString
```

## 8. CloudWatch 설정

### 8.1 로그 그룹
```bash
aws logs create-log-group --log-group-name /aws/hexgame/prod
```

### 8.2 알람 설정
- CPU 사용률 > 80%
- 메모리 사용률 > 90%
- RDS 연결 수 > 80% of max

## 9. 백업 전략

### 9.1 RDS 자동 백업
- 일일 자동 스냅샷
- 7일 보관

### 9.2 수동 스냅샷
```bash
aws rds create-db-snapshot \
  --db-snapshot-identifier hexgame-manual-$(date +%Y%m%d) \
  --db-instance-identifier hexgame-db
```

## 10. 모니터링

### 10.1 CloudWatch Metrics
- EC2: CPU, Memory, Network
- RDS: CPU, Connections, Storage
- ElastiCache: CPU, Memory, Evictions

### 10.2 로그 수집
- Django 로그 → CloudWatch Logs
- 구조화된 JSON 로깅

## 11. 비용 최적화 (MVP)

### 12.1 인스턴스 크기
- EC2: t3.medium (~$30/월)
- RDS: db.t3.micro (~$15/월)
- ElastiCache: cache.t3.micro (~$12/월)
- **총 예상 비용**: ~$60/월

### 12.2 Reserved Instances
- 1년 약정 시 30-40% 할인 가능

