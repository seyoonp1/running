import api from './api';
import { mockApi } from './mockData';

// Mock 모드 활성화 여부 (프론트엔드만 테스트할 때 true로 설정)
const USE_MOCK = true; // 백엔드 서버 없이 테스트하려면 true로 설정

/**
 * 게임 구역 목록 조회
 * GET /api/game-areas/
 */
export const getGameAreas = async (params = {}) => {
  console.log('🔵 getGameAreas 호출됨', { params, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getGameAreas(params);
    console.log('✅ getGameAreas 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get('/game-areas/', { params });
    return response.data;
  } catch (error) {
    console.error('게임 구역 목록 조회 실패:', error);
    throw error;
  }
};

/**
 * 방 생성
 * POST /api/rooms/
 */
export const createRoom = async (roomData) => {
  console.log('🟢 createRoom 호출됨', { roomData, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.createRoom(roomData);
    console.log('✅ createRoom 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post('/rooms/', roomData);
    return response.data;
  } catch (error) {
    console.error('방 생성 실패:', error);
    throw error;
  }
};

/**
 * 방 목록 조회
 * GET /api/rooms/
 */
export const getRooms = async (params = {}) => {
  console.log('🟡 getRooms 호출됨', { params, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getRooms(params);
    console.log('✅ getRooms 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get('/rooms/', { params });
    return response.data;
  } catch (error) {
    console.error('방 목록 조회 실패:', error);
    throw error;
  }
};

/**
 * 방 상세 조회
 * GET /api/rooms/{id}/
 */
export const getRoomDetail = async (roomId) => {
  console.log('🟣 getRoomDetail 호출됨', { roomId, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getRoomDetail(roomId);
    console.log('✅ getRoomDetail 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get(`/rooms/${roomId}/`);
    return response.data;
  } catch (error) {
    console.error('방 상세 조회 실패:', error);
    throw error;
  }
};

/**
 * 내가 현재 참가 중인 방 조회
 * GET /api/rooms/my/
 */
export const getMyRoom = async () => {
  console.log('🔴 getMyRoom 호출됨', { USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getMyRoom();
    console.log('✅ getMyRoom 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get('/rooms/my/');
    return response.data;
  } catch (error) {
    console.error('내 방 조회 실패:', error);
    throw error;
  }
};

/**
 * 방 참가 (초대 코드)
 * POST /api/rooms/join/
 */
export const joinRoom = async (inviteCode, team = null) => {
  console.log('🟠 joinRoom 호출됨', { inviteCode, team, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.joinRoom(inviteCode, team);
    console.log('✅ joinRoom 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post('/rooms/join/', {
      invite_code: inviteCode,
      team: team,
    });
    return response.data;
  } catch (error) {
    console.error('방 참가 실패:', error);
    throw error;
  }
};

/**
 * 방 나가기
 * POST /api/rooms/{id}/leave/
 */
export const leaveRoom = async (roomId) => {
  console.log('🔴 leaveRoom 호출됨', { roomId, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.leaveRoom(roomId);
    console.log('✅ leaveRoom 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post(`/rooms/${roomId}/leave/`);
    return response.data;
  } catch (error) {
    console.error('방 나가기 실패:', error);
    throw error;
  }
};

/**
 * 팀 변경
 * POST /api/rooms/{id}/change-team/
 */
export const changeTeam = async (roomId, team) => {
  console.log('🟡 changeTeam 호출됨', { roomId, team, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.changeTeam(roomId, team);
    console.log('✅ changeTeam 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post(`/rooms/${roomId}/change-team/`, { team });
    return response.data;
  } catch (error) {
    console.error('팀 변경 실패:', error);
    throw error;
  }
};

/**
 * 방 시작 (방장 전용)
 * POST /api/rooms/{id}/start/
 */
export const startRoom = async (roomId) => {
  console.log('🟢 startRoom 호출됨', { roomId, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.startRoom(roomId);
    console.log('✅ startRoom 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post(`/rooms/${roomId}/start/`);
    return response.data;
  } catch (error) {
    console.error('방 시작 실패:', error);
    throw error;
  }
};

/**
 * 친구 초대 (방 내에서)
 * POST /api/rooms/{id}/invite/
 */
export const inviteFriend = async (roomId, userId) => {
  console.log('🟣 inviteFriend 호출됨', { roomId, userId, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.inviteFriend(roomId, userId);
    console.log('✅ inviteFriend 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post(`/rooms/${roomId}/invite/`, { user_id: userId });
    return response.data;
  } catch (error) {
    console.error('친구 초대 실패:', error);
    throw error;
  }
};

/**
 * 출석 현황 조회
 * GET /api/rooms/{id}/attendance/
 */
export const getAttendance = async (roomId) => {
  console.log('🔵 getAttendance 호출됨', { roomId, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getAttendance(roomId);
    console.log('✅ getAttendance 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get(`/rooms/${roomId}/attendance/`);
    return response.data;
  } catch (error) {
    console.error('출석 현황 조회 실패:', error);
    throw error;
  }
};
