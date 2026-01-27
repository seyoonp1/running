import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Platform } from 'react-native';
import MapView, { Polyline, Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const GoogleMapView = forwardRef(({
    style,
    initialCenter = { latitude: 37.5665, longitude: 126.9780 },
    initialZoom = 16,
    onMapReady,
    onCameraChange,
}, ref) => {
    const mapRef = useRef(null);

    // 지도 준비 완료 핸들러
    const handleMapReady = () => {
        console.log('Google Maps Ready');
        onMapReady && onMapReady();
    };

    // 지역 변경 핸들러
    const handleRegionChangeComplete = (region) => {
        onCameraChange && onCameraChange({
            latitude: region.latitude,
            longitude: region.longitude,
            zoom: region.latitudeDelta, // 줌 레벨 근사값
        });
    };

    // 외부에서 호출 가능한 메서드들
    useImperativeHandle(ref, () => ({
        drawPolyline: () => {
            // react-native-maps에서는 컴포넌트로 직접 렌더링
            console.log('Polyline은 컴포넌트로 직접 렌더링하세요');
        },
        drawPolygons: () => {
            console.log('Polygon은 컴포넌트로 직접 렌더링하세요');
        },
        drawMarkers: () => {
            console.log('Marker는 컴포넌트로 직접 렌더링하세요');
        },
        updateMyLocation: (latitude, longitude) => {
            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
            }
        },
        moveCamera: (latitude, longitude) => {
            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
            }
        },
    }), []);

    return (
        <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={[styles.map, style]}
            initialRegion={{
                latitude: initialCenter.latitude,
                longitude: initialCenter.longitude,
                latitudeDelta: 0.0922 / initialZoom,
                longitudeDelta: 0.0421 / initialZoom,
            }}
            onMapReady={handleMapReady}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation={true}
            showsMyLocationButton={true}
        />
    );
});

const styles = StyleSheet.create({
    map: {
        flex: 1,
    },
});

export default GoogleMapView;
