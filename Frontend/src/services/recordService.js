import api from './api';
import { mockApi } from './mockData';

// Mock 모드 활성화 여부
const USE_MOCK = false;

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
    const response = await api.post('/records/start/', roomId ? { room_id: roomId } : {});
    return response.data;
  } catch (error) {
    console.error('기록 시작 실패:', error);
    // 에러 처리 개선
    if (!error.response) {
      const networkError = new Error('네트워크 연결을 확인해주세요.');
      networkError.isNetworkError = true;
      throw networkError;
    }
    const errorData = error.response.data;
    let errorMessage = '기록 시작에 실패했습니다.';
    if (errorData?.message) {
      errorMessage = errorData.message;
    } else if (errorData?.detail) {
      errorMessage = errorData.detail;
    }
    const processedError = new Error(errorMessage);
    processedError.response = error.response;
    throw processedError;
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
    // 에러 처리 개선
    if (!error.response) {
      const networkError = new Error('네트워크 연결을 확인해주세요.');
      networkError.isNetworkError = true;
      throw networkError;
    }
    const errorData = error.response.data;
    let errorMessage = '기록 종료에 실패했습니다.';
    if (errorData?.message) {
      errorMessage = errorData.message;
    } else if (errorData?.detail) {
      errorMessage = errorData.detail;
    }
    const processedError = new Error(errorMessage);
    processedError.response = error.response;
    throw processedError;
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
    // 백엔드 응답 형식: { results: [...] } 또는 페이지네이션 형식
    return response.data;
  } catch (error) {
    console.error('기록 목록 조회 실패:', error);
    // 에러 처리 개선
    if (!error.response) {
      const networkError = new Error('네트워크 연결을 확인해주세요.');
      networkError.isNetworkError = true;
      throw networkError;
    }
    const errorData = error.response.data;
    let errorMessage = '기록 목록을 불러올 수 없습니다.';
    if (errorData?.message) {
      errorMessage = errorData.message;
    } else if (errorData?.detail) {
      errorMessage = errorData.detail;
    }
    const processedError = new Error(errorMessage);
    processedError.response = error.response;
    throw processedError;
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
    // 에러 처리 개선
    if (!error.response) {
      const networkError = new Error('네트워크 연결을 확인해주세요.');
      networkError.isNetworkError = true;
      throw networkError;
    }
    const errorData = error.response.data;
    let errorMessage = '기록 통계를 불러올 수 없습니다.';
    if (errorData?.message) {
      errorMessage = errorData.message;
    } else if (errorData?.detail) {
      errorMessage = errorData.detail;
    }
    const processedError = new Error(errorMessage);
    processedError.response = error.response;
    throw processedError;
  }
};
