import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  getRoomDetail,
  leaveRoom,
  changeTeam,
  startRoom,
  inviteFriend,
  getAttendance,
} from '../services/roomService';
import { getFriends } from '../services/friendService';

import { useAuth } from '../contexts/AuthContext';

export default function RoomDetailScreen({ navigation, route }) {
  const { roomId } = route.params;
  const { user } = useAuth(); // AuthContext에서 user 가져오기
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showTeamChange, setShowTeamChange] = useState(false);
  const [showInviteFriend, setShowInviteFriend] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);

  // 현재 사용자가 방장인지 확인
  // 1. room.my_participant (백엔드에서 명시적으로 준 내 정보)
  // 2. user.id로 찾기 (AuthContext 정보와 매칭)
  // 3. (Mock용 Fallback) 방장 또는 첫 번째 참가자
  const myParticipant =
    room?.my_participant ||
    room?.participants?.find((p) => p.user?.id === user?.id) ||
    room?.participants?.find((p) => p.is_host); // Mock 테스트용 최후의 수단

  const isHost = myParticipant?.is_host || false;
  const myTeam = myParticipant?.team;

  useEffect(() => {
    loadRoomDetail();
  }, [roomId]);

  const loadRoomDetail = async () => {
    try {
      setLoading(true);
      const roomData = await getRoomDetail(roomId);
      setRoom(roomData);
    } catch (error) {
      // roomService에서 이미 처리된 에러 메시지 사용
      const errorMessage = error.message || '방 정보를 불러올 수 없습니다.';
      Alert.alert('오류', errorMessage);
      console.error(error);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  };

  const handleLeaveRoom = async () => {
    Alert.alert('확인', '정말 방에서 나가시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading(true);
            await leaveRoom(roomId);
            Alert.alert('성공', '방에서 나갔습니다.', [
              { text: '확인', onPress: () => navigation.goBack() },
            ]);
          } catch (error) {
            Alert.alert('오류', error.message || '방 나가기에 실패했습니다.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleChangeTeam = async (newTeam) => {
    if (newTeam === myTeam) {
      Alert.alert('알림', '이미 해당 팀에 속해있습니다.');
      return;
    }

    try {
      setActionLoading(true);
      await changeTeam(roomId, newTeam);
      Alert.alert('성공', '팀을 변경했습니다.');
      setShowTeamChange(false);
      loadRoomDetail(); // 방 정보 다시 로드
    } catch (error) {
      Alert.alert('오류', error.message || '팀 변경에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRoom = async () => {
    // 인원 체크: 최소 2명 이상, 짝수 인원이어야 함
    if (room.current_participants < 2) {
      Alert.alert('알림', '최소 2명의 참가자가 필요합니다.');
      return;
    }
    if (room.current_participants % 2 !== 0) {
      Alert.alert('알림', '참가자 수는 짝수여야 합니다.');
      return;
    }

    Alert.alert('확인', '게임을 시작하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '시작',
        onPress: async () => {
          try {
            setActionLoading(true);
            await startRoom(roomId);
            Alert.alert('성공', '게임이 시작되었습니다.', [
              {
                text: '확인',
                onPress: () => {
                  // 게임 화면으로 이동
                  navigation.replace('GamePlay', { roomId });
                }
              }
            ]);
          } catch (error) {
            Alert.alert('오류', error.message || '게임 시작에 실패했습니다.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleShowInviteFriend = async () => {
    setShowInviteFriend(true);
    // 친구 목록 로드
    try {
      setFriendsLoading(true);
      const friendsData = await getFriends();
      // 백엔드 응답 형식: { results: [...], count: ... }
      const friendsList = Array.isArray(friendsData) 
        ? friendsData 
        : (friendsData?.results || []);
      setFriends(friendsList);
    } catch (error) {
      const errorMessage = error.message || '친구 목록을 불러올 수 없습니다.';
      Alert.alert('오류', errorMessage);
      setShowInviteFriend(false);
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleInviteFriend = async (friendId) => {
    if (!friendId) {
      Alert.alert('오류', '친구를 선택해주세요.');
      return;
    }

    try {
      setActionLoading(true);
      await inviteFriend(roomId, friendId);
      Alert.alert('성공', '초대를 보냈습니다.');
      setShowInviteFriend(false);
      // 방 정보 새로고침
      loadRoomDetail();
    } catch (error) {
      // roomService에서 이미 처리된 에러 메시지 사용
      const errorMessage = error.message || '친구 초대에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!room?.invite_code) {
      Alert.alert('오류', '초대 코드를 불러올 수 없습니다.');
      return;
    }

    try {
      await Clipboard.setStringAsync(room.invite_code);
      Alert.alert('복사 완료', '초대 코드가 클립보드에 복사되었습니다.');
    } catch (error) {
      Alert.alert('오류', '초대 코드 복사에 실패했습니다.');
      console.error('클립보드 복사 실패:', error);
    }
  };

  const handleShowAttendance = async () => {
    try {
      setActionLoading(true);
      const data = await getAttendance(roomId);
      setAttendanceData(data);
      setShowAttendance(true);
    } catch (error) {
      // roomService에서 이미 처리된 에러 메시지 사용
      const errorMessage = error.message || '출석 현황을 불러올 수 없습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003D7A" />
        </View>
      </SafeAreaView>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>방 정보</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* 방 정보 카드 */}
        <View style={styles.infoCard}>
          {/* 출석 버튼 */}
          {/* 출석 버튼 제거됨 */}

          {/* 방 나가기 버튼 (우측 상단) */}
          <TouchableOpacity
            style={styles.leaveRoomButton}
            onPress={handleLeaveRoom}
            disabled={actionLoading}
          >
            <Text style={styles.leaveRoomButtonText}>나가기</Text>
          </TouchableOpacity>

          <Text style={styles.roomName}>{room.name}</Text>
          <TouchableOpacity onPress={handleCopyInviteCode}>
            <Text style={styles.inviteCode}>초대 코드: {room.invite_code}</Text>
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>상태:</Text>
            <Text style={[styles.infoValue, styles.statusBadge, room.status === 'active' && styles.statusActive]}>
              {room.status === 'ready' ? '준비 중' : room.status === 'active' ? '진행 중' : '종료'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>시작일:</Text>
            <Text style={styles.infoValue}>
              {formatDate(room.start_date)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>종료일:</Text>
            <Text style={styles.infoValue}>
              {formatDate(room.end_date)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>인원:</Text>
            <Text style={styles.infoValue}>
              {room.current_participants || 0} / {room.total_participants}
            </Text>
          </View>

          {room.game_area && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>게임 구역:</Text>
              <Text style={styles.infoValue}>
                {room.game_area.name} ({room.game_area.city})
              </Text>
            </View>
          )}
        </View>

        {/* 팀 및 참가자 정보 (2열 레이아웃) */}
        <View style={styles.teamContainer}>
          {/* A팀 컬럼 */}
          <View style={styles.teamColumn}>
            <TouchableOpacity
              style={[
                styles.teamHeader,
                styles.teamAHeader,
                myTeam === 'A' && styles.selectedTeamHeader // 내 팀 강조
              ]}
              onPress={() => myTeam !== 'A' && handleChangeTeam('A')}
              disabled={loading || room.status !== 'ready' || myTeam === 'A'}
            >
              <Text style={[styles.teamTitle, myTeam === 'A' && styles.selectedTeamText]}>A팀</Text>
              <Text style={styles.teamCount}>
                {room.team_a_count || 0} / {room.total_participants / 2}
              </Text>
            </TouchableOpacity>

            <View style={styles.teamList}>
              {room.participants
                ?.filter(p => p.team === 'A')
                .map((participant) => (
                  <View key={participant.id} style={styles.participantItemSmall}>
                    <Text style={styles.participantNameSmall} numberOfLines={1}>
                      {participant.user?.username}
                    </Text>
                    <Text style={styles.levelText}>{participant.user?.rating || 0}</Text>
                    {participant.is_host && <Text style={styles.hostIcon}>👑</Text>}
                  </View>
                ))}
            </View>
          </View>

          {/* B팀 컬럼 */}
          <View style={styles.teamColumn}>
            <TouchableOpacity
              style={[
                styles.teamHeader,
                styles.teamBHeader,
                myTeam === 'B' && styles.selectedTeamHeaderB // 내 팀 강조 (주황색)
              ]}
              onPress={() => myTeam !== 'B' && handleChangeTeam('B')}
              disabled={loading || room.status !== 'ready' || myTeam === 'B'}
            >
              <Text style={[styles.teamTitle, myTeam === 'B' && styles.selectedTeamText]}>B팀</Text>
              <Text style={styles.teamCount}>
                {room.team_b_count || 0} / {room.total_participants / 2}
              </Text>
            </TouchableOpacity>

            <View style={styles.teamList}>
              {room.participants
                ?.filter(p => p.team === 'B')
                .map((participant) => (
                  <View key={participant.id} style={styles.participantItemSmall}>
                    <Text style={styles.participantNameSmall} numberOfLines={1}>
                      {participant.user?.username}
                    </Text>
                    <Text style={styles.levelText}>{participant.user?.rating || 0}</Text>
                    {participant.is_host && <Text style={styles.hostIcon}>👑</Text>}
                  </View>
                ))}
            </View>
          </View>
        </View>

        {/* 액션 버튼들 */}
        <View style={styles.actionsSection}>
          {room.status === 'ready' && (
            <>
              {/* 팀 변경 버튼 제거됨 (팀 헤더 클릭으로 통합) */}

              {/* 친구 초대 */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleShowInviteFriend}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>친구 초대</Text>
              </TouchableOpacity>

              {/* 방 시작 (방장만) */}
              {isHost && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.startButton]}
                  onPress={handleStartRoom}
                  disabled={actionLoading || room.current_participants < 2 || room.current_participants % 2 !== 0}
                >
                  <Text style={styles.startButtonText}>게임 시작</Text>
                </TouchableOpacity>
              )}

              {/* 방 나가기 */}
              {!isHost && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.leaveButton]}
                  onPress={handleLeaveRoom}
                  disabled={actionLoading}
                >
                  <Text style={styles.leaveButtonText}>방 나가기</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* 게임 플레이 (active 상태일 때) */}
          {room.status === 'active' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.playButton]}
              onPress={() => navigation.navigate('GamePlay', { roomId: room.id })}
            >
              <Text style={styles.playButtonText}>게임 시작</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* 팀 변경 모달 */}
      <Modal visible={showTeamChange} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>팀 변경</Text>
            <Text style={styles.modalSubtitle}>변경할 팀을 선택하세요</Text>
            <View style={styles.modalTeamSelector}>
              <TouchableOpacity
                style={[styles.modalTeamButton, myTeam === 'A' && styles.modalTeamButtonDisabled]}
                onPress={() => handleChangeTeam('A')}
                disabled={myTeam === 'A' || actionLoading}
              >
                <Text style={styles.modalTeamButtonText}>A팀</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalTeamButton, myTeam === 'B' && styles.modalTeamButtonDisabled]}
                onPress={() => handleChangeTeam('B')}
                disabled={myTeam === 'B' || actionLoading}
              >
                <Text style={styles.modalTeamButtonText}>B팀</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTeamChange(false)}
            >
              <Text style={styles.modalCloseButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 친구 초대 모달 */}
      <Modal visible={showInviteFriend} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>친구 초대</Text>
            {friendsLoading ? (
              <View style={styles.friendsLoadingContainer}>
                <ActivityIndicator size="large" color="#003D7A" />
                <Text style={styles.friendsLoadingText}>친구 목록을 불러오는 중...</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.friendsEmptyContainer}>
                <Text style={styles.friendsEmptyText}>친구가 없습니다.</Text>
                <Text style={styles.friendsEmptySubtext}>먼저 친구를 추가해주세요.</Text>
              </View>
            ) : (
              <ScrollView style={styles.friendsList}>
                {friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.friendItem}
                    onPress={() => handleInviteFriend(friend.id)}
                    disabled={actionLoading}
                  >
                    <View style={styles.friendItemContent}>
                      <Text style={styles.friendItemName}>{friend.username}</Text>
                      <Text style={styles.friendItemEmail}>{friend.email}</Text>
                    </View>
                    <Text style={styles.friendItemArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowInviteFriend(false);
                setFriends([]);
              }}
            >
              <Text style={styles.modalCloseButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 출석 현황 모달 */}
      <Modal visible={showAttendance} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>출석 현황</Text>
            {attendanceData ? (
              <ScrollView style={styles.attendanceContent}>
                <View style={styles.attendanceInfo}>
                  <Text style={styles.attendanceLabel}>연속 출석일:</Text>
                  <Text style={styles.attendanceValue}>{attendanceData.consecutive_days}일</Text>
                </View>
                <View style={styles.attendanceInfo}>
                  <Text style={styles.attendanceLabel}>오늘 출석:</Text>
                  <Text style={styles.attendanceValue}>
                    {attendanceData.attended_today ? '✓ 완료' : '✗ 미완료'}
                  </Text>
                </View>
                <View style={styles.attendanceInfo}>
                  <Text style={styles.attendanceLabel}>다음 보상:</Text>
                  <Text style={styles.attendanceValue}>
                    {attendanceData.next_reward}일 연속 시 +{attendanceData.next_reward} 페인트볼
                  </Text>
                </View>
                {attendanceData.reward_info && (
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardTitle}>보상 정보</Text>
                    {attendanceData.reward_info.rewards?.map((reward, index) => (
                      <Text key={index} style={styles.rewardItem}>
                        {reward.days}일 연속: +{reward.paintballs} 페인트볼
                        {reward.note && ` (${reward.note})`}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : (
              <ActivityIndicator size="large" color="#003D7A" />
            )}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowAttendance(false)}
            >
              <Text style={styles.modalCloseButtonText}>닫기</Text>
            </TouchableOpacity>
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
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    fontSize: 16,
    color: '#003D7A',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  roomName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  attendanceButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#003D7A',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  leaveRoomButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFE0E0',
    borderWidth: 1,
    borderColor: '#FFB3B3',
    zIndex: 10,
  },
  leaveRoomButtonText: {
    color: '#D32F2F',
    fontSize: 12,
    fontWeight: '600',
  },
  attendanceButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
  },
  teamContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  teamColumn: {
    flex: 1,
  },
  teamHeader: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  teamAHeader: {
    backgroundColor: '#E3F2FD', // Light Blue
  },
  teamBHeader: {
    backgroundColor: '#FFF3E0', // Light Orange
  },
  selectedTeamHeader: {
    borderWidth: 2,
    borderColor: '#003D7A', // 파란색 테두리 (A팀)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  selectedTeamHeaderB: {
    borderWidth: 2,
    borderColor: '#FF6B35', // 주황색 테두리 (B팀)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  teamTitle: {
    fontSize: 18,
    fontWeight: '500', // Normal
    marginBottom: 4,
    color: '#333',
  },
  selectedTeamText: {
    fontWeight: 'bold', // Bold for my team
    color: '#000000',
  },
  teamCount: {
    fontSize: 14,
    color: '#666',
  },
  teamList: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    minHeight: 100,
    padding: 5,
  },
  participantItemSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  participantNameSmall: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  levelText: {
    fontSize: 12,
    color: '#999',
    marginRight: 5,
  },
  hostIcon: {
    fontSize: 14,
  },
  actionsSection: {
    marginTop: 20,
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#5A9FD4',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#81C784',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  leaveButton: {
    backgroundColor: '#EF5350',
  },
  leaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playButton: {
    backgroundColor: '#FF8A65',
    marginTop: 10,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  modalTeamSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  modalTeamButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#003D7A',
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
  },
  modalTeamButtonDisabled: {
    opacity: 0.5,
    borderColor: '#999',
    backgroundColor: '#F0F0F0',
  },
  modalTeamButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003D7A',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#E0E0E0',
  },
  modalButtonConfirm: {
    backgroundColor: '#003D7A',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  modalButtonTextConfirm: {
    color: '#FFFFFF',
  },
  modalCloseButton: {
    marginTop: 10,
    padding: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#003D7A',
    fontWeight: '500',
  },
  attendanceContent: {
    maxHeight: 300,
  },
  attendanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  attendanceLabel: {
    fontSize: 16,
    color: '#666',
  },
  attendanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  rewardInfo: {
    marginTop: 10,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  rewardItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  friendsLoadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  friendsLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  friendsEmptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  friendsEmptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  friendsEmptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  friendsList: {
    maxHeight: 400,
    marginBottom: 10,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  friendItemContent: {
    flex: 1,
  },
  friendItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  friendItemEmail: {
    fontSize: 14,
    color: '#666',
  },
  friendItemArrow: {
    fontSize: 18,
    color: '#003D7A',
    marginLeft: 10,
  },
});
