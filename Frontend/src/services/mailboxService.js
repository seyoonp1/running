import api from './api';
import { mockApi } from './mockData';

// Mock 모드 활성화 여부
const USE_MOCK = false;

/**
 * 우편함 목록 조회
 * GET /api/mailbox/
 */
export const getMailbox = async (params = {}) => {
  console.log('🟣 getMailbox 호출됨', { params, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.getMailbox(params);
    console.log('✅ getMailbox 결과:', result);
    return result;
  }
  
  try {
    const response = await api.get('/mailbox/', { params });
    return response.data;
  } catch (error) {
    console.error('우편함 목록 조회 실패:', error);
    // 에러 처리 개선
    if (!error.response) {
      const networkError = new Error('네트워크 연결을 확인해주세요.');
      networkError.isNetworkError = true;
      throw networkError;
    }
    const errorData = error.response.data;
    let errorMessage = '우편함 목록을 불러올 수 없습니다.';
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
 * 우편 수락/거절 (친구 요청 및 방 초대 통합)
 * POST /api/mailbox/{id}/respond/
 */
export const respondToMail = async (mailId, accept) => {
  console.log('🟠 respondToMail 호출됨', { mailId, accept, USE_MOCK });
  if (USE_MOCK) {
    const result = await mockApi.respondToMail(mailId, accept);
    console.log('✅ respondToMail 결과:', result);
    return result;
  }
  
  try {
    const response = await api.post(`/mailbox/${mailId}/respond/`, { accept });
    return response.data;
  } catch (error) {
    console.error('우편 응답 실패:', error);
    // 에러 처리 개선
    if (!error.response) {
      const networkError = new Error('네트워크 연결을 확인해주세요.');
      networkError.isNetworkError = true;
      throw networkError;
    }
    const errorData = error.response.data;
    let errorMessage = '우편 처리에 실패했습니다.';
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
