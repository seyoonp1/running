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
// strokeOnly는 이미지로 처리하기 어려우므로 일반 파란색 육각형 사용 (추후 필요시 스트로크 이미지 추가)
const Hexagon = ({ x, y, size, color, strokeOnly = false }) => {
  const imageSource = color === '#003D7A'
    ? require('../../assets/icons/simple_hexagon.png')
    : require('../../assets/icons/simple_hexagon_orange.png');
  const imageSize = size * 2;

  // strokeOnly인 경우 투명도를 조절하거나 다른 방식으로 처리 (여기서는 일단 그대로 표시)
  const opacity = strokeOnly ? 0.3 : 1;

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
        opacity: opacity,
      }}
    />
  );
};

import { useAuth } from '../contexts/AuthContext';
// ...

export default function SignUpScreen({ navigation }) {
  const [username, setUsername] = useState(''); // Modified id -> username
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const { register } = useAuth();

  const handleClose = () => {
    if (navigation) {
      navigation.goBack();
    }
  };

  const handleJoin = async () => {
    if (!username || !password || !email) {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    const { success, error } = await register(username, email, password);
    if (success) {
      Alert.alert('가입 성공', '회원가입이 완료되었습니다. 로그인해주세요.', [
        {
          text: '확인',
          onPress: () => navigation.navigate('Login'),
        },
      ]);
    } else {
      Alert.alert('가입 실패', JSON.stringify(error));
    }
  };

  const handleLogin = () => {
    if (navigation) {
      navigation.navigate('Login');
    }
  };

  // 오른쪽 육각형 그래픽 (주황색 3개, 파란색 2개, 파란색 테두리 1개)
  const hexSize = 28;
  const hexSpacing = hexSize * 1.732;
  const hexContainerWidth = width * 0.3;
  const hexContainerHeight = height * 0.4;
  const hexStartX = hexContainerWidth * 0.3;
  const hexStartY = hexContainerHeight * 0.2;

  const hexagons = [
    // 주황색 3개
    { x: hexStartX, y: hexStartY, color: '#FF6B35' },
    { x: hexStartX + hexSpacing * 0.866, y: hexStartY + hexSpacing * 0.5, color: '#FF6B35' },
    { x: hexStartX + hexSpacing * 0.866 * 2, y: hexStartY + hexSpacing, color: '#FF6B35' },

    // 파란색 2개
    { x: hexStartX + hexSpacing * 0.866, y: hexStartY - hexSpacing * 0.5, color: '#003D7A' },
    { x: hexStartX + hexSpacing * 0.866 * 2, y: hexStartY + hexSpacing * 0.5, color: '#003D7A' },

    // 파란색 테두리만 1개
    { x: hexStartX + hexSpacing * 0.866 * 2, y: hexStartY - hexSpacing * 0.5, color: '#003D7A', strokeOnly: true },
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

        {/* 입력 필드들 */}
        <View style={styles.inputContainer}>
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

          {/* Email 필드 */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Verification Code 필드 */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Verification Code"
              placeholderTextColor="#999999"
              value={verificationCode}
              onChangeText={setVerificationCode}
            />
          </View>
        </View>

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
                strokeOnly={hex.strokeOnly}
              />
            ))}
          </View>
        </View>

        {/* Join 버튼 */}
        <View style={styles.joinButtonContainer}>
          <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
            <Text style={styles.joinButtonText}>Join</Text>
            <Text style={styles.joinButtonSubtext}>땅따먹으러 가기</Text>
          </TouchableOpacity>
          {/* 달리는 사람 실루엣 (오른쪽에 위치) */}
          <View style={styles.runningManContainer}>
            <Text style={styles.runningMan}>🏃</Text>
          </View>
        </View>

        {/* Log In 링크 */}
        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginLinkText}>
            Already have an account?{' '}
            <Text style={styles.loginLink} onPress={handleLogin}>
              Log In
            </Text>
          </Text>
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
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  closeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  inputContainer: {
    marginTop: 60,
    width: '60%',
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
  hexContainer: {
    position: 'absolute',
    top: height * 0.15,
    right: 30,
    width: width * 0.3,
    height: height * 0.4,
    zIndex: 1,
  },
  joinButtonContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinButton: {
    flex: 1,
    height: 70,
    backgroundColor: '#003D7A',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  joinButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  joinButtonSubtext: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  runningManContainer: {
    position: 'absolute',
    right: 20,
    top: -10,
  },
  runningMan: {
    fontSize: 50,
  },
  loginLinkContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 16,
    color: '#000000',
  },
  loginLink: {
    color: '#003D7A',
    fontWeight: '600',
  },
});
