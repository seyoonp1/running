import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { getMailbox, respondToMail } from '../services/mailboxService';

export default function MailboxScreen({ navigation }) {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, friend_request, room_invite
  const [responding, setResponding] = useState({});

  useEffect(() => {
    loadMailbox();
  }, [filter]);

  const loadMailbox = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter === 'unread') params.status = 'unread';
      if (filter === 'friend_request') params.mail_type = 'friend_request';
      if (filter === 'room_invite') params.mail_type = 'room_invite';
      
      const data = await getMailbox(params);
      setMails(data.results || []);
    } catch (error) {
      console.error('우편함 로드 실패:', error);
      setMails([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMailbox();
  };

  const handleRespond = async (mailId, accept) => {
    try {
      setResponding((prev) => ({ ...prev, [mailId]: true }));
      const result = await respondToMail(mailId, accept);
      
      Alert.alert('성공', result.message, [
        {
          text: '확인',
          onPress: () => {
            // 방 초대 수락 시 방 상세로 이동
            if (accept && result.room) {
              navigation.navigate('RoomDetail', { roomId: result.room.id });
            } else {
              loadMailbox(); // 우편함 새로고침
            }
          },
        },
      ]);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '처리에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setResponding((prev) => ({ ...prev, [mailId]: false }));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getMailTypeLabel = (mailType) => {
    return mailType === 'friend_request' ? '친구 요청' : '방 초대';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'unread':
        return '#FF6B35';
      case 'read':
        return '#999';
      case 'accepted':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      default:
        return '#999';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>우편함</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 필터 버튼 */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            전체
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'unread' && styles.filterButtonActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
            안읽음
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'friend_request' && styles.filterButtonActive]}
          onPress={() => setFilter('friend_request')}
        >
          <Text style={[styles.filterText, filter === 'friend_request' && styles.filterTextActive]}>
            친구 요청
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'room_invite' && styles.filterButtonActive]}
          onPress={() => setFilter('room_invite')}
        >
          <Text style={[styles.filterText, filter === 'room_invite' && styles.filterTextActive]}>
            방 초대
          </Text>
        </TouchableOpacity>
      </View>

      {/* 우편함 목록 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003D7A" />
          </View>
        ) : mails.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>우편함이 비어있습니다.</Text>
          </View>
        ) : (
          mails.map((mail) => (
            <View key={mail.id} style={styles.mailItem}>
              <View style={styles.mailHeader}>
                <View style={styles.mailTypeBadge}>
                  <Text style={styles.mailTypeText}>{getMailTypeLabel(mail.mail_type)}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(mail.status) }]} />
              </View>

              <View style={styles.mailContent}>
                <Text style={styles.senderName}>
                  {mail.sender?.username || 'Unknown'}님으로부터
                </Text>
                {mail.mail_type === 'room_invite' && mail.room && (
                  <Text style={styles.roomName}>방: {mail.room.name}</Text>
                )}
                <Text style={styles.mailDate}>{formatDate(mail.created_at)}</Text>
              </View>

              {/* 응답 버튼 (unread 또는 read 상태일 때만) */}
              {(mail.status === 'unread' || mail.status === 'read') && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleRespond(mail.id, false)}
                    disabled={responding[mail.id]}
                  >
                    {responding[mail.id] ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>거절</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleRespond(mail.id, true)}
                    disabled={responding[mail.id]}
                  >
                    {responding[mail.id] ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>수락</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* 처리 완료 표시 */}
              {mail.status === 'accepted' && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>✓ 수락됨</Text>
                </View>
              )}
              {mail.status === 'rejected' && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>✗ 거절됨</Text>
                </View>
              )}
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
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  filterButtonActive: {
    backgroundColor: '#003D7A',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  mailItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  mailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mailTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
  },
  mailTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003D7A',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mailContent: {
    marginBottom: 15,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  roomName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  mailDate: {
    fontSize: 12,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});
