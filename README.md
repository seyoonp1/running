# Running App 🏃‍♂️

나이키 런(Nike Run Club) 스타일의 러닝 추적 애플리케이션

## 주요 기능

- 📍 **GPS 기반 러닝 추적**: 실시간 위치 추적 및 경로 기록
- 📊 **러닝 통계**: 거리, 시간, 페이스, 속도, 칼로리 계산
- 📈 **러닝 히스토리**: 과거 러닝 기록 조회 및 통계
- 🗺️ **경로 시각화**: 지도에 러닝 경로 표시
- 🔐 **사용자 인증**: 회원가입, 로그인, JWT 기반 인증
- 💾 **데이터 저장**: 로컬 및 서버 데이터 동기화

## 기술 스택

### Frontend
- React Native (Expo)
- React Navigation
- Expo Location (GPS 추적)
- React Native Maps (지도)
- React Native Chart Kit (통계 차트)
- AsyncStorage (로컬 저장소)

### Backend
- Flask (Python)
- SQLAlchemy (ORM)
- Flask-JWT-Extended (인증)
- SQLite (개발용, 프로덕션에서는 PostgreSQL 권장)

## 가상 환경 설정

### 1. 가상 환경 생성
```bash
cd Backend
python3 -m venv venv
```

### 2. 가상 환경 활성화

**macOS/Linux:**
```bash
cd Backend
source venv/bin/activate
```

**Windows:**
```bash
cd Backend
venv\Scripts\activate
```

### 3. 패키지 설치
```bash
pip install -r Backend/requirements.txt
```

### 4. 가상 환경 비활성화
```bash
deactivate
```

## 프로젝트 구조
```
running/
├── Frontend/                    # 프론트엔드 (React Native)
│   ├── src/
│   │   ├── screens/            # 화면 컴포넌트
│   │   ├── components/         # 재사용 컴포넌트
│   │   ├── navigation/         # 네비게이션 설정
│   │   ├── services/           # API 및 서비스
│   │   │   ├── api.js          # API 클라이언트
│   │   │   └── locationService.js # 위치 추적 서비스
│   │   ├── utils/              # 유틸리티 함수
│   │   │   └── runCalculator.js # 러닝 계산 함수
│   │   ├── contexts/           # Context API
│   │   │   └── RunContext.js   # 러닝 상태 관리
│   │   └── types/              # 타입 정의
│   ├── App.js                  # 메인 컴포넌트
│   ├── app.json                # Expo 설정 (위치 권한 포함)
│   ├── babel.config.js         # Babel 설정
│   └── package.json             # 의존성
│
├── Backend/                     # 백엔드 (Flask)
│   ├── models/                  # 데이터베이스 모델
│   │   ├── user.py             # 사용자 모델
│   │   └── run.py              # 러닝 기록 모델
│   ├── routes/                  # API 라우트
│   │   ├── auth.py             # 인증 API
│   │   └── runs.py             # 러닝 API
│   ├── services/                # 비즈니스 로직
│   ├── utils/                   # 유틸리티
│   ├── config.py                # 설정 파일
│   ├── app.py                   # Flask 앱 진입점
│   ├── requirements.txt         # Python 의존성
│   └── venv/                    # 가상 환경
│
├── docs/                        # 프로젝트 문서
├── tests/                       # 테스트 코드
├── scripts/                     # 유틸리티 스크립트
└── README.md                    # 프로젝트 설명
```

## 빠른 시작

### 1. 프로젝트 초기 설정
```bash
# 스크립트를 사용한 자동 설정
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 2. Backend 실행
```bash
# Backend 폴더로 이동
cd Backend

# 가상 환경 활성화
source venv/bin/activate

# Backend 의존성 설치
pip install -r requirements.txt

# Backend 실행
python app.py
```

### 3. Frontend 실행 (React Native)
```bash
cd Frontend
npm install

# 개발 서버 시작
npm start

# 또는 플랫폼별 실행
npm run ios      # iOS 시뮬레이터
npm run android  # Android 에뮬레이터
npm run web      # 웹 브라우저
```

## 개발 가이드

### Backend 설정

1. **데이터베이스 초기화**
```bash
cd Backend
source venv/bin/activate
flask db init          # 최초 1회만
flask db migrate -m "Initial migration"
flask db upgrade
```

2. **환경 변수 설정** (선택사항)
```bash
# Backend/.env 파일 생성
FLASK_ENV=development
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key
DATABASE_URL=sqlite:///running.db
```

3. **API 엔드포인트**
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 현재 사용자 정보
- `GET /api/runs` - 러닝 기록 목록
- `POST /api/runs` - 러닝 기록 생성
- `GET /api/runs/<id>` - 러닝 기록 상세
- `DELETE /api/runs/<id>` - 러닝 기록 삭제
- `GET /api/runs/stats` - 러닝 통계

### Frontend 설정

1. **위치 권한**
   - iOS: Info.plist에 위치 권한 설명 추가됨
   - Android: AndroidManifest.xml에 권한 추가됨
   - 실제 기기에서 테스트 시 권한 요청 팝업이 표시됩니다

2. **API 연결**
   - 개발 환경: `http://localhost:5000/api`
   - 프로덕션: 환경 변수로 설정 필요

3. **주요 기능**
   - 위치 추적: `src/services/locationService.js`
   - 러닝 계산: `src/utils/runCalculator.js`
   - 상태 관리: `src/contexts/RunContext.js`

### 필수 권한

**iOS**
- 위치 정보 (항상 허용 권한 권장)

**Android**
- 위치 정보 (정확한 위치)
- 백그라운드 위치
- 포그라운드 서비스

## 다음 단계

1. **화면 구현**
   - 홈 화면 (러닝 시작)
   - 러닝 중 화면 (실시간 통계, 지도)
   - 러닝 히스토리 화면
   - 통계 화면 (차트)

2. **추가 기능**
   - 음악 재생 통합
   - 목표 설정 및 달성
   - 소셜 기능 (친구, 챌린지)
   - 푸시 알림

3. **최적화**
   - 배터리 최적화
   - 백그라운드 실행 최적화
   - 데이터 동기화 전략
