import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Alert,
    Modal,
    ScrollView,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, Booking, getImageUrl } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { GuestView } from '../components/GuestView';
import { useAppSession } from '../contexts/AppSessionContext';
import { useFocusEffect } from '@react-navigation/native';
import { bookingNeedsPayment } from '../api/client';

export function BookingsScreen({ navigation }: any) {
    const { t, language } = useLanguage();
    const { showLogin } = useAppSession();
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            loadBookings();
        }, [activeTab])
    );

    const loadBookings = async () => {
        try {
            setLoading(true);
            const user = await api.getUser();
            if (!user) {
                setIsAuthenticated(false);
                return;
            }
            setIsAuthenticated(true);
            const data = await api.getBookings(activeTab === 'upcoming' ? 'upcoming' : 'completed');
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

    const getBookingNumber = (booking: Booking) =>
        booking.bookingNumber || booking.id.slice(0, 8).toUpperCase();

    const getServiceName = (booking: Booking) => {
        const service = booking.Service || booking.service;
        return language === 'ar'
            ? service?.name_ar || service?.name_en || '-'
            : service?.name_en || service?.name_ar || '-';
    };

    const getStaffName = (booking: Booking) =>
        booking.Staff?.name || booking.staff?.name || '-';

    const getPaymentStatusText = (paymentStatus?: string | null) => {
        if (language === 'ar') {
            switch (paymentStatus) {
                case 'pending': return 'بانتظار الدفع';
                case 'deposit_paid': return 'عربون مدفوع';
                case 'fully_paid':
                case 'paid': return 'مدفوع بالكامل';
                case 'refunded': return 'مسترد';
                case 'partially_refunded': return 'مسترد جزئياً';
                default: return paymentStatus || '-';
            }
        }

        switch (paymentStatus) {
            case 'pending': return 'Pending';
            case 'deposit_paid': return 'Deposit Paid';
            case 'fully_paid':
            case 'paid': return 'Fully Paid';
            case 'refunded': return 'Refunded';
            case 'partially_refunded': return 'Partially Refunded';
            default: return paymentStatus || '-';
        }
    };

    const renderBookingCard = ({ item }: { item: Booking }) => {
        const isArabic = language === 'ar';
        const dateDate = new Date(item.startTime);

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => setSelectedBooking(item)}
            >
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
                            {getStatusText(item.status, t, language)}
                        </Text>
                    </View>
                </View>

                {/* Body: Service Info */}
                <View style={styles.cardBody}>
                    <Text style={styles.bookingNumberLabel}>
                        {language === 'ar' ? 'رقم الحجز' : 'Booking No.'} {getBookingNumber(item)}
                    </Text>
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
                        {bookingNeedsPayment(item.paymentStatus) && !['cancelled', 'completed', 'no_show'].includes(item.status) && activeTab === 'upcoming' && (
                            <TouchableOpacity
                                style={styles.payButton}
                                onPress={() => (navigation as any).navigate('Payment', {
                                    appointmentId: item.id,
                                    amount: Number(item.price),
                                    tenantId: item.tenantId || item.tenant?.id
                                })}
                            >
                                <Text style={styles.payButtonText}>{t('payNow')}</Text>
                            </TouchableOpacity>
                        )}
                        {['confirmed', 'pending'].includes(item.status) && activeTab === 'upcoming' && (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancel(item.id)}
                            >
                                <Text style={styles.cancelButtonText}>{t('cancel' as any)}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
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
                    onLoginPress={showLogin}
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

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}

            <Modal
                visible={!!selectedBooking}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedBooking(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTitle}>
                                        {language === 'ar' ? 'تفاصيل الحجز' : 'Appointment Details'}
                                    </Text>
                                    {selectedBooking && (
                                        <Text style={styles.modalReference}>
                                            {language === 'ar' ? 'رقم الحجز' : 'Booking No.'} {getBookingNumber(selectedBooking)}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={styles.modalCloseButton}
                                    onPress={() => setSelectedBooking(null)}
                                >
                                    <Text style={styles.modalCloseText}>×</Text>
                                </TouchableOpacity>
                            </View>

                            {selectedBooking && (
                                <View style={styles.modalBody}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'المركز' : 'Center'}</Text>
                                        <Text style={styles.detailValue}>{selectedBooking.tenant?.name || '-'}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'الخدمة' : 'Service'}</Text>
                                        <Text style={styles.detailValue}>{getServiceName(selectedBooking)}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'الموظف' : 'Employee'}</Text>
                                        <Text style={styles.detailValue}>{getStaffName(selectedBooking)}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'التاريخ' : 'Date'}</Text>
                                        <Text style={styles.detailValue}>
                                            {format(new Date(selectedBooking.startTime), 'eeee, d MMMM yyyy', {
                                                locale: language === 'ar' ? ar : enUS,
                                            })}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'الوقت' : 'Time'}</Text>
                                        <Text style={styles.detailValue}>
                                            {format(new Date(selectedBooking.startTime), 'h:mm a', {
                                                locale: language === 'ar' ? ar : enUS,
                                            })}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'حالة الحجز' : 'Booking Status'}</Text>
                                        <Text style={styles.detailValue}>
                                            {getStatusText(selectedBooking.status, t, language)}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'حالة الدفع' : 'Payment Status'}</Text>
                                        <Text style={styles.detailValue}>
                                            {getPaymentStatusText(selectedBooking.paymentStatus)}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'السعر' : 'Amount'}</Text>
                                        <Text style={styles.detailValue}>{selectedBooking.price} SAR</Text>
                                    </View>
                                    {selectedBooking.paymentMethod && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</Text>
                                            <Text style={styles.detailValue}>{selectedBooking.paymentMethod}</Text>
                                        </View>
                                    )}
                                    {selectedBooking.notes && (
                                        <View style={styles.notesBlock}>
                                            <Text style={styles.detailLabel}>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Text>
                                            <Text style={styles.notesText}>{selectedBooking.notes}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'confirmed': return '#10B981'; // Green
        case 'checked_in': return '#0EA5E9'; // Sky
        case 'in_service': return '#8B5CF6'; // Purple
        case 'pending': return '#F59E0B';   // Orange
        case 'cancelled': return '#EF4444'; // Red
        case 'completed': return '#3B82F6'; // Blue
        default: return '#6B7280';          // Gray
    }
};

