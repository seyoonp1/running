import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenService } from '../services/api';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 앱 시작 시 저장된 토큰 확인
    const checkAuth = async () => {
      try {
        const token = await tokenService.getAccessToken();
        if (token) {
          // 토큰이 있으면 내 정보 조회 시도
          try {
            const response = await api.get('/auth/me/');
            setUser(response.data);
          } catch (e) {
            console.error('토큰 유효성 검사 실패:', e);
            // 토큰이 유효하지 않으면 삭제
            await tokenService.clearTokens();
          }
        }
      } catch (e) {
        console.error('인증 체크 실패:', e);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login/', { username, password });
      const { access, refresh, user: userData } = response.data;

      await tokenService.setTokens(access, refresh);
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('로그인 에러:', error);
      
      // 네트워크 에러 처리
      if (!error.response) {
        return {
          success: false,
          error: '네트워크 연결을 확인해주세요.'
        };
      }

      const errorData = error.response.data;
      let errorMessage = '로그인에 실패했습니다.';

      // Django REST Framework 에러 형식 처리
      if (errorData) {
        // 일반 에러 메시지
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
        // ValidationError (non_field_errors)
        else if (errorData.non_field_errors && Array.isArray(errorData.non_field_errors)) {
          errorMessage = errorData.non_field_errors[0];
        }
        // 필드별 에러 (username 또는 password)
        else if (errorData.username && Array.isArray(errorData.username)) {
          errorMessage = `사용자명: ${errorData.username[0]}`;
        }
        else if (errorData.password && Array.isArray(errorData.password)) {
          errorMessage = `비밀번호: ${errorData.password[0]}`;
        }
        // 기타 에러 형식
        else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
        else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const logout = async () => {
    try {
      await tokenService.clearTokens();
      setUser(null);
    } catch (error) {
      console.error('로그아웃 에러:', error);
    }
  };

  const register = async (username, email, password) => {
    try {
      await api.post('/auth/register/', { username, email, password });
      return { success: true };
    } catch (error) {
      console.error('회원가입 에러:', error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
