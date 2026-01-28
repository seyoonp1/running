import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, Polygon } from 'react-native-svg';
import { getRooms, getMyRoom, getRoomDetail, joinRoom } from '../services/roomService';
import { useAuth } from '../contexts/AuthContext';
import simpleHexagon from '../../assets/icons/simple_hexagon.png';
import simpleHexagonOrange from '../../assets/icons/simple_hexagon_orange.png';

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
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [myRoom, setMyRoom] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  // 팀별 점수 계산 함수
  const calculateTeamScores = (hexOwnerships) => {
    if (!hexOwnerships || typeof hexOwnerships !== 'object') {
      return { teamA: 0, teamB: 0 };
    }

    let teamA = 0;
    let teamB = 0;

    // current_hex_ownerships는 { h3Id: { team: 'A' or 'B', ... } } 형태
    Object.values(hexOwnerships).forEach((hexData) => {
      const team = hexData?.team;
      if (team === 'A') {
        teamA++;
      } else if (team === 'B') {
        teamB++;
      }
    });

    return { teamA, teamB };
  };

  // 날짜 포맷팅 헬퍼 (메인 카드용 - 년도 포함)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  // 날짜 포맷팅 헬퍼 (방 리스트용 - 년도 제외)
  const formatDateShort = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  };

  // 카운트다운 효과
  useEffect(() => {
    if (!myRoom || !myRoom.start_date) {
      setTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const startDate = new Date(myRoom.start_date);
      const diff = startDate - now;

      if (diff > 0) {
        // 밀리초 단위를 초 단위로 변환
        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / (3600 * 24));
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let timeString = '';
        if (days > 0) timeString += `${days}일 `;
        if (hours > 0) timeString += `${hours}시간 `;
        if (minutes > 0) timeString += `${minutes}분 `;
        timeString += `${seconds}초 남음`;

        setTimeLeft(timeString);
      } else {
        // 시간이 지났을 때
        if (myRoom.status === 'active') {
          setTimeLeft(''); // 이미 active 상태고 시간도 지났으면 표시하지 않음
        } else {
          setTimeLeft('곧 시작됩니다!'); // ready 상태지만 시간이 지났다면
        }
      }
    };

    updateTimer(); // 즉시 실행
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [myRoom]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState(null);


  const loadData = async () => {
    try {
      setLoading(true);
      // Run in parallel
      const [roomsData, myRoomData] = await Promise.all([
        getRooms({ status: 'ready' }),
        getMyRoom()
      ]);

      // 백엔드 응답 형식: { results: [...], count: ... } 또는 [...]
      const roomsList = Array.isArray(roomsData) 
        ? roomsData 
        : (roomsData?.results || []);
      
      setRooms(roomsList);
      
      // getMyRoom은 null 또는 room 객체 반환
      setMyRoom(myRoomData || null);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      Alert.alert(
        '오류', 
        error.response?.data?.detail || error.message || '데이터를 불러오는데 실패했습니다.'
      );
      setRooms([]);
      setMyRoom(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateRoom = () => {
    navigation.navigate('CreateRoom');
  };

  const handleRoomPress = async (roomId) => {
    // 이미 참가 중인 방이면 바로 상세 화면으로 이동
    if (myRoom && myRoom.id === roomId) {
      navigation.navigate('RoomDetail', { roomId });
      return;
    }

    try {
      setJoiningRoomId(roomId);
      // 방 상세 정보를 먼저 가져와서 invite_code 확인
      const roomData = await getRoomDetail(roomId);

      // 방 상태 확인
      if (roomData.status !== 'ready') {
        Alert.alert('알림', '준비 중인 방만 참가할 수 있습니다.');
        return;
      }

      // 정원 확인
      if (roomData.current_participants >= roomData.total_participants) {
        Alert.alert('알림', '방 정원이 가득 찼습니다.');
        return;
      }

      // 참가 확인 다이얼로그
      Alert.alert(
        '방 참가',
        `"${roomData.name}" 방에 참가하시겠습니까?`,
        [
          {
            text: '취소',
            style: 'cancel',
            onPress: () => setJoiningRoomId(null),
          },
          {
            text: '참가',
            onPress: async () => {
              try {
                // 이미 참가 중인 방이 있는지 확인
                if (myRoom) {
                  Alert.alert(
                    '알림',
                    `이미 "${myRoom.name}" 방에 참가 중입니다.\n다른 방에 참가하려면 먼저 현재 방에서 나가주세요.`,
                    [{ text: '확인' }]
                  );
                  setJoiningRoomId(null);
                  return;
                }

                // invite_code로 방 참가
                const result = await joinRoom(roomData.invite_code);
                
                Alert.alert('성공', result.message || '방에 참가했습니다.', [
                  {
                    text: '확인',
                    onPress: () => {
                      // 방 상세 화면으로 이동
                      navigation.navigate('RoomDetail', { roomId });
                      // 데이터 새로고침
                      loadData();
                    },
                  },
                ]);
              } catch (error) {
                const errorMessage = error.message || '방 참가에 실패했습니다.';
                Alert.alert('오류', errorMessage);
              } finally {
                setJoiningRoomId(null);
              }
            },
          },
        ],
        { cancelable: true, onDismiss: () => setJoiningRoomId(null) }
      );
    } catch (error) {
      const errorMessage = error.message || '방 정보를 불러올 수 없습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setJoiningRoomId(null);
    }
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
              {/* 프로필 버튼 (사이드 메뉴 열기) */}
              <TouchableOpacity onPress={() => setIsMenuOpen(true)}>
                <View style={styles.profileIconContainer}>
                  {/* 임시 프로필 이미지 또는 아이콘 */}
                  <Text style={styles.profileIconText}>👤</Text>
                </View>
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
                  <Text style={styles.cardDays} numberOfLines={1}>{myRoom.name || '방 이름 없음'}</Text>
                  <Text style={styles.cardTimes}>
                    {myRoom.game_area?.name || '지역 정보 없음'}
                  </Text>
                  <View style={styles.cardDatesContainer}>
                    <Text style={styles.cardDates}>
                      <Text style={styles.roomDateLabel}>시작일: </Text>
                      {myRoom.start_date ? formatDateShort(myRoom.start_date) : ''}
                    </Text>
                    <Text style={styles.cardDates}>
                      <Text style={styles.roomDateLabel}>종료일: </Text>
                      {myRoom.end_date ? formatDateShort(myRoom.end_date) : ''}
                    </Text>
                  </View>
                  <Text style={[
                    styles.cardStatus,
                    { color: myRoom.status === 'active' ? '#4CAF50' : '#FF5252', fontWeight: '600' }
                  ]}>
                    {myRoom.status === 'active' ? '● 게임 진행 중' : myRoom.status === 'ready' ? '○ 게임 준비 중' : '● 게임 종료'}
                  </Text>
                  {timeLeft ? (
                    <Text style={styles.countdownText}>
                      (시작까지 {timeLeft})
                    </Text>
                  ) : null}
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
                  {myRoom ? `${myRoom.current_participants ?? 0}명` : '-'}
                </Text>
              </View>
              <View style={styles.progressBarsContainer}>
                {(() => {
                  // 팀별 점수 계산
                  const { teamA, teamB } = myRoom && myRoom.status === 'active' && myRoom.current_hex_ownerships
                    ? calculateTeamScores(myRoom.current_hex_ownerships)
                    : { teamA: 0, teamB: 0 };
                  
                  // 내 팀 확인
                  const myTeam = myRoom?.my_participant?.team;
                  const isTeamA = myTeam === 'A';
                  
                  return (
                    <>
                      <View style={styles.hexagonContainer}>
                        <Image
                          source={isTeamA ? simpleHexagonOrange : simpleHexagon}
                          style={styles.hexagonIcon}
                          resizeMode="contain"
                        />
                        <Text style={styles.hexagonText}>
                          {myRoom && myRoom.status === 'active' ? teamA : 0}
                        </Text>
                      </View>
                      <View style={styles.hexagonContainer}>
                        <Image
                          source={isTeamA ? simpleHexagon : simpleHexagonOrange}
                          style={styles.hexagonIcon}
                          resizeMode="contain"
                        />
                        <Text style={styles.hexagonText}>
                          {myRoom && myRoom.status === 'active' ? teamB : 0}
                        </Text>
                      </View>
                    </>
                  );
                })()}
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
                  <PlayButton size={30} fill={myRoom?.status === 'ready' ? '#FF5252' : '#4CAF50'} />
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
                  style={[
                    styles.roomCard,
                    joiningRoomId === room.id && styles.roomCardLoading
                  ]}
                  onPress={() => handleRoomPress(room.id)}
                  disabled={joiningRoomId === room.id}
                >
                  {joiningRoomId === room.id ? (
                    <ActivityIndicator size="small" color="#003D7A" />
                  ) : (
                    <>
                      <View style={styles.roomCardIcon}>
                        <LandIcon size={35} />
                      </View>
                      <Text style={styles.roomName} numberOfLines={1}>
                        {room.name}
                      </Text>
                      <Text style={styles.roomPlayerCount}>
                        {room.current_participants || 0}/{room.total_participants}
                      </Text>
                      {room.start_date && room.end_date && (
                        <View style={styles.roomDateContainer}>
                          <View style={styles.roomDateRow}>
                            <Text style={styles.roomDateLabel}>시작일: </Text>
                            <Text style={styles.roomDateValue}>{formatDateShort(room.start_date)}</Text>
                          </View>
                          <View style={styles.roomDateRow}>
                            <Text style={styles.roomDateLabel}>종료일: </Text>
                            <Text style={styles.roomDateValue}>{formatDateShort(room.end_date)}</Text>
                          </View>
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      {/* 사이드 메뉴 (슬라이드 모달) */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={styles.modalOverlay}>
          {/* 배경 누르면 닫기 */}
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setIsMenuOpen(false)}
          />

          {/* 메뉴 컨텐츠 */}
          <View style={styles.sideMenu}>
            {/* 메뉴 헤더: 프로필 정보 */}
            <View style={styles.menuHeader}>
              <View style={styles.bigProfileIcon}>
                <Text style={styles.bigProfileIconText}>👤</Text>
              </View>
              <Text style={styles.menuUsername}>{user?.username || '게스트'}</Text>
              <Text style={styles.menuLevel}>
                레이팅: {user?.rating || 1000}점
              </Text>
            </View>

            {/* 메뉴 리스트 */}
            <View style={styles.menuItems}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); navigation.navigate('RecordList'); }}>
                <Text style={styles.menuItemIcon}>📊</Text>
                <Text style={styles.menuItemText}>내 기록</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); navigation.navigate('RecordStats'); }}>
                <Text style={styles.menuItemIcon}>📈</Text>
                <Text style={styles.menuItemText}>통계</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); navigation.navigate('FriendList'); }}>
                <Text style={styles.menuItemIcon}>👥</Text>
                <Text style={styles.menuItemText}>친구</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); navigation.navigate('Mailbox'); }}>
                <Text style={styles.menuItemIcon}>📬</Text>
                <Text style={styles.menuItemText}>우편함</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  cardDatesContainer: {
    marginTop: 4,
  },
  cardDates: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    marginBottom: 4,
  },
  cardStatus: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
    marginBottom: 4,
  },
  countdownText: {
    fontSize: 14,
    color: '#FF5252',
    marginTop: 2,
    marginBottom: 0,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
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
    alignItems: 'center',
  },
  hexagonContainer: {
    position: 'relative',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hexagonIcon: {
    width: 50,
    height: 50,
    position: 'absolute',
  },
  hexagonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    zIndex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
    justifyContent: 'center',
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roomCardLoading: {
    opacity: 0.6,
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
    marginBottom: 8,
  },
  roomDateContainer: {
    width: '100%',
    marginTop: 6,
    alignItems: 'center',
  },
  roomDateText: {
    fontSize: 12,
    color: '#000000',
  },
  roomDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  roomDateLabel: {
    fontSize: 10,
    color: '#666666',
  },
  roomDateValue: {
    fontSize: 10,
    color: '#000000',
    fontWeight: '500',
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
  // 프로필 아이콘 스타일
  profileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#003D7A',
  },
  profileIconText: {
    fontSize: 24,
  },
  // 사이드 메뉴 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  modalBackground: {
    flex: 1,
  },
  sideMenu: {
    width: width * 0.7, // 화면의 70% 차지
    backgroundColor: '#FFFFFF',
    height: '100%',
    padding: 20,
    paddingTop: 50,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'absolute', // 왼쪽 고정
    left: 0,
    top: 0,
    bottom: 0,
  },
  menuHeader: {
    alignItems: 'center',
    marginBottom: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  bigProfileIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#003D7A',
  },
  bigProfileIconText: {
    fontSize: 40,
  },
  menuUsername: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5,
  },
  menuLevel: {
    fontSize: 14,
    color: '#666666',
  },
  menuItems: {
    gap: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 15,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
});
