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
| is_active | BOOLEAN | DEFAULT TRUE | 활성 상태 |
| is_staff | BOOLEAN | DEFAULT FALSE | 스태프 여부 |
| is_superuser | BOOLEAN | DEFAULT FALSE | 슈퍼유저 여부 |
| date_joined | DATETIME | | 가입일시 |
| last_login | DATETIME | NULL | 마지막 로그인 |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |
| updated_at | DATETIME | AUTO_NOW | 수정일시 |

**관계**:
- `created_rooms` (1:N) → rooms (creator)
- `participations` (1:N) → participants (user)

---

### 2. rooms
**설명**: 게임 방 설정 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 방 고유 ID |
| name | VARCHAR(200) | NOT NULL | 방 이름 |
| creator_id | UUID | FOREIGN KEY → users.id | 생성자 ID |
| invite_code | VARCHAR(20) | UNIQUE, INDEX | 초대 코드 |
| max_participants | INTEGER | DEFAULT 20 | 최대 참가자 수 |
| game_duration_minutes | INTEGER | DEFAULT 60 | 게임 지속 시간 (분) |
| scheduled_start | DATETIME | NULL | 예정 시작 시간 |
| rules | JSON | DEFAULT {} | 커스텀 규칙 |
| is_active | BOOLEAN | DEFAULT TRUE | 활성 상태 |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |
| updated_at | DATETIME | AUTO_NOW | 수정일시 |

**관계**:
- `creator` (N:1) ← users
- `sessions` (1:N) → sessions (room)

**인덱스**:
- `invite_code` (UNIQUE INDEX)

---

### 3. sessions
**설명**: 게임 세션 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 세션 고유 ID |
| room_id | UUID | FOREIGN KEY → rooms.id | 방 ID |
| status | VARCHAR(20) | DEFAULT 'waiting', INDEX | 상태 (waiting/active/finished) |
| started_at | DATETIME | NULL | 시작 시간 |
| ended_at | DATETIME | NULL | 종료 시간 |
| game_area_bounds | JSON | DEFAULT {} | 게임 영역 경계 |
| h3_resolution | INTEGER | DEFAULT 8 | H3 해상도 |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |
| updated_at | DATETIME | AUTO_NOW | 수정일시 |

**관계**:
- `room` (N:1) ← rooms
- `teams` (1:N) → teams (session)
- `participants` (1:N) → participants (session)
- `hex_ownerships` (1:N) → hex_ownerships (session)
- `event_logs` (1:N) → event_logs (session)
- `player_stats` (1:N) → player_stats (session)
- `snapshots` (1:N) → session_state_snapshots (session)

**인덱스**:
- `status` (INDEX)

---

### 4. teams
**설명**: 세션 내 팀 정보 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 팀 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| name | VARCHAR(100) | NOT NULL | 팀 이름 |
| color | VARCHAR(7) | NOT NULL | HEX 색상 코드 |
| score | INTEGER | DEFAULT 0 | 점수 (점령한 hex 수) |
| created_at | DATETIME | AUTO_NOW_ADD | 생성일시 |

**관계**:
- `session` (N:1) ← sessions
- `members` (1:N) → participants (team)
- `owned_hexes` (1:N) → hex_ownerships (team)
- `events` (1:N) → event_logs (team)

---

### 5. participants
**설명**: 세션 참가자 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 참가자 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| user_id | UUID | FOREIGN KEY → users.id | 사용자 ID |
| team_id | UUID | FOREIGN KEY → teams.id, NULL | 팀 ID |
| status | VARCHAR(20) | DEFAULT 'joined', INDEX | 상태 (joined/active/left) |
| last_lat | FLOAT | NULL | 마지막 위도 |
| last_lng | FLOAT | NULL | 마지막 경도 |
| last_h3_id | VARCHAR(20) | NULL, INDEX | 마지막 H3 ID |
| last_location_at | DATETIME | NULL | 마지막 위치 업데이트 시간 |
| joined_at | DATETIME | AUTO_NOW_ADD | 참가일시 |

