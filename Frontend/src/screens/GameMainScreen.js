import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Svg, { Path, Circle, Polygon } from 'react-native-svg';
import { getRooms, getMyRoom } from '../services/roomService';

const { width, height } = Dimensions.get('window');

// 불규칙한 형태 아이콘 컴포넌트 (땅따먹기 형태)
const LandIcon = ({ size = 40 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* 왼쪽 형태 (연한 파란색으로 채워짐) */}
      <Path
        d="M 10 20 Q 15 10 20 15 Q 18 25 10 20 Z"
        fill="#9DB8D3"
        stroke="#003D7A"
        strokeWidth="1.5"
      />
      {/* 오른쪽 형태 (빈 형태) */}
      <Path
        d="M 20 15 Q 25 10 30 20 Q 25 25 20 20 Q 18 25 20 15 Z"
        fill="none"
        stroke="#003D7A"
        strokeWidth="1.5"
      />
    </Svg>
  );
};

// 진행 바 컴포넌트 (주황색 대각선 줄무늬)
const ProgressBar = ({ width: barWidth, height: barHeight, filled = true, color = '#FF6B35' }) => {
  if (!filled) {
    return (
      <View style={[styles.progressBar, { width: barWidth, height: barHeight, backgroundColor: '#9DB8D3' }]} />
    );
  }

  return (
    <Svg width={barWidth} height={barHeight}>
      {/* 주황색 배경 */}
      <Path
        d={`M 0 0 L ${barWidth} 0 L ${barWidth} ${barHeight} L 0 ${barHeight} Z`}
        fill={color}
      />
      {/* 대각선 줄무늬 */}
      {Array.from({ length: Math.ceil(barWidth / 8) }).map((_, i) => (
        <Path
          key={i}
          d={`M ${i * 8} 0 L ${(i + 1) * 8} ${barHeight} L ${i * 8} ${barHeight} Z`}
          fill="#FFFFFF"
          opacity="0.3"
        />
      ))}
    </Svg>
  );
};

// 재생 버튼 아이콘
const PlayButton = ({ size = 30, fill = '#003D7A' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Polygon
        points="10,8 10,22 22,15"
        fill={fill}
      />
    </Svg>
  );
};

