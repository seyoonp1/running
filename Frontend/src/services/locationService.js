// 위치 추적 서비스
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';

// 위치 권한 요청
export const requestLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    alert('위치 권한이 필요합니다.');
    return false;
  }
  
  const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus.status !== 'granted') {
    alert('백그라운드 위치 권한이 필요합니다.');
    return false;
  }
  
  return true;
};

// 위치 추적 시작
export const startLocationTracking = async (onLocationUpdate) => {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000, // 1초마다 업데이트
    distanceInterval: 1, // 1미터마다 업데이트
    foregroundService: {
      notificationTitle: '러닝 추적 중',
      notificationBody: '앱이 러닝을 추적하고 있습니다.',
    },
  });
};

// 위치 추적 중지
export const stopLocationTracking = async () => {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
};

// 백그라운드 태스크 정의
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Location tracking error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    // 위치 업데이트 처리
    console.log('Location update:', locations);
  }
});
