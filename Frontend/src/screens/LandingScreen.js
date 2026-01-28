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

  // 상단 오른쪽 육각형 클러스터 - 정밀 벌집 패턴 (Flat-topped 기준)
  const hexSize = 45; // 크기 증가
  // Flat-topped Geometry
  // Width = size * 2
  // Height = size * sqrt(3)
  // Horiz spacing = width * 0.75 = 1.5 * size
  // Vert spacing = height = size * sqrt(3)
  // Offset = height / 2

  const dx = hexSize * 1.05; // 거의 겹칠 정도로 밀착
  const dy = hexSize * 0.60; // 거의 겹칠 정도로 밀착

  // hexContainer 내부 기준 좌표
  const hexContainerWidth = width * 0.8; // 컨테이너도 조금 확장
  const hexContainerHeight = height * 0.4;

  const startX = hexContainerWidth * 0.15; // 중앙으로 미세 조정
  const startY = hexContainerHeight * 0.35;

  // 좌표 재구성 (Axial Q, R 유사 방식 적용)
  // (0,0) 기준: x += dx, y += dy (ZigZag)

  const hexagons = [
    // 1. 중앙 파란색 (Center)
    { x: startX, y: startY, color: '#003D7A' },

    // 2. 우측 상단 주황 (Top-Right)
    { x: startX + dx, y: startY - dy, color: '#FF6B35' },

    // 3. 우측 하단 파란색 (Bottom-Right)
    { x: startX + dx, y: startY + dy, color: '#003D7A' },

    // 4. 왼쪽 아래 주황 (Left-Bottom)
    { x: startX - dx, y: startY + dy, color: '#FF6B35' },

    // 5. 맨 우측 중간 주황
    { x: startX + dx * 2, y: startY, color: '#FF6B35' },

    // 6. 우측 하단 파란색 바로 아래 (이미지 요청 사항)
    { x: startX + dx, y: startY + dy * 3, color: '#FF6B35' },
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
            style={styles.ellipseButton}
            onPress={handleSignUp}
            activeOpacity={0.7}
          >
            <View style={styles.buttonBackground} />
            <Text style={styles.buttonText}>회원가입</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ellipseButton}
            onPress={handleLogin}
            activeOpacity={0.7}
          >
            <View style={styles.buttonBackground} />
            <Text style={styles.buttonText}>로그인</Text>
          </TouchableOpacity>

          {/* 테스트용 버튼 (동일한 타원형 스타일 적용) */}
          <TouchableOpacity
            style={styles.ellipseButton}
            onPress={() => navigation?.navigate('GameMain')}
            activeOpacity={0.7}
          >
            <View style={[styles.buttonBackground, { borderColor: '#FF6B35' }]} />
            <Text style={[styles.buttonText, { color: '#FF6B35', fontSize: 13 }]}>
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
    right: 20,
    width: width * 0.4,
    height: height * 0.22,
    zIndex: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: height * 0.2 + 85, // 한 번 더 내림
    marginBottom: 5,
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
    marginTop: 15, // 제목과의 간격 추가하여 전체적으로 내려오게 함
    marginBottom: height * 0.08,
  },
  tagline: {
    fontFamily: 'NanumPenScript', // 나눔손글씨 펜 적용
    fontSize: 32, // 손글씨체는 작아서 더 크게 키움
    color: '#003D7A', // 원래 파란색으로 복구
    marginTop: 5,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    marginTop: -20, // 위 문구와의 간격 조절
  },
  ellipseButton: {
    width: '100%',
    height: 80, // 배경이 늘어날 공간 확보
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: -5, // 타원형이라 위아래 공간이 많이 남으므로 좁힘
    backgroundColor: 'transparent',
  },
  buttonBackground: {
    position: 'absolute',
    width: 60,   // 원의 기본 지름
    height: 60,  // 원의 기본 지름
    borderWidth: 1.2, // 테두리를 조금 더 두껍게 조정
    borderColor: '#003D7A',
    borderRadius: 30, // 완벽한 원 (지름의 절반)
    backgroundColor: '#FFFFFF',
    // 원을 가로로 4.8배 늘려서 진짜 타원형 생성 (비율 미세 축소)
    transform: [{ scaleX: 4.8 }],
  },
  buttonText: {
    fontSize: 19,
    fontWeight: '600',
    color: '#003D7A',
    letterSpacing: 0.5,
    zIndex: 2, // 배경보다 위에 표시
  },
  button: {
    // 기존 스타일 유지 (테스트용)
    width: '70%',
    height: 48,
    borderWidth: 1,
    borderColor: '#003D7A',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
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
