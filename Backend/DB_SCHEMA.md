# 데이터베이스 스키마 (Database Schema)

## 테이블 목록 (Tables)

### 1. users
**설명**: 사용자 정보 테이블 (Django AbstractUser 확장)

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 사용자 고유 ID |
| username | VARCHAR(150) | UNIQUE, NOT NULL | 사용자명 |
| email | VARCHAR | UNIQUE, NOT NULL | 이메일 |
| password | VARCHAR(128) | NOT NULL | 비밀번호 (해시) |
| status | VARCHAR(20) | DEFAULT 'ready' | 방 상태 (ready/active/finished) |
| is_staff | BOOLEAN | DEFAULT FALSE | 스태프 여부 |
| is_superuser | BOOLEAN | DEFAULT FALSE | 슈퍼유저 여부 |
| date_joined | DATETIME | | 가입일시 |
| last_login | DATETIME | NULL | 마지막 로그인 |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |
| updated_at | DATETIME | AUTO_NOW | 수정일시 |

**관계**:
- `created_rooms` (1:N) → rooms (creator)
- `participations` (1:N) → participants (user)
- `room_memberships` (1:N) → room_members (user)

---

### 2. rooms
**설명**: 게임 방 설정 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 방 고유 ID |
| name | VARCHAR(200) | NOT NULL | 방 이름 |
| creator_id | UUID | FOREIGN KEY → users.id | 생성자 ID |
| mvp_id | UUID | FOREIGN KEY → users.id, NULL | 방 종료 시 MVP 사용자 ID |
| invite_code | VARCHAR(20) | UNIQUE, INDEX | 초대 코드 |
| max_participants | INTEGER | DEFAULT 20 | 최대 참가자 수 |
| game_duration_minutes | INTEGER | DEFAULT 60 | 게임 지속 시간 (분) |
| schedule | JSON | DEFAULT {} | 요일별 시간 설정 |
| duration_days | INTEGER | NULL | 기간 일수 |
| scheduled_start | DATETIME | NULL | 예정 시작 시간 |
| game_area_bounds | JSON | DEFAULT {} | 게임 영역 경계 |
| h3_resolution | INTEGER | DEFAULT 8 | H3 해상도 |
| rules | JSON | DEFAULT {} | 커스텀 규칙 |
| current_hex_ownerships | JSON | DEFAULT {} | 현재 방의 hex 소유 정보 {h3_id: {team_name, user_id, claimed_at}} |
| initial_locations | JSON | DEFAULT {} | 참가자 초기 위치 설정 {user_id: {lat, lng, h3_id}} |
| last_session_id | UUID | NULL | 마지막으로 종료된 세션 ID (데이터 복원용) |
| status | VARCHAR(20) | DEFAULT 'ready' | 방 상태 (ready/active/finished) |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |
| updated_at | DATETIME | AUTO_NOW | 수정일시 |

**관계**:
- `creator` (N:1) ← users
- `mvp` (N:1) ← users
- `sessions` (1:N) → sessions (room)
- `room_teams` (1:N) → room_teams (room)
- `room_members` (1:N) → room_members (room)

**인덱스**:
- `invite_code` (UNIQUE INDEX)
- `(creator_id, status)` - 사용자별 상태별 방 조회 최적화

**제약조건**:
- `CHECK max_participants > 0` - 최대 참가자 수는 1 이상
- `CHECK game_duration_minutes > 0` - 게임 지속 시간은 1분 이상
- `CHECK h3_resolution >= 0 AND h3_resolution <= 15` - H3 해상도는 0~15 사이
- `(creator_id, status)` - 사용자별 상태별 방 조회 최적화

**제약조건**:
- CHECK: `max_participants > 0`
- CHECK: `game_duration_minutes > 0`
- CHECK: `h3_resolution BETWEEN 0 AND 15`

---

### 3. room_teams
**설명**: 방 단위 팀 정의 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 팀 고유 ID |
| room_id | UUID | FOREIGN KEY → rooms.id | 방 ID |
| name | VARCHAR(100) | NOT NULL | 팀 이름 |
| color | VARCHAR(7) | NOT NULL | HEX 색상 코드 |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |

**제약조건**:
- `UNIQUE (room_id, name)` - 같은 방 내 동일한 팀 이름 방지

**관계**:
- `room` (N:1) ← rooms
- `members` (1:N) → room_members (team)
- `session_teams` (1:N) → teams (room_team)

---

