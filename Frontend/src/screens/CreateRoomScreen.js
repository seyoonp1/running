import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getGameAreas, createRoom } from '../services/roomService';

export default function CreateRoomScreen({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [gameAreas, setGameAreas] = useState([]);
  const [selectedGameArea, setSelectedGameArea] = useState(null);
  
  // 방 정보 상태
  const [roomName, setRoomName] = useState('');
  const [totalParticipants, setTotalParticipants] = useState('4');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadGameAreas();
  }, []);

  const loadGameAreas = async () => {
    try {
      setLoading(true);
      const data = await getGameAreas();
      setGameAreas(data.results || []);
    } catch (error) {
      Alert.alert('오류', '게임 구역을 불러올 수 없습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    // 유효성 검사
    if (!roomName.trim()) {
      Alert.alert('오류', '방 이름을 입력해주세요.');
      return;
    }

    if (!selectedGameArea) {
      Alert.alert('오류', '게임 구역을 선택해주세요.');
      return;
    }

    const participants = parseInt(totalParticipants);
    if (isNaN(participants) || participants < 2 || participants % 2 !== 0) {
      Alert.alert('오류', '총 인원수는 2 이상의 짝수여야 합니다.');
      return;
    }

    if (!startDate || !endDate) {
      Alert.alert('오류', '시작 날짜와 종료 날짜를 입력해주세요.');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      Alert.alert('오류', '종료 날짜는 시작 날짜보다 이후여야 합니다.');
      return;
    }

    try {
      setLoading(true);
      const roomData = {
        name: roomName.trim(),
        total_participants: participants,
        start_date: startDate,
        end_date: endDate,
        game_area_id: selectedGameArea.id,
      };

      const createdRoom = await createRoom(roomData);
      
      Alert.alert('성공', '방이 생성되었습니다.', [
        {
          text: '확인',
          onPress: () => {
            navigation.navigate('RoomDetail', { roomId: createdRoom.id });
          },
        },
      ]);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '방 생성에 실패했습니다.';
      Alert.alert('오류', errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 오늘 날짜를 YYYY-MM-DD 형식으로 반환
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>방 만들기</Text>
          <View style={{ width: 60 }} />
        </View>

        {loading && gameAreas.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003D7A" />
          </View>
        ) : (
          <>
            {/* 방 이름 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>방 이름</Text>
              <TextInput
                style={styles.input}
                value={roomName}
                onChangeText={setRoomName}
                placeholder="예: 한강 러닝 대결"
                placeholderTextColor="#999"
              />
            </View>

            {/* 총 인원수 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>총 인원수 (짝수)</Text>
              <TextInput
                style={styles.input}
                value={totalParticipants}
                onChangeText={setTotalParticipants}
                placeholder="4"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
              <Text style={styles.hint}>A팀과 B팀으로 균등 분배됩니다</Text>
            </View>

            {/* 시작 날짜 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>시작 날짜</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder={getTodayDate()}
                placeholderTextColor="#999"
              />
              <Text style={styles.hint}>형식: YYYY-MM-DD</Text>
            </View>

            {/* 종료 날짜 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>종료 날짜</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder={getTodayDate()}
                placeholderTextColor="#999"
              />
              <Text style={styles.hint}>형식: YYYY-MM-DD</Text>
            </View>

            {/* 게임 구역 선택 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>게임 구역</Text>
              <ScrollView style={styles.gameAreaList} nestedScrollEnabled>
                {gameAreas.map((area) => (
                  <TouchableOpacity
                    key={area.id}
                    style={[
                      styles.gameAreaItem,
                      selectedGameArea?.id === area.id && styles.gameAreaItemSelected,
                    ]}
                    onPress={() => setSelectedGameArea(area)}
                  >
                    <Text style={styles.gameAreaName}>{area.name}</Text>
                    <Text style={styles.gameAreaCity}>{area.city}</Text>
                    {selectedGameArea?.id === area.id && (
                      <Text style={styles.selectedMark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 생성 버튼 */}
            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled]}
              onPress={handleCreateRoom}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>방 만들기</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
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
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  gameAreaList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  gameAreaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  gameAreaItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  gameAreaName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
  gameAreaCity: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  selectedMark: {
    fontSize: 18,
    color: '#003D7A',
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#003D7A',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
