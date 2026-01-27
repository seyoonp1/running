# Postman 테스트 가이드

Running App API를 Postman으로 테스트하는 방법입니다.

## 1. 파일 Import

### Postman 웹/앱에서 Import
1. Postman 열기
2. 좌측 상단 **Import** 버튼 클릭
3. 다음 2개 파일 선택:
   - `Running_App_API.postman_collection.json`
   - `Running_App_Environment.postman_environment.json`
4. Import 완료

### 환경 설정
1. 우측 상단 환경 선택 드롭다운에서 **"Running App Environment"** 선택
2. 환경 변수 확인:
   - `base_url`: http://localhost:8000 (기본값)
   - 나머지 변수들은 API 호출 시 자동으로 설정됨

## 2. 서버 실행

테스트 전에 Django 서버가 실행 중이어야 합니다:

```bash
cd running/Backend
python manage.py runserver
```

서버가 `http://localhost:8000`에서 실행되는지 확인하세요.

## 3. 테스트 시나리오

### 기본 플로우 (순서대로 실행)

#### Step 1: 회원가입
1. **인증 API > 회원가입** 선택
2. Body에서 `username`, `email`, `password` 수정
3. Send 클릭
4. 201 응답 확인

#### Step 2: 로그인
1. **인증 API > 로그인** 선택
2. Body에서 위에서 사용한 `username`, `password` 입력
3. Send 클릭
4. 200 응답 확인
5. **환경 변수 자동 저장 확인**: 
   - `access_token`, `refresh_token`, `user_id`가 자동으로 저장됨
   - 이후 모든 요청에서 자동으로 Authorization 헤더에 토큰이 포함됨

#### Step 3: 게임 구역 조회
1. **게임 구역 API > 게임 구역 목록 조회** 선택
2. Send 클릭
3. 200 응답 확인
4. **환경 변수 자동 저장**: `game_area_id`가 첫 번째 구역의 ID로 설정됨

#### Step 4: 방 생성
1. **방 API > 방 생성** 선택
2. Body 확인:
   - `game_area_id`는 자동으로 환경 변수에서 가져옴
   - `start_date`, `end_date`는 현재 시각 이후 일시로 설정
   - `total_participants`는 짝수로 설정 (예: 4)
3. Send 클릭
4. 201 응답 확인
5. **환경 변수 자동 저장**: `room_id`, `invite_code` 저장됨

#### Step 5: 방 상세 조회
1. **방 API > 방 상세 조회** 선택
2. Send 클릭
3. 200 응답 확인
4. 응답에서 `participants`, `status` 등 확인

#### Step 6: 방 참가 (다른 사용자로)
**주의**: 다른 사용자 계정으로 로그인해야 합니다.

1. 새로운 사용자로 **회원가입** → **로그인**
2. **방 API > 방 참가 (초대 코드)** 선택
3. Body에서 `invite_code` 확인 (이전에 생성한 방의 코드)
4. Send 클릭
5. 201 응답 확인

#### Step 7: 팀 변경
1. **방 API > 팀 변경** 선택
2. Body에서 `team` 수정 (A 또는 B)
3. Send 클릭
4. 200 응답 확인

#### Step 8: 방 시작 (방장만 가능)
1. **방장 계정으로 다시 로그인**
2. **방 API > 방 시작** 선택
3. Send 클릭
4. 200 응답 확인
5. 방 상태가 `active`로 변경됨

#### Step 9: 기록 시작
1. **러닝 기록 API > 기록 시작** 선택
2. Body에서 `room_id` 확인 (자동으로 설정됨)
3. Send 클릭
4. 201 응답 확인
5. **환경 변수 자동 저장**: `record_id` 저장됨

#### Step 10: 기록 종료
1. **러닝 기록 API > 기록 종료** 선택
2. Body에서 `duration_seconds`, `distance_meters` 입력
3. Send 클릭
4. 200 응답 확인

#### Step 11: 친구 검색 및 요청
1. **친구 API > 친구 검색** 선택
2. Query에서 `q` 파라미터 수정 (검색할 사용자명)
3. Send 클릭
4. 검색 결과에서 `user_id` 복사
5. **친구 API > 친구 요청** 선택
6. Body에서 `user_id` 입력
7. Send 클릭
8. 201 응답 확인

#### Step 12: 우편함 확인 및 응답
1. **우편함 API > 우편함 목록** 선택
2. Send 클릭
3. 200 응답 확인
4. **환경 변수 자동 저장**: `mailbox_id` 저장됨
5. **우편함 API > 초대 수락/거절** 선택
6. Body에서 `accept: true` 설정
7. Send 클릭
8. 200 응답 확인

## 4. 환경 변수 확인

각 요청 후 환경 변수가 자동으로 저장되는지 확인:

1. 우측 상단 환경 이름 옆 **눈 아이콘** 클릭
2. 또는 **Environments** 탭에서 확인

자동 저장되는 변수:
- `access_token`: 로그인 시
- `refresh_token`: 로그인 시
- `user_id`: 로그인 시
- `game_area_id`: 게임 구역 목록 조회 시 (첫 번째 구역)
- `room_id`: 방 생성 시
- `invite_code`: 방 생성 시
- `record_id`: 기록 시작 시
- `mailbox_id`: 우편함 목록 조회 시 (첫 번째 메일)

## 5. 주의사항

### 날짜 형식
- `start_date`, `end_date`는 `YYYY-MM-DDTHH:mm` 형식
- 오늘 이후 날짜여야 함

### 팀 정원
- `total_participants`는 짝수여야 함
- 각 팀 정원 = `total_participants / 2`

### 방 상태
- `ready`: 참가/나가기/팀 변경 가능
- `active`: 게임 진행 중, 참가/나가기 불가
- `finished`: 게임 종료

### 토큰 만료
- `access_token`이 만료되면 **토큰 갱신** API 호출
- 또는 다시 로그인

## 6. 트러블슈팅

### 401 Unauthorized
- 토큰이 만료되었거나 없음
- **해결**: 로그인 다시 하거나 토큰 갱신

### 403 Forbidden
- 권한 부족 (예: 방장만 시작 가능)
- **해결**: 올바른 사용자로 로그인 확인

### 404 Not Found
- 리소스가 존재하지 않음
- **해결**: `room_id`, `game_area_id` 등이 올바른지 확인

### 400 Bad Request
- 요청 데이터가 잘못됨
- **해결**: Body 형식 및 필수 필드 확인

## 7. WebSocket 테스트

Postman은 WebSocket도 지원합니다:

1. New → WebSocket Request
2. URL: `ws://localhost:8000/ws/room/{room_id}/?token={access_token}`
3. Connect 후 메시지 전송:
   ```json
   {
     "type": "loc",
     "lat": 37.5665,
     "lng": 126.9780
   }
   ```

## 8. 추가 팁

### Collection Runner
여러 요청을 순차적으로 실행:
1. Collection 우클릭 → **Run collection**
2. 순서 확인 및 실행

### Pre-request Script 수정
각 요청의 **Pre-request Script** 탭에서 추가 로직 작성 가능

### Tests Script 수정
각 요청의 **Tests** 탭에서 응답 검증 로직 추가 가능

