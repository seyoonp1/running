import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const NAVER_CLIENT_ID = 'nmywoc1kln';

const NaverMapWebView = forwardRef(({
  style,
  initialCenter = { latitude: 37.5665, longitude: 126.9780 },
  initialZoom = 16,
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
  <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_CLIENT_ID}"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100vw; height: 100vh; overflow: hidden; background-color: #32CD32; }
    #map { width: 100vw; height: 100vh; background-color: #32CD32; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map = null;

    function sendToRN(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
      }
    }

    // 인증 실패 시 현재 브라우저가 인식하는 주소를 출력
    window.naver_maps_auth_failure = function() {
      const currentUrl = window.location.href;
      document.body.innerHTML = \`
        <div style="background: #e74c3c; color: white; padding: 20px; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; font-family: sans-serif;">
          <h2 style="margin-bottom: 10px;">❌ 네이버 지도 인증 실패</h2>
          <p>아래 주소(슬래시 여부 확인)를 네이버 콘솔에 등록해주세요:</p>
          <div style="background: rgba(0,0,0,0.2); padding: 10px; margin: 15px 0; border-radius: 5px; font-family: monospace; font-weight: bold;">
            \${currentUrl}
          </div>
          <p style="font-size: 14px;">설정 후 앱을 리로드(r) 해주세요.</p>
        </div>
      \`;
    };

    function initMap() {
      try {
        if (typeof naver === 'undefined' || typeof naver.maps === 'undefined') {
          setTimeout(initMap, 500);
          return;
        }

        const center = new naver.maps.LatLng(${initialCenter.latitude}, ${initialCenter.longitude});
        map = new naver.maps.Map('map', {
          center: center,
          zoom: 15,
        });

        document.getElementById('map').style.backgroundColor = 'white';

        // 큰 빨간 테스트 마커 추가 (지도가 작동하는지 확인용)
        new naver.maps.Marker({
          position: center,
          map: map,
          icon: {
            content: '<div style="width:50px;height:50px;background:red;border:5px solid yellow;border-radius:50%;box-shadow: 0 0 20px rgba(0,0,0,0.5)"></div>',
            anchor: new naver.maps.Point(25, 25)
          }
        });

        // 타일 로드 이벤트 감시
        naver.maps.Event.addListener(map, 'tilesloaded', function() {
          sendToRN('log', { message: '✅ 지도 타일 로딩 완료!' });
        });

        naver.maps.Event.addListener(map, 'idle', function() {
          sendToRN('cameraChange', {
            latitude: map.getCenter().lat(),
            longitude: map.getCenter().lng(),
            zoom: map.getZoom()
          });
        });

        sendToRN('mapReady', { success: true });
        sendToRN('log', { message: '✅ 지도 객체 생성 성공! 빨간 마커를 찾아보세요.' });
      } catch (error) {
        sendToRN('error', { message: '지도 생성 실패: ' + error.message });
      }
    }

    window.handleMessage = function(message) {
      try {
        const { action, data } = JSON.parse(message);
        if (action === 'moveCamera' && map) {
          map.setCenter(new naver.maps.LatLng(data.latitude, data.longitude));
        }
      } catch(e) {}
    };

    window.onload = initMap;
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
    updateMyLocation: (latitude, longitude) => sendMessage('updateMyLocation', { latitude, longitude }),
    moveCamera: (latitude, longitude) => sendMessage('moveCamera', { latitude, longitude }),
  }), [sendMessage]);

  const handleMessage = (event) => {
    try {
      const { type, data } = JSON.parse(event.nativeEvent.data);
      if (type === 'mapReady') onMapReady && onMapReady();
      if (type === 'cameraChange') onCameraChange && onCameraChange(data);
    } catch (e) { }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: getMapHTML(), baseUrl: 'http://localhost/' }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#32CD32' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});

export default NaverMapWebView;
