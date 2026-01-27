import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// 육각형 컴포넌트
// 육각형 컴포넌트 (이미지 사용)
const Hexagon = ({ x, y, size, color }) => {
  const imageSource = color === '#003D7A'
    ? require('../../assets/icons/simple_hexagon.png')
    : require('../../assets/icons/simple_hexagon_orange.png');
  const imageSize = size * 2;

  return (
    <Image
      source={imageSource}
      style={{
        position: 'absolute',
        width: imageSize,
        height: imageSize,
        left: x - size,
        top: y - size,
        resizeMode: 'contain',
      }}
    />
  );
};

import { useAuth } from '../contexts/AuthContext';
// ... imports

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState(''); // Modified id -> username
  const [password, setPassword] = useState('');
  const { login } = useAuth();

  const handleClose = () => {
    if (navigation) {
      navigation.goBack();
    }
  };

  const handleCreateAccount = () => {
    if (navigation) {
      navigation.navigate('SignUp');
    }
  };

  const handleForgotPassword = () => {
    console.log('Forgot password 클릭');
    // TODO: 비밀번호 찾기 화면으로 이동
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('오류', '아이디와 비밀번호를 입력해주세요.');
      return;
    }

    const { success, error } = await login(username, password);
    if (success) {
      if (navigation) {
        // 스택 초기화 후 메인으로 이동 (뒤로가기 방지)
        navigation.reset({
          index: 0,
          routes: [{ name: 'GameMain' }],
        });
      }
    } else {
      Alert.alert('로그인 실패', error);
    }
  };

  // 오른쪽 육각형 그래픽 (파란색 3개, 주황색 4개)
  const hexSize = 28;
  const hexSpacing = hexSize * 1.732;
  const hexContainerWidth = width * 0.35;
  const hexContainerHeight = height * 0.4;
  const hexStartX = hexContainerWidth * 0.4;
  const hexStartY = hexContainerHeight * 0.3;

  const hexagons = [
    // 파란색 3개
    { x: hexStartX, y: hexStartY, color: '#003D7A' },
    { x: hexStartX + hexSpacing * 0.866, y: hexStartY - hexSpacing * 0.5, color: '#003D7A' },
    { x: hexStartX + hexSpacing * 0.866, y: hexStartY + hexSpacing * 0.5, color: '#003D7A' },

    // 주황색 4개
    { x: hexStartX - hexSpacing * 0.866, y: hexStartY, color: '#FF6B35' },
    { x: hexStartX + hexSpacing * 0.866 * 2, y: hexStartY, color: '#FF6B35' },
    { x: hexStartX + hexSpacing * 0.866, y: hexStartY - hexSpacing * 1.5, color: '#FF6B35' },
    { x: hexStartX + hexSpacing * 0.866, y: hexStartY + hexSpacing * 1.5, color: '#FF6B35' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* 파란색 테두리 프레임 */}
      <View style={styles.borderFrame}>
        {/* 왼쪽 상단 X 버튼 */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <View style={styles.closeIcon}>
            <Text style={styles.closeText}>✕</Text>
          </View>
        </TouchableOpacity>

        {/* 오른쪽 육각형 그래픽 */}
        <View style={styles.hexContainer}>
          <View style={{ width: hexContainerWidth, height: hexContainerHeight }}>
            {hexagons.map((hex, index) => (
              <Hexagon
                key={index}
                x={hex.x}
                y={hex.y}
                size={hexSize}
                color={hex.color}
              />
            ))}
          </View>
        </View>

        {/* 왼쪽 로그인 폼 */}
        <View style={styles.formContainer}>
          {/* Create Account 링크 */}
          <TouchableOpacity onPress={handleCreateAccount}>
            <Text style={styles.createAccountText}>
              NEW to Account? <Text style={styles.createAccountLink}>Create Account</Text>
            </Text>
          </TouchableOpacity>

          {/* ID 필드 */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>ID</Text>
            <TextInput
              style={styles.input}
              placeholder="ID"
              placeholderTextColor="#999999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Password 필드 */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Forgot password 링크 */}
          <TouchableOpacity onPress={handleForgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* 하단 오른쪽 Login 버튼 */}
        <View style={styles.loginButtonContainer}>
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <View style={styles.loginButtonContent}>
              <Text style={styles.loginButtonText}>Login</Text>
              <Text style={styles.loginButtonSubtext}>달려가기</Text>
            </View>
            <View style={styles.runningManContainer}>
              <Text style={styles.runningMan}>🏃</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  borderFrame: {
    width: width * 0.95,
    height: height * 0.9,
    borderWidth: 2,
    borderColor: '#003D7A',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  closeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#003D7A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  hexContainer: {
    position: 'absolute',
    top: height * 0.1,
    right: 30,
    width: width * 0.35,
    height: height * 0.4,
    zIndex: 1,
  },
  formContainer: {
    marginTop: 80,
    width: '55%',
    marginLeft: 20,
  },
  createAccountText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 30,
  },
  createAccountLink: {
    color: '#003D7A',
    fontWeight: '600',
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#003D7A',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  forgotPasswordText: {
    fontSize: 16,
    color: '#003D7A',
    fontWeight: '500',
    marginTop: 10,
  },
  loginButtonContainer: {
    position: 'absolute',
    bottom: 40,
    right: 30,
    alignItems: 'flex-end',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  loginButtonContent: {
    alignItems: 'flex-end',
    marginRight: 15,
  },
  loginButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#003D7A',
    marginBottom: 4,
  },
  loginButtonSubtext: {
    fontSize: 16,
    color: '#003D7A',
  },
  runningManContainer: {
    marginLeft: 10,
  },
  runningMan: {
    fontSize: 60,
  },
});
