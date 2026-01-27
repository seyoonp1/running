import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

// 위치 콜백을 저장할 변수
let locationCallback = null;

// 백그라운드 태스크 정의 (파일 최상단에서 정의해야 함)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('[BackgroundLocation] Error:', error.message);
        return;
    }

    if (data) {
        const { locations } = data;
        const location = locations[0];

        if (location && locationCallback) {
            const timestamp = new Date().toLocaleTimeString('ko-KR');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📍 [GPS 수신] ${timestamp}`);
            console.log(`   위도: ${location.coords.latitude.toFixed(6)}`);
            console.log(`   경도: ${location.coords.longitude.toFixed(6)}`);
            console.log(`   정확도: ${location.coords.accuracy?.toFixed(1)}m`);
            console.log(`   속도: ${location.coords.speed?.toFixed(1) || 'N/A'} m/s`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            locationCallback({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy,
                timestamp: location.timestamp,
            });
        }
    }
});

const BackgroundLocationService = {
    /**
     * 백그라운드 위치 추적 시작
     * @param {Function} callback - 새 위치가 감지될 때마다 호출될 함수
     * @returns {Promise<boolean>} - 성공 여부
     */
    async startTracking(callback) {
        try {
            // 포그라운드 권한 요청
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            if (foregroundStatus !== 'granted') {
                console.error('[BackgroundLocation] Foreground permission denied');
                return false;
            }

            // 백그라운드 권한 요청
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus !== 'granted') {
                console.warn('[BackgroundLocation] Background permission denied - will only track in foreground');
                // 백그라운드 권한이 없어도 포그라운드에서는 작동하므로 계속 진행
            }

            // 콜백 저장
            locationCallback = callback;

            // 이미 실행 중인지 확인
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);

            if (hasStarted) {
                console.log('[BackgroundLocation] Task already running, stopping first...');
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            }

            // 백그라운드 위치 추적 시작
            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                accuracy: Location.Accuracy.BestForNavigation, // 최상위 정확도 (내비게이션 등급)
                distanceInterval: 1, // 1미터마다 업데이트
                timeInterval: 1000, // 최소 1초 간격
                showsBackgroundLocationIndicator: true, // iOS: 상태바에 위치 아이콘 표시
                foregroundService: {
                    notificationTitle: 'Running 기록 중',
                    notificationBody: '백그라운드에서 실시간 위치를 추적하고 있습니다.',
                    notificationColor: '#003D7A',
                },
                pausesUpdatesAutomatically: false,
                activityType: Location.ActivityType.Fitness, // 피트니스 활동으로 최적화
            });

            console.log('[BackgroundLocation] Started tracking');
            return true;
        } catch (error) {
            console.error('[BackgroundLocation] Failed to start:', error);
            return false;
        }
    },

    /**
     * 백그라운드 위치 추적 중지
     */
    async stopTracking() {
        try {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);

            if (hasStarted) {
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                console.log('[BackgroundLocation] Stopped tracking');
            }

            locationCallback = null;
            return true;
        } catch (error) {
            console.error('[BackgroundLocation] Failed to stop:', error);
            return false;
        }
    },

    /**
     * 현재 추적 중인지 확인
     */
    async isTracking() {
        try {
            return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        } catch {
            return false;
        }
    },

    /**
     * 콜백 함수 업데이트 (화면이 다시 포커스될 때 사용)
     */
    updateCallback(callback) {
        locationCallback = callback;
    },
};

export default BackgroundLocationService;
export { BACKGROUND_LOCATION_TASK };
