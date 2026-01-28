# 🏃‍♂️ Running App: Hexagon Territory War

![Running App Banner](https://img.shields.io/badge/Status-Development-orange?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Tech-React_Native_|_Django-blue?style=for-the-badge)

**Nike Run Club의 러닝 추적 기술**과 **땅따먹기 게임의 재미**가 결합된 차세대 러닝 애플리케이션입니다. Uber의 H3 헥사곤 시스템을 활용하여 도시 전체를 거대한 게임 보드로 바꿉니다.

---

## 🎮 핵심 게임 루프

### 1. 점령 및 확장
- **영역 점령**: 새로운 헥사곤(Hexagon) 영역을 지나갈 때마다 당신의 팀 영역으로 선점됩니다.
- **에너지 충전**: 이미 점령한 영역을 달리면 게이지가 충전됩니다(헥사곤당 +60). 게이지가 100%가 되면 **페인트볼**을 획득합니다.
- **페인트볼 시스템**: 직접 가기 힘든 먼 거리의 영역을 페인트볼로 즉시 자신의 팀 색깔로 칠할 수 있습니다.

### 2. 팀 대결 (Team A vs Team B)
- 방(Room) 시스템을 통해 팀을 나누어 경쟁합니다.
- 게임 종료 시점에 더 넓은 영역을 점령한 팀이 승리합니다.
- 승리한 팀 전원에게는 ELO 레이팅 보너스가, MVP에게는 추가 점수가 부여됩니다.

### 3. 출석 및 보상
- **연속 출석**: 매일 다른 헥사곤으로 이동하여 출석을 체크하세요. 연속 출석일수가 늘어날수록 더 많은 페인트볼 보상을 받습니다.

---

## ✨ 주요 기능

- 📍 **실시간 GPS 추적**: Expo Location 기반 정밀 위치 추적 및 경로 시각화.
- 🗺️ **구글 지도(Google Maps) 통합**: 전 세계 어디서나 정확한 지도 인프라와 `react-native-maps`를 사용하여 헥사곤 그리드 및 팀 영역 표시.
- ⚡ **실시간 데이터 동기화**: WebSocket(Django Channels)을 사용하여 팀원들의 위치와 영역 점령 현황을 실시간으로 확인.
- 📊 **상세 통계**: 거리, 시간, 페이스, 칼로리 소모량 등 전문적인 러닝 데이터 분석.
- 🏆 **랭킹 시스템**: ELO 알고리즘 기반의 공정한 티어 시스템 및 시즌제 랭커 선정.
- 📱 **프리미엄 UI/UX**: 다크 모드 지원, 부드러운 애니메이션, 직관적인 대시보드.

---

## 🛠 기술 스택

### Frontend
- **Framework**: `React Native` (Expo Managed Workflow)
- **Navigation**: `React Navigation` (Stack, Bottom Tabs)
- **Maps**: `Google Maps` (via `react-native-maps`)
- **State/Storage**: `Context API`, `AsyncStorage`
- **Network**: `Axios`
- **Spatial Indexing**: `H3-js` (H3 Resolution 9)

### Backend
- **Framework**: `Django` (Python)
- **API**: `Django REST Framework (DRF)`
- **Real-time**: `Django Channels` (WebSockets)
- **Database**: `PostgreSQL` (H3 그리드 기반 공간 데이터 관리)
- **Queue/Task**: `Redis`, `Celery`
- **Authentication**: `SimpleJWT` (JWT 기반 인증)

---

## 🚀 시작하기

### 1. 저장소 복제
```bash
git clone https://github.com/your-repo/running.git
cd running
```

### 2. Backend 설정 (Docker 권장)
```bash
cd Backend
# 환경 변수 설정 (.env 파일 작성 필요)
cp .env.example .env 
docker-compose up -d --build

# 마이그레이션 및 초기 데이터 설정
docker-compose exec web python manage.py migrate
```

### 3. Frontend 설정
```bash
cd Frontend
npm install

# iOS 실행
npx expo run:ios

# Android 실행
npx expo run:android
```

---

## 📂 프로젝트 구조

```bash
running/
├── Frontend/               # React Native (Expo) App
│   ├── src/
│   │   ├── screens/       # 게임 플레이, 룸 상세, 프로필 등 화면
│   │   ├── components/    # 헥사곤 지도, 커스텀 버튼 등 UI 컴포넌트
│   │   ├── services/      # API 통신 및 Location 서비스
│   │   └── utils/         # H3 계산 및 데이터 포맷터 
│   └── app.json           # Expo & Google Maps API 설정
├── Backend/                # Django REST API
│   ├── apps/              # 기능별 Django Apps (users, rooms, records, games)
│   ├── config/            # Django 설정 (settings, routing)
│   ├── migrations/        # DB 마이그레이션 파일
│   └── docker-compose.yml # 컨테이너 오케스트레이션
├── api명세서.txt            # 상세 REST API 정의서
└── requirements.txt        # 공통 의존성 (참조용)
```

---

## 🔒 라이선스 및 권한

이 프로젝트는 학습 및 포트폴리오 목적으로 개발되었습니다.
- **위치 권한**: 정확한 게임 플레이를 위해 '항상 허용' 위치 권한이 필요합니다.
- **지도 API**: Google Maps Platform의 API Key 설정이 필요합니다 (`app.json`).

---

**Running App Team** | Let's Run and Paint the City! 🏃‍♂️🎨
