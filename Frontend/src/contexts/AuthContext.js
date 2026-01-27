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
      return {
        success: false,
        error: error.response?.data?.detail || '로그인에 실패했습니다.'
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
