# Running App Frontend - React Native & Google Maps

이 디렉토리는 **Running App**의 프론트엔드 모바일 애플리케이션 코드를 포함하고 있습니다. Expo를 사용하여 관리되며, 실시간 GPS 추적 및 구글 지도를 통한 게임 플레이를 제공합니다.

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 설정
구글 지도 API 사용을 위해 `app.json`에 `googleMapsApiKey` (iOS) 및 `googleMaps.apiKey` (Android)가 설정되어 있어야 합니다. (현재 설정 완료됨)

### 3. 애플리케이션 실행
```bash
# iOS 시뮬레이터 (추천)
npm run ios

# Android 에뮬레이터
npm run android

# Expo 개발 서버 시작
npm start
```

## 🛠 주요 기술 및 라이브러리

- **React Native (Expo)**: 크로스 플랫폼 모바일 개발.
- **Google Maps (react-native-maps)**: 글로벌 표준 지도 인프라. 커스텀 마커 및 폴리라인/폴리곤 렌더링.
- **H3-js**: Uber의 헥사곤 그리드 시스템 연산 (Resolution 9).
- **Expo Location**: 고정밀 백그라운드 GPS 위치 추적.
- **React Navigation**: Stack 및 Bottom Tabs 기반의 네비게이션 구조.
- **Axios**: Django REST API와의 비동기 통신.

## 📂 프로젝트 구조

```bash
Frontend/
├── src/
│   ├── screens/        # 주요 화면 (Home, GamePlay, RoomDetail, History 등)
│   ├── components/     # 재사용 가능한 UI 컴포넌트
│   ├── services/       # API 클라이언트 및 위치 추적 로직 (locationService.js)
│   ├── contexts/       # 전역 상태 관리 (Auth, GameContext)
│   ├── utils/          # 하버사인(Haversine) 공식, H3 변환 등 유틸리티
│   └── constants/      # 테마 컬러, API 엔드포인트 등 상수
├── assets/             # 이미지, 폰트 등 정적 리소스
└── app.json            # Expo 프로젝트 설정 및 네이티브 모듈 설정
```

## 📍 주요 기능 상세

- **GamePlay Screen**: 실시간으로 헥사곤 영역을 점령하고 자신의 위치를 확인하는 핵심 게임 화면입니다.
- **Location Tracking**: `expo-location` 및 `expo-task-manager`를 사용하여 앱이 백그라운드에 있을 때도 러닝 데이터를 기록합니다.
- **Team Coordination**: WebSocket을 통해 다른 팀원과 적팀의 위치를 실시간으로 시각화합니다.

## ⚠️ 주의 사항

- **네이티브 모듈**: Google Maps 통합을 위해 `react-native-maps`를 사용하며, 실제 기기나 시뮬레이터에서 원활한 테스트를 위해 `npx expo run:ios` 또는 `npx expo run:android` 명령어를 사용하여 **Development Build**를 생성하는 것을 권장합니다.
- **권한**: 앱 최초 실행 시 위치 권한(정확한 위치, 항상 허용)과 알림 권한이 필요합니다.
