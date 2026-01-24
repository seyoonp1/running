# 새로 추가된 기능

## 1. 친구 기능

### 모델
- `Friendship` 모델: 사용자 간 친구 관계를 관리
  - `requester`: 친구 요청을 보낸 사용자
  - `addressee`: 친구 요청을 받은 사용자
  - `status`: 'pending' (대기중), 'accepted' (수락됨), 'blocked' (차단됨)

### API 엔드포인트

#### 친구 요청 보내기
```
POST /api/auth/friends/request/
Body: {
  "username": "friend_username"  // 또는
  "user_id": "uuid"
}
```

#### 친구 요청 수락
```
POST /api/auth/friends/accept/<friendship_id>/
```

#### 친구 요청 거절
```
POST /api/auth/friends/reject/<friendship_id>/
```

#### 친구 삭제
```
DELETE /api/auth/friends/remove/<friendship_id>/
```

#### 친구 목록 조회
```
GET /api/auth/friends/
Response: {
  "friends": [
    {
      "friendship_id": "uuid",
      "user": {...},
      "friends_since": "datetime"
    }
  ]
}
```

#### 친구 요청 목록 조회
```
GET /api/auth/friends/requests/
Response: {
  "sent": [...],
  "received": [...]
}
```

#### 사용자 검색
```
GET /api/auth/users/search/?q=username
Response: {
  "users": [
    {
      "user": {...},
      "friendship_status": "accepted|pending|null",
      "friendship_id": "uuid|null"
    }
  ]
}
```

### 방 생성 시 친구 초대

방 생성 시 `friend_ids` 배열을 포함하면 친구를 초대할 수 있습니다:

```
POST /api/rooms/
Body: {
  "name": "My Room",
  "max_participants": 20,
  "friend_ids": ["uuid1", "uuid2", ...]
}
```

초대된 친구 정보는 `room.rules['invited_friends']`에 저장됩니다.

---

## 2. 팀 채팅 기능

### 모델
- `ChatMessage` 모델: 세션 내 팀별 채팅 메시지
  - `session`: 세션
  - `team`: 팀 (null이면 전체 세션 채팅)
  - `participant`: 메시지를 보낸 참가자
  - `message`: 메시지 내용 (최대 500자)
  - `created_at`: 생성 시간

### API 엔드포인트

#### 채팅 메시지 조회
```
GET /api/sessions/<session_id>/chat/?team_id=<team_id>
Response: {
  "messages": [
    {
      "id": "uuid",
      "session": "uuid",
      "team": {...},
      "participant": {...},
      "message": "Hello!",
      "created_at": "datetime"
    }
  ]
}
```

- `team_id` 파라미터가 없으면 세션 전체 메시지
- `team_id` 파라미터가 있으면 해당 팀의 메시지만

### Socket.IO 이벤트

#### 팀 채팅 메시지 보내기
```javascript
socket.emit('team_chat', {
  message: 'Hello team!',
  team_id: 'uuid'  // optional, 현재 팀 사용
});
```

#### 팀 채팅 메시지 수신
```javascript
socket.on('team_chat_message', (data) => {
  console.log('Chat message:', data);
  // {
  //   id: "uuid",
  //   session_id: "uuid",
  //   team_id: "uuid",
  //   participant: {
  //     id: "uuid",
  //     user: {
  //       id: "uuid",
  //       username: "username"
  //     }
  //   },
  //   message: "Hello!",
  //   created_at: "datetime"
  // }
});
```

### 동작 방식

1. 세션 참가 시 자동으로 팀 채팅방에 join
2. `team_chat` 이벤트로 메시지 전송
3. 같은 팀의 모든 멤버에게 `team_chat_message` 이벤트로 브로드캐스트
4. 메시지는 데이터베이스에 저장되어 나중에 조회 가능

---

## 사용 예시

### 친구 추가 플로우

```javascript
// 1. 사용자 검색
const response = await fetch('/api/auth/users/search/?q=john', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { users } = await response.json();

// 2. 친구 요청 보내기
await fetch('/api/auth/friends/request/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ user_id: users[0].user.id })
});

// 3. 친구 요청 수락 (받은 사람이)
await fetch(`/api/auth/friends/accept/${friendship_id}/`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### 방 생성 시 친구 초대

```javascript
// 친구 목록 조회
const friendsResponse = await fetch('/api/auth/friends/', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { friends } = await friendsResponse.json();

// 방 생성 시 친구 초대
await fetch('/api/rooms/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Game Room',
    max_participants: 20,
    friend_ids: friends.slice(0, 5).map(f => f.user.id)  // 처음 5명 초대
  })
});
```

### 팀 채팅 사용

```javascript
// Socket.IO 연결
const socket = io('http://localhost:3000', {
  path: '/socket.io/',
  auth: { token: jwtToken }
});

// 세션 참가
socket.emit('join_session', { session_id: sessionId });

// 채팅 메시지 보내기
socket.on('connection_established', () => {
  socket.emit('team_chat', {
    message: '안녕하세요 팀원들!'
  });
});

// 채팅 메시지 수신
socket.on('team_chat_message', (data) => {
  console.log(`${data.participant.user.username}: ${data.message}`);
  // UI에 메시지 표시
});
```

---

## 마이그레이션

새로운 모델을 추가했으므로 마이그레이션을 실행해야 합니다:

```bash
python manage.py makemigrations
python manage.py migrate
```

