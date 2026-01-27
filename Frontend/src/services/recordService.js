import api from './api';
import { mockApi } from './mockData';

// Mock 모드 활성화 여부
const USE_MOCK = true;

/**
 * 기록 시작
 * POST /api/records/start/
 */
export const startRecord = async (roomId = null) => {
  console.log('🟢 startRecord 호출됨', { roomId, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.startRecord(roomId);
    console.log('✅ startRecord 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post('/records/start/', { room_id: roomId });
    return response.data;
  } catch (error) {
    console.error('기록 시작 실패:', error);
    throw error;
  }
};

/**
 * 기록 종료
 * POST /api/records/{id}/stop/
 */
export const stopRecord = async (recordId) => {
  console.log('🔴 stopRecord 호출됨', { recordId, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.stopRecord(recordId);
    console.log('✅ stopRecord 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post(`/records/${recordId}/stop/`, {});
    return response.data;
  } catch (error) {
    console.error('기록 종료 실패:', error);
    throw error;
  }
};

/**
 * 내 기록 목록 조회
 * GET /api/records/
 */
export const getRecords = async (params = {}) => {
  console.log('🟡 getRecords 호출됨', { params, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getRecords(params);
    console.log('✅ getRecords 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get('/records/', { params });
    return response.data;
  } catch (error) {
    console.error('기록 목록 조회 실패:', error);
    throw error;
  }
};

/**
 * 기록 통계 조회
 * GET /api/records/stats/
 */
export const getRecordStats = async (period = null) => {
  console.log('🔵 getRecordStats 호출됨', { period, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getRecordStats(period);
    console.log('✅ getRecordStats 결과:', result);
    return result;
  }
  
  try {
    const params = period ? { period } : {};
    const response = await api.get('/records/stats/', { params });
    return response.data;
  } catch (error) {
    console.error('기록 통계 조회 실패:', error);
    throw error;
  }
};
