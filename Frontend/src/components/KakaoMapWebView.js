import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const KAKAO_API_KEY = '78314b03d7381eb894f96318102eab1d';

const KakaoMapWebView = forwardRef(({
  style,
  initialCenter = { latitude: 37.5665, longitude: 126.9780 },
  initialZoom = 3,
  onMapReady,
  onCameraChange,
}, ref) => {
  const webViewRef = useRef(null);

  const getMapHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background-color: #00ff00; }
    #map { width: 100%; height: 100%; background-color: #00ff00; }
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: orange;
      color: white;
      padding: 20px;
      border-radius: 10px;
      font-family: sans-serif;
      z-index: 9999;
      max-width: 80%;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <div id="loading">카카오맵 로딩 중...</div>
  <div id="map"></div>
  <script>
    let map = null;
    let polylines = [];
    let polygons = [];
    let markers = [];
    let myLocationMarker = null;

    function sendToRN(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
      }
    }

    function updateLoadingStatus(message) {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.innerHTML = message;
      }
      sendToRN('log', { message: '📍 ' + message });
    }

    // 즉시 실행
    updateLoadingStatus('HTML 로딩 완료, 카카오 스크립트 로딩 시도...');
    
    // 스크립트 동적 로딩
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}';
    
    script.onload = function() {
      updateLoadingStatus('✅ 카카오 스크립트 로딩 성공!');
      window.kakaoScriptLoaded = true;
    };
    
    script.onerror = function(e) {
      updateLoadingStatus('❌ 카카오 스크립트 로딩 실패<br/>네트워크 또는 보안 설정 문제');
      sendToRN('error', { message: '카카오 스크립트 로딩 실패: 네트워크 차단 또는 API 키 문제' });
    };
    
    document.head.appendChild(script);

    // 스크립트 로딩 타임아웃 체크 (5초)
    setTimeout(function() {
      if (!window.kakaoScriptLoaded && !window.kakaoScriptFailed) {
        updateLoadingStatus('⚠️ 스크립트 로딩 타임아웃 (5초 경과)');
        sendToRN('error', { message: '카카오 스크립트 로딩 타임아웃' });
      }
    }, 5000);

    function initMap() {
      try {
        const loading = document.getElementById('loading');
        
        if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined') {
          updateLoadingStatus('⏳ kakao 객체 대기 중...');
          setTimeout(initMap, 100);
          return;
        }

        updateLoadingStatus('지도 초기화 중...');

        const container = document.getElementById('map');
        const options = {
          center: new kakao.maps.LatLng(${initialCenter.latitude}, ${initialCenter.longitude}),
          level: ${initialZoom}
        };

        map = new kakao.maps.Map(container, options);

        // 로딩 표시 제거 및 배경색 변경
        if (loading) loading.remove();
        document.body.style.backgroundColor = 'white';
        container.style.backgroundColor = 'white';

        // 지도 이동 이벤트
        kakao.maps.event.addListener(map, 'idle', function() {
          const center = map.getCenter();
          sendToRN('cameraChange', {
            latitude: center.getLat(),
            longitude: center.getLng(),
            zoom: map.getLevel()
          });
        });

        sendToRN('mapReady', { success: true });
        sendToRN('log', { message: '✅ 카카오맵 로딩 완료!' });
      } catch (error) {
        updateLoadingStatus('❌ 지도 생성 실패: ' + error.message);
        sendToRN('error', { message: '지도 생성 실패: ' + error.message });
      }
    }

    // window.onload로 초기화 시도
    window.onload = function() {
      updateLoadingStatus('window.onload 실행됨');
      
      // kakao 객체 확인
      if (typeof kakao === 'undefined') {
        updateLoadingStatus('❌ kakao 객체가 전혀 없음 (스크립트 로딩 실패)');
        sendToRN('error', { message: 'kakao 객체가 정의되지 않음' });
        return;
      }
      
      updateLoadingStatus('kakao 객체 발견, maps.load() 호출 중...');
      
      // 카카오맵 SDK는 비동기 초기화가 필요함
      kakao.maps.load(function() {
        updateLoadingStatus('kakao.maps.load 콜백 실행됨, 지도 초기화 시작');
        initMap();
      });
    };

    function drawPolyline(coords, color, width) {
      // 기존 폴리라인 제거
      polylines.forEach(p => p.setMap(null));
      polylines = [];

      if (!map || coords.length < 2) return;

      const path = coords.map(c => new kakao.maps.LatLng(c.latitude, c.longitude));
      const polyline = new kakao.maps.Polyline({
        path: path,
        strokeWeight: width || 4,
        strokeColor: color || '#003D7A',
        strokeOpacity: 1,
        strokeStyle: 'solid'
      });

      polyline.setMap(map);
      polylines.push(polyline);
    }

    function drawPolygons(polygonData) {
      // 기존 폴리곤 제거
      polygons.forEach(p => p.setMap(null));
      polygons = [];

      if (!map) return;

      polygonData.forEach(poly => {
        const path = poly.coords.map(c => new kakao.maps.LatLng(c.latitude, c.longitude));
        const polygon = new kakao.maps.Polygon({
          path: path,
          strokeWeight: 1,
          strokeColor: poly.strokeColor,
          strokeOpacity: 1,
          fillColor: poly.fillColor,
          fillOpacity: 0.4
        });

        polygon.setMap(map);
        polygons.push(polygon);
      });
    }

    function drawMarkers(markerData) {
      // 기존 마커 제거
      markers.forEach(m => m.setMap(null));
      markers = [];

      if (!map) return;

      markerData.forEach(m => {
        const markerContent = document.createElement('div');
        markerContent.style.width = '16px';
        markerContent.style.height = '16px';
        markerContent.style.background = m.color || '#003D7A';
        markerContent.style.border = '2px solid white';
        markerContent.style.borderRadius = '50%';

        const customOverlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(m.latitude, m.longitude),
          content: markerContent
        });

        customOverlay.setMap(map);
        markers.push(customOverlay);
      });
    }

    function updateMyLocation(lat, lng) {
      if (!map) return;

      const position = new kakao.maps.LatLng(lat, lng);

      if (!myLocationMarker) {
        const markerContent = document.createElement('div');
        markerContent.style.width = '20px';
        markerContent.style.height = '20px';
        markerContent.style.background = '#4285F4';
        markerContent.style.border = '3px solid white';
        markerContent.style.borderRadius = '50%';
        markerContent.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';

        myLocationMarker = new kakao.maps.CustomOverlay({
          position: position,
          content: markerContent
        });

        myLocationMarker.setMap(map);
      } else {
        myLocationMarker.setPosition(position);
      }
    }

    function moveCamera(lat, lng) {
      if (!map) return;
      const moveLatLon = new kakao.maps.LatLng(lat, lng);
      map.setCenter(moveLatLon);
    }

    window.handleMessage = function(message) {
      try {
        const { action, data } = JSON.parse(message);
        switch(action) {
          case 'drawPolyline':
            drawPolyline(data.coords, data.color, data.width);
            break;
          case 'drawPolygons':
            drawPolygons(data.polygons);
            break;
          case 'drawMarkers':
            drawMarkers(data.markers);
            break;
          case 'updateMyLocation':
            updateMyLocation(data.latitude, data.longitude);
            break;
          case 'moveCamera':
            moveCamera(data.latitude, data.longitude);
            break;
        }
      } catch(e) {
        sendToRN('error', { message: 'handleMessage error: ' + e.message });
      }
    };
  </script>