### 4. room_members
**설명**: 방 멤버십 및 팀 배정 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 멤버십 고유 ID |
| room_id | UUID | FOREIGN KEY → rooms.id | 방 ID |
| user_id | UUID | FOREIGN KEY → users.id | 사용자 ID |
| team_id | UUID | FOREIGN KEY → room_teams.id, NULL | 방 팀 ID |
| joined_at | DATETIME | AUTO_NOW_ADD | 참가일시 |

**제약조건**:
- `UNIQUE (room_id, user_id)` - 방 내 중복 참가 방지

**관계**:
- `room` (N:1) ← rooms
- `user` (N:1) ← users
- `team` (N:1) ← room_teams

---

### 5. sessions
**설명**: 게임 세션 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 세션 고유 ID |
| room_id | UUID | FOREIGN KEY → rooms.id | 방 ID |
| status | VARCHAR(20) | DEFAULT 'waiting', INDEX | 상태 (waiting/active/finished) |
| started_at | DATETIME | NULL | 시작 시간 |
| ended_at | DATETIME | NULL | 종료 시간 |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |
| updated_at | DATETIME | AUTO_NOW | 수정일시 |

**참고**: `game_area_bounds`와 `h3_resolution`은 `room`을 통해 접근합니다 (Session 모델의 property로 제공).

**관계**:
- `room` (N:1) ← rooms
- `teams` (1:N) → teams (session)
- `participants` (1:N) → participants (session)
- `hex_ownerships` (1:N) → hex_ownerships (session)
- `event_logs` (1:N) → event_logs (session)
- `player_stats` (1:N) → player_stats (session)

**인덱스**:
- `status` (INDEX)

---

### 6. teams
**설명**: 세션 내 팀 정보 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 팀 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| room_team_id | UUID | FOREIGN KEY → room_teams.id, NULL | 방 팀 ID |
| name | VARCHAR(100) | NOT NULL | 팀 이름 |
| color | VARCHAR(7) | NOT NULL | HEX 색상 코드 |
| hexes_claimed | INTEGER | DEFAULT 0 | 이번 경기에서 새로 점령한 hex 수 (소유 변경 포함) |
| hexes_lost | INTEGER | DEFAULT 0 | 이번 경기에서 다른 팀에게 뺏긴 hex 수 |
| paintballs_used | INTEGER | DEFAULT 0 | 이번 경기에서 사용한 페인트볼 수 |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |

**제약조건**:
- `UNIQUE (session_id, name)` - 같은 세션 내 동일한 팀 이름 방지
- `CHECK hexes_claimed >= 0` - 점령한 hex 수는 0 이상
- `CHECK hexes_lost >= 0`
- `CHECK paintballs_used >= 0`

**관계**:
- `session` (N:1) ← sessions
- `room_team` (N:1) ← room_teams
- `members` (1:N) → participants (team)
- `owned_hexes` (1:N) → hex_ownerships (team)
- `events` (1:N) → event_logs (team)

**제약조건**:
- UNIQUE `(session_id, name)` - 같은 세션 내 동일한 팀 이름 방지
- CHECK: `hexes_claimed >= 0` - 점령한 hex 수는 0 이상
- CHECK: `hexes_lost >= 0` - 뺏긴 hex 수는 0 이상
- CHECK: `paintballs_used >= 0` - 사용한 페인트볼 수는 0 이상

---

### 7. participants
**설명**: 세션 참가자 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 참가자 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| user_id | UUID | FOREIGN KEY → users.id | 사용자 ID |
| team_id | UUID | FOREIGN KEY → room_teams.id, NULL | 방 팀 ID |
| status | VARCHAR(20) | DEFAULT 'joined', INDEX | 상태 (joined/active/left) |
| last_lat | FLOAT | NULL | 마지막 위도 |
| last_lng | FLOAT | NULL | 마지막 경도 |
| last_h3_id | VARCHAR(20) | NULL, INDEX | 마지막 H3 ID |
| last_location_at | DATETIME | NULL | 마지막 위치 업데이트 시간 |
| joined_at | DATETIME | AUTO_NOW_ADD | 참가일시 |
| paintball_count | INTEGER | DEFAULT 0 | 보유 페인트볼 개수 |

**관계**:
- `session` (N:1) ← sessions
- `user` (N:1) ← users
- `team` (N:1) ← room_teams
- `claimed_hexes` (1:N) → hex_ownerships (claimed_by)
- `events` (1:N) → event_logs (participant)
- `stats` (1:1) → player_stats (participant)

