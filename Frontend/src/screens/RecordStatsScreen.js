import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getRecordStats } from '../services/recordService';

export default function RecordStatsScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all'); // all, year, month, week

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getRecordStats(period === 'all' ? null : period);
      setStats(data);
    } catch (error) {
      console.error('통계 로드 실패:', error);
      Alert.alert('오류', error.message || '통계를 불러올 수 없습니다.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (meters) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters} m`;
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  const formatPace = (secondsPerKm) => {
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = secondsPerKm % 60;
    return `${minutes}'${String(seconds).padStart(2, '0')}"`;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'year':
        return '올해';
      case 'month':
        return '이번 달';
      case 'week':
        return '이번 주';
      default:
        return '전체';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>기록 통계</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 기간 선택 */}
      <View style={styles.periodContainer}>
        <TouchableOpacity
          style={[styles.periodButton, period === 'all' && styles.periodButtonActive]}
          onPress={() => setPeriod('all')}
        >
          <Text style={[styles.periodText, period === 'all' && styles.periodTextActive]}>
            전체
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'year' && styles.periodButtonActive]}
          onPress={() => setPeriod('year')}
        >
          <Text style={[styles.periodText, period === 'year' && styles.periodTextActive]}>
            올해
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.periodText, period === 'month' && styles.periodTextActive]}>
            이번 달
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
          onPress={() => setPeriod('week')}
        >
          <Text style={[styles.periodText, period === 'week' && styles.periodTextActive]}>
            이번 주
          </Text>
        </TouchableOpacity>
      </View>

      {/* 통계 내용 */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003D7A" />
          </View>
        ) : stats ? (
          <>
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>{getPeriodLabel()} 통계</Text>
              
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>총 거리</Text>
                  <Text style={styles.statValue}>
                    {formatDistance(stats.total_distance_meters || 0)}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>총 시간</Text>
                  <Text style={styles.statValue}>
                    {formatDuration(stats.total_duration_seconds || 0)}
                  </Text>
                </View>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>총 런닝 횟수</Text>
                  <Text style={styles.statValue}>{stats.total_runs || 0}회</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>평균 페이스</Text>
                  <Text style={styles.statValue}>
                    {stats.avg_pace_seconds_per_km ? formatPace(stats.avg_pace_seconds_per_km) : '--\'--"'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 추가 정보 */}
            {stats.total_runs > 0 && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>평균 정보</Text>
                <Text style={styles.infoText}>
                  평균 거리: {formatDistance((stats.total_distance_meters || 0) / stats.total_runs)}
                </Text>
                <Text style={styles.infoText}>
                  평균 시간: {formatDuration(
                    Math.floor((stats.total_duration_seconds || 0) / stats.total_runs)
                  )}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>통계 데이터가 없습니다.</Text>
          </View>
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
  periodContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  periodButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  periodButtonActive: {
    backgroundColor: '#003D7A',
  },
  periodText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
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
  statsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003D7A',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});
