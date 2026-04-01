import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Alert,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, Booking, getImageUrl } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { GuestView } from '../components/GuestView';

export function BookingsScreen({ navigation }: any) {
    const { t, language } = useLanguage();
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

    useEffect(() => {
        loadBookings();
    }, [activeTab]);

    const loadBookings = async () => {
        try {
            setLoading(true);
            const user = await api.getUser();
            if (!user) {
                setIsAuthenticated(false);
                return;
            }
            setIsAuthenticated(true);
            const status = activeTab === 'upcoming' ? 'upcoming' : 'completed';
            const data = await api.getBookings(status);
            setBookings(data);
        } catch (error: any) {
            if (error.status === 401 || error.message?.includes('unauthorized') || error.message?.includes('Invalid or expired token')) {
                setIsAuthenticated(false);
            } else {
                console.error('Failed to load bookings:', error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadBookings();
    };

    const handleCancel = async (id: string) => {
        Alert.alert(
            t('cancelBooking'),
            t('cancelBookingConfirm'),
            [
                { text: t('no'), style: 'cancel' },
                {
                    text: t('yes'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await api.cancelBooking(id);
                            if (success) {
                                loadBookings();
                                Alert.alert(t('success'), t('bookingCancelled'));
                            }
                        } catch (error) {
                            Alert.alert(t('error'), t('failedToCancel'));
                        }
                    },
                },
            ]
        );
    };

    const renderBookingCard = ({ item }: { item: Booking }) => {
        const isArabic = language === 'ar';
        const dateDate = new Date(item.startTime);

        return (
            <View style={styles.card}>
                {/* Header: Salon Info */}
                <View style={styles.cardHeader}>
                    <View style={styles.salonInfo}>
                        {item.tenant?.logo ? (
                            <Image
                                source={{ uri: getImageUrl(item.tenant.logo) }}
                                style={styles.salonLogo}
                            />
                        ) : (
                            <View style={[styles.salonLogo, styles.placeholderLogo]}>
                                <Text style={styles.placeholderText}>
                                    {item.tenant?.name?.charAt(0) || 'S'}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.salonName}>{item.tenant?.name || 'Salon Name'}</Text>
                    </View>
                    <View style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) + '20' }
                    ]}>
                        <Text style={[
                            styles.statusText,
                            { color: getStatusColor(item.status) }
                        ]}>
                            {getStatusText(item.status, t)}
                        </Text>
                    </View>
                </View>

                {/* Body: Service Info */}
                <View style={styles.cardBody}>
                    <Text style={styles.serviceName}>{isArabic ? item.Service?.name_ar : item.Service?.name_en}</Text>
                    <View style={styles.dateTimeRow}>
                        <Text style={styles.dateIcon}>📅</Text>
                        <Text style={styles.dateTimeText}>
                            {format(dateDate, 'eeee, d MMMM yyyy', { locale: isArabic ? ar : enUS })}
                        </Text>
                    </View>
                    <View style={styles.dateTimeRow}>
                        <Text style={styles.dateIcon}>⏰</Text>
                        <Text style={styles.dateTimeText}>
                            {format(dateDate, 'h:mm a', { locale: isArabic ? ar : enUS })}
                        </Text>
                    </View>
                    {item.Staff && (
                        <View style={styles.staffRow}>
                            <Text style={styles.staffLabel}>{t('specialist')}: </Text>
                            <Text style={styles.staffName}>{item.Staff.name}</Text>
                        </View>
                    )}
                </View>

                {/* Footer: Price & Actions */}
                <View style={styles.cardFooter}>
                    <Text style={styles.price}>{item.price} SAR</Text>
                    <View style={styles.actions}>
                        {item.paymentStatus !== 'paid' && item.status !== 'cancelled' && activeTab === 'upcoming' && (
                            <TouchableOpacity
                                style={styles.payButton}
                                onPress={() => (navigation as any).navigate('Payment', {
                                    appointmentId: item.id,
                                    amount: item.price,
                                    tenantId: item.tenantId
                                })}
                            >
                                <Text style={styles.payButtonText}>{t('payNow')}</Text>
                            </TouchableOpacity>
                        )}
                        {item.status === 'confirmed' && activeTab === 'upcoming' && (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancel(item.id)}
                            >
                                <Text style={styles.cancelButtonText}>{t('cancel' as any)}</Text>
                            </TouchableOpacity>
                        )}
                        {item.status === 'completed' && activeTab === 'history' && (
                            <TouchableOpacity
                                style={styles.reviewButton}
                                onPress={() => { setSelectedBookingForReview(item); setReviewModalVisible(true); }}
                            >
                                <Text style={styles.reviewButtonText}>{t('leaveReview' as any) || 'Leave a Review'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    if (!isAuthenticated && !loading) {
        return (
            <>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('bookings')}</Text>
                </View>
                <GuestView
                    type="bookings"
                    onLoginPress={() => {
                        api.clearTokens().then(() => {
                            // Navigate to welcome/login natively if possible, or trigger an app restart
                            // In this architecture, clearing tokens and reloading the app is the safest way to reset the global navigation state
                            import('react-native').then(RN => {
                                if (RN.NativeModules.DevSettings) {
                                    RN.NativeModules.DevSettings.reload();
                                }
                            });
                        });
                    }}
                />
            </>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('bookings')}</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
                    onPress={() => setActiveTab('upcoming')}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'upcoming' && styles.activeTabText
                    ]}>{t('upcoming')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                    onPress={() => setActiveTab('history')}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'history' && styles.activeTabText
                    ]}>{t('history')}</Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            {bookings.length > 0 ? (
                <FlatList
                    data={bookings}
                    renderItem={renderBookingCard}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📅</Text>
                    <Text style={styles.emptyText}>
                        {activeTab === 'upcoming' ? t('noUpcomingBookings') : t('noBookingHistory')}
                    </Text>
                    <TouchableOpacity
                        style={styles.bookButton}
                        onPress={handleRefresh}
                    >
                        <Text style={styles.bookButtonText}>{t('refresh')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ReviewPromptModal
                visible={reviewModalVisible}
                onClose={() => { setReviewModalVisible(false); setSelectedBookingForReview(null); }}
                appointment={selectedBookingForReview}
                onSuccess={() => { loadBookings(); setReviewModalVisible(false); setSelectedBookingForReview(null); }}
            />

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}
        </View>
    );
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'confirmed': return '#10B981'; // Green
        case 'pending': return '#F59E0B';   // Orange
        case 'cancelled': return '#EF4444'; // Red
        case 'completed': return '#3B82F6'; // Blue
        default: return '#6B7280';          // Gray
    }
};

