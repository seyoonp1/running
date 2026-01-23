// 러닝 계산 유틸리티

/**
 * 두 좌표 간 거리 계산 (Haversine 공식)
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 미터 단위
};

/**
 * 총 거리 계산
 */
export const calculateTotalDistance = (locations) => {
  if (locations.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    totalDistance += calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );
  }

  return totalDistance; // 미터 단위
};

/**
 * 페이스 계산 (분/km)
 */
export const calculatePace = (distance, timeInSeconds) => {
  if (distance === 0 || timeInSeconds === 0) return 0;
  const distanceInKm = distance / 1000;
  const timeInMinutes = timeInSeconds / 60;
  return timeInMinutes / distanceInKm;
};

/**
 * 속도 계산 (km/h)
 */
export const calculateSpeed = (distance, timeInSeconds) => {
  if (timeInSeconds === 0) return 0;
  const distanceInKm = distance / 1000;
  const timeInHours = timeInSeconds / 3600;
  return distanceInKm / timeInHours;
};

/**
 * 칼로리 계산 (대략적)
 */
export const calculateCalories = (distance, weight = 70) => {
  // 대략적인 공식: 1km당 1kcal/kg
  const distanceInKm = distance / 1000;
  return Math.round(distanceInKm * weight);
};

/**
 * 시간 포맷팅 (초 -> MM:SS)
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 거리 포맷팅 (미터 -> km 또는 m)
 */
export const formatDistance = (meters) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
};

/**
 * 페이스 포맷팅 (분/km -> MM:SS/km)
 */
export const formatPace = (paceInMinutes) => {
  const mins = Math.floor(paceInMinutes);
  const secs = Math.round((paceInMinutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/km`;
};
