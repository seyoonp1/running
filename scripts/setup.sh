#!/bin/bash
# 프로젝트 초기 설정 스크립트

echo "🚀 Running 프로젝트 설정을 시작합니다..."

# Backend 가상 환경 설정
echo "📦 Backend 가상 환경 설정 중..."
cd Backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
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
echo "Backend 실행:"
echo "  cd Backend"
echo "  source venv/bin/activate"
echo "  python app.py"
echo ""
echo "Frontend 실행:"
echo "  cd Frontend"
echo "  npm start"
echo "  또는: npm run ios / npm run android / npm run web"
