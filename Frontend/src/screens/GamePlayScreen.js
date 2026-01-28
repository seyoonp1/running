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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import paintItemIcon from '../../assets/icons/paint item_icon.png';
import hexagonBlue from '../../assets/icons/simple_hexagon.png';
import hexagonOrange from '../../assets/icons/simple_hexagon_orange.png';
import GoogleMapView from '../components/GoogleMapView';
import { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { cellToBoundary, latLngToCell, gridDisk, cellToLatLng, gridDistance } from 'h3-js';
import { startRecord, stopRecord } from '../services/recordService';
import { getAttendance, getMyRoom } from '../services/roomService';
import socketService from '../services/socketService';
import BackgroundLocationService from '../services/BackgroundLocationService';
import { calculateDistance, calculatePace, formatDistance, formatTime } from '../utils/gpsUtils';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

// 기본 게임 구역 설정 (백엔드에서 가져온 값으로 덮어씀)
const DEFAULT_GAME_CONFIG = {
  name: '기본 구역',
  city: '',
  center: { latitude: 36.3721, longitude: 127.3604 },
  h3Resolution: 8, // H3 해상도 (모든 곳에서 8 사용)
  gridRadius: 15,  // 중심으로부터의 반지름 (헥사곤 개수 단위)
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
  const [gameAreaConfig, setGameAreaConfig] = useState(DEFAULT_GAME_CONFIG); // 게임 영역 설정

  // 출석 상태
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [hasAcquiredHex, setHasAcquiredHex] = useState(false); // 땅 획득 여부 (도장용)

  // 게임 종료 상태
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [gameEndResult, setGameEndResult] = useState(null);

  // 헥사곤 하이라이트 및 선택 상태
  const [highlightedTeam, setHighlightedTeam] = useState(null); // null, 'A', 'B'
  const [selectedHexId, setSelectedHexId] = useState(null); // 터치로 선택된 헥사곤 ID
  const [lastVisitedHexId, setLastVisitedHexId] = useState(null); // 마지막으로 발을 들인 헥사곤 ID

  // 슈퍼 페인트볼 조준 (깜빡임효과)
  const [aimingHexes, setAimingHexes] = useState([]);
  const [aimingType, setAimingType] = useState(null); // 'normal', 'super', null
  const [blinkOpacity, setBlinkOpacity] = useState(0.2);

  // 깜빡임 애니메이션
  useEffect(() => {
    // 조준 대상이 없으면 종료
    if (aimingHexes.length === 0) return;

    // 조준 대상이 1개면 깜빡임 없이 고정 (선택 완료 상태)
    if (aimingHexes.length === 1) {
      setBlinkOpacity(0.7);
      return;
    }

    // 여러 개일 때만 깜빡임 (조준 중 상태)
    const interval = setInterval(() => {
      setBlinkOpacity(prev => prev === 0.2 ? 0.6 : 0.2);
    }, 500);
    return () => clearInterval(interval);
  }, [aimingHexes]);

  // 페인트볼 개수 및 게이지 (프론트 상태로 관리)
  const [paintballCount, setPaintballCount] = useState(5); // 일반 페인트볼 보유 개수
  const [paintballGauge, setPaintballGauge] = useState(0); // 페인트볼 충전 게이지 (0-100)
  const [superPaintballCount, setSuperPaintballCount] = useState(2); // 슈퍼 페인트볼

  // 0. 헥사곤 그리드 초기화 (게임 영역 + 백엔드 점령 상태 병합)
  const initHexGrid = (config, serverHexOwnerships = {}) => {
    console.log('🔷 initHexGrid 시작...', config);

    const centerH3 = latLngToCell(
      config.center.latitude,
      config.center.longitude,
      config.h3Resolution
    );
    console.log('🔷 중심 H3 ID:', centerH3);

    // 중심 주변 헥사곤 ID 리스트 생성
    const hexIds = gridDisk(centerH3, config.gridRadius);
    console.log('🔷 생성된 헥사곤 개수:', hexIds.length);

    const initialHexes = {};
    hexIds.forEach((h3Id, index) => {
      // 백엔드에서 가져온 점령 상태가 있으면 사용, 없으면 미점령
      if (serverHexOwnerships[h3Id]) {
        initialHexes[h3Id] = {
          team: serverHexOwnerships[h3Id].team,
          ownerId: serverHexOwnerships[h3Id].user_id || serverHexOwnerships[h3Id].ownerId
        };
      } else {
        initialHexes[h3Id] = {
          team: null, // 주인이 없음
          ownerId: null
        };
      }
    });

    const claimedCount = Object.values(initialHexes).filter(h => h.team !== null).length;
    console.log('🔷 ownedHexes 설정 완료. 점령된 헥사곤:', claimedCount);
    setOwnedHexes(initialHexes);
  };

  // 영역 점령 로직 (위치 이동 시 트리거)
  useEffect(() => {
    if (!location || !myTeam || Object.keys(ownedHexes).length === 0) return;

    const currentH3Index = latLngToCell(location.latitude, location.longitude, gameAreaConfig.h3Resolution);

    // 1. 새로운 헥사곤에 진입했는지 확인
    if (currentH3Index !== lastVisitedHexId) {
      setLastVisitedHexId(currentH3Index);

      // 2. 현재 위치가 우리 그리드 안에 있는지 확인
      if (ownedHexes[currentH3Index]) {
        const currentHex = ownedHexes[currentH3Index];

        if (currentHex.team === myTeam) {
          // [수정] 이미 내 팀 땅인 곳에 가면 게이지 +60 및 레벨업 로직
          console.log(`♻️ 내 팀 땅 재방문! 게이지 충전 (+60)`);

          setPaintballGauge(prev => {
            const nextGauge = prev + 60;
            if (nextGauge >= 100) {
              setPaintballCount(count => count + 1); // 개수 +1
              return nextGauge - 100; // 100 제외한 나머지 값으로 리셋
            }
            return nextGauge;
          });
        } else {
          // [기존] 내 팀 땅이 아니라면 점령
          console.log(`🚩 땅 점령! ${currentH3Index} : ${currentHex.team || 'None'} -> ${myTeam}`);

          setOwnedHexes(prev => ({
            ...prev,
            [currentH3Index]: {
              ...prev[currentH3Index],
              team: myTeam, // 내 팀으로 변경
              ownerId: user?.id || 'me'
            }
          }));

          setHasAcquiredHex(true); // 도장 쾅!
        }
      }
    }
  }, [location, myTeam]); // location이나 myTeam이 바뀌면 체크

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

      // 3. 소켓 연결 및 내 참가 상태 확인
      if (roomId) {
        await socketService.connect(roomId);
        setupSocketListeners();

        // [추가] 내가 현재 기록 중인지 확인하여 UI 상태 동기화
        try {
          const roomData = await getMyRoom();
          if (roomData && roomData.my_participant) {
            const part = roomData.my_participant;
            if (part.is_recording) {
              console.log('🔄 기존 기록 세션 발견. UI 상태를 동기화합니다.');
              updateIsRecording(true);
              setCurrentRecordId(part.current_record_id);

              // 현재 시간과 시작 시간의 차이로 타이머 초기화
              if (part.current_record_started_at) {
                const startTime = new Date(part.current_record_started_at).getTime();
                const now = new Date().getTime();
                const diffSec = Math.floor((now - startTime) / 1000);
                if (diffSec > 0) {
                  setRecordingTime(diffSec);
                  recordingTimeRef.current = diffSec;
                }
              }
            }

            // 내 팀 정보 설정 (백엔드에서 가져온 값 사용)
            if (roomData.my_participant?.team) {
              setMyTeam(roomData.my_participant.team);
            }
          }

          // 게임 영역 설정 (백엔드 game_area에서 가져온 값 사용)
          let config = DEFAULT_GAME_CONFIG;
          if (roomData?.game_area) {
            const ga = roomData.game_area;
            // bounds에서 중심값 계산 (bounds가 폴리곤 좌표 배열인 경우)
            let center = DEFAULT_GAME_CONFIG.center;
            if (ga.bounds && ga.bounds.coordinates) {
              // GeoJSON 형식: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
              const coords = ga.bounds.coordinates[0];
              if (coords && coords.length > 0) {
                const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
                const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
                center = {
                  latitude: sumLat / coords.length,
                  longitude: sumLng / coords.length
                };
              }
            } else if (ga.center_lat && ga.center_lng) {
              center = { latitude: ga.center_lat, longitude: ga.center_lng };
            }

            config = {
              name: ga.name || DEFAULT_GAME_CONFIG.name,
              city: ga.city || DEFAULT_GAME_CONFIG.city,
              center: center,
              h3Resolution: 8, // 모든 곳에서 H3 resolution 8 사용
              gridRadius: 15,
            };
            setGameAreaConfig(config);
          }

          // 점령 상태를 initHexGrid에 전달
          initHexGrid(config, roomData?.current_hex_ownerships || {});
        } catch (err) {
          console.log('상태 동기화 중 오류 (무시 가능):', err);
          initHexGrid(DEFAULT_GAME_CONFIG); // 에러 시 빈 그리드로 초기화
        }
      } else {
        initHexGrid(DEFAULT_GAME_CONFIG); // roomId가 없으면 빈 그리드
      }
    };

    initGame();

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

    // 게임 종료 이벤트
    socketService.on('game_ended', (data) => {
      console.log('게임 종료 이벤트 수신:', data);
      // 게임 종료 결과 저장 (백엔드 payload 형식에 맞게 처리)
      setGameEndResult({
        winnerTeam: data.winner_team || data.winnerTeam,
        mvpUser: data.mvp_username || data.mvp_user?.username || data.mvpUser?.username || data.mvpUser || null,
        teamACount: data.team_a_count || data.teamACount || 0,
        teamBCount: data.team_b_count || data.teamBCount || 0,
      });
      // WebSocket으로 기록 중지 전송 (백엔드에서 거리 포함하여 저장)
      if (isRecordingRef.current) {
        socketService.send('stop_recording', {});
        updateIsRecording(false);
      }
      // 백그라운드 위치 추적 중지
      BackgroundLocationService.stopTracking().catch(console.error);
      // 모달 표시
      setShowGameEndModal(true);
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

            // WebSocket으로 기록 종료 전송 (백엔드에서 거리/페이스 저장)
            if (roomId) {
              socketService.send('stop_recording', {});
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

  // 헥사곤 터치 핸들러
  const handleHexPress = (h3Id) => {
    // 조준 중일 때
    if (aimingHexes.length > 0) {
      // 클릭한 헥사곤이 조준 범위 안에 있는지 확인
      if (!aimingHexes.includes(h3Id)) {
        // 범위 밖 클릭 -> 조준 해제
        setAimingHexes([]);
        setAimingType(null);
        return;
      }

      // 현재 내 위치의 H3 ID
      if (!location) return;
      const currentH3Index = latLngToCell(location.latitude, location.longitude, KAIST_CONFIG.h3Resolution);

      // k-ring 거리 계산
      const distance = gridDistance(currentH3Index, h3Id);
      console.log(`🎯 헥사곤 선택: ${h3Id}, 거리: k=${distance}`);

      // 시각적 연출: 클릭한 것만 남기고 깜빡임 멈춤
      setAimingHexes([h3Id]);
      setSelectedHexId(h3Id); // 흰색 테두리 효과를 위해 함께 설정

      // 거리에 따른 페인트볼 종류 결정
      if (distance === 0) {
        // 내 위치 헥사곤 -> 그냥 선택만
        setSelectedHexId(h3Id);
        setAimingHexes([]);
        return;
      }

      const isSuper = distance === 2;
      const itemName = isSuper ? '슈퍼페인트볼' : '페인트볼';
      const currentCount = isSuper ? superPaintballCount : paintballCount;

      if (currentCount < 1) {
        Alert.alert('사용 불가', `${itemName}이 부족합니다. (현재: ${currentCount}개)`);
        return;
      }

      // 사용 확인 팝업
      Alert.alert(
        `${itemName} 사용`,
        `${itemName}을 사용하시겠습니까?\n(잔여: ${currentCount}개)`,
        [
          {
            text: '취소',
            style: 'cancel',
            onPress: () => {
              setAimingHexes([]);
              setAimingType(null);
            }
          },
          {
            text: '사용',
            style: 'destructive',
            onPress: () => {
              // 개수 차감
              if (isSuper) {
                setSuperPaintballCount(prev => prev - 1);
              } else {
                setPaintballCount(prev => prev - 1);
              }

              // 해당 헥사곤 점령 (색깔 변경 핵심 로직)
              setOwnedHexes(prev => ({
                ...prev,
                [h3Id]: {
                  ...prev[h3Id],
                  team: myTeam || 'A', // 내 팀이 설정되어 있지 않다면 기본 A팀으로 설정
                  ownerId: 'me'
                }
              }));

              console.log(`🎨 ${itemName} 사용! ${h3Id} 점령 완료 (팀: ${myTeam || 'A'})`);

              // [추가] 땅을 획득했으므로 출석 버튼 도장 활성화
              setHasAcquiredHex(true);
              console.log('🔨 hasAcquiredHex 상태를 true로 설정 (아이템 사용)');

              // 시각적 정리: 조준 및 선택 효과 제거
              setSelectedHexId(null);
              setAimingHexes([]);
              setAimingType(null);
            }
          }
        ]
      );
      return;
    }

    // 일반 모드: 토글 선택
    console.log('Hex Pressed:', h3Id);
    setSelectedHexId(prev => prev === h3Id ? null : h3Id);
  };

  // 일반 페인트볼 롱프레스 (내 주변 1칸 깜빡임)
  const handlePaintballLongPress = () => {
    if (!location) return;
    const currentH3Index = latLngToCell(location.latitude, location.longitude, KAIST_CONFIG.h3Resolution);
    // k=1 (1칸 범위)
    const neighbors = gridDisk(currentH3Index, 1);
    setAimingHexes(neighbors);
    setAimingType('normal');
    console.log('🎯 일반 페인트볼 조준 시작:', neighbors.length);
  };

  // 슈퍼 페인트볼 롱프레스 (내 주변 2칸 깜빡임)
  const handleSuperPaintballLongPress = () => {
    if (!location) return;
    const currentH3Index = latLngToCell(location.latitude, location.longitude, KAIST_CONFIG.h3Resolution);
    // k=2 (2칸 범위)
    const neighbors = gridDisk(currentH3Index, 2);
    setAimingHexes(neighbors);
    setAimingType('super');
    console.log('🎯 슈퍼 페인트볼 조준 시작:', neighbors.length);
  };

  // 페인트볼 교환: 일반 3개 -> 슈퍼 1개 (아래 화살표 ↓)
  const exchangeToSuper = () => {
    if (paintballCount < 3) {
      Alert.alert('교환 실패', '일반 페인트볼이 3개 이상 필요합니다.');
      return;
    }

    Alert.alert(
      '슈퍼 페인트볼 제작',
      '일반 페인트볼 3개를 슈퍼 페인트볼 1개로 교환하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '교환',
          onPress: () => {
            setPaintballCount(prev => prev - 3);
            setSuperPaintballCount(prev => prev + 1);
          }
        }
      ]
    );
  };

  // 페인트볼 교환: 슈퍼 1개 -> 일반 3개 (위 화살표 ↑)
  const exchangeToRegular = () => {
    if (superPaintballCount < 1) {
      Alert.alert('교환 실패', '보유한 슈퍼 페인트볼이 없습니다.');
      return;
    }

    Alert.alert(
      '페인트볼 분해',
      '슈퍼 페인트볼 1개를 일반 페인트볼 3개로 분해하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '분해',
          onPress: () => {
            setSuperPaintballCount(prev => prev - 1);
            setPaintballCount(prev => prev + 3);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* 지도 영역 (전체 배경) */}
      <View style={styles.mapContainer}>
        <GoogleMapView
          ref={mapRef}
          style={styles.map}
          initialCenter={gameAreaConfig.center}
          initialZoom={16}
          onMapReady={handleMapReady}
          onCameraChange={handleCameraChange}
        >
          {/* 게임 영역 중심 마커 */}
          <Marker
            coordinate={gameAreaConfig.center}
            title={gameAreaConfig.name || '게임 영역 중심'}
          >
            <View style={{ backgroundColor: 'red', padding: 10, borderRadius: 20 }}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>CENTER</Text>
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
              const isHighlighted = highlightedTeam !== null && highlightedTeam === data.team;
              const isDimmed = highlightedTeam && highlightedTeam !== data.team;

              const isSelected = selectedHexId === h3Id;
              const isAiming = aimingHexes.includes(h3Id); // 조준 대상인가?
              const opacityBoost = isSelected ? 0.3 : 0;

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

                const opacity = Math.min(0.9 + opacityBoost, 1.0);
                const fillColor = data.team === 'A' ? `rgba(33, 150, 243, ${opacity})` : `rgba(255, 152, 0, ${opacity})`;
                const strokeColor = isSelected ? '#FFFFFF' : (data.team === 'A' ? '#1565C0' : '#E65100');

                polygons.push(
                  <Polygon
                    key={`${h3Id}-main`}
                    coordinates={floatedCoordinates}
                    fillColor={fillColor}
                    strokeColor={strokeColor}
                    strokeWidth={isSelected ? 3 : 2}
                    zIndex={2}
                    tappable={true}
                    onPress={() => handleHexPress(h3Id)}
                  />
                );
              } else {
                // 일반 상태 (Highligh 아님)
                let baseColor, baseOpacity, strokeColor;

                if (data.team === 'A') {
                  baseColor = '33, 150, 243';
                  strokeColor = '#1976D2';
                  baseOpacity = isDimmed ? 0.1 : 0.3;
                } else if (data.team === 'B') {
                  baseColor = '255, 152, 0';
                  strokeColor = '#F57C00';
                  baseOpacity = isDimmed ? 0.1 : 0.3;
                } else {
                  // 미점령 (회색) - 더 투명하게
                  baseColor = '50, 50, 50';
                  strokeColor = '#444444';
                  baseOpacity = isDimmed ? 0.15 : 0.25;
                }

                const opacity = Math.min(baseOpacity + opacityBoost, 1.0);

                // 조준 중일 때는 핑크색 깜빡임으로 덮어씀
                const finalFillColor = isAiming
                  ? `rgba(255, 64, 129, ${blinkOpacity})`
                  : `rgba(${baseColor}, ${opacity})`;

                const finalStrokeColor = isSelected ? '#FFFFFF' : (isAiming ? '#FF4081' : (isDimmed ? 'transparent' : strokeColor));
                const finalZIndex = isAiming ? 20 : (isSelected ? 10 : 1);

                polygons.push(
                  <Polygon
                    key={`${h3Id}-${finalFillColor}`}
                    coordinates={coordinates}
                    fillColor={finalFillColor}
                    strokeColor={finalStrokeColor}
                    strokeWidth={isSelected ? 3 : (isAiming ? 2 : 1)}
                    zIndex={finalZIndex}
                    tappable={true}
                    onPress={() => handleHexPress(h3Id)}
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
        {/* 일반 페인트볼 (New) */}
        <TouchableOpacity
          style={[styles.hexCounterItem, { alignSelf: 'flex-start', marginBottom: 2, top: -5, zIndex: 5, backgroundColor: aimingType === 'normal' ? 'rgba(255, 64, 129, 0.9)' : 'rgba(230, 230, 230, 0.8)', padding: 6, borderRadius: 12 }]}
          onPress={() => {
            setAimingHexes([]);
            setAimingType(null);
          }}
          onLongPress={handlePaintballLongPress}
          delayLongPress={500}
          activeOpacity={0.7}
        >
          <Image
            source={paintItemIcon}
            style={{
              width: 48,
              height: 48,
              resizeMode: 'contain',
              tintColor: myTeam === 'B' ? '#FF9800' : '#2196F3'
            }}
          />
          <Text style={[styles.hexCountText, { color: myTeam === 'B' ? '#E65100' : '#1565C0', marginLeft: -2, marginRight: 8, fontSize: 20, fontWeight: 'bold' }]}>
            {paintballCount}
          </Text>
        </TouchableOpacity>

        {/* 교환 화살표 UI 영역 (중첩 배치) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, marginVertical: -10, zIndex: 10, gap: 0 }}>
          {/* 위쪽으로 (분해): 슈퍼 1 -> 일반 3 */}
          <TouchableOpacity
            onLongPress={exchangeToRegular}
            delayLongPress={500}
            style={{ padding: 0 }}
          >
            <MaterialCommunityIcons name="arrow-up-bold" size={40} color="black" />
          </TouchableOpacity>

          {/* 아래쪽으로 (제작): 일반 3 -> 슈퍼 1 */}
          <TouchableOpacity
            onLongPress={exchangeToSuper}
            delayLongPress={500}
            style={{ padding: 0 }}
          >
            <MaterialCommunityIcons name="arrow-down-bold" size={40} color="black" />
          </TouchableOpacity>
        </View>

        {/* 슈퍼 페인트볼 (위쪽에 배치) */}
        <TouchableOpacity
          style={[styles.hexCounterItem, { alignSelf: 'flex-start', marginTop: 2, zIndex: 5, backgroundColor: aimingType === 'super' ? 'rgba(255, 64, 129, 0.9)' : 'rgba(200, 200, 200, 0.9)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 }]}
          onPress={() => {
            setAimingHexes([]);
            setAimingType(null);
          }}
          onLongPress={handleSuperPaintballLongPress}
          delayLongPress={500}
          activeOpacity={0.7}
        >
          <Image
            source={paintItemIcon}
            style={{ width: 60, height: 60, resizeMode: 'contain' }}
          />
          <Text style={[styles.hexCountText, { color: '#FF4081', marginLeft: -2, marginRight: 8, fontSize: 26, fontWeight: 'bold' }]}>
            {superPaintballCount}
          </Text>
        </TouchableOpacity>

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
            {(() => {
              const shouldShowStamp = hasAcquiredHex || attendanceData?.attended_today;
              console.log('🔍 도장 표시 조건:', { hasAcquiredHex, attended_today: attendanceData?.attended_today, shouldShowStamp });
              return shouldShowStamp && (
                <Image
                  source={paintItemIcon}
                  style={{
                    width: 85,
                    height: 85,
                    resizeMode: 'contain',
                    position: 'absolute',
                    transform: [{ rotate: '-15deg' }], // 도장처럼 살짝 기울임
                    tintColor: '#FF4081', // 슈퍼 페인트볼 색상 (핑크)
                    opacity: 0.8,
                  }}
                />
              );
            })()}
          </TouchableOpacity>

          {/* 연속 출석일 라벨 (버튼 옆) */}
          {attendanceData && (
            <View style={styles.daysLabelContainer}>
              <Text style={styles.daysLabelText}>연속 {displayDays}일차</Text>
            </View>
          )}
        </View>
      </View>

      {/* 오른족 실린더형 페인트볼 게이지 (New) */}
      <View style={styles.rightGaugeContainer}>
        <View style={styles.cylinderTube}>
          {/* 눈금 표시 (선택사항) */}
          {[...Array(5)].map((_, i) => (
            <View key={i} style={[styles.gaugeTick, { bottom: (i + 1) * 25 }]} />
          ))}

          {/* 실제 채워지는 게이지 */}
          <View
            style={[
              styles.cylinderFill,
              {
                height: `${Math.min(paintballGauge, 100)}%`,
                backgroundColor: myTeam === 'B'
                  ? `rgba(255, 152, 0, ${0.4 + (Math.min(paintballGauge, 100) / 100) * 0.6})`
                  : `rgba(33, 150, 243, ${0.4 + (Math.min(paintballGauge, 100) / 100) * 0.6})`,
                shadowColor: myTeam === 'B' ? '#FF9800' : '#2196F3',
              }
            ]}
          >
            {/* 상단 액체 표면 효과 */}
            <View style={styles.liquidTop} />
          </View>
        </View>

        {/* 하단 캡 */}
        <View style={styles.cylinderCap} />

        {/* 아이콘 표시 */}
        <View style={styles.gaugeIconContainer}>
          <Ionicons
            name="flask-outline"
            size={18}
            color="white"
          />
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

      {/* 게임 종료 결과 모달 */}
      <Modal visible={showGameEndModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.gameEndModalContent}>
            <Text style={styles.gameEndTitle}>게임 종료</Text>
            {gameEndResult && (
              <View style={styles.gameEndResult}>
                {/* 승리 팀 */}
                <View style={styles.gameEndSection}>
                  <Text style={styles.gameEndSectionTitle}>승리 팀</Text>
                  <Text style={[
                    styles.gameEndWinner,
                    gameEndResult.winnerTeam === 'A' && styles.gameEndWinnerA,
                    gameEndResult.winnerTeam === 'B' && styles.gameEndWinnerB,
                  ]}>
                    {gameEndResult.winnerTeam === 'A' ? 'A팀 승리!' :
                      gameEndResult.winnerTeam === 'B' ? 'B팀 승리!' : '무승부'}
                  </Text>
                </View>

                {/* 점수 */}
                <View style={styles.gameEndSection}>
                  <Text style={styles.gameEndSectionTitle}>최종 점수</Text>
                  <View style={styles.gameEndScores}>
                    <View style={styles.gameEndScoreItem}>
                      <Text style={styles.gameEndScoreLabel}>A팀</Text>
                      <Text style={styles.gameEndScoreValue}>{gameEndResult.teamACount}개</Text>
                    </View>
                    <Text style={styles.gameEndScoreDivider}>:</Text>
                    <View style={styles.gameEndScoreItem}>
                      <Text style={styles.gameEndScoreLabel}>B팀</Text>
                      <Text style={styles.gameEndScoreValue}>{gameEndResult.teamBCount}개</Text>
                    </View>
                  </View>
                </View>

                {/* MVP */}
                {gameEndResult.mvpUser && (
                  <View style={styles.gameEndSection}>
                    <Text style={styles.gameEndSectionTitle}>MVP</Text>
                    <Text style={styles.gameEndMvp}>
                      {typeof gameEndResult.mvpUser === 'string'
                        ? gameEndResult.mvpUser
                        : (gameEndResult.mvpUser.username || gameEndResult.mvpUser)}
                    </Text>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity
              style={styles.gameEndButton}
              onPress={() => {
                setShowGameEndModal(false);
                // GameMainScreen으로 이동
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'GameMain' }],
                });
              }}
            >
              <Text style={styles.gameEndButtonText}>확인</Text>
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
    bottom: 33, // 조금 더 위로 (터치 영역 확보)
    left: 10,
    alignItems: 'flex-start',
    zIndex: 9999, // 최상위 보장
  },
  hexCounterContainer: {
    flexDirection: 'row', // 아이콘들 가로 배치
    marginTop: 8, // 위쪽 요소(슈퍼 페인트볼)와의 간격 추가
    marginBottom: 8,
    gap: 12,
  },
  hexCounterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 6,
  },
  hexCounterItemHighlighted: {
    backgroundColor: 'rgba(255, 255, 255, 1)', // 완전 불투명
    borderWidth: 2,
    borderColor: '#4CAF50', // 초록 테두리
    transform: [{ scale: 1.05 }], // 살짝 확대
  },
  hexIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  hexCountText: {
    fontSize: 16,
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
  // 게임 종료 모달 스타일
  gameEndModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  gameEndTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 20,
  },
  gameEndResult: {
    width: '100%',
    marginBottom: 20,
  },
  gameEndSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  gameEndSectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  gameEndWinner: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003D7A',
  },
  gameEndWinnerA: {
    color: '#2196F3',
  },
  gameEndWinnerB: {
    color: '#FF6B35',
  },
  gameEndScores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  gameEndScoreItem: {
    alignItems: 'center',
  },
  gameEndScoreLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  gameEndScoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#003D7A',
  },
  gameEndScoreDivider: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#999',
  },
  gameEndMvp: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6B35',
  },
  gameEndButton: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    backgroundColor: '#003D7A',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  gameEndButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // 실린더 게이지 스타일
  rightGaugeContainer: {
    position: 'absolute',
    right: 20,
    bottom: 180,
    alignItems: 'center',
    zIndex: 100,
  },
  cylinderTube: {
    width: 40,
    height: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cylinderFill: {
    width: '100%',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  liquidTop: {
    height: 4,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    position: 'absolute',
    top: 0,
  },
  gaugeTick: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cylinderCap: {
    width: 46,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginTop: -4,
    zIndex: 101,
  },
  gaugeIconContainer: {
    marginTop: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  }
});
