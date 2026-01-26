import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { searchUsers, sendFriendRequest } from '../services/friendService';

export default function FriendSearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState({});

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      Alert.alert('알림', '최소 2자 이상 입력해주세요.');
      return;
    }

    try {
      setSearching(true);
      const data = await searchUsers(searchQuery.trim());
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('검색 실패:', error);
      Alert.alert('오류', '검색에 실패했습니다.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      setSendingRequest((prev) => ({ ...prev, [userId]: true }));
      await sendFriendRequest(userId);
      Alert.alert('성공', '친구 요청을 보냈습니다.');
      // 요청 보낸 사용자는 목록에서 제거하거나 상태 업데이트
      setSearchResults((prev) => prev.filter((user) => user.id !== userId));
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '친구 요청에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setSendingRequest((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>친구 검색</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 검색 입력 */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="사용자 이름 검색 (최소 2자)"
          placeholderTextColor="#999"
          autoCapitalize="none"
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={searching || searchQuery.trim().length < 2}
        >
          {searching ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.searchButtonText}>검색</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 검색 결과 */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {searchResults.length === 0 && searchQuery.length >= 2 && !searching ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
          </View>
        ) : (
          searchResults.map((user) => (
            <View key={user.id} style={styles.resultItem}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user.username?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <Text style={styles.username}>{user.username}</Text>
              </View>
              <TouchableOpacity
                style={styles.requestButton}
                onPress={() => handleSendRequest(user.id)}
                disabled={sendingRequest[user.id]}
              >
                {sendingRequest[user.id] ? (
                  <ActivityIndicator color="#003D7A" size="small" />
                ) : (
                  <Text style={styles.requestButtonText}>친구 추가</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    fontSize: 16,
    color: '#003D7A',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  searchButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#003D7A',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#003D7A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  requestButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003D7A',
    backgroundColor: '#FFFFFF',
  },
  requestButtonText: {
    color: '#003D7A',
    fontSize: 14,
    fontWeight: '600',
  },
});
