// Mock 데이터 - 백엔드 없이 프론트엔드 테스트용

export const mockGameAreas = {
  count: 3,
  results: [
    {
      id: '1',
      name: '한강공원',
      city: '서울',
      description: '한강을 따라 이어지는 공원 구역',
      bounds: {
        type: 'Polygon',
        coordinates: [[[127.0, 37.5], [127.1, 37.5], [127.1, 37.6], [127.0, 37.6], [127.0, 37.5]]],
      },
      h3_resolution: 8,
      is_active: true,
    },
    {
      id: '2',
      name: '올림픽공원',
      city: '서울',
      description: '올림픽공원 일대',
      bounds: {
        type: 'Polygon',
        coordinates: [[[127.1, 37.5], [127.2, 37.5], [127.2, 37.6], [127.1, 37.6], [127.1, 37.5]]],
      },
      h3_resolution: 8,
      is_active: true,
    },
    {
      id: '3',
      name: '여의도공원',
      city: '서울',
      description: '여의도 한강공원',
      bounds: {
        type: 'Polygon',
        coordinates: [[[126.9, 37.5], [127.0, 37.5], [127.0, 37.6], [126.9, 37.6], [126.9, 37.5]]],
      },
      h3_resolution: 8,
      is_active: true,
    },
  ],
};

export const mockRooms = {
  count: 4,
  results: [
    {
      id: '1',
      name: '한강 러닝 대결',
      total_participants: 4,
      current_participants: 2,
      status: 'ready',
      start_date: '2026-01-27T12:00:00',
      end_date: '2026-02-28T18:00:00',
    },
    {
      id: '2',
      name: '올림픽공원 챌린지',
      total_participants: 6,
      current_participants: 4,
      status: 'ready',
      start_date: '2026-02-05',
      end_date: '2026-02-20',
    },
    {
      id: '3',
      name: '여의도 러닝',
      total_participants: 4,
      current_participants: 3,
      status: 'ready',
      start_date: '2026-02-10',
      end_date: '2026-02-25',
    },
    {
      id: '4',
      name: '서울 한바퀴',
      total_participants: 8,
      current_participants: 5,
      status: 'ready',
      start_date: '2026-02-15',
      end_date: '2026-03-15',
    },
  ],
};

export const mockRoomDetail = {
  id: '1',
  name: '한강 러닝 대결',
  creator: { id: 'user1', username: 'runner1' },
  total_participants: 4,
  current_participants: 2,
  team_a_count: 1,
  team_b_count: 1,
  start_date: '2026-01-27T12:00:00',
  end_date: '2026-02-28T18:00:00',
  status: 'ready',
  invite_code: 'ABC123',
  game_area: {
    id: '1',
    name: '한강공원',
    city: '서울',
    bounds: {
      type: 'Polygon',
      coordinates: [[[127.0, 37.5], [127.1, 37.5], [127.1, 37.6], [127.0, 37.6], [127.0, 37.5]]],
    },
    h3_resolution: 8,
  },
  current_hex_ownerships: {},
  participants: [
    {
      id: 'p1',
      user: { id: 'user1', username: 'runner1' },
      team: 'B',
      is_host: false,
      paintball_count: 5,
      super_paintball_count: 1,
    },
    {
      id: 'p2',
      user: { id: 'user2', username: 'runner2' },
      team: 'A',
      is_host: true,
      paintball_count: 3,
      super_paintball_count: 0,
    },
  ],
};

