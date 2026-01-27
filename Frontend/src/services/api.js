import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API 기본 URL
// 프로덕션 서버: http://44.196.254.97
const API_BASE_URL = __DEV__ 
  ? 'http://44.196.254.97/api'  // 개발 환경에서도 프로덕션 서버 사용
  : 'http://44.196.254.97/api';  // 프로덕션 서버

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 토큰 저장 키
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// 토큰 관리 함수
export const tokenService = {
  // 토큰 저장
  async setTokens(accessToken, refreshToken) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },

  // Access 토큰 가져오기
  async getAccessToken() {
    return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  },

  // Refresh 토큰 가져오기
  async getRefreshToken() {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },

  // 토큰 삭제
  async clearTokens() {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// 요청 인터셉터: 토큰 자동 추가
api.interceptors.request.use(
  async (config) => {
    const token = await tokenService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터: 토큰 만료 시 자동 갱신
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401 에러이고 아직 재시도하지 않은 경우
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await tokenService.getRefreshToken();
        if (!refreshToken) {
          // Refresh 토큰이 없으면 로그아웃 처리
          await tokenService.clearTokens();
          throw new Error('No refresh token');
        }

        // 토큰 갱신 요청
        const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        await tokenService.setTokens(access, refreshToken);

        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // 토큰 갱신 실패 시 로그아웃 처리
        await tokenService.clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