</body>
</html>
    `;
  };

  const sendMessage = useCallback((action, data) => {
    if (webViewRef.current) {
      const message = JSON.stringify({ action, data });
      webViewRef.current.injectJavaScript(`window.handleMessage('${message.replace(/'/g, "\\'")}'); true;`);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    drawPolyline: (coords, color, width) => sendMessage('drawPolyline', { coords, color, width }),
    drawPolygons: (polygons) => sendMessage('drawPolygons', { polygons }),
    drawMarkers: (markers) => sendMessage('drawMarkers', { markers }),
    updateMyLocation: (latitude, longitude) => sendMessage('updateMyLocation', { latitude, longitude }),
    moveCamera: (latitude, longitude) => sendMessage('moveCamera', { latitude, longitude }),
  }), [sendMessage]);

  const handleMessage = (event) => {
    try {
      const { type, data } = JSON.parse(event.nativeEvent.data);
      if (type === 'mapReady') onMapReady && onMapReady();
      if (type === 'cameraChange') onCameraChange && onCameraChange(data);
      if (type === 'log') console.log('[KakaoMap]', data.message);
      if (type === 'error') console.error('[KakaoMap Error]', data.message);
    } catch (e) {
      console.error('WebView message parse error:', e);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: getMapHTML(), baseUrl: 'https://dapi.kakao.com' }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        cacheEnabled={false}
        allowFileAccess={true}
        mixedContentMode="always"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
});

export default KakaoMapWebView;