**제약조건**:
- UNIQUE (session_id, user_id)
- CHECK: `last_lat IS NULL OR (last_lat >= -90 AND last_lat <= 90)` - 위도 범위 검증
- CHECK: `last_lng IS NULL OR (last_lng >= -180 AND last_lng <= 180)` - 경도 범위 검증
- CHECK: `paintball_count >= 0` - 페인트볼 개수는 0 이상

**인덱스**:
- INDEX (session_id, status)
- INDEX (session_id, last_h3_id)
- CHECK: `last_lat BETWEEN -90 AND 90` (위도 범위)
- CHECK: `last_lng BETWEEN -180 AND 180` (경도 범위)

---

### 8. hex_ownerships
**설명**: Hex 소유 정보 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 소유 정보 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| h3_id | VARCHAR(20) | INDEX | H3 Hex ID |
| team_id | UUID | FOREIGN KEY → teams.id, NULL | 소유 팀 ID |
| claimed_at | DATETIME | AUTO_NOW_ADD | 점령 시간 |
| claimed_by_id | UUID | FOREIGN KEY → participants.id, NULL | 점령한 참가자 ID |

**관계**:
- `session` (N:1) ← sessions
- `team` (N:1) ← teams
- `claimed_by` (N:1) ← participants

**제약조건**:
- UNIQUE (session_id, h3_id)
- INDEX (session_id, h3_id)
- INDEX (session_id, team_id)

---

### 9. event_logs
**설명**: 이벤트 로그 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 이벤트 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| event_type | VARCHAR(20) | INDEX | 이벤트 타입 (claim/loop/join/leave/match_end) |
| participant_id | UUID | FOREIGN KEY → participants.id, NULL | 참가자 ID |
| team_id | UUID | FOREIGN KEY → teams.id, NULL | 팀 ID |
| data | JSON | DEFAULT {} | 이벤트별 데이터 |
| created_at | DATETIME | AUTO_NOW_ADD, INDEX | 생성일시 |

**관계**:
- `session` (N:1) ← sessions
- `participant` (N:1) ← participants
- `team` (N:1) ← teams

**인덱스**:
- INDEX (session_id, event_type, created_at)

---

### 10. player_stats
**설명**: 플레이어 통계 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 통계 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| participant_id | UUID | FOREIGN KEY → participants.id | 참가자 ID |
| distance_m | FLOAT | DEFAULT 0.0 | 이동 거리 (미터) |
| duration_sec | INTEGER | DEFAULT 0 | 활동 시간 (초) |
| hexes_claimed | INTEGER | DEFAULT 0 | 점령한 hex 수 |
| hexes_in_loops | INTEGER | DEFAULT 0 | 루프에 포함된 hex 수 |
| is_mvp | BOOLEAN | DEFAULT FALSE | MVP 여부 |
| mvp_score | FLOAT | DEFAULT 0.0 | MVP 점수 |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |
| updated_at | DATETIME | AUTO_NOW | 수정일시 |

**관계**:
- `session` (N:1) ← sessions
- `participant` (N:1) ← participants

**제약조건**:
- UNIQUE (session_id, participant_id)

---


## ERD 다이어그램

```
users
  ├── created_rooms (1:N) → rooms
  ├── participations (1:N) → participants
  └── room_memberships (1:N) → room_members

rooms
  ├── creator (N:1) ← users
  ├── sessions (1:N) → sessions
  ├── room_teams (1:N) → room_teams
  └── room_members (1:N) → room_members

room_teams
  ├── room (N:1) ← rooms
  ├── members (1:N) → room_members
  └── session_teams (1:N) → teams

room_members
  ├── room (N:1) ← rooms
  ├── user (N:1) ← users
  └── team (N:1) ← room_teams

sessions
  ├── room (N:1) ← rooms
  ├── teams (1:N) → teams
  ├── participants (1:N) → participants
  ├── hex_ownerships (1:N) → hex_ownerships
  ├── event_logs (1:N) → event_logs
  ├── player_stats (1:N) → player_stats

teams
  ├── session (N:1) ← sessions
  ├── room_team (N:1) ← room_teams
  ├── members (1:N) → participants
  ├── owned_hexes (1:N) → hex_ownerships
  └── events (1:N) → event_logs

participants
  ├── session (N:1) ← sessions
  ├── user (N:1) ← users
  ├── team (N:1) ← room_teams
  ├── claimed_hexes (1:N) → hex_ownerships
  ├── events (1:N) → event_logs
  └── stats (1:1) → player_stats

hex_ownerships
  ├── session (N:1) ← sessions
  ├── team (N:1) ← teams
  └── claimed_by (N:1) ← participants

event_logs
  ├── session (N:1) ← sessions
  ├── participant (N:1) ← participants
  └── team (N:1) ← teams

player_stats
  ├── session (N:1) ← sessions
  └── participant (N:1) ← participants

```

