import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// 육각형 컴포넌트 (이미지와 동일하게 - sharp edges, flat colors)
// 육각형 컴포넌트 (이미지 사용)
const Hexagon = ({ x, y, size, color }) => {
  // 색상에 따라 이미지 소스 결정
  // color prop이 파란색(#003D7A)이면 simple_hexagon.png
  // 그 외(주황색 등)이면 simple_hexagon_orange.png
  const imageSource = color === '#003D7A'
    ? require('../../assets/icons/simple_hexagon.png')
    : require('../../assets/icons/simple_hexagon_orange.png');

  // 이미지 크기는 size * 2 정도가 적당 (반지름 -> 지름)
  const imageSize = size * 2;

  return (
    <Image
      source={imageSource}
      style={{
        position: 'absolute',
        width: imageSize,
        height: imageSize,
        left: x - size, // 중심점 보정
        top: y - size,  // 중심점 보정
        resizeMode: 'contain',
      }}
    />
  );
};

export default function LandingScreen({ navigation }) {
  const handleSignUp = () => {
    if (navigation) {
      navigation.navigate('SignUp');
    }
  };

  const handleLogin = () => {
    if (navigation) {
      navigation.navigate('Login');
    }
  };

  // 상단 오른쪽 육각형 클러스터 (7개: 중앙 1개 파란색, 주변 6개 중 3개 파란색, 3개 주황색)
  // 이미지와 정확히 일치하도록 배치
  const hexSize = 30;
  const hexSpacing = hexSize * 1.732; // √3 정확한 값

  // hexContainer 내부 기준 좌표
  const hexContainerWidth = width * 0.35;
  const hexContainerHeight = height * 0.25;
  const hexClusterCenterX = hexContainerWidth * 0.65; // 컨테이너 내부 오른쪽
  const hexClusterCenterY = hexContainerHeight * 0.5; // 컨테이너 내부 중앙

  // 이미지 설명에 따르면: 왼쪽에 주황색, 중앙에 파란색들, 오른쪽에 주황색들
  const hexagons = [
    // 왼쪽: 주황색
    { x: hexClusterCenterX - hexSpacing * 0.866, y: hexClusterCenterY, color: '#FF6B35' },

    // 중앙: 파란색들
    { x: hexClusterCenterX, y: hexClusterCenterY, color: '#003D7A' }, // 중앙
    { x: hexClusterCenterX, y: hexClusterCenterY - hexSpacing, color: '#003D7A' }, // 위
    { x: hexClusterCenterX, y: hexClusterCenterY + hexSpacing, color: '#003D7A' }, // 아래

    // 오른쪽: 주황색들
    { x: hexClusterCenterX + hexSpacing * 0.866, y: hexClusterCenterY, color: '#FF6B35' },
    { x: hexClusterCenterX + hexSpacing * 0.866, y: hexClusterCenterY - hexSpacing * 0.5, color: '#FF6B35' },
    { x: hexClusterCenterX + hexSpacing * 0.866, y: hexClusterCenterY + hexSpacing * 0.5, color: '#FF6B35' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* 다크 블루 테두리 프레임 */}
      <View style={styles.borderFrame}>
        {/* 상단 오른쪽: 육각형 그래픽 (7개) */}
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

        {/* 중앙: 제목 "SPLAT RUN" */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>SPLAT</Text>
          <Text style={styles.title}>RUN</Text>
        </View>

        {/* 제목 아래: 태그라인 "재밌게 달려요" */}
        <View style={styles.taglineContainer}>
          <Text style={styles.tagline}>재밌게 달려요</Text>
        </View>

        {/* 하단: 버튼들 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSignUp}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>회원가입</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>로그인</Text>
          </TouchableOpacity>

          {/* 테스트용: GameMain으로 바로 이동 */}
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={() => navigation?.navigate('GameMain')}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, styles.testButtonText]}>
              🧪 테스트: 게임 메인
            </Text>
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
    borderColor: '#003D7A', // 파란색 테두리
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hexContainer: {
    position: 'absolute',
    top: 30,
    right: 30,
    width: width * 0.35,
    height: height * 0.25,
    zIndex: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: height * 0.2,
    marginBottom: 10,
  },
  title: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#003D7A', // 파란색
    letterSpacing: 2,
    lineHeight: 70,
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: height * 0.1,
  },
  tagline: {
    fontSize: 20,
    color: '#003D7A', // 파란색
    fontWeight: '400',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  button: {
    width: '70%',
    height: 52,
    borderWidth: 2,
    borderColor: '#003D7A', // 파란색 테두리
    backgroundColor: '#FFFFFF',
    borderRadius: 100, // 완전한 타원형 (Capsule shape)
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#003D7A', // 파란색 텍스트
  },
  testButton: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    marginTop: 10,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