**관계**:
- `session` (N:1) ← sessions
- `user` (N:1) ← users
- `team` (N:1) ← teams
- `claimed_hexes` (1:N) → hex_ownerships (claimed_by)
- `events` (1:N) → event_logs (participant)
- `stats` (1:1) → player_stats (participant)

**제약조건**:
- UNIQUE (session_id, user_id)
- INDEX (session_id, status)
- INDEX (session_id, last_h3_id)

---

### 6. hex_ownerships
**설명**: Hex 소유 정보 테이블

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 소유 정보 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| h3_id | VARCHAR(20) | INDEX | H3 Hex ID |
| team_id | UUID | FOREIGN KEY → teams.id, NULL | 소유 팀 ID |
| claimed_at | DATETIME | AUTO_NOW_ADD | 점령 시간 |
| claimed_by_id | UUID | FOREIGN KEY → participants.id, NULL | 점령한 참가자 ID |
| visit_count | INTEGER | DEFAULT 1 | 방문 횟수 (효율 감소용) |

**관계**:
- `session` (N:1) ← sessions
- `team` (N:1) ← teams
- `claimed_by` (N:1) ← participants

**제약조건**:
- UNIQUE (session_id, h3_id)
- INDEX (session_id, h3_id)
- INDEX (session_id, team_id)

---

### 7. event_logs
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

### 8. player_stats
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

### 9. session_state_snapshots
**설명**: 세션 상태 스냅샷 테이블 (복구용)

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 스냅샷 고유 ID |
| session_id | UUID | FOREIGN KEY → sessions.id | 세션 ID |
| snapshot_data | JSON | NOT NULL | 전체 상태 JSON |
| created_at | DATETIME | AUTO_NOW_ADD, INDEX | 생성일시 |

**관계**:
- `session` (N:1) ← sessions

---

## ERD 다이어그램

```
users
  ├── created_rooms (1:N) → rooms
  └── participations (1:N) → participants

rooms
  ├── creator (N:1) ← users
  └── sessions (1:N) → sessions

sessions
  ├── room (N:1) ← rooms
  ├── teams (1:N) → teams
  ├── participants (1:N) → participants
  ├── hex_ownerships (1:N) → hex_ownerships
  ├── event_logs (1:N) → event_logs
  ├── player_stats (1:N) → player_stats
  └── snapshots (1:N) → session_state_snapshots

teams
  ├── session (N:1) ← sessions
  ├── members (1:N) → participants
  ├── owned_hexes (1:N) → hex_ownerships
  └── events (1:N) → event_logs

participants
  ├── session (N:1) ← sessions
  ├── user (N:1) ← users
  ├── team (N:1) ← teams
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

session_state_snapshots
  └── session (N:1) ← sessions
```

---

## 주요 인덱스 요약

1. **users**: username (UNIQUE), email (UNIQUE)
2. **rooms**: invite_code (UNIQUE INDEX)
3. **sessions**: status (INDEX)
4. **participants**: 
   - (session_id, user_id) UNIQUE
   - (session_id, status) INDEX
   - (session_id, last_h3_id) INDEX
5. **hex_ownerships**:
   - (session_id, h3_id) UNIQUE, INDEX
   - (session_id, team_id) INDEX
6. **event_logs**: 
   - event_type (INDEX)
   - (session_id, event_type, created_at) INDEX
7. **player_stats**: (session_id, participant_id) UNIQUE
8. **session_state_snapshots**: created_at (INDEX)

---

## 데이터 타입 및 제약사항

- **UUID**: 모든 테이블의 Primary Key는 UUID 사용
- **JSON**: rules, game_area_bounds, data, snapshot_data 필드에 사용
- **CASCADE**: 대부분의 Foreign Key는 CASCADE 삭제
- **SET_NULL**: team, claimed_by, participant, team (event_logs)는 SET_NULL 사용
- **AUTO_NOW_ADD**: created_at, joined_at, claimed_at 필드
- **AUTO_NOW**: updated_at 필드

