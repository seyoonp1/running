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
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import paintItemIcon from '../../assets/icons/paint item_icon.png';
import hexagonBlue from '../../assets/icons/simple_hexagon.png';
import hexagonOrange from '../../assets/icons/simple_hexagon_orange.png';
import GoogleMapView from '../components/GoogleMapView';
import { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { cellToBoundary, latLngToCell, gridDisk, cellToLatLng } from 'h3-js';
import { startRecord, stopRecord } from '../services/recordService';
import { getAttendance } from '../services/roomService';
import socketService from '../services/socketService';
import BackgroundLocationService from '../services/BackgroundLocationService';
import { calculateDistance, calculatePace, formatDistance, formatTime } from '../utils/gpsUtils';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

// 게임 구역 설정: 카이스트 본원
const KAIST_CONFIG = {
  name: '카이스트 본원',
  city: '대전광역시',
  center: { latitude: 36.3721, longitude: 127.3604 },
  h3Resolution: 9, // H3 해상도 (약 170m 반경)
  gridRadius: 10,  // 중심으로부터의 반지름 (헥사곤 개수 단위)
};

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

  // Ref로 최신 상태 추적 (클로저 문제 해결)
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const recordingTimeRef = useRef(0);

  // 상태 변경 시 ref도 함께 업데이트
  const updateIsRecording = (value) => {
    setIsRecording(value);
    isRecordingRef.current = value;
  };
  const updateIsPaused = (value) => {
    setIsPaused(value);
    isPausedRef.current = value;
  };

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

  // 출석 상태
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [hasAcquiredHex, setHasAcquiredHex] = useState(false); // 땅 획득 여부 (도장용)

  // 헥사곤 하이라이트 상태
  const [highlightedTeam, setHighlightedTeam] = useState(null); // null, 'A', 'B'

  // 0. 헥사곤 그리드 초기화 (카이스트 지역 시뮬레이션)
  const initHexGrid = () => {
    console.log('🔷 initHexGrid 시작...');

    const centerH3 = latLngToCell(
      KAIST_CONFIG.center.latitude,
      KAIST_CONFIG.center.longitude,
      KAIST_CONFIG.h3Resolution
    );
    console.log('🔷 중심 H3 ID:', centerH3);

    // 중심 주변 헥사곤 ID 리스트 생성
    const hexIds = gridDisk(centerH3, KAIST_CONFIG.gridRadius);
    console.log('🔷 생성된 헥사곤 개수:', hexIds.length);

    const initialHexes = {};
    hexIds.forEach((h3Id, index) => {
      // 랜덤하게 팀 배정 (A: 파랑, B: 주황)
      const team = Math.random() > 0.5 ? 'A' : 'B';
      initialHexes[h3Id] = {
        team: team,
        ownerId: team === 'A' ? 'system-a' : 'system-b'
      };
    });

    console.log('🔷 ownedHexes 설정 완료. 샘플:', Object.keys(initialHexes).slice(0, 3));
    setOwnedHexes(initialHexes);
  };

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

    initGame().then(() => {
      initHexGrid(); // 카이스트 그리드 생성
    });

    // 초기 출석 상태 확인 (조용히)
    const checkInitialAttendance = async () => {
      try {
        if (!roomId) return;
        const data = await getAttendance(roomId);
        setAttendanceData(data);
      } catch (error) {
        console.log('초기 출석 확인 실패:', error);
      }
    };
    checkInitialAttendance();

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
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          recordingTimeRef.current = newTime; // Ref도 업데이트
          return newTime;
        });
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

      // 내가 땅을 먹었으면 도장 상태 업데이트
      if (data.user_id === user?.id) {
        setHasAcquiredHex(true);
      }
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

    // Ref를 사용하여 최신 상태 확인 (클로저 문제 해결)
    const recording = isRecordingRef.current;
    const paused = isPausedRef.current;
    const currentRecordingTime = recordingTimeRef.current;

    // 거리 계산 (이전 위치가 있을 경우)
    if (lastLocationRef.current && recording && !paused) {
      const distance = calculateDistance(
        lastLocationRef.current.latitude,
        lastLocationRef.current.longitude,
        latitude,
        longitude
      );

      // 비정상적으로 큰 거리는 무시 (GPS 오류 방지, 100m 이상)
      if (distance < 100 && distance > 0.5) { // 최소 0.5m 이상이어야 계산
        setTotalDistance((prev) => {
          const newDistance = prev + distance;

          // 페이스 계산 (recordingTime은 초 단위)
          if (currentRecordingTime > 0) {
            const avgPace = calculatePace(newDistance, currentRecordingTime);
            setAveragePace(avgPace);

            // 현재 페이스 (최근 10초 기준으로 계산)
            if (newDistance >= 10) {
              const recentTime = 5; // 대략 최근 5초
              const currPace = calculatePace(distance * 2, recentTime); // 대략적인 추정
              setCurrentPace(currPace);
            }
          }

          console.log(`🏃 [거리 계산] +${distance.toFixed(2)}m | 총: ${newDistance.toFixed(2)}m`);
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
      updateIsRecording(true);

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
    updateIsPaused(true);
  };

  // 재개 핸들러
  const handleResumeRecord = async () => {
    try {
      // 백그라운드 위치 추적 재시작
      const started = await BackgroundLocationService.startTracking(handleLocationUpdate);

      if (!started) {
        Alert.alert('경고', '위치 추적을 재시작할 수 없습니다.');
      }

      updateIsPaused(false);
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
            updateIsRecording(false);
            updateIsPaused(false);
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

  // 출석 확인 핸들러
  const handleShowAttendance = async () => {
    try {
      setLoading(true);
      const data = await getAttendance(roomId);
      setAttendanceData(data);
      setShowAttendance(true);
    } catch (error) {
      Alert.alert('오류', '출석 현황을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 출석일 계산 (실시간 반영)
  const displayDays = attendanceData ? (
    (!attendanceData.attended_today && hasAcquiredHex)
      ? attendanceData.consecutive_days + 1
      : attendanceData.consecutive_days
  ) : 0;

  // 팀 하이라이트 토글 핸들러
  const handleTeamHighlight = (team) => {
    console.log(`🔘 팀 ${team} 클릭됨! 현재 상태: ${highlightedTeam}`);
    setHighlightedTeam(prev => prev === team ? null : team);
  };

  return (
    <View style={styles.container}>
      {/* 지도 영역 (전체 배경) */}
      <View style={styles.mapContainer}>
        <GoogleMapView
          ref={mapRef}
          style={styles.map}
          initialCenter={KAIST_CONFIG.center}
          initialZoom={16}
          onMapReady={handleMapReady}
          onCameraChange={handleCameraChange}
        >
          {/* 테스트 마커 - 카이스트 중심 */}
          <Marker
            coordinate={KAIST_CONFIG.center}
            title="카이스트 중심"
          >
            <View style={{ backgroundColor: 'red', padding: 10, borderRadius: 20 }}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>TEST</Text>
            </View>
          </Marker>

          {/* 헥사곤 점령 영역 표시 (Polygon 방식 - 정확한 경계) */}
          {Object.entries(ownedHexes).map(([h3Id, data]) => {
            try {
              const boundary = cellToBoundary(h3Id); // H3 경계 좌표
              const coordinates = boundary.map(([lat, lng]) => ({
                latitude: lat,
                longitude: lng,
              }));

              // 하이라이트 효과 데이터 준비
              const isHighlighted = highlightedTeam === data.team;
              const isDimmed = highlightedTeam && highlightedTeam !== data.team;

              const polygons = [];

              if (isHighlighted) {
                // 1. 그림자 (원래 위치)
                polygons.push(
                  <Polygon
                    key={`${h3Id}-shadow`}
                    coordinates={coordinates}
                    fillColor="rgba(0, 0, 0, 0.2)"
                    strokeColor="transparent"
                    strokeWidth={0}
                    zIndex={1}
                  />
                );

                // 2. 본체 (위로 떠오름 - 좌표 이동)
                const floatedCoordinates = coordinates.map(c => ({
                  latitude: c.latitude + 0.00008, // 위로 살짝 이동 (부양 효과)
                  longitude: c.longitude
                }));

                const fillColor = data.team === 'A' ? 'rgba(33, 150, 243, 0.9)' : 'rgba(255, 152, 0, 0.9)';
                const strokeColor = data.team === 'A' ? '#1565C0' : '#E65100';

                polygons.push(
                  <Polygon
                    key={`${h3Id}-main`}
                    coordinates={floatedCoordinates}
                    fillColor={fillColor}
                    strokeColor={strokeColor}
                    strokeWidth={2}
                    zIndex={2}
                  />
                );
              } else {
                // 일반 상태 (Highligh 아님)
                let fillColor = data.team === 'A' ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 152, 0, 0.3)';
                let strokeColor = data.team === 'A' ? '#1976D2' : '#F57C00';

                if (isDimmed) {
                  fillColor = data.team === 'A' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(255, 152, 0, 0.1)';
                  strokeColor = 'transparent';
                }

                polygons.push(
                  <Polygon
                    key={h3Id}
                    coordinates={coordinates}
                    fillColor={fillColor}
                    strokeColor={strokeColor}
                    strokeWidth={1}
                    zIndex={1}
                  />
                );
              }

              return polygons;
            } catch (error) {
              console.error('🔴 헥사곤 렌더링 에러:', h3Id, error.message);
              return null;
            }
          })}
        </GoogleMapView>
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
            // 기록 시작 전 (재생 버튼)
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleStartRecord}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="black" size="large" />
              ) : (
                <Ionicons name="play" size={36} color="black" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          ) : (
            // 기록 중 (정지 버튼 + 일시정지/재개 버튼)
            <View style={styles.recordingControls} pointerEvents="box-none">
              {/* 완전 종료 버튼 (네모 아이콘, 위쪽) */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleCompleteStop}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="black" size="large" />
                ) : (
                  <Ionicons name="square" size={28} color="black" />
                )}
              </TouchableOpacity>

              {/* 일시정지/재개 버튼 (아래쪽) */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={isPaused ? handleResumeRecord : handlePauseRecord}
                disabled={loading}
              >
                <Ionicons
                  name={isPaused ? "play" : "pause"}
                  size={36}
                  color="black"
                  style={isPaused ? { marginLeft: 4 } : {}}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* 헥사곤 카운터 + 출석 버튼 (왼쪽 하단) - SafeAreaView 바깥 */}
      <View style={styles.attendanceButtonContainer}>
        {/* 헥사곤 개수 표시 (출석 버튼 위) */}
        <View style={styles.hexCounterContainer}>
          {/* A팀 (Blue) */}
          <TouchableOpacity
            style={[
              styles.hexCounterItem,
              highlightedTeam === 'A' && styles.hexCounterItemHighlighted
            ]}
            onPress={() => handleTeamHighlight('A')}
            activeOpacity={0.7}
          >
            <Image source={hexagonBlue} style={styles.hexIcon} />
            <Text style={styles.hexCountText}>
              {Object.values(ownedHexes).filter(h => h.team === 'A').length}
            </Text>
          </TouchableOpacity>
          {/* B팀 (Orange) */}
          <TouchableOpacity
            style={[
              styles.hexCounterItem,
              highlightedTeam === 'B' && styles.hexCounterItemHighlighted
            ]}
            onPress={() => handleTeamHighlight('B')}
            activeOpacity={0.7}
          >
            <Image source={hexagonOrange} style={styles.hexIcon} />
            <Text style={styles.hexCountText}>
              {Object.values(ownedHexes).filter(h => h.team === 'B').length}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 출석 버튼 + 연속 일수 (가로 배치) */}
        <View style={styles.attendanceRow}>
          <TouchableOpacity
            style={[styles.attendanceButton, { backgroundColor: 'rgba(224, 255, 230, 0.8)' }]}
            onPress={handleShowAttendance}
            disabled={loading}
          >
            {/* 기본 텍스트 (출석) */}
            <Text style={styles.attendanceButtonText}>출석</Text>

            {/* 도장 (조건부 표시: 이미 출석했거나 방금 땅을 먹었을 때) */}
            {(hasAcquiredHex || attendanceData?.attended_today) && (
              <Image
                source={paintItemIcon}
                style={{
                  width: 90,
                  height: 90,
                  resizeMode: 'contain',
                  position: 'absolute', // 겹쳐서 표시
                  opacity: 1
                }}
              />
            )}
          </TouchableOpacity>

          {/* 연속 출석일 라벨 (버튼 옆) */}
          {attendanceData && (
            <View style={styles.daysLabelContainer}>
              <Text style={styles.daysLabelText}>연속 {displayDays}일차</Text>
            </View>
          )}
        </View>
      </View>

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
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent', // 투명하게 설정
  },
  recordingControls: {
    alignItems: 'center',
    gap: 15, // 버튼 간 간격
  },
  iconButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'black',
  },
  // 개별 스타일 제거 (공통 iconButton 사용)
  // 마커 스타일 유지
  participantMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  attendanceButtonContainer: {
    position: 'absolute',
    bottom: 50, // 조금 더 위로 (터치 영역 확보)
    left: 10,
    alignItems: 'flex-start',
    zIndex: 9999, // 최상위 보장
  },
  hexCounterContainer: {
    flexDirection: 'row', // 아이콘들 가로 배치
    marginBottom: 8,
    gap: 12,
  },
  hexCounterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  hexCounterItemHighlighted: {
    backgroundColor: 'rgba(255, 255, 255, 1)', // 완전 불투명
    borderWidth: 2,
    borderColor: '#4CAF50', // 초록 테두리
    transform: [{ scale: 1.05 }], // 살짝 확대
  },
  hexIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  hexCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  daysLabelContainer: {
    marginLeft: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  daysLabelText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendanceButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50', // 연두색 테두리
  },
  attendanceButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32', // 진한 녹색 텍스트
  },
  // 모달 스타일
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
  attendanceContent: {
    marginVertical: 10,
  },
  attendanceInfo: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  attendanceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    width: 100,
  },
  attendanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  rewardInfo: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#003D7A',
  },
  rewardItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  modalCloseButton: {
    marginTop: 10,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#003D7A',
    borderRadius: 8,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
