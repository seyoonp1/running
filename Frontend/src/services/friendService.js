import api from './api';
import { mockApi } from './mockData';

// Mock 모드 활성화 여부
const USE_MOCK = true;

/**
 * 친구 목록 조회
 * GET /api/friends/
 */
export const getFriends = async (params = {}) => {
  console.log('🟢 getFriends 호출됨', { params, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getFriends(params);
    console.log('✅ getFriends 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get('/friends/', { params });
    return response.data;
  } catch (error) {
    console.error('친구 목록 조회 실패:', error);
    throw error;
  }
};

/**
 * 친구 검색 (닉네임)
 * GET /api/friends/search/?q={username}
 */
export const searchUsers = async (query) => {
  console.log('🔵 searchUsers 호출됨', { query, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.searchUsers(query);
    console.log('✅ searchUsers 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get('/friends/search/', { params: { q: query } });
    return response.data;
  } catch (error) {
    console.error('친구 검색 실패:', error);
    throw error;
  }
};

/**
 * 친구 요청
 * POST /api/friends/request/
 */
export const sendFriendRequest = async (userId) => {
  console.log('🟡 sendFriendRequest 호출됨', { userId, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.sendFriendRequest(userId);
    console.log('✅ sendFriendRequest 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post('/friends/request/', { user_id: userId });
    return response.data;
  } catch (error) {
    console.error('친구 요청 실패:', error);
    throw error;
  }
};