// 지연 시뮬레이션 (실제 API 호출 느낌)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockApi = {
  getGameAreas: async (params = {}) => {
    await delay(500); // 0.5초 지연
    return mockGameAreas;
  },

  createRoom: async (roomData) => {
    await delay(1000); // 1초 지연
    return {
      ...mockRoomDetail,
      name: roomData.name,
      total_participants: roomData.total_participants,
      start_date: roomData.start_date,
      end_date: roomData.end_date,
      game_area: mockGameAreas.results.find((area) => area.id === roomData.game_area_id),
    };
  },

  getRooms: async (params = {}) => {
    await delay(500);
    return mockRooms;
  },

  getRoomDetail: async (roomId) => {
    await delay(500);
    return {
      ...mockRoomDetail,
      id: roomId,
    };
  },

  getMyRoom: async () => {
    await delay(500);
    // Mock: 참가 중인 방이 있다고 가정 (또는 null 반환)
    // null을 반환하려면: return null;
    return {
      ...mockRoomDetail,
      my_participant: {
        id: 'p2',
        user: { id: 'user2', username: 'runner2' },
        team: 'A',
        is_host: true,
        is_recording: false,
        paintball_count: 5,
        super_paintball_count: 1,
        paintball_gauge: 60,
        consecutive_attendance_days: 2,
        joined_at: '2026-01-25T00:00:00Z',
      },
    };
  },

  joinRoom: async (inviteCode, team = null) => {
    await delay(1000);
    if (inviteCode !== 'ABC123') {
      throw new Error('유효하지 않은 초대 코드입니다.');
    }
    return {
      message: '방에 참가했습니다.',
      room: mockRoomDetail,
      participant: {
        id: 'p3',
        team: team || 'A',
        is_host: false,
      },
    };
  },

  leaveRoom: async (roomId) => {
    await delay(500);
    return {
      message: '방에서 나갔습니다.',
    };
  },

  changeTeam: async (roomId, team) => {
    await delay(500);
    return {
      message: '팀을 변경했습니다.',
      participant: {
        id: 'p2',
        team: team,
      },
    };
  },

  startRoom: async (roomId) => {
    await delay(1000);
    return {
      message: '게임이 시작되었습니다.',
      room: {
        id: roomId,
        status: 'active',
        start_date: '2026-01-27T12:00:00',
      },
    };
  },

  inviteFriend: async (roomId, userId) => {
    await delay(500);
    return {
      message: '초대를 보냈습니다.',
    };
  },

  getAttendance: async (roomId) => {
    await delay(500);
    return {
      consecutive_days: 3,
      last_attendance_date: '2026-01-25',
      attended_today: false,
      current_paintball_count: 5,
      next_reward: 4,
      max_reward: 7,
      reward_info: {
        description: '연속 출석 보상',
        rewards: [
          { days: 2, paintballs: 2 },
          { days: 3, paintballs: 3 },
          { days: 4, paintballs: 4 },
          { days: 5, paintballs: 5 },
          { days: 6, paintballs: 6 },
          { days: 7, paintballs: 7, note: '최대' },
        ],
        how_to_attend: '기록 중일 때 다른 헥사곤으로 이동하면 출석 체크됩니다.',
      },
    };
  },
};

// 기록 관련 Mock 데이터
export const mockRecords = {
  count: 5,
  results: [
    {
      id: 'r1',
      duration_seconds: 1800,
      distance_meters: 5000,
      avg_pace_seconds_per_km: 360,
      started_at: '2026-01-25T10:00:00Z',
      ended_at: '2026-01-25T10:30:00Z',
    },
    {
      id: 'r2',
      duration_seconds: 2400,
      distance_meters: 6000,
      avg_pace_seconds_per_km: 400,
      started_at: '2026-01-24T18:00:00Z',
      ended_at: '2026-01-24T18:40:00Z',
    },
    {
      id: 'r3',
      duration_seconds: 1500,
      distance_meters: 4000,
      avg_pace_seconds_per_km: 375,
      started_at: '2026-01-23T07:00:00Z',
      ended_at: '2026-01-23T07:25:00Z',
    },
    {
      id: 'r4',
      duration_seconds: 2100,
      distance_meters: 5500,
      avg_pace_seconds_per_km: 381,
      started_at: '2026-01-22T19:00:00Z',
      ended_at: '2026-01-22T19:35:00Z',
    },
    {
      id: 'r5',
      duration_seconds: 2700,
      distance_meters: 7000,
      avg_pace_seconds_per_km: 385,
      started_at: '2026-01-21T06:00:00Z',
      ended_at: '2026-01-21T06:45:00Z',
    },
  ],
};

// 기록 Mock API 함수들
export const recordMockApi = {
  startRecord: async (roomId = null) => {
    await delay(500);
    const recordId = `record_${Date.now()}`;
    return {
      id: recordId,
      started_at: new Date().toISOString(),
      room_id: roomId,
    };
  },

  stopRecord: async (recordId) => {
    await delay(1000);
    // Mock: 랜덤한 거리와 시간 생성
    const duration = 1500 + Math.floor(Math.random() * 1500); // 25-50분
    const distance = 3000 + Math.floor(Math.random() * 4000); // 3-7km
    const pace = Math.round((duration / distance) * 1000); // 초/km

    return {
      id: recordId,
      duration_seconds: duration,
      distance_meters: distance,
      avg_pace_seconds_per_km: pace,
      started_at: new Date(Date.now() - duration * 1000).toISOString(),
      ended_at: new Date().toISOString(),
    };
  },

  getRecords: async (params = {}) => {
    await delay(500);
    let results = [...mockRecords.results];

    // 필터링 (간단한 Mock)
    if (params.year) {
      // 년도 필터링은 Mock에서 생략
    }
    if (params.month) {
      // 월 필터링은 Mock에서 생략
    }
    if (params.week) {
      // 주 필터링은 Mock에서 생략
    }

    return {
      count: results.length,
      results: results,
    };
  },

  getRecordStats: async (period = null) => {
    await delay(500);
    const allRecords = mockRecords.results;

    const totalDistance = allRecords.reduce((sum, r) => sum + r.distance_meters, 0);
    const totalDuration = allRecords.reduce((sum, r) => sum + r.duration_seconds, 0);
    const totalRuns = allRecords.length;
    const avgPace = totalDistance > 0 ? (totalDuration / totalDistance) * 1000 : 0;

    return {
      period: period || 'all',
      total_distance_meters: totalDistance,
      total_duration_seconds: totalDuration,
      total_runs: totalRuns,
      avg_pace_seconds_per_km: Math.round(avgPace),
    };
  },
};

