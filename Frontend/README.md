# Running Frontend (React Native)

React Native + Expo를 사용한 모바일 애플리케이션입니다.

## 필수 요구사항

- Node.js (v18 이상 권장)
- npm 또는 yarn
- Expo CLI (전역 설치 권장): `npm install -g expo-cli`

## 설치

```bash
npm install
```

## 실행

### 개발 서버 시작
```bash
npm start
```

### 플랫폼별 실행

**iOS (macOS만 가능)**
```bash
npm run ios
```

**Android**
```bash
npm run android
```

**Web**
```bash
npm run web
```

## 실제 기기에서 테스트

1. Expo Go 앱 설치 (iOS App Store / Google Play Store)
2. `npm start` 실행
3. 터미널에 표시된 QR 코드를 Expo Go 앱으로 스캔

## 프로젝트 구조

```
Frontend/
├── App.js           # 메인 컴포넌트
├── app.json         # Expo 설정
├── babel.config.js  # Babel 설정
└── package.json     # 의존성
```

## 추가 리소스

- [Expo 문서](https://docs.expo.dev/)
- [React Native 문서](https://reactnative.dev/)
