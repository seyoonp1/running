import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LandingScreen from '../screens/LandingScreen';
import SignUpScreen from '../screens/SignUpScreen';
import LoginScreen from '../screens/LoginScreen';
import GameMainScreen from '../screens/GameMainScreen';
import CreateRoomScreen from '../screens/CreateRoomScreen';
import RoomDetailScreen from '../screens/RoomDetailScreen';
import JoinRoomScreen from '../screens/JoinRoomScreen';
import GamePlayScreen from '../screens/GamePlayScreen';
import RecordListScreen from '../screens/RecordListScreen';
import RecordStatsScreen from '../screens/RecordStatsScreen';
import FriendListScreen from '../screens/FriendListScreen';
import FriendSearchScreen from '../screens/FriendSearchScreen';
import MailboxScreen from '../screens/MailboxScreen';
import { AuthProvider } from '../contexts/AuthContext';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Landing"
          screenOptions={{
            headerShown: false, // 헤더 숨기기
          }}
        >
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="GameMain" component={GameMainScreen} />
          <Stack.Screen name="CreateRoom" component={CreateRoomScreen} />
          <Stack.Screen name="RoomDetail" component={RoomDetailScreen} />
          <Stack.Screen name="JoinRoom" component={JoinRoomScreen} />
          <Stack.Screen name="GamePlay" component={GamePlayScreen} />
          <Stack.Screen name="RecordList" component={RecordListScreen} />
          <Stack.Screen name="RecordStats" component={RecordStatsScreen} />
          <Stack.Screen name="FriendList" component={FriendListScreen} />
          <Stack.Screen name="FriendSearch" component={FriendSearchScreen} />
          <Stack.Screen name="Mailbox" component={MailboxScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
