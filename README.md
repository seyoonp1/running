# 🏃‍♂️ Running App: Hexagon Territory War

![Status-Development](https://img.shields.io/badge/Status-Development-orange?style=for-the-badge)
![Tech-React_Native](https://img.shields.io/badge/Frontend-React_Native_|_Expo-61DAFB?style=for-the-badge&logo=react)
![Tech-Django](https://img.shields.io/badge/Backend-Django_|_Python-092E20?style=for-the-badge&logo=django)
![Tech-H3](https://img.shields.io/badge/Geo-Uber_H3-black?style=for-the-badge)

**Nike Run Club**의 러닝 추적 기술과 **땅따먹기 게임**의 경쟁 요소가 결합된 차세대 러닝 애플리케이션입니다. Uber의 H3 헥사곤 시스템을 활용하여 도시 전체를 거대한 게임 보드로 바꿉니다.

단순한 운동을 넘어, **"사람들이 더 꾸준히 재미있게 러닝할 수 있도록 장려하는 것"**을 목적으로 개발되었습니다. 매일 새로운 영역을 점령하고 팀과 함께 승리하는 과정을 통해 러닝을 일상의 즐거운 놀이로 변화시킵니다.

---

## 🎮 핵심 게임 루프

### 1. 영역 점령 및 확장
- **영역 점령**: 새로운 헥사곤(Hexagon) 영역을 지나갈 때마다 당신의 팀 영역으로 선점됩니다.
- **에너지 충전**: 이미 점령한 영역을 달리면 게이지가 충전되며, 100% 도달 시 **페인트볼**을 획득합니다.
- **아이템 활용**: 직접 가기 힘든 먼 거리의 영역을 페인트볼로 즉시 자신의 팀 색깔로 칠할 수 있습니다.

### 2. 팀 대결 (Team A vs Team B)
- 방(Room) 시스템을 통해 팀을 나누어 실시간으로 경쟁합니다.
- 게임 종료 시점 더 넓은 영역을 점령한 팀이 승리하며, ELO 레이팅 보너스를 획득합니다.

---

## ✨ 주요 기능

### 📱 Frontend (Mobile App)
- 📍 **실시간 GPS 추적**: Expo Location 기반 정밀 백그라운드 위치 추적.
- 🗺️ **인터랙티브 지도**: `react-native-maps` 기반 헥사곤 그리드 및 팀 영역 시각화.
- ⚡ **실시간 동기화**: WebSocket을 통한 팀원/적팀 위치 및 점령 현황 실시간 업데이트.
- 📊 **러닝 통계**: 거리, 페이스, 칼로리 소모량 등 전문적인 데이터 분석.

### ⚙️ Backend (API & Real-time)
- 🔐 **인증 시스템**: JWT 기반 고보안 사용자 인증.
- 📐 **H3 공간 연산**: GPS 좌표를 H3 인덱스로 정밀 변환 및 점령 판정.
- 🔄 **루프 검출**: 유저의 이동 경로를 분석하여 폐쇄된 루프 내부를 자동으로 점령.
- 🏆 **랭킹/티어**: ELO 알고리즘 기반의 공정한 티어 시스템 및 시즌제 운영.

---

## 🛠 기술 스택

| 구분 | 기술 스택 |
| :--- | :--- |
| **Frontend** | React Native (Expo), React Navigation, Axios, H3-js, Context API |
| **Backend** | Django, Django REST Framework, Django Channels (WebSockets) |
| **Database** | PostgreSQL, Redis (Caching & Task Queue) |
| **Infrastucture** | Docker, Nginx, AWS EC2 |

---

## 📂 프로젝트 구조

```bash
running/
├── Frontend/               # React Native (Expo) 모바일 앱
│   ├── src/
│   │   ├── screens/       # GamePlay, RoomDetail, History 등
│   │   ├── components/    # HexagonMap, Custom UI 등
│   │   ├── services/      # LocationService, API Client
│   │   └── utils/         # H3 Helpers, Formatters
│   └── app.json           # Expo & Native Config
├── Backend/                # Django REST API & WebSocket 서버
│   ├── apps/              # accounts, rooms, hexmap, realtime 등
│   ├── config/            # Django Settings & Routing
│   ├── socketio-server/   # 실시간 통신 보조 서버
│   └── docker-compose.yml # 컨테이너 관리
└── docs/                   # 프로젝트 상세 문서 (DB Schema, Architecture)
```

---

## 🚀 시작하기

### 1. 저장소 복제
```bash
git clone https://github.com/your-username/running-app.git
cd running-app
```

### 2. Backend 설정 (Docker 권장)
```bash
cd Backend
cp .env.example .env # 환경 변수 설정 필요
docker-compose up -d --build

# DB 마이그레이션
docker-compose exec django python manage.py migrate
```

### 3. Frontend 설정
```bash
cd Frontend
npm install

# iOS/Android 실행 (Development Build 권장)
npx expo run:ios
npx expo run:android
```

---

## 📄 상세 문서

더 자세한 정보는 아래 문서들을 참고하세요:
- [Backend 상세 README](./Backend/README.md)
- [Frontend 상세 README](./Frontend/README.md)
- [시스템 아키텍처](./Backend/ARCHITECTURE.md)
- [데이터베이스 스키마](./Backend/DB_SCHEMA.md)

---

**Running App Team** | *Let's Run and Paint the City!* 🏃‍♂️🎨
