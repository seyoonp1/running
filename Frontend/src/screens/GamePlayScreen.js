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
import GoogleMapView from '../components/GoogleMapView';
import * as Location from 'expo-location';
import { cellToBoundary } from 'h3-js';
import { startRecord, stopRecord } from '../services/recordService';
import socketService from '../services/socketService';
import BackgroundLocationService from '../services/BackgroundLocationService';
import { calculateDistance, calculatePace, formatDistance, formatTime } from '../utils/gpsUtils';
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
  const [mapReady, setMapReady] = useState(false);

  // 위치 및 경로 상태 (테스트를 위해 서울시청 기본값 설정)
  const [location, setLocation] = useState({
    latitude: 37.5665,
    longitude: 126.9780,
  });
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  // 러닝 통계 상태
  const [totalDistance, setTotalDistance] = useState(0); // 총 이동거리 (미터)
  const [currentPace, setCurrentPace] = useState("--'--\""); // 현재 페이스
  const [averagePace, setAveragePace] = useState("--'--\""); // 평균 페이스
  const lastLocationRef = useRef(null); // 이전 위치 저장용

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

  // 3. 맵 업데이트 (위치, 경로, 폴리곤, 마커)
  useEffect(() => {
    if (mapReady && mapRef.current && location) {
      // 내 위치 업데이트
      mapRef.current.updateMyLocation(location.latitude, location.longitude);
    }
  }, [mapReady, location]);

  // 경로 업데이트
  useEffect(() => {
    if (mapReady && mapRef.current && routeCoordinates.length > 1) {
      mapRef.current.drawPolyline(routeCoordinates, '#003D7A', 4);
    }
  }, [mapReady, routeCoordinates]);

  // 폴리곤 업데이트 (헥사곤 영역)
  useEffect(() => {
    if (mapReady && mapRef.current) {
      const polygonData = Object.entries(ownedHexes).map(([h3Id, data]) => {
        const coords = h3ToCoordinates(h3Id);
        const isTeamA = data.team === 'A';
        return {
          coords,
          fillColor: isTeamA ? 'rgba(0, 61, 122, 0.4)' : 'rgba(255, 107, 53, 0.4)',
          strokeColor: isTeamA ? '#003D7A' : '#FF6B35',
        };
      }).filter(p => p.coords.length > 0);

      if (polygonData.length > 0) {
        mapRef.current.drawPolygons(polygonData);
      }
    }
  }, [mapReady, ownedHexes]);

  // 마커 업데이트 (다른 참가자)
  useEffect(() => {
    if (mapReady && mapRef.current) {
      const markerData = Object.entries(otherParticipants).map(([userId, p]) => ({
        latitude: p.lat,
        longitude: p.lng,
        caption: `Team ${p.team}`,
        color: p.team === 'A' ? '#003D7A' : '#FF6B35',
        captionColor: p.team === 'A' ? '#003D7A' : '#FF6B35',
      }));

      if (markerData.length > 0) {
        mapRef.current.drawMarkers(markerData);
      }
    }
  }, [mapReady, otherParticipants]);

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

  const cleanup = async () => {
    // 백그라운드 위치 추적 중지 (isRecording 상태 확인 필요)
    await BackgroundLocationService.stopTracking();
    if (roomId) {
      socketService.disconnect();
    }
  };

  // 위치 업데이트 핸들러 (백그라운드/포그라운드 공통)
  const handleLocationUpdate = (coords) => {
    const { latitude, longitude } = coords;

    // 거리 계산 (이전 위치가 있을 경우)
    if (lastLocationRef.current && isRecording && !isPaused) {
      const distance = calculateDistance(
        lastLocationRef.current.latitude,
        lastLocationRef.current.longitude,
        latitude,
        longitude
      );

      // 비정상적으로 큰 거리는 무시 (GPS 오류 방지, 100m 이상)
      if (distance < 100) {
        setTotalDistance((prev) => {
          const newDistance = prev + distance;

          // 페이스 계산 (recordingTime은 초 단위)
          if (recordingTime > 0) {
            const avgPace = calculatePace(newDistance, recordingTime);
            setAveragePace(avgPace);

            // 현재 페이스 (최근 100m 기준으로 계산)
            if (newDistance >= 100) {
              const recentTime = 10; // 대략 최근 10초 (간단한 추정)
              const currPace = calculatePace(distance, recentTime);
              setCurrentPace(currPace);
            }
          }

          return newDistance;
        });
      }
    }

    // 현재 위치를 이전 위치로 저장
    lastLocationRef.current = { latitude, longitude };

    // 상태 업데이트
    setLocation({ latitude, longitude });
    setRouteCoordinates((prev) => [...prev, { latitude, longitude }]);

    // 소켓으로 위치 전송
    if (roomId) {
      socketService.sendLocationUpdate(latitude, longitude);
    }
  };

  // 기록 시작 핸들러 (백그라운드 위치 추적 사용)
  const handleStartRecord = async () => {
    try {
      setLoading(true);

      // API 호출
      const result = await startRecord(roomId);
      setCurrentRecordId(result.id);
      setIsRecording(true);

      // 통계 초기화
      setTotalDistance(0);
      setCurrentPace("--'--\"");
      setAveragePace("--'--\"");
      lastLocationRef.current = null;

      // 백그라운드 위치 추적 시작
      const started = await BackgroundLocationService.startTracking(handleLocationUpdate);

      if (!started) {
        Alert.alert('경고', '백그라운드 위치 추적을 시작할 수 없습니다. 앱이 열려 있을 때만 추적됩니다.');
      }

      Alert.alert('성공', '기록을 시작했습니다. 앱을 닫아도 백그라운드에서 계속 추적됩니다.');
    } catch (error) {
      Alert.alert('오류', error.message || '기록 시작에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 일시중단 핸들러 (팝업 없이 즉시 실행)
  const handlePauseRecord = async () => {
    // 백그라운드 위치 추적 중지
    await BackgroundLocationService.stopTracking();
    setIsPaused(true);
  };

  // 재개 핸들러
  const handleResumeRecord = async () => {
    try {
      // 백그라운드 위치 추적 재시작
      const started = await BackgroundLocationService.startTracking(handleLocationUpdate);

      if (!started) {
        Alert.alert('경고', '위치 추적을 재시작할 수 없습니다.');
      }

      setIsPaused(false);
    } catch (error) {
      Alert.alert('오류', '재개에 실패했습니다.');
    }
  };

  // 완전종료 핸들러 (확인 팝업 표시)
  const handleCompleteStop = () => {
    Alert.alert('확인', '기록을 완전히 종료하고 메인 화면으로 돌아가시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);

            // 백그라운드 위치 추적 중단
            await BackgroundLocationService.stopTracking();

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

  // 지도 준비 완료 핸들러
  const handleMapReady = () => {
    setMapReady(true);
    console.log('Google Maps 준비 완료');
  };

  // 카메라 변경 핸들러
  const handleCameraChange = (e) => {
    // 필요 시 카메라 변경 이벤트 처리
  };

  return (
    <View style={styles.container}>
      {/* 지도 영역 (전체 배경) */}
      <View style={styles.mapContainer}>
        <GoogleMapView
          ref={mapRef}
          style={styles.map}
          initialCenter={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          initialZoom={16}
          onMapReady={handleMapReady}
          onCameraChange={handleCameraChange}
        />
      </View>

      <SafeAreaView style={[styles.overlayContainer, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
        {/* 상단 정보 패널 */}
        <View style={styles.overlayPanel} pointerEvents="none">
          {/* 왼쪽: 페이스 */}
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>페이스</Text>
            <Text style={styles.statValue}>{averagePace}</Text>
          </View>

          {/* 중앙: 시간 */}
          <View style={[styles.statBox, styles.centerStatBox]}>
            <Text style={styles.statLabel}>시간</Text>
            <Text style={[styles.statValue, styles.timeValue]}>{formatTime(recordingTime)}</Text>
          </View>
          {/* 오른쪽: 거리 */}
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>거리</Text>
            <Text style={styles.statValue}>{formatDistance(totalDistance)}</Text>
          </View>
        </View>

        {/* 하단 컨트롤러 */}
        <View style={styles.controlsContainer} pointerEvents="box-none">
          {!isRecording ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.startButton]}
              onPress={handleStartRecord}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>기록 시작</Text>}
            </TouchableOpacity>
          ) : (
            <View style={styles.recordingControls} pointerEvents="box-none">
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black', // 흰색이 있으면 티가 나게 검은색으로 변경
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent', // 투명하게 설정하여 지도가 보이게 함
    zIndex: 10,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'blue',
    zIndex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
    zIndex: 10,
  },
  statBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#003D7A',
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  centerStatBox: {
    minWidth: 120,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003D7A',
  },
  timeValue: {
    fontSize: 24,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent', // 투명하게 설정
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
