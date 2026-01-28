import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRanking, getMyRanking } from '../services/rankingService';

const { width } = Dimensions.get('window');

const RankIcon = ({ rank }) => {
    if (rank === 1) return <MaterialCommunityIcons name="medal" size={28} color="#FFD700" />;
    if (rank === 2) return <MaterialCommunityIcons name="medal" size={28} color="#C0C0C0" />;
    if (rank === 3) return <MaterialCommunityIcons name="medal" size={28} color="#CD7F32" />;
    return <Text style={styles.rankText}>{rank}</Text>;
};

export default function RankingScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rankings, setRankings] = useState([]);
    const [myRanking, setMyRanking] = useState(null);

    const fetchRankings = async () => {
        try {
            setLoading(true);
            const [rankingData, myData] = await Promise.all([
                getRanking(100),
                getMyRanking(),
            ]);
            setRankings(rankingData.results || []);
            setMyRanking(myData);
        } catch (error) {
            console.error('Error fetching rankings:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRankings();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRankings();
    };

    const renderItem = ({ item }) => (
        <View style={[
            styles.rankItem,
            item.rank <= 3 && styles.topRankItem,
            item.user_id === myRanking?.user_id && styles.myRankItemHighlight
        ]}>
            <View style={styles.rankBadge}>
                <RankIcon rank={item.rank} />
            </View>

            <View style={styles.userInfo}>
                <Text style={styles.username} numberOfLines={1}>{item.username}</Text>
                <Text style={styles.winRate}>승률: {item.win_rate}% | MVP: {item.mvp_count}회</Text>
            </View>

            <View style={styles.ratingInfo}>
                <Text style={styles.ratingText}>{item.rating}</Text>
                <Text style={styles.ratingLabel}>LP</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialCommunityIcons name="chevron-left" size={32} color="#003D7A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>RANKING</Text>
                <View style={styles.headerRight} />
            </View>

            {/* Podium Effect (Top 3) */}
            {rankings.length >= 3 && (
                <View style={styles.podiumContainer}>
                    {/* 2nd Place */}
                    <View style={[styles.podiumItem, styles.podium2]}>
                        <MaterialCommunityIcons name="crown" size={24} color="#C0C0C0" />
                        <Text style={styles.podiumName} numberOfLines={1}>{rankings[1].username}</Text>
                        <Text style={styles.podiumRating}>{rankings[1].rating}</Text>
                        <View style={[styles.podiumBar, { height: 60, backgroundColor: '#C0C0C0' }]}>
                            <Text style={styles.podiumRankText}>2</Text>
                        </View>
                    </View>

                    {/* 1st Place */}
                    <View style={[styles.podiumItem, styles.podium1]}>
                        <MaterialCommunityIcons name="crown" size={32} color="#FFD700" />
                        <Text style={styles.podiumNameBig} numberOfLines={1}>{rankings[0].username}</Text>
                        <Text style={styles.podiumRatingBig}>{rankings[0].rating}</Text>
                        <View style={[styles.podiumBar, { height: 90, backgroundColor: '#FFD700' }]}>
                            <Text style={styles.podiumRankText}>1</Text>
                        </View>
                    </View>

                    {/* 3rd Place */}
                    <View style={[styles.podiumItem, styles.podium3]}>
                        <MaterialCommunityIcons name="crown" size={24} color="#CD7F32" />
                        <Text style={styles.podiumName} numberOfLines={1}>{rankings[2].username}</Text>
                        <Text style={styles.podiumRating}>{rankings[2].rating}</Text>
                        <View style={[styles.podiumBar, { height: 40, backgroundColor: '#CD7F32' }]}>
                            <Text style={styles.podiumRankText}>3</Text>
                        </View>
                    </View>
                </View>
            )}

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#003D7A" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={rankings}
                    keyExtractor={(item) => item.user_id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#003D7A']} />
                    }
                />
            )}

            {/* My Rank Footer */}
            {myRanking && (
                <View style={styles.myRankFooter}>
                    <Text style={styles.myRankLabel}>내 순위</Text>
                    <View style={styles.myRankContent}>
                        <Text style={styles.myRankText}>{myRanking.rank}위 ({myRanking.username})</Text>
                        <View style={styles.myRatingContainer}>
                            <Text style={styles.myRatingText}>{myRanking.rating}</Text>
                            <Text style={styles.myRatingLabel}>LP</Text>
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 15,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#003D7A',
        letterSpacing: 2,
    },
    backButton: {
        width: 40,
    },
    headerRight: {
        width: 40,
    },
    podiumContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingVertical: 20,
        backgroundColor: '#FFFFFF',
        marginBottom: 10,
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    podiumItem: {
        alignItems: 'center',
        width: width / 3.5,
    },
    podiumBar: {
        width: '100%',
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 5,
    },
    podiumRankText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 18,
    },
    podiumName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#444',
        marginTop: 5,
    },
    podiumRating: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#003D7A',
        marginBottom: 5,
    },
    podiumNameBig: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 5,
    },
    podiumRatingBig: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#003D7A',
        marginBottom: 5,
    },
    podium1: {
        zIndex: 2,
        marginHorizontal: -5,
    },
    podium2: {
        zIndex: 1,
    },
    podium3: {
        zIndex: 1,
    },
    listContainer: {
        paddingHorizontal: 15,
        paddingBottom: 100,
    },
    rankItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: 15,
        marginBottom: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    topRankItem: {
        backgroundColor: '#FFFFFF',
        borderLeftWidth: 4,
        borderLeftColor: '#003D7A',
    },
    myRankItemHighlight: {
        borderWidth: 2,
        borderColor: '#003D7A',
    },
    rankBadge: {
        width: 40,
        alignItems: 'center',
    },
    rankText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
    },
    userInfo: {
        flex: 1,
        marginLeft: 15,
    },
    username: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    winRate: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    ratingInfo: {
        alignItems: 'flex-end',
    },
    ratingText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#003D7A',
    },
    ratingLabel: {
        fontSize: 10,
        color: '#999',
        fontWeight: '600',
    },
    myRankFooter: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#003D7A',
        borderRadius: 20,
        padding: 15,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    myRankLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 5,
    },
    myRankContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    myRankText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    myRatingContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    myRatingText: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginRight: 4,
    },
    myRatingLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