const getStatusText = (status: string, t: any) => {
    // Basic mapping, should ideally be in translations
    return status.charAt(0).toUpperCase() + status.slice(1);
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: spacing.xl,
        paddingTop: spacing.xl + 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: fontSize.xxl,
        fontWeight: '700',
        color: colors.text,
    },
    tabsContainer: {
        flexDirection: 'row',
        padding: spacing.md,
        backgroundColor: '#FFFFFF',
        marginBottom: spacing.sm,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: '700',
    },
    listContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    salonInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    salonLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    placeholderLogo: {
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: colors.primary,
        fontWeight: '700',
    },
    salonName: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardBody: {
        marginBottom: spacing.md,
    },
    serviceName: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    dateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: 4,
    },
    dateIcon: {
        fontSize: 16,
    },
    dateTimeText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    staffRow: {
        flexDirection: 'row',
        marginTop: spacing.sm,
    },
    staffLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    staffName: {
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '500',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    price: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.primary,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    payButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
    },
    payButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    cancelButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: '#EF4444',
        borderRadius: borderRadius.md,
    },
    cancelButtonText: {
        color: '#EF4444',
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    reviewButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: '#4F46E5', // Indigo
        borderRadius: borderRadius.md,
    },
    reviewButtonText: {
        color: 'white',
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyText: {
        fontSize: fontSize.lg,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    bookButton: {
        marginTop: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
    },
    bookButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