---

## 주요 인덱스 요약

1. **users**: username (UNIQUE), email (UNIQUE)
2. **user_stats**: rank (INDEX), total_hexes_claimed (INDEX)
3. **friendships**: 
   - (requester_id, status) INDEX
   - (addressee_id, status) INDEX
   - (requester_id, addressee_id) INDEX - 친구 관계 조회 최적화
4. **mailbox**: 
   - (receiver_id, status) INDEX
   - (receiver_id, mail_type) INDEX
   - (receiver_id, created_at) INDEX
   - (receiver_id, status, created_at) INDEX - 사용자별 메일 조회 최적화
5. **rooms**: 
   - invite_code (UNIQUE INDEX)
   - (creator_id, status) INDEX - 사용자별 상태별 방 조회 최적화
6. **room_teams**:
   - (room_id, name) UNIQUE - 같은 방 내 동일한 팀 이름 방지
7. **room_members**:
   - (room_id, user_id) UNIQUE - 방 내 중복 참가 방지
8. **sessions**: status (INDEX)
9. **teams**: (session_id, name) UNIQUE - 같은 세션 내 동일한 팀 이름 방지
10. **participants**: 
   - (session_id, user_id) UNIQUE
   - (session_id, status) INDEX
   - (session_id, last_h3_id) INDEX
11. **hex_ownerships**:
   - (session_id, h3_id) UNIQUE, INDEX
   - (session_id, team_id) INDEX
12. **event_logs**: 
    - event_type (INDEX)
    - (session_id, event_type, created_at) INDEX
13. **player_stats**: (session_id, participant_id) UNIQUE

---

## 데이터 타입 및 제약사항

- **UUID**: 모든 테이블의 Primary Key는 UUID 사용
- **JSON**: rules, game_area_bounds, data, snapshot_data 필드에 사용
- **CASCADE**: 대부분의 Foreign Key는 CASCADE 삭제
- **SET_NULL**: team, claimed_by, participant, team (event_logs)는 SET_NULL 사용
- **AUTO_NOW_ADD**: created_at, joined_at, claimed_at 필드
- **AUTO_NOW**: updated_at 필드

## 데이터 무결성 제약조건 (CheckConstraints)

### user_stats
- `rank >= 0` - 랭크는 0 이상
- `total_hexes_claimed >= 0` - 점령한 hex 수는 0 이상
- `mvp_count >= 0` - MVP 횟수는 0 이상
- `win_count >= 0` - 승리 횟수는 0 이상
- `lose_count >= 0` - 패배 횟수는 0 이상

### friendships
- `requester_id != addressee_id` - 자기 자신에게 친구 요청 방지

### rooms
- `max_participants > 0` - 최대 참가자 수는 1 이상
- `game_duration_minutes > 0` - 게임 지속 시간은 1분 이상
- `h3_resolution >= 0 AND h3_resolution <= 15` - H3 해상도는 0~15 사이

### teams
- `hexes_claimed >= 0` - 점령한 hex 수는 0 이상
- `hexes_lost >= 0` - 뺏긴 hex 수는 0 이상
- `paintballs_used >= 0` - 사용한 페인트볼 수는 0 이상

### participants
- `last_lat IS NULL OR (last_lat >= -90 AND last_lat <= 90)` - 위도 범위 검증
- `last_lng IS NULL OR (last_lng >= -180 AND last_lng <= 180)` - 경도 범위 검증

## 데이터 무결성 제약조건 (CheckConstraint)

### friendships
- `requester_id != addressee_id` - 자기 자신에게 친구 요청 방지

### user_stats
- `rank >= 0`
- `total_hexes_claimed >= 0`
- `mvp_count >= 0`
- `win_count >= 0`
- `lose_count >= 0`

### rooms
- `max_participants > 0` - 최대 참가자 수는 양수
- `game_duration_minutes > 0` - 게임 지속 시간은 양수
- `h3_resolution BETWEEN 0 AND 15` - H3 해상도 범위

### teams
- `hexes_claimed >= 0` - 점령한 hex 수는 0 이상
- `hexes_lost >= 0` - 뺏긴 hex 수는 0 이상
- `paintballs_used >= 0` - 사용한 페인트볼 수는 0 이상

### participants
- `last_lat BETWEEN -90 AND 90` - 위도 범위 검증
- `last_lng BETWEEN -180 AND 180` - 경도 범위 검증

