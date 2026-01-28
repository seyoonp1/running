import React, { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, NativeModules } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';

// 스플래시 스크린 자동 숨김 방지
SplashScreen.preventAutoHideAsync();

// 개발 모드에서 흔들기 등으로 개발자 메뉴가 뜨는 것을 방지
if (__DEV__) {
  const DevMenu = NativeModules.DevMenu;
  if (DevMenu) {
    // 메뉴 표시 함수를 아무 동작도 하지 않는 함수로 덮어씌움
    DevMenu.show = () => { };
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'NanumPenScript': require('./assets/fonts/NanumPenScript-Regular.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar style="auto" />
      <AppNavigator />
    </View>
  );
}