// 기존 mockApi에 기록 함수들 추가
mockApi.startRecord = recordMockApi.startRecord;
mockApi.stopRecord = recordMockApi.stopRecord;
mockApi.getRecords = recordMockApi.getRecords;
mockApi.getRecordStats = recordMockApi.getRecordStats;

// 친구 관련 Mock 데이터
export const mockFriends = {
  count: 3,
  results: [
    {
      id: 'user3',
      username: 'friend1',
      email: 'friend1@example.com',
    },
    {
      id: 'user4',
      username: 'friend2',
      email: 'friend2@example.com',
    },
    {
      id: 'user5',
      username: 'friend3',
      email: 'friend3@example.com',
    },
  ],
};

export const mockSearchResults = [
  { id: 'user6', username: 'runner2' },
  { id: 'user7', username: 'runner3' },
  { id: 'user8', username: 'runner4' },
];

// 친구 Mock API 함수들
export const friendMockApi = {
  getFriends: async (params = {}) => {
    await delay(500);
    return mockFriends;
  },

  searchUsers: async (query) => {
    await delay(500);
    if (!query || query.length < 2) {
      return { results: [] };
    }
    // Mock: 검색어가 포함된 사용자 반환
    const filtered = mockSearchResults.filter((user) =>
      user.username.toLowerCase().includes(query.toLowerCase())
    );
    return { results: filtered };
  },

  sendFriendRequest: async (userId) => {
    await delay(500);
    return {
      message: '친구 요청을 보냈습니다.',
    };
  },
};

// 우편함 관련 Mock 데이터
export const mockMailbox = {
  count: 4,
  results: [
    {
      id: 'mail1',
      sender: { id: 'user3', username: 'friend1' },
      mail_type: 'friend_request',
      status: 'unread',
      created_at: '2026-01-25T10:00:00Z',
    },
    {
      id: 'mail2',
      sender: { id: 'user4', username: 'friend2' },
      mail_type: 'room_invite',
      room: { id: '1', name: '한강 러닝 대결' },
      status: 'unread',
      created_at: '2026-01-25T09:00:00Z',
    },
    {
      id: 'mail3',
      sender: { id: 'user5', username: 'friend3' },
      mail_type: 'friend_request',
      status: 'read',
      created_at: '2026-01-24T15:00:00Z',
    },
    {
      id: 'mail4',
      sender: { id: 'user6', username: 'runner2' },
      mail_type: 'room_invite',
      room: { id: '2', name: '올림픽공원 챌린지' },
      status: 'read',
      created_at: '2026-01-24T12:00:00Z',
    },
  ],
};

// 우편함 Mock API 함수들
export const mailboxMockApi = {
  getMailbox: async (params = {}) => {
    await delay(500);
    let results = [...mockMailbox.results];

    // 필터링
    if (params.status) {
      results = results.filter((mail) => mail.status === params.status);
    }
    if (params.mail_type) {
      results = results.filter((mail) => mail.mail_type === params.mail_type);
    }

    return {
      count: results.length,
      results: results,
    };
  },

  respondToMail: async (mailId, accept) => {
    await delay(500);
    const mail = mockMailbox.results.find((m) => m.id === mailId);

    if (!mail) {
      throw new Error('메일을 찾을 수 없습니다.');
    }

    if (mail.status !== 'unread' && mail.status !== 'read') {
      throw new Error('이미 처리된 메일입니다.');
    }

    if (accept) {
      if (mail.mail_type === 'friend_request') {
        return {
          message: '친구 요청을 수락했습니다.',
        };
      } else if (mail.mail_type === 'room_invite') {
        return {
          message: '초대를 수락했습니다. A팀에 배정되었습니다.',
          room: mockRoomDetail,
          participant: {
            id: 'p3',
            team: 'A',
            is_host: false,
          },
        };
      }
    } else {
      if (mail.mail_type === 'friend_request') {
        return {
          message: '친구 요청을 거절했습니다.',
        };
      } else if (mail.mail_type === 'room_invite') {
        return {
          message: '초대를 거절했습니다.',
        };
      }
    }

    return { message: '처리되었습니다.' };
  },
};

// 기존 mockApi에 친구 및 우편함 함수들 추가
mockApi.getFriends = friendMockApi.getFriends;
mockApi.searchUsers = friendMockApi.searchUsers;
mockApi.sendFriendRequest = friendMockApi.sendFriendRequest;
mockApi.getMailbox = mailboxMockApi.getMailbox;
mockApi.respondToMail = mailboxMockApi.respondToMail;
