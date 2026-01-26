# 프론트엔드만 실행하기 (백엔드 없이)

팀원과 분리해서 작업할 때 프론트엔드 UI만 확인하는 방법입니다.

## 빠른 시작

### 1단계: Frontend 디렉토리로 이동
```bash
cd Frontend
```

### 2단계: 의존성 설치 (최초 1회만)
```bash
npm install
```

### 3단계: iOS 시뮬레이터 실행
```bash
npm run ios
```

또는

```bash
npm start
# 터미널에서 'i' 키를 눌러 iOS 시뮬레이터 실행
```

---

## 주의사항

### 백엔드 없이 실행할 때

1. **UI 확인 가능**
   - 화면 레이아웃
   - 네비게이션
   - 스타일링
   - 컴포넌트 렌더링

2. **API 호출은 실패**
   - 백엔드가 없으면 API 호출 시 에러 발생
   - 네트워크 에러는 정상 (백엔드가 없으므로)
   - UI는 확인 가능

3. **Mock 데이터 사용 권장**
   - API 호출 부분에 임시 데이터 사용
   - 개발 중에는 Mock 데이터로 UI 확인

---

## Mock 데이터 사용 예시

### API 호출 부분을 임시로 주석 처리

```javascript
// src/services/api.js 또는 컴포넌트에서
// 실제 API 호출 대신 Mock 데이터 반환

// 예시: 러닝 기록 조회
const getRuns = async () => {
  // 실제 API 호출 (백엔드 있을 때)
  // return await api.get('/runs');
  
  // Mock 데이터 (백엔드 없을 때)
  return {
    data: [
      {
        id: 1,
        distance: 5000,
        duration: 1800,
        average_pace: 6.0,
        started_at: new Date().toISOString()
      }
    ]
  };
};
```

---

## 개발 워크플로우

### 프론트엔드만 작업할 때

```bash
# 1. Frontend 디렉토리로 이동
cd Frontend

# 2. 개발 서버 시작
npm start

# 3. iOS 시뮬레이터 실행
# 터미널에서 'i' 키 입력
```

### 코드 수정 시
- 자동으로 Hot Reload 됨
- 시뮬레이터에서 즉시 확인 가능

---

## 유용한 명령어

```bash
# 캐시 클리어 후 실행
npm start -- --clear

# 특정 포트로 실행
EXPO_PORT=8081 npm start

# iOS 시뮬레이터만 실행 (개발 서버는 이미 실행 중일 때)
# 터미널에서 'i' 키 입력
```

---

## 문제 해결

### 시뮬레이터가 열리지 않는 경우
```bash
# Xcode 시뮬레이터 직접 실행
open -a Simulator

# 그 다음 다시 시도
npm run ios
```

### 포트 충돌
```bash
# 다른 포트 사용
EXPO_PORT=8082 npm start
```

### 의존성 문제
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules
npm install
```

---

## 다음 단계

프론트엔드 UI 확인 후:
1. 백엔드와 연동 테스트
2. API 호출 부분 구현
3. 실제 데이터로 테스트

---

## 참고

- 백엔드 연동이 필요할 때는 `Backend/README.md` 참조
- iOS 시뮬레이터 상세 가이드는 `IOS_SIMULATOR_SETUP.md` 참조
