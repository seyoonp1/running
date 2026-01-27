/**
 * GPS 좌표 간 거리 계산 및 러닝 통계 유틸리티
 */

/**
 * Haversine 공식을 사용하여 두 GPS 좌표 간의 거리를 계산 (미터 단위)
 * @param {number} lat1 - 첫 번째 좌표의 위도
 * @param {number} lon1 - 첫 번째 좌표의 경도
 * @param {number} lat2 - 두 번째 좌표의 위도
 * @param {number} lon2 - 두 번째 좌표의 경도
 * @returns {number} 두 좌표 간의 거리 (미터)
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
 * 페이스 계산 (분/km)
 * @param {number} distanceMeters - 이동 거리 (미터)
 * @param {number} timeSeconds - 소요 시간 (초)
 * @returns {string} 페이스 (예: "5'30\"")
 */
export const calculatePace = (distanceMeters, timeSeconds) => {
    if (distanceMeters === 0 || timeSeconds === 0) return '--\'--"';

    const distanceKm = distanceMeters / 1000;
    const paceSecondsPerKm = timeSeconds / distanceKm;

    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.floor(paceSecondsPerKm % 60);

    return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
};

/**
 * 속도 계산 (km/h)
 * @param {number} distanceMeters - 이동 거리 (미터)
 * @param {number} timeSeconds - 소요 시간 (초)
 * @returns {number} 속도 (km/h)
 */
export const calculateSpeed = (distanceMeters, timeSeconds) => {
    if (timeSeconds === 0) return 0;
    return (distanceMeters / 1000) / (timeSeconds / 3600);
};

/**
 * 거리를 읽기 쉬운 형식으로 변환
 * @param {number} meters - 거리 (미터)
 * @returns {string} 포맷된 거리 (예: "1.23 km" 또는 "450 m")
 */
export const formatDistance = (meters) => {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
};

/**
 * 시간을 읽기 쉬운 형식으로 변환
 * @param {number} seconds - 시간 (초)
 * @returns {string} 포맷된 시간 (예: "1:23:45" 또는 "23:45")
 */
export const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 칼로리 소모량 계산 (간단한 추정)
 * @param {number} distanceKm - 거리 (km)
 * @param {number} weightKg - 체중 (kg, 기본값 70kg)
 * @returns {number} 소모 칼로리 (kcal)
 */
export const calculateCalories = (distanceKm, weightKg = 70) => {
    // 러닝: 대략 체중(kg) × 거리(km) × 1.036
    return Math.round(weightKg * distanceKm * 1.036);
};