const getStatusText = (status: string, _t: any, language?: string) => {
    if (language === 'ar') {
        switch (status) {
            case 'pending': return 'قيد الانتظار';
            case 'confirmed': return 'مؤكد';
            case 'checked_in': return 'تم الوصول';
            case 'in_service': return 'الخدمة جارية';
            case 'completed': return 'مكتمل';
            case 'cancelled': return 'ملغي';
            case 'no_show': return 'لم يحضر';
            default: return status;
        }
    }

    switch (status) {
        case 'pending': return 'Pending';
        case 'confirmed': return 'Confirmed';
        case 'checked_in': return 'Checked In';
        case 'in_service': return 'In Service';
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        case 'no_show': return 'No Show';
        default: return status;
    }
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
    bookingNumberLabel: {
        fontSize: fontSize.xs,
        color: colors.primary,
        fontWeight: '700',
        marginBottom: spacing.xs,
        letterSpacing: 0.8,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(17,24,39,0.55)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        maxHeight: '85%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    modalReference: {
        marginTop: 4,
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.primary,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseText: {
        fontSize: 28,
        lineHeight: 30,
        color: colors.text,
    },
    modalBody: {
        gap: spacing.md,
        paddingBottom: spacing.xl,
    },
    detailRow: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: colors.border,
    },
    detailLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    detailValue: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
    },
    notesBlock: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: '#F3E8FF',
    },
    notesText: {
        fontSize: fontSize.sm,
        color: colors.text,
        lineHeight: 20,
    },
});
