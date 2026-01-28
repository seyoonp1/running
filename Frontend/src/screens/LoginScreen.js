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

  // 오른쪽 육각형 그래픽 (LandingScreen의 클러스터 패턴 복사)
  const hexSize = 45; // 52.5에서 45로 조절
  const dx = hexSize * 1.05;
  const dy = hexSize * 0.60;

  const hexContainerWidth = width * 0.4;
  const hexContainerHeight = height * 0.35;
  const hexStartX = hexContainerWidth * 0.5; // 우상단 배치를 위해 상향 조정
  const hexStartY = hexContainerHeight * 0.35;

  const hexagons = [
    { x: hexStartX, y: hexStartY, color: '#003D7A' }, // 중앙 파란색
    { x: hexStartX + dx, y: hexStartY - dy, color: '#FF6B35' }, // 우상 주황
    { x: hexStartX + dx, y: hexStartY + dy, color: '#003D7A' }, // 우하 파란색
    { x: hexStartX - dx, y: hexStartY + dy, color: '#FF6B35' }, // 좌하 주황
    { x: hexStartX + dx * 2, y: hexStartY, color: '#FF6B35' }, // 맨 우측 주황
    { x: hexStartX + dx, y: hexStartY + dy * 3, color: '#FF6B35' }, // 맨 아래 주황
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

        {/* 배경 육각형 그래픽 (먼저 렌더링하여 뒤에 깔기) */}
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

        {/* 하단 오른쪽 Login 버튼 영역 */}
        <View style={styles.loginButtonContainer}>
          {/* 달리는 사람 아이콘 (우측 하단 배경) */}
          <View style={styles.runningManContainer}>
            <Image
              source={require('../../assets/icons/runningman.png')}
              style={styles.runningManImage}
            />
          </View>

          {/* 로그인 버튼 문구 (아이콘의 왼쪽 하단에 배치하도록 절대 좌표 설정) */}
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <View style={styles.loginButtonContent}>
              <Text style={styles.loginButtonText}>Login</Text>
              <Text style={styles.loginButtonSubtext}>달리러가기</Text>
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
    top: height * 0.15, // 0.08에서 0.15로 하향 조정
    right: 35, // 25에서 10만큼 더 왼쪽으로 이동 (35)
    width: width * 0.45,
    height: height * 0.4,
    zIndex: 0, // 배경으로 배치
  },
  formContainer: {
    marginTop: 325, // 310에서 15만큼 더 하향 조정
    width: '80%', // 55%에서 80%로 늘려 텍스트 줄바꿈 방지
    marginLeft: 0, // 10에서 10만큼 더 왼쪽으로 이동 (0)
  },
  createAccountText: {
    fontSize: 14, // 16에서 14로 축소
    color: '#000000',
    marginTop: 20, // 25에서 5만큼 더 위로 조정 (20)
    marginBottom: 0, // ID/Password 창이 밀려나지 않도록 간격 제거
    marginLeft: 5, // 오른쪽으로 10 더 이동 (-5 -> 5)
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
    marginLeft: 5, // 오른쪽으로 10 더 이동 (-5 -> 5)
  },
  input: {
    height: 50,
    borderWidth: 2, // 두께를 1에서 2로 늘림
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
    marginLeft: 5, // 10에서 5만큼 왼쪽으로 이동 (다른 글씨들과 정렬 맞춤)
  },
  loginButtonContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '100%',
    height: 600, // 아이콘이 위로 올라갔으므로 영역 확장
  },
  loginButton: {
    position: 'absolute',
    right: 60, // 아이콘의 아래쪽 중앙 부근에 오도록 조정
    bottom: 20, // 아이콘보다 아래에 배치
    zIndex: 10,
  },
  loginButtonContent: {
    alignItems: 'center', // 아이콘 아래에서 중앙 정렬
  },
  loginButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#003D7A',
    marginBottom: 4,
    right: 20, // 5에서 15만큼 더 왼쪽으로 이동 (20)
  },
  loginButtonSubtext: {
    fontFamily: 'NanumPenScript',
    fontSize: 22, // 나눔손글씨 적용 및 크기 최적화
    color: '#003D7A',
  },
  runningManContainer: {
    position: 'absolute',
    right: -105, // -120에서 15만큼 더 왼쪽으로 이동 (-105)
    bottom: -50, // -55에서 5만큼 위로 이동 (-50)
    zIndex: -1,
  },
  runningManImage: {
    width: 360, // 480에서 1/4(120)을 줄여 360으로 조절
    height: 360,
    resizeMode: 'contain',
    tintColor: '#003D7A',
  },
});
