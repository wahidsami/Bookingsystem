import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Modal, TextInput, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getMyReviews, replyToReview, ReviewsSummary, Review } from '../../src/services/financials';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

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
        } catch (e) {
            Alert.alert('Error', 'Could not post reply');
        } finally {
            setSubmitting(false);
        }
    };

    const renderItem = ({ item }: { item: Review }) => (
        <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
                <StarRating rating={item.rating} />
                <Text style={styles.timestamp}>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</Text>
            </View>
            {item.customerName && <Text style={styles.customerName}>— {item.customerName}</Text>}
            {item.comment && <Text style={styles.comment}>"{item.comment}"</Text>}
            {item.staffReply ? (
                <View style={styles.replyBox}>
                    <Text style={styles.replyLabel}>{t('reviews.yourReply')}</Text>
                    <Text style={styles.replyText}>{item.staffReply}</Text>
                </View>
            ) : user?.permissions?.reply_reviews ? (
                <TouchableOpacity style={styles.replyBtn} onPress={() => { setReplyModal(item); setReplyText(''); }}>
                    <Ionicons name="chatbubble-outline" size={16} color="#8B5ADF" />
                    <Text style={styles.replyBtnText}>{t('reviews.replyBtn')}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <Text style={styles.headerTitle}>{t('reviews.title')}</Text>
                {data?.avgRating && (
                    <View style={styles.avgRow}>
                        <Text style={styles.avgNumber}>{data.avgRating}</Text>
                        <Ionicons name="star" size={24} color="#fbbf24" />
                        <Text style={styles.avgTotal}> ({data.total} {t('reviews.reviewsLabel')})</Text>
                    </View>
                )}
            </LinearGradient>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#8B5ADF" /></View>
            ) : !data || data.reviews.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="star-half-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{t('reviews.noReviews')}</Text>
                    <Text style={styles.emptySub}>{t('reviews.noReviewsSub')}</Text>
                </View>
            ) : (
                <FlatList
                    data={data.reviews}
                    keyExtractor={r => r.id}
                    renderItem={renderItem}
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
                            <Text style={styles.comment} numberOfLines={3}>"{replyModal.comment}"</Text>
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
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
    avgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    avgNumber: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
    avgTotal: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#4b5563', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
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
