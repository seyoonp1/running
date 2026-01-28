import api from './api';
import { mockApi } from './mockData';

// Mock 모드 활성화 여부 (프론트엔드만 테스트할 때 true로 설정)
const USE_MOCK = false; // 백엔드 서버 연결 시 false로 설정

/**
 * Django REST Framework 에러 형식을 처리하는 헬퍼 함수
 * @param {Error} error - Axios 에러 객체
 * @param {string} defaultMessage - 기본 에러 메시지
 * @returns {Error} - 처리된 에러 객체 (message 속성 포함)
 */
const handleApiError = (error, defaultMessage = '요청에 실패했습니다.') => {
  // 네트워크 에러 처리
  if (!error.response) {
    const networkError = new Error('네트워크 연결을 확인해주세요.');
    networkError.isNetworkError = true;
    return networkError;
  }

  const errorData = error.response.data;
  let errorMessage = defaultMessage;

  // Django REST Framework 에러 형식 처리
  if (errorData) {
    // 커스텀 에러 형식 (백엔드에서 { error, message } 형식으로 반환)
    if (errorData.message) {
      errorMessage = errorData.message;
    }
    // 일반 에러 메시지 (detail)
    else if (errorData.detail) {
      errorMessage = errorData.detail;
    }
    // ValidationError (non_field_errors)
    else if (errorData.non_field_errors && Array.isArray(errorData.non_field_errors)) {
      errorMessage = errorData.non_field_errors[0];
    }
    // 필드별 에러 (첫 번째 필드의 첫 번째 에러 사용)
    else {
      const fieldNames = Object.keys(errorData);
      if (fieldNames.length > 0) {
        const firstField = fieldNames[0];
        const fieldErrors = errorData[firstField];
        if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
          errorMessage = `${firstField}: ${fieldErrors[0]}`;
        } else if (typeof fieldErrors === 'string') {
          errorMessage = `${firstField}: ${fieldErrors}`;
        }
      }
    }
    // 기타 에러 형식
    if (errorMessage === defaultMessage && typeof errorData === 'string') {
      errorMessage = errorData;
    }
  }

  const processedError = new Error(errorMessage);
  processedError.response = error.response;
  processedError.status = error.response?.status;
  processedError.data = errorData;
  return processedError;
};

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
    throw handleApiError(error, '게임 구역 목록을 불러올 수 없습니다.');
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
    throw handleApiError(error, '방 생성에 실패했습니다.');
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
    throw handleApiError(error, '방 목록을 불러올 수 없습니다.');
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
    throw handleApiError(error, '방 정보를 불러올 수 없습니다.');
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
    throw handleApiError(error, '내 방 정보를 불러올 수 없습니다.');
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
    throw handleApiError(error, '방 참가에 실패했습니다.');
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
    throw handleApiError(error, '방 나가기에 실패했습니다.');
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
    throw handleApiError(error, '팀 변경에 실패했습니다.');
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
    throw handleApiError(error, '방 시작에 실패했습니다.');
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
    throw handleApiError(error, '친구 초대에 실패했습니다.');
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
    throw handleApiError(error, '출석 현황을 불러올 수 없습니다.');
  }
};
