import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Polyline, Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { cellToBoundary } from 'h3-js';
import { startRecord, stopRecord } from '../services/recordService';
import socketService from '../services/socketService';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

// H3 ID를 좌표 배열로 변환하는 함수
const h3ToCoordinates = (h3Id) => {
  try {
    const boundary = cellToBoundary(h3Id);
    // h3-js returns [lat, lng], MapView needs {latitude, longitude}
    return boundary.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
  } catch (e) {
    console.error('H3 변환 실패:', e);
    return [];
  }
};

export default function GamePlayScreen({ navigation, route }) {
  const { roomId, gameArea } = route.params || {};
  const { user } = useAuth();
  const mapRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [loading, setLoading] = useState(false);

  // 위치 및 경로 상태
  const [location, setLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [subscription, setSubscription] = useState(null);

  // 게임 데이터 상태
  const [myTeam, setMyTeam] = useState(null); // 'A' or 'B'
  const [ownedHexes, setOwnedHexes] = useState({}); // { h3Id: { team: 'A', ownerId: '...' } }
  const [otherParticipants, setOtherParticipants] = useState({}); // { userId: { lat, lng, team } }

  // 1. 초기 설정 및 소켓 연결
  useEffect(() => {
    let mounted = true;

    const initGame = async () => {
      // 권한 요청
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 거부', '위치 권한이 필요합니다.');
        navigation.goBack();
        return;
      }

      // 현재 위치 가져오기
      const currentLocation = await Location.getCurrentPositionAsync({});
      console.log('현재 위치:', currentLocation.coords);
      if (mounted) {
        setLocation(currentLocation.coords);
      }

      // 소켓 연결
      if (roomId) {
        await socketService.connect(roomId);
        setupSocketListeners();
      }
    };

    initGame();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [roomId]);

  // 2. 타이머 (일시중단 시에는 타이머만 멈춤)
  useEffect(() => {
    let interval = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  // 소켓 리스너 설정
  const setupSocketListeners = () => {
    // 헥사곤 점령 알림
    socketService.on('hex_claimed', (data) => {
      setOwnedHexes((prev) => ({
        ...prev,
        [data.h3_id]: { team: data.team, ownerId: data.user_id }
      }));
    });

    // 다른 참가자 위치 업데이트
    socketService.on('participant_location', (data) => {
      if (data.user_id === user?.id) return; // 내 위치는 제외
      setOtherParticipants((prev) => ({
        ...prev,
        [data.user_id]: {
          lat: data.lat,
          lng: data.lng,
          team: data.team,
          h3Id: data.h3_id
        }
      }));
    });

    // 내 팀 정보 등 초기 정보 수신 (필요 시)
    // socketService.on('game_info', ...);
  };

  const cleanup = () => {
    if (subscription) {
      subscription.remove();
    }
    if (roomId) {
      socketService.disconnect();
    }
  };

  // 3. 기록 시작 핸들러
  const handleStartRecord = async () => {
    try {
      setLoading(true);

      // API 호출
      const result = await startRecord(roomId);
      setCurrentRecordId(result.id);
      setIsRecording(true);

      // 위치 추적 시작
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5, // 5미터마다 업데이트
          timeInterval: 1000,
        },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;

          // 상태 업데이트
          setLocation(newLocation.coords);
          setRouteCoordinates((prev) => [...prev, { latitude, longitude }]);

          // 소켓으로 위치 전송
          if (roomId) {
            socketService.sendLocationUpdate(latitude, longitude);
          }
        }
      );
      setSubscription(sub);

      Alert.alert('성공', '기록을 시작했습니다.');
    } catch (error) {
      Alert.alert('오류', error.message || '기록 시작에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 4. 일시중단 핸들러 (팝업 없이 즉시 실행)
  const handlePauseRecord = () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
    setIsPaused(true);
  };

  // 5. 재개 핸들러
  const handleResumeRecord = async () => {
    try {
      // 위치 추적 재시작
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 1000,
        },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;
          setLocation(newLocation.coords);
          setRouteCoordinates((prev) => [...prev, { latitude, longitude }]);
          if (roomId) {
            socketService.sendLocationUpdate(latitude, longitude);
          }
        }
      );
      setSubscription(sub);
      setIsPaused(false);
    } catch (error) {
      Alert.alert('오류', '재개에 실패했습니다.');
    }
  };

  // 6. 완전종료 핸들러 (확인 팝업 표시)
  const handleCompleteStop = () => {
    Alert.alert('확인', '기록을 완전히 종료하고 메인 화면으로 돌아가시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);

            // 위치 추적 중단
            if (subscription) {
              subscription.remove();
              setSubscription(null);
            }

            // API 호출 (기록 저장)
            if (currentRecordId) {
              await stopRecord(currentRecordId);
            }

            // 상태 초기화
            setIsRecording(false);
            setIsPaused(false);
            setCurrentRecordId(null);
            setRecordingTime(0);
            setRouteCoordinates([]);

            // GameMainScreen으로 이동
            navigation.navigate('GameMain');
          } catch (error) {
            Alert.alert('오류', error.message || '기록 종료에 실패했습니다.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const formatPace = (secondsPerKm) => {
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}'${String(seconds).padStart(2, '0')}"`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 지도 영역 */}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            followsUserLocation={true}
          >
            {/* 내 이동 경로 */}
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#003D7A"
              strokeWidth={4}
            />

            {/* 점령된 헥사곤들 */}
            {Object.entries(ownedHexes).map(([h3Id, data]) => {
              const coords = h3ToCoordinates(h3Id);
              if (coords.length === 0) return null;

              const isTeamA = data.team === 'A';
              const fillColor = isTeamA ? 'rgba(0, 61, 122, 0.4)' : 'rgba(255, 107, 53, 0.4)'; // 파랑/주황 반투명
              const strokeColor = isTeamA ? '#003D7A' : '#FF6B35';

              return (
                <Polygon
                  key={h3Id}
                  coordinates={coords}
                  fillColor={fillColor}
                  strokeColor={strokeColor}
                  strokeWidth={1}
                />
              );
            })}

            {/* 다른 참가자들 마커 (간단하게 원으로 표시) */}
            {Object.entries(otherParticipants).map(([userId, p]) => (
              <Marker
                key={userId}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                title={`User ${userId.slice(0, 4)}`}
                description={`Team ${p.team}`}
              >
                <View style={[
                  styles.participantMarker,
                  { backgroundColor: p.team === 'A' ? '#003D7A' : '#FF6B35' }
                ]} />
              </Marker>
            ))}

          </MapView>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003D7A" />
            <Text>위치 정보를 불러오는 중...</Text>
          </View>
        )}
      </View>

      {/* 상단 정보 패널 */}
      <View style={styles.overlayPanel}>
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatDuration(recordingTime)}</Text>
        </View>
        <View style={styles.statsContainer}>
          {/* 여기에 팀 점수 등을 표시할 수 있음 */}
          <Text style={styles.statText}>A팀: {Object.values(ownedHexes).filter(x => x.team === 'A').length}</Text>
          <Text style={styles.statText}>B팀: {Object.values(ownedHexes).filter(x => x.team === 'B').length}</Text>
        </View>
      </View>

      {/* 하단 컨트롤러 */}
      <View style={styles.controlsContainer}>
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.controlButton, styles.startButton]}
            onPress={handleStartRecord}
            disabled={loading || !location}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>기록 시작</Text>}
          </TouchableOpacity>
        ) : (
          <View style={styles.recordingControls}>
            {isPaused ? (
              <TouchableOpacity
                style={[styles.controlButton, styles.resumeButton]}
                onPress={handleResumeRecord}
                disabled={loading}
              >
                <Text style={styles.buttonText}>재개</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.controlButton, styles.pauseButton]}
                onPress={handlePauseRecord}
                disabled={loading}
              >
                <Text style={styles.buttonText}>일시중단</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={handleCompleteStop}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>완전종료</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayPanel: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003D7A',
  },
  statsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordingControls: {
    width: width * 0.8,
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  startButton: {
    backgroundColor: '#003D7A',
  },
  pauseButton: {
    backgroundColor: '#FFA500',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#FF6B35',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  participantMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
