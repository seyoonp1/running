# GameMainScreen 백엔드 연결 완료

## 완료된 작업

### 1. **roomService.js 수정**
- `USE_MOCK = false`로 변경하여 실제 백엔드 API 연결
- 모든 API 호출이 실제 서버로 전송됨

### 2. **GameMainScreen 데이터 처리 개선**
- 백엔드 응답 형식에 맞게 데이터 처리
- 페이지네이션 응답 처리 (`results` 배열)
- null/undefined 안전 처리 추가
- 에러 처리 및 사용자 알림 추가

### 3. **데이터 필드 매핑**
- `myRoom.game_area.name` → 게임 구역 이름
- `myRoom.current_participants` → 현재 참가자 수
- `myRoom.status` → 방 상태 (ready/active/finished)
- `room.current_participants` → 방 목록의 참가자 수

## 연결된 API

### 1. 방 목록 조회
- **엔드포인트**: `GET /api/rooms/?status=ready`
- **응답 형식**: 
  ```json
  {
    "results": [
      {
        "id": "...",
        "name": "방 이름",
        "total_participants": 4,
        "current_participants": 2,
        "status": "ready",
        "start_date": "...",
        "end_date": "...",
        "game_area_name": "카이스트 본원"
      }
    ],
    "count": 10
  }
  ```

### 2. 내 방 조회
- **엔드포인트**: `GET /api/rooms/my/`
- **응답 형식**: 
  ```json
  {
    "id": "...",
    "name": "방 이름",
    "game_area": {
      "id": "...",
      "name": "카이스트 본원",
      "city": "대전광역시"
    },
    "current_participants": 2,
    "status": "ready",
    "start_date": "...",
    "end_date": "...",
    "my_participant": { ... }
  }
  ```
  또는 `null` (참가 중인 방이 없을 때)

## 주요 기능

### 1. 방 목록 표시
- 준비 중인 방 목록을 2x2 그리드로 표시
- 각 방 카드에 이름, 참가자 수 표시
- 방 클릭 시 상세 화면으로 이동

### 2. 내 방 정보 표시
- 현재 참가 중인 방 정보를 메인 카드에 표시
- 방 이름, 게임 구역, 날짜/시간 표시
- 방 상태에 따른 색상 표시 (준비 중/진행 중)
- 시작까지 남은 시간 카운트다운

### 3. 새로고침 기능
- Pull-to-refresh로 데이터 갱신
- 로딩 상태 표시

### 4. 에러 처리
- API 호출 실패 시 사용자에게 알림
- 빈 상태 처리 (방이 없을 때)

## 사용자 정보

- **사용자명**: `user.username` (AuthContext에서 가져옴)
- **레이팅**: `user.rating` (기본값 1000점)
- 레벨 시스템은 현재 백엔드에 없으므로 레이팅으로 대체

## 다음 단계

1. 백엔드 서버가 실행 중인지 확인
2. 인증 토큰이 올바르게 전송되는지 확인
3. 실제 데이터로 테스트
4. 에러 발생 시 로그 확인

## 주의사항

- API 호출은 인증이 필요합니다 (JWT 토큰)
- 네트워크 연결이 필요합니다
- 백엔드 서버 URL: `http://44.196.254.97/api`
