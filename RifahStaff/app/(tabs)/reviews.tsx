import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Modal, TextInput, Platform, Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getMyReviews, replyToReview, ReviewsSummary, Review } from '../../src/services/financials';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { canReplyToReviews, canViewReviews } from '../../src/utils/capabilities';
import { formatDistanceToNowSafe } from '../../src/utils/safeDate';

const StarRating = ({ rating }: { rating: number }) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
            <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={16} color="#f59e0b" />
        ))}
    </View>
);

export default function ReviewsScreen() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [data, setData] = useState<ReviewsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [replyModal, setReplyModal] = useState<Review | null>(null);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterKey, setFilterKey] = useState<'all' | 'pending_reply' | 'five_star' | 'low_rated'>('all');
    const reviewsAllowed = canViewReviews(user);
    const canReply = canReplyToReviews(user);

    const load = async () => {
        try {
            const result = await getMyReviews();
            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

    const handleReply = async () => {
        if (!replyModal || !replyText.trim()) return;
        setSubmitting(true);
        try {
            await replyToReview(replyModal.id, replyText.trim());
            setReplyModal(null);
            setReplyText('');
            load();
        } catch {
            Alert.alert('Error', 'Could not post reply');
        } finally {
            setSubmitting(false);
        }
    };

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredReviews = (data?.reviews || []).filter((item) => {
        const matchesFilter =
            filterKey === 'all' ? true :
                filterKey === 'pending_reply' ? !item.staffReply :
                    filterKey === 'five_star' ? Number(item.rating) === 5 :
                        Number(item.rating) <= 3;

        if (!matchesFilter) {
            return false;
        }

        if (!normalizedSearch) {
            return true;
        }

        return [
            item.customerName,
            item.comment,
            item.staffReply
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);
    });

    const pendingReplies = (data?.reviews || []).filter((item) => !item.staffReply).length;
    const fiveStarCount = (data?.reviews || []).filter((item) => Number(item.rating) === 5).length;
    const lowRatedCount = (data?.reviews || []).filter((item) => Number(item.rating) <= 3).length;

    const filterOptions: { key: 'all' | 'pending_reply' | 'five_star' | 'low_rated'; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: data?.total || 0 },
        { key: 'pending_reply', label: 'Need Reply', count: pendingReplies },
        { key: 'five_star', label: '5 Stars', count: fiveStarCount },
        { key: 'low_rated', label: 'Low Rated', count: lowRatedCount },
    ];

    const distributionCards = [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: Number(data?.distribution?.[rating] || 0),
    }));

    const renderItem = ({ item }: { item: Review }) => (
        <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
                <StarRating rating={item.rating} />
                <Text style={styles.timestamp}>{formatDistanceToNowSafe(item.createdAt)}</Text>
            </View>
            {item.customerName && <Text style={styles.customerName}>— {item.customerName}</Text>}
            {item.comment && <Text style={styles.comment}>&quot;{item.comment}&quot;</Text>}
            {item.staffReply ? (
                <View style={styles.replyBox}>
                    <Text style={styles.replyLabel}>{t('reviews.yourReply')}</Text>
                    <Text style={styles.replyText}>{item.staffReply}</Text>
                </View>
            ) : canReply ? (
                <TouchableOpacity style={styles.replyBtn} onPress={() => { setReplyModal(item); setReplyText(''); }}>
                    <Ionicons name="chatbubble-outline" size={16} color="#8B5ADF" />
                    <Text style={styles.replyBtnText}>{t('reviews.replyBtn')}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {data?.avgRating && (
                <View style={styles.header}>
                    <View style={styles.avgRow}>
                        <Text style={styles.avgNumberDark}>{data.avgRating}</Text>
                        <Ionicons name="star" size={24} color="#f59e0b" />
                        <Text style={styles.avgTotalDark}> ({data.total} {t('reviews.reviewsLabel')})</Text>
                    </View>
                </View>
            )}

            {!reviewsAllowed ? (
                <View style={styles.center}>
                    <Ionicons name="lock-closed-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{t('reviews.notEnabledTitle')}</Text>
                    <Text style={styles.emptySub}>{t('reviews.notEnabledSubtitle')}</Text>
                </View>
            ) : loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#8B5ADF" /></View>
            ) : !data || data.reviews.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="star-half-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{t('reviews.noReviews')}</Text>
                    <Text style={styles.emptySub}>{t('reviews.noReviewsSub')}</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredReviews}
                    keyExtractor={r => r.id}
                    renderItem={renderItem}
                    ListHeaderComponent={(
                        <View>
                            <View style={styles.statsGrid}>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{data.total}</Text>
                                    <Text style={styles.statLabel}>{t('reviews.totalReviews')}</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{pendingReplies}</Text>
                                    <Text style={styles.statLabel}>{t('reviews.needReply')}</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{fiveStarCount}</Text>
                                    <Text style={styles.statLabel}>{t('reviews.fiveStar')}</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{lowRatedCount}</Text>
                                    <Text style={styles.statLabel}>{t('reviews.lowRated')}</Text>
                                </View>
                            </View>

                            <View style={styles.distributionRow}>
                                {distributionCards.map((item) => (
                                    <View key={item.rating} style={styles.distributionCard}>
                                        <Text style={styles.distributionValue}>{item.count}</Text>
                                        <Text style={styles.distributionLabel}>{item.rating}★</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.searchBox}>
                                <Ionicons name="search-outline" size={18} color="#6b7280" style={styles.searchIcon} />
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder={t('reviews.searchPlaceholder')}
                                    placeholderTextColor="#9ca3af"
                                    style={styles.searchInput}
                                />
                                {searchQuery ? (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color="#9ca3af" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filterRow}
                            >
                                {filterOptions.map((option) => {
                                    const active = filterKey === option.key;
                                    return (
                                        <TouchableOpacity
                                            key={option.key}
                                            style={[styles.filterChip, active && styles.filterChipActive]}
                                            onPress={() => setFilterKey(option.key)}
                                        >
                                            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                                {option.label} ({option.count})
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <Text style={styles.resultsLabel}>
                                Showing {filteredReviews.length} of {data.total} reviews
                            </Text>
                        </View>
                    )}
                    ListEmptyComponent={(
                        <View style={styles.emptyFilterState}>
                            <Ionicons name="search-outline" size={48} color="#d1d5db" />
                            <Text style={styles.emptyTitle}>{t('reviews.emptyFilterTitle')}</Text>
                            <Text style={styles.emptySub}>{t('reviews.emptyFilterSubtitle')}</Text>
                        </View>
                    )}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={['#8B5ADF']} />}
                />
            )}

            {/* Reply Modal */}
            <Modal visible={!!replyModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReplyModal(null)}>
                <View style={styles.modal}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{t('reviews.replyModalTitle')}</Text>
                        <TouchableOpacity onPress={() => setReplyModal(null)}>
                            <Ionicons name="close" size={28} color="#4b5563" />
                        </TouchableOpacity>
                    </View>
                    {replyModal && (
                        <View style={styles.reviewPreview}>
                            <StarRating rating={replyModal.rating} />
                            <Text style={styles.comment} numberOfLines={3}>&quot;{replyModal.comment}&quot;</Text>
                        </View>
                    )}
                    <TextInput
                        style={styles.textInput}
                        placeholder={t('reviews.replyPlaceholder')}
                        multiline
                        numberOfLines={5}
                        value={replyText}
                        onChangeText={setReplyText}
                        textAlignVertical="top"
                    />
                    <TouchableOpacity style={styles.submitButton} onPress={handleReply} disabled={submitting || !replyText.trim()}>
                        <Text style={styles.submitText}>{submitting ? t('reviews.posting') : t('reviews.postReply')}</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
        paddingBottom: 20,
        alignItems: 'center',
    },
    avgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    avgNumberDark: { fontSize: 36, fontWeight: 'bold', color: '#1f2937' },
    avgTotalDark: { fontSize: 14, color: '#6b7280' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 10,
    },
    statCard: {
        width: '48%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#6d28d9',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    distributionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    distributionCard: {
        flex: 1,
        marginRight: 8,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    distributionValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    distributionLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginBottom: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1f2937',
        paddingVertical: 10,
    },
    filterRow: {
        paddingBottom: 10,
        gap: 10,
    },
    filterChip: {
        backgroundColor: '#ffffff',
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    filterChipActive: {
        backgroundColor: '#ede9fe',
        borderColor: '#8B5ADF',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4b5563',
    },
    filterChipTextActive: {
        color: '#6d28d9',
    },
    resultsLabel: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 14,
    },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#4b5563', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
    emptyFilterState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 36,
    },
    reviewCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    timestamp: { fontSize: 12, color: '#9ca3af' },
    customerName: { fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginBottom: 6 },
    comment: { fontSize: 15, color: '#374151', lineHeight: 22 },
    replyBox: { marginTop: 12, padding: 10, backgroundColor: '#f0fdf4', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#10b981' },
    replyLabel: { fontSize: 11, fontWeight: 'bold', color: '#059669', marginBottom: 4 },
    replyText: { fontSize: 14, color: '#065f46' },
    replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
    replyBtnText: { fontSize: 14, color: '#8B5ADF', fontWeight: '600' },
    // Modal
    modal: { flex: 1, padding: 24, backgroundColor: '#fff' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    reviewPreview: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 16 },
    textInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 14, fontSize: 15, color: '#1f2937', minHeight: 120, marginBottom: 16 },
    submitButton: { backgroundColor: '#8B5ADF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