export default function GameMainScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [myRoom, setMyRoom] = useState(null); // Add missing state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { getMyRoom } = require('../services/roomService'); // Import here if not imported at top, or ensure top import

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Run in parallel
      const [roomsData, myRoomData] = await Promise.all([
        getRooms({ status: 'ready' }),
        getMyRoom()
      ]);

      setRooms(roomsData.results || []);
      setMyRoom(myRoomData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateRoom = () => {
    navigation.navigate('CreateRoom');
  };

  const handleRoomPress = (roomId) => {
    navigation.navigate('RoomDetail', { roomId });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 파란색 테두리 프레임 */}
      <View style={styles.borderFrame}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* 상단 헤더 */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.navigate('RecordList')}>
                <Text style={styles.headerText}>내 기록 &gt;</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('RecordStats')}>
                <Text style={styles.headerText}>통계 &gt;</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('FriendList')}>
                <Text style={styles.headerText}>친구 &gt;</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Mailbox')}>
                <Text style={styles.headerText}>우편함 &gt;</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.navigationArrows}>
              <TouchableOpacity>
                <Text style={styles.arrow}>&lt;</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.arrow}>&gt;</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 메인 활동 카드 */}
          <View style={styles.mainCard}>
            {/* 왼쪽: 아이콘 */}
            <View style={styles.cardIconContainer}>
              <LandIcon size={50} />
            </View>

            {/* 오른쪽: 텍스트 정보 */}
            <View style={styles.cardTextContainer}>
              {myRoom ? (
                <>
                  <Text style={styles.cardDays} numberOfLines={1}>{myRoom.name}</Text>
                  <Text style={styles.cardTimes}>{myRoom.game_area?.name || '지역 정보 없음'}</Text>
                  <Text style={[
                    styles.cardStatus,
                    { color: myRoom.status === 'active' ? '#4CAF50' : '#FF5252', fontWeight: '600' }
                  ]}>
                    {myRoom.status === 'active' ? '● 게임 진행 중' : '○ 게임 준비 중'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardDays}>참가 중인 방이 없습니다</Text>
                  <Text style={styles.cardTimes}>새로운 방을 찾아보세요!</Text>
                </>
              )}
            </View>

            {/* 하단: 진행 정보 */}
            <View style={styles.cardBottom}>
              <View style={styles.cardBottomLeft}>
                <Text style={styles.runningIcon}>🏃</Text>
                <Text style={styles.runningNumber}>
                  {myRoom ? `${myRoom.current_participants || 0}명` : '-'}
                </Text>
              </View>
              <View style={styles.progressBarsContainer}>
                <ProgressBar width={60} height={12} filled={!!myRoom} color="#FF6B35" />
                <ProgressBar width={60} height={12} filled={false} />
              </View>
              <View style={styles.playButtonContainer}>
                <TouchableOpacity
                  onPress={() => {
                    if (myRoom) {
                      if (myRoom.status === 'active') {
                        navigation.navigate('GamePlay', { roomId: myRoom.id });
                      } else {
                        navigation.navigate('RoomDetail', { roomId: myRoom.id });
                      }
                    } else {
                      Alert.alert('알림', '현재 참가 중인 방이 없습니다.');
                    }
                  }}
                >
                  <PlayButton size={30} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 중간 섹션 */}
          <View style={styles.middleSection}>
            <TouchableOpacity style={styles.createRoomButton} onPress={handleCreateRoom}>
              <Text style={styles.createRoomText}>방 만들기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.joinRoomButton}
              onPress={() => navigation.navigate('JoinRoom')}
            >
              <Text style={styles.joinRoomText}>방 참가</Text>
            </TouchableOpacity>
            <View style={styles.roomListLabel}>
              <Text style={styles.roomListLabelText}>방 리스트</Text>
            </View>
          </View>

          {/* 방 리스트 (2x2 그리드) */}
          <View style={styles.roomList}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003D7A" />
              </View>
            ) : rooms.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>참가 가능한 방이 없습니다.</Text>
              </View>
            ) : (
              rooms.map((room) => (
                <TouchableOpacity
                  key={room.id}
                  style={styles.roomCard}
                  onPress={() => handleRoomPress(room.id)}
                >
                  <View style={styles.roomCardIcon}>
                    <LandIcon size={35} />
                  </View>
                  <Text style={styles.roomName} numberOfLines={1}>
                    {room.name}
                  </Text>
                  <Text style={styles.roomPlayerCount}>
                    {room.current_participants || 0}/{room.total_participants}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 15,
    flex: 1,
    flexWrap: 'wrap',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  navigationArrows: {
    flexDirection: 'row',
    gap: 15,
  },
  arrow: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003D7A',
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardIconContainer: {
    position: 'absolute',
    left: 15,
    top: 15,
  },
  cardTextContainer: {
    marginLeft: 70,
    marginBottom: 50,
  },
  cardDays: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  cardTimes: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  cardStatus: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cardBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runningIcon: {
    fontSize: 24,
    marginRight: 5,
  },
  runningNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#003D7A',
  },
  progressBarsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressBar: {
    borderRadius: 6,
  },
  playButtonContainer: {
    marginLeft: 10,
  },
  middleSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  createRoomButton: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003D7A',
    backgroundColor: '#FFFFFF',
  },
  createRoomText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  joinRoomButton: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#FFFFFF',
  },
  joinRoomText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
  },
  roomListLabel: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    marginLeft: 'auto',
  },
  roomListLabelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  roomList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  roomCard: {
    width: (width * 0.95 - 60) / 2 - 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roomCardIcon: {
    marginBottom: 10,
  },
  roomName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 5,
    textAlign: 'center',
    width: '100%',
  },
  roomPlayerCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003D7A',
  },
  loadingContainer: {
    width: '100%',
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    width: '100%',
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});
