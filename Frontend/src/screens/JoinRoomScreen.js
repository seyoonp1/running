import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { joinRoom } from '../services/roomService';

export default function JoinRoomScreen({ navigation }) {
  const [inviteCode, setInviteCode] = useState('');
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('오류', '초대 코드를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const result = await joinRoom(inviteCode.trim().toUpperCase(), team);
      
      Alert.alert('성공', result.message, [
        {
          text: '확인',
          onPress: () => {
            navigation.navigate('RoomDetail', { roomId: result.room.id });
          },
        },
      ]);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '방 참가에 실패했습니다.';
      Alert.alert('오류', errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>방 참가</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* 초대 코드 입력 */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>초대 코드</Text>
          <TextInput
            style={styles.input}
            value={inviteCode}
            onChangeText={(text) => setInviteCode(text.toUpperCase())}
            placeholder="예: ABC123"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            maxLength={6}
          />
          <Text style={styles.hint}>6자리 초대 코드를 입력하세요</Text>
        </View>

        {/* 팀 선택 (선택사항) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>팀 선택 (선택사항)</Text>
          <View style={styles.teamSelector}>
            <TouchableOpacity
              style={[styles.teamButton, team === 'A' && styles.teamButtonSelected]}
              onPress={() => setTeam(team === 'A' ? null : 'A')}
            >
              <Text style={[styles.teamButtonText, team === 'A' && styles.teamButtonTextSelected]}>
                A팀
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.teamButton, team === 'B' && styles.teamButtonSelected]}
              onPress={() => setTeam(team === 'B' ? null : 'B')}
            >
              <Text style={[styles.teamButtonText, team === 'B' && styles.teamButtonTextSelected]}>
                B팀
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>팀을 선택하지 않으면 자동 배정됩니다</Text>
        </View>

        {/* 참가 버튼 */}
        <TouchableOpacity
          style={[styles.joinButton, loading && styles.joinButtonDisabled]}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.joinButtonText}>참가하기</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
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
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  teamSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  teamButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  teamButtonSelected: {
    borderColor: '#003D7A',
    backgroundColor: '#E3F2FD',
  },
  teamButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  teamButtonTextSelected: {
    color: '#003D7A',
    fontWeight: 'bold',
  },
  joinButton: {
    backgroundColor: '#003D7A',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
