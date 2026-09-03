import React, { useMemo, useState } from 'react';
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
    TextInput,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius, shadows } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { api, Booking, getBookingOutstandingAmount, getImageUrl } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { GuestView } from '../components/GuestView';
import { useAppSession } from '../contexts/AppSessionContext';
import { useFocusEffect } from '@react-navigation/native';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { LinearGradient } from 'expo-linear-gradient';
import { parseGroupGuestFromNotes } from '../utils/groupGuest';

interface BookingGroup {
    key: string;
    bookingReference?: string | null;
    bookingSessionId?: string | null;
    tenant?: Booking['tenant'];
    items: Booking[];
    status: Booking['status'];
    startTime: string;
    totalPrice: number;
    payableNowTotal: number;
}

export function BookingsScreen({ navigation }: any) {
    const { t, language } = useLanguage();
    const isRTL = language === 'ar';
    const { showLogin, isAuthenticated } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'no_show' | 'cancelled'>('upcoming');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
    const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());
    const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleTime, setRescheduleTime] = useState('');
    const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

    const loadBookings = React.useCallback(async () => {
        try {
            setLoading(true);
            if (!isAuthenticated) {
                return;
            }
            const [data, reviews] = await Promise.all([
                api.getBookings(activeTab),
                api.getMyReviews(200).catch(() => []),
            ]);
            const reviewedIds = new Set<string>(
                (reviews || [])
                    .map((review: any) => review?.appointmentId)
                    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
            );
            setReviewedAppointmentIds(reviewedIds);
            setBookings(data);
        } catch (error: any) {
            if (error.status === 401 || error.message?.includes('unauthorized') || error.message?.includes('Invalid or expired token')) {
                showLogin();
            } else {
                console.error('Failed to load bookings:', error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab, isAuthenticated, showLogin]);

    useFocusEffect(
        React.useCallback(() => {
            loadBookings();
        }, [loadBookings])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadBookings();
    };

    const groupedBookings = useMemo<BookingGroup[]>(() => {
        const map = new Map<string, BookingGroup>();

        bookings.forEach((booking) => {
            const key = booking.bookingReference || booking.bookingSessionId || booking.id;
            const existing = map.get(key) || {
                key,
                bookingReference: booking.bookingReference,
                bookingSessionId: booking.bookingSessionId,
                tenant: booking.tenant,
                items: [],
                status: booking.status,
                startTime: booking.startTime,
                totalPrice: 0,
                payableNowTotal: 0,
            };

            existing.items.push(booking);
            existing.totalPrice += Number(booking.price || 0);
            existing.payableNowTotal += getBookingOutstandingAmount(booking);

            if (booking.startTime && (!existing.startTime || new Date(booking.startTime).getTime() < new Date(existing.startTime).getTime())) {
                existing.startTime = booking.startTime;
            }

            map.set(key, existing);
        });

        return Array.from(map.values()).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }, [bookings]);

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
        booking.bookingNumber || booking.bookingReference || booking.id.slice(0, 8).toUpperCase();

    const getServiceName = (booking: Booking) => {
        const service = booking.Service || booking.service;
        return language === 'ar'
            ? service?.name_ar || service?.name_en || '-'
            : service?.name_en || service?.name_ar || '-';
    };

    const openReschedule = (booking: Booking) => {
        const baseDate = new Date(booking.startTime);
        const yyyy = baseDate.getFullYear();
        const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
        const dd = String(baseDate.getDate()).padStart(2, '0');
        const hh = String(baseDate.getHours()).padStart(2, '0');
        const min = String(baseDate.getMinutes()).padStart(2, '0');
        setRescheduleDate(`${yyyy}-${mm}-${dd}`);
        setRescheduleTime(`${hh}:${min}`);
        setRescheduleBooking(booking);
    };

    const submitReschedule = async () => {
        if (!rescheduleBooking || !rescheduleDate || !rescheduleTime || rescheduleSubmitting) return;
        try {
            setRescheduleSubmitting(true);
            const dateTime = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
            if (Number.isNaN(dateTime.getTime())) {
                throw new Error(language === 'ar' ? 'تاريخ/وقت غير صالح' : 'Invalid date/time');
            }
            await api.rescheduleBooking(rescheduleBooking.id, {
                startTime: dateTime.toISOString(),
                staffId: rescheduleBooking.staffId,
            });
            setRescheduleBooking(null);
            await loadBookings();
            Alert.alert(
                language === 'ar' ? 'تم' : 'Done',
                language === 'ar' ? 'تمت إعادة جدولة الموعد بنجاح' : 'Appointment rescheduled successfully'
            );
        } catch (error: any) {
            Alert.alert(
                language === 'ar' ? 'خطأ' : 'Error',
                error?.message || (language === 'ar' ? 'تعذرت إعادة الجدولة' : 'Failed to reschedule')
            );
        } finally {
            setRescheduleSubmitting(false);
        }
    };

    const getServiceVariantLabel = (booking: Booking) => {
        const variantName = booking.serviceVariantName?.trim();
        if (!variantName) {
            return '';
        }

        return language === 'ar' ? `النوع: ${variantName}` : `Variant: ${variantName}`;
    };

    const hasRescheduleAudit = (booking: Booking) => `${booking.notes || ''}`.includes('[RESCHEDULE_AUDIT]');

    const renderBookingCard = ({ item }: { item: BookingGroup }) => {
        const isArabic = language === 'ar';
        const representative = item.items[0];
        const groupGuest = parseGroupGuestFromNotes(representative.notes);
        const dateDate = new Date(item.startTime);
        const serviceCount = item.items.length;
        const hasCompletedReview = reviewedAppointmentIds.has(representative.id);
        const canLeaveReview = item.status === 'completed' && !hasCompletedReview;

        const isRescheduled = item.items.some((booking) => hasRescheduleAudit(booking));
        const customerNameStr = (representative.customerName || '').trim()
            || [representative.customer?.firstName, representative.customer?.lastName].filter(Boolean).join(' ').trim()
            || representative.customer?.fullName?.trim()
            || (language === 'ar' ? 'العميل' : 'Customer');
        const serviceNameStr = serviceCount > 1
            ? (language === 'ar' ? `${serviceCount} خدمات` : `${serviceCount} services`)
            : getServiceName(representative);

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('AppointmentDetails', { bookingGroup: item, activeTab })}
            >
                {isRescheduled && activeTab === 'upcoming' ? (
                    <View style={styles.rescheduledRibbon}>
                        <Text style={styles.rescheduledRibbonText}>{language === 'ar' ? 'أعيد جدولته' : 'Rescheduled'}</Text>
                    </View>
                ) : null}

                <View style={[styles.cardBody, isArabic ? styles.cardBodyRTL : null]}>
                    <Text style={[styles.customerName, isArabic ? styles.customerNameRTL : null]} numberOfLines={1}>
                        {customerNameStr}
                    </Text>
                    <Text style={[styles.serviceName, isArabic ? styles.serviceNameRTL : null]} numberOfLines={2}>
                        {serviceNameStr}
                    </Text>
                    {serviceCount > 1 ? (
                        <View style={[styles.chainIndicator, isArabic ? styles.chainIndicatorRTL : null]}>
                            <AppIcon name="link" size={12} color={colors.primary} />
                        </View>
                    ) : null}
                </View>

                {(canLeaveReview || hasCompletedReview) && (
                    <View style={styles.cardFooter}>
                        <View style={styles.actions}>
                            {canLeaveReview ? (
                                <TouchableOpacity
                                    style={styles.reviewButton}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setReviewBooking(representative);
                                    }}
                                >
                                    <AppIcon name="star" size={12} color={colors.textInverse} />
                                    <Text style={styles.reviewButtonText}>{t('leaveReview')}</Text>
                                </TouchableOpacity>
                            ) : hasCompletedReview ? (
                                <View style={[styles.reviewButton, styles.reviewedButton]}>
                                    <AppIcon name="star" size={12} color={colors.accentDark} />
                                    <Text style={[styles.reviewButtonText, styles.reviewedButtonText]}>{language === 'ar' ? 'تم التقييم' : 'Reviewed'}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (!isAuthenticated && !loading) {
        return (
            <>
                <LinearGradient
                    colors={['#F6F2FF', '#FFFFFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.header, { paddingTop: spacing.xl + topInset }]}
                >
                    <Text style={styles.headerTitle}>{t('bookings')}</Text>
                </LinearGradient>
                <GuestView
                    type="bookings"
                    onLoginPress={showLogin}
                />
            </>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#F6F2FF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: spacing.xl + topInset }]}
            >
                <Text style={styles.headerTitle}>{t('bookings')}</Text>
            </LinearGradient>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]} onPress={() => setActiveTab('upcoming')}>
                    <Text style={[
                        styles.tabText,
                        activeTab === 'upcoming' && styles.activeTabText
                    ]}>{t('upcoming')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'completed' && styles.activeTab]} onPress={() => setActiveTab('completed')}>
                    <Text style={[
                        styles.tabText,
                        activeTab === 'completed' && styles.activeTabText
                    ]}>{language === 'ar' ? 'مكتمل' : 'Completed'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'no_show' && styles.activeTab]} onPress={() => setActiveTab('no_show')}>
                    <Text style={[
                        styles.tabText,
                        activeTab === 'no_show' && styles.activeTabText
                    ]}>{language === 'ar' ? 'لم يحضر' : 'No Show'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'cancelled' && styles.activeTab]} onPress={() => setActiveTab('cancelled')}>
                    <Text style={[
                        styles.tabText,
                        activeTab === 'cancelled' && styles.activeTabText
                    ]}>{language === 'ar' ? 'ملغي' : 'Canceled'}</Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            {groupedBookings.length > 0 ? (
                <FlatList
                    data={groupedBookings}
                    renderItem={renderBookingCard}
                    keyExtractor={(item) => item.key}
                    contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPadding }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <AppIcon name="bookings" size={64} color={colors.textSecondary} />
                    <Text style={styles.emptyText}>
                        {activeTab === 'upcoming'
                            ? t('noUpcomingBookings')
                            : activeTab === 'completed'
                                ? (language === 'ar' ? 'لا توجد مواعيد مكتملة' : 'No completed bookings')
                                : activeTab === 'no_show'
                                    ? (language === 'ar' ? 'لا توجد مواعيد لم يحضرها العميل' : 'No no-show bookings')
                                    : (language === 'ar' ? 'لا توجد مواعيد ملغاة' : 'No canceled bookings')}
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

            <ReviewPromptModal
                visible={!!reviewBooking}
                appointment={reviewBooking}
                onClose={() => setReviewBooking(null)}
                onSuccess={() => {
                    setReviewBooking(null);
                    loadBookings();
                }}
            />
            <Modal
                visible={!!rescheduleBooking}
                transparent
                animationType="fade"
                onRequestClose={() => !rescheduleSubmitting && setRescheduleBooking(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.rescheduleModalCard}>
                        <Text style={styles.modalTitle}>
                            {language === 'ar' ? 'إعادة جدولة الموعد' : 'Reschedule Booking'}
                        </Text>
                        <Text style={styles.rescheduleHint}>
                            {language === 'ar' ? 'أدخل التاريخ والوقت الجديدين' : 'Enter new date and time'}
                        </Text>
                        <TextInput
                            value={rescheduleDate}
                            onChangeText={setRescheduleDate}
                            placeholder="YYYY-MM-DD"
                            autoCapitalize="none"
                            style={styles.rescheduleInput}
                        />
                        <TextInput
                            value={rescheduleTime}
                            onChangeText={setRescheduleTime}
                            placeholder="HH:MM"
                            autoCapitalize="none"
                            style={styles.rescheduleInput}
                        />
                        <View style={styles.rescheduleActions}>
                            <TouchableOpacity
                                style={styles.rescheduleCancelBtn}
                                onPress={() => setRescheduleBooking(null)}
                                disabled={rescheduleSubmitting}
                            >
                                <Text style={styles.rescheduleCancelText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.rescheduleSaveBtn}
                                onPress={submitReschedule}
                                disabled={rescheduleSubmitting}
                            >
                                <Text style={styles.rescheduleSaveText}>
                                    {rescheduleSubmitting ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'confirmed': return colors.success;
        case 'checked_in': return colors.info;
        case 'in_service': return colors.primary;
        case 'pending': return colors.warning;
        case 'cancelled': return colors.error;
        case 'completed': return colors.info;
        default: return colors.textSecondary;
    }
};

const getStatusText = (status: string, _t: any, language?: string) => {
    if (language === 'ar') {
        switch (status) {
            case 'pending': return 'محجوز';
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
        case 'pending': return 'Booked';
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
        backgroundColor: colors.backgroundMuted,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        paddingTop: spacing.xl,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    headerTitle: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    tabsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        marginBottom: spacing.sm,
        gap: spacing.xs,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
    },
    activeTab: {
        borderColor: colors.primaryLight,
        backgroundColor: '#F7F2FF',
    },
    tabText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xl,
        gap: spacing.sm,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        position: 'relative',
        ...shadows.sm,
    },
    rescheduledRibbon: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        zIndex: 10,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        backgroundColor: '#EAF2FF',
        borderWidth: 1,
        borderColor: '#C8DDFE',
    },
    rescheduledRibbonText: {
        fontSize: fontSize.xs,
        color: '#2E5FA8',
        fontWeight: '700',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    cardHeaderRTL: {
        flexDirection: 'row-reverse',
    },
    salonInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flex: 1,
    },
    salonLogo: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        fontWeight: '700',
        color: colors.textPrimary,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    statusText: {
        fontSize: fontSize.xs,
        fontWeight: '700',
    },
    cardBody: {
        minHeight: 92,
        justifyContent: 'center',
        paddingBottom: spacing.xs,
    },
    cardBodyRTL: {
        alignItems: 'flex-end',
    },
    customerName: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    customerNameRTL: {
        textAlign: 'right',
    },
    serviceName: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.textSecondary,
        lineHeight: 20,
    },
    serviceNameRTL: {
        textAlign: 'right',
    },
    chainIndicator: {
        position: 'absolute',
        bottom: spacing.xs,
        left: 0,
        padding: 4,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.primaryLight,
        backgroundColor: `${colors.primary}0D`,
    },
    chainIndicatorRTL: {
        left: 'auto',
        right: 0,
    },
    variantLabel: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    dateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 2,
    },
    dateTimeRowRTL: {
        flexDirection: 'row-reverse',
    },
    dateIcon: {
        fontSize: 16,
    },
    dateTimeText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    dateTimeTextRTL: {
        textAlign: 'right',
    },
    staffRow: {
        flexDirection: 'row',
        marginTop: spacing.sm,
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    staffRowRTL: {
        flexDirection: 'row-reverse',
    },
    staffLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    staffLabelRTL: {
        textAlign: 'right',
    },
    staffName: {
        fontSize: fontSize.sm,
        color: colors.textPrimary,
        fontWeight: '700',
    },
    staffNameRTL: {
        textAlign: 'right',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    priceBlock: {
        flex: 1,
        gap: 2,
    },
    price: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
    },
    actions: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    payButton: {
        minWidth: 120,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#6D31D9',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    dueNowText: {
        fontSize: 11,
        color: '#6E7596',
        fontWeight: '600',
    },
    cancelButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: colors.error,
        borderRadius: 12,
    },
    cancelButtonText: {
        color: colors.error,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    rescheduleButton: {
        marginTop: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        alignItems: 'center',
    },
    rescheduleButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    reviewButton: {
        marginTop: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
    },
    reviewButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    reviewedButton: {
        backgroundColor: `${colors.success}1A`,
        borderWidth: 1,
        borderColor: colors.accentLight,
    },
    reviewedButtonText: {
        color: colors.accentDark,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        backgroundColor: colors.surface,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyText: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    bookButton: {
        marginTop: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        ...shadows.sm,
    },
    bookButtonText: {
        color: colors.textInverse,
        fontWeight: '600',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sortContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        gap: spacing.sm,
    },
    sortButtonText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    sortModalCard: {
        width: '90%',
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        gap: spacing.md,
    },
    sortOptionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    sortOptionText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
    },
    sortOptionTextActive: {
        color: colors.primary,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(18, 13, 33, 0.55)',
        justifyContent: 'flex-end',
    },
    modalTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    rescheduleModalCard: {
        width: '90%',
        alignSelf: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        ...shadows.md,
    },
    rescheduleHint: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    rescheduleInput: {
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.backgroundMuted,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    rescheduleActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.sm,
    },
    rescheduleCancelBtn: {
        borderWidth: 1,
        borderColor: '#D8C7FA',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#F4EEFF',
    },
    rescheduleCancelText: {
        color: colors.textSecondary,
        fontWeight: '600',
    },
    rescheduleSaveBtn: {
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primary,
    },
    rescheduleSaveText: {
        color: colors.textInverse,
        fontWeight: '700',
    },
});
