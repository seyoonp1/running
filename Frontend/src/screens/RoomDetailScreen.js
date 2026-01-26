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
import {
  getRoomDetail,
  leaveRoom,
  changeTeam,
  startRoom,
  inviteFriend,
  getAttendance,
} from '../services/roomService';

export default function RoomDetailScreen({ navigation, route }) {
  const { roomId } = route.params;
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showTeamChange, setShowTeamChange] = useState(false);
  const [showInviteFriend, setShowInviteFriend] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [friendUserId, setFriendUserId] = useState('');
  const [attendanceData, setAttendanceData] = useState(null);
  
  // 현재 사용자가 방장인지 확인
  const myParticipant = room?.my_participant || room?.participants?.find((p) => p.is_host);
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
      Alert.alert('오류', '방 정보를 불러올 수 없습니다.');
      console.error(error);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
    if (room.current_participants < room.total_participants) {
      Alert.alert('알림', '모든 인원이 찬 후에 시작할 수 있습니다.');
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
            Alert.alert('성공', '게임이 시작되었습니다.');
            loadRoomDetail(); // 방 정보 다시 로드
          } catch (error) {
            Alert.alert('오류', error.message || '게임 시작에 실패했습니다.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleInviteFriend = async () => {
    if (!friendUserId.trim()) {
      Alert.alert('오류', '사용자 ID를 입력해주세요.');
      return;
    }

    try {
      setActionLoading(true);
      await inviteFriend(roomId, friendUserId.trim());
      Alert.alert('성공', '초대를 보냈습니다.');
      setShowInviteFriend(false);
      setFriendUserId('');
    } catch (error) {
      Alert.alert('오류', error.message || '친구 초대에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShowAttendance = async () => {
    try {
      setActionLoading(true);
      const data = await getAttendance(roomId);
      setAttendanceData(data);
      setShowAttendance(true);
    } catch (error) {
      Alert.alert('오류', '출석 현황을 불러올 수 없습니다.');
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
          <Text style={styles.roomName}>{room.name}</Text>
          <Text style={styles.inviteCode}>초대 코드: {room.invite_code}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>상태:</Text>
            <Text style={[styles.infoValue, styles.statusBadge, room.status === 'active' && styles.statusActive]}>
              {room.status === 'ready' ? '준비 중' : room.status === 'active' ? '진행 중' : '종료'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>기간:</Text>
            <Text style={styles.infoValue}>
              {formatDate(room.start_date)} ~ {formatDate(room.end_date)}
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

        {/* 팀 정보 */}
        <View style={styles.teamSection}>
          <View style={[styles.teamCard, styles.teamA]}>
            <Text style={styles.teamTitle}>A팀</Text>
            <Text style={styles.teamCount}>
              {room.team_a_count || 0} / {room.total_participants / 2}
            </Text>
          </View>
          <View style={[styles.teamCard, styles.teamB]}>
            <Text style={styles.teamTitle}>B팀</Text>
            <Text style={styles.teamCount}>
              {room.team_b_count || 0} / {room.total_participants / 2}
            </Text>
          </View>
        </View>

        {/* 참가자 목록 */}
        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>참가자</Text>
          {room.participants && room.participants.length > 0 ? (
            room.participants.map((participant) => (
              <View key={participant.id} style={styles.participantItem}>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {participant.user?.username || 'Unknown'}
                  </Text>
                  <View style={[styles.teamBadge, participant.team === 'A' ? styles.teamABadge : styles.teamBBadge]}>
                    <Text style={styles.teamBadgeText}>{participant.team}팀</Text>
                  </View>
                  {participant.is_host && (
                    <View style={styles.hostBadge}>
                      <Text style={styles.hostBadgeText}>방장</Text>
                    </View>
                  )}
                </View>
                <View style={styles.paintballInfo}>
                  <Text style={styles.paintballText}>
                    페인트볼: {participant.paintball_count || 0}
                  </Text>
                  <Text style={styles.paintballText}>
                    슈퍼: {participant.super_paintball_count || 0}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>참가자가 없습니다.</Text>
          )}
        </View>

        {/* 액션 버튼들 */}
        <View style={styles.actionsSection}>
          {room.status === 'ready' && (
            <>
              {/* 팀 변경 */}
              {myParticipant && !isHost && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowTeamChange(true)}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionButtonText}>팀 변경</Text>
                </TouchableOpacity>
              )}

              {/* 친구 초대 */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowInviteFriend(true)}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>친구 초대</Text>
              </TouchableOpacity>

              {/* 방 시작 (방장만) */}
              {isHost && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.startButton]}
                  onPress={handleStartRoom}
                  disabled={actionLoading || room.current_participants < room.total_participants}
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

          {/* 출석 현황 */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShowAttendance}
            disabled={actionLoading}
          >
            <Text style={styles.actionButtonText}>출석 현황</Text>
          </TouchableOpacity>

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
            <TextInput
              style={styles.modalInput}
              value={friendUserId}
              onChangeText={setFriendUserId}
              placeholder="사용자 ID 또는 username"
              placeholderTextColor="#999"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowInviteFriend(false);
                  setFriendUserId('');
                }}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleInviteFriend}
                disabled={actionLoading}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>초대</Text>
              </TouchableOpacity>
            </View>
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
  teamSection: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  teamCard: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  teamA: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  teamB: {
    backgroundColor: '#FFF3E0',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  teamTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  teamCount: {
    fontSize: 16,
    color: '#666',
  },
  participantsSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginRight: 10,
  },
  teamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  teamABadge: {
    backgroundColor: '#2196F3',
  },
  teamBBadge: {
    backgroundColor: '#FF9800',
  },
  teamBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#003D7A',
  },
  hostBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  paintballInfo: {
    alignItems: 'flex-end',
  },
  paintballText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  actionsSection: {
    marginTop: 20,
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#003D7A',
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
    backgroundColor: '#4CAF50',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  leaveButton: {
    backgroundColor: '#F44336',
  },
  leaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playButton: {
    backgroundColor: '#FF6B35',
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
});
