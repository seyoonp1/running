#!/bin/bash
# 프로젝트 초기 설정 스크립트

echo "🚀 Running 프로젝트 설정을 시작합니다..."

# Docker 및 Docker Compose 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되어 있지 않습니다. Docker를 먼저 설치해주세요."
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose가 설치되어 있지 않습니다. Docker Compose를 먼저 설치해주세요."
    exit 1
fi

# Backend Docker 설정
echo "📦 Backend Docker 이미지 빌드 중..."
cd Backend
docker-compose build
cd ..

# Frontend 의존성 설치
echo "📦 Frontend 의존성 설치 중..."
cd Frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

echo "✅ 설정이 완료되었습니다!"
echo ""
echo "Backend 실행 (Docker):"
echo "  cd Backend"
echo "  docker-compose up -d"
echo "  docker-compose exec web python manage.py migrate"
echo "  docker-compose exec web python manage.py createsuperuser"
echo ""
echo "Frontend 실행:"
echo "  cd Frontend"
echo "  npm start"
echo "  또는: npm run ios / npm run android / npm run web"
