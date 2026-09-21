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
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
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
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { parseGroupGuestFromNotes } from '../utils/groupGuest';
import { usePopup } from '../contexts/PopupContext';

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
    const { scrollBottomPadding } = useScreenSafeArea();
    const { confirm, showDialog } = usePopup();
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
        const confirmed = await confirm({
            title: t('cancelBooking'),
            message: t('cancelBookingConfirm'),
            confirmText: t('yes'),
            cancelText: t('no'),
            variant: 'destructive',
        });

        if (!confirmed) return;

        try {
            const success = await api.cancelBooking(id);
            if (success) {
                loadBookings();
                await showDialog({
                    title: t('success'),
                    message: t('bookingCancelled'),
                    variant: 'success',
                    confirmText: isRTL ? 'حسنًا' : 'OK',
                });
            }
        } catch (error) {
            await showDialog({
                title: t('error'),
                message: t('failedToCancel'),
                variant: 'error',
                confirmText: isRTL ? 'حسنًا' : 'OK',
            });
        }
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
        const dateDate = new Date(item.startTime);
        const serviceCount = item.items.length;
        const hasCompletedReview = reviewedAppointmentIds.has(representative.id);
        const canLeaveReview = item.status === 'completed' && !hasCompletedReview;
        const isRescheduled = item.items.some((booking) => hasRescheduleAudit(booking));
        const bookingRefNumber = getBookingNumber(representative);

        const primaryServiceName = getServiceName(representative);
        const dateStr = format(dateDate, 'd MMM yyyy', { locale: isArabic ? ar : enUS });
        const timeStr = format(dateDate, 'h:mm a', { locale: isArabic ? ar : enUS });
        const hasOutstanding = item.payableNowTotal > 0.009;

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('AppointmentDetails', { bookingGroup: item, activeTab })}
            >
                {isRescheduled && activeTab === 'upcoming' ? (
                    <View style={[styles.rescheduledRibbon, isArabic && styles.rescheduledRibbonRTL]}>
                        <Text style={styles.rescheduledRibbonText}>{language === 'ar' ? 'أعيد جدولته' : 'Rescheduled'}</Text>
                    </View>
                ) : null}

                {/* Header: Tenant Info, Booking Reference & Status */}
                <View style={[styles.cardHeader, isArabic && styles.rowReverse]}>
                    <View style={[styles.salonInfo, isArabic && styles.salonInfoRTL]}>
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
                        <View style={[styles.salonTextWrap, isArabic && styles.alignEnd]}>
                            <Text style={[styles.salonName, isArabic && styles.cairoBold]} numberOfLines={1}>
                                {item.tenant?.name || (language === 'ar' ? 'المركز' : 'Center')}
                            </Text>
                            <Text style={styles.bookingRefText}>#{bookingRefNumber}</Text>
                        </View>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(item.status) }]}>
                        <Text style={[styles.statusText, { color: getStatusTextColor(item.status) }, isArabic && styles.cairoBold]}>
                            {getStatusText(item.status, t, language)}
                        </Text>
                    </View>
                </View>

                {/* Body: Multi-Service Badge & Service Names */}
                <View style={styles.cardBody}>
                    {serviceCount > 1 ? (
                        <View style={styles.multiServiceContainer}>
                            <View style={[styles.multiServiceBadge, isArabic && styles.multiServiceBadgeRTL]}>
                                <AppIcon name="sparkles" size={13} color="#7C3AED" />
                                <Text style={[styles.multiServiceBadgeText, isArabic && styles.cairoBold]}>
                                    {serviceCount} {language === 'ar' ? 'خدمات' : 'Services'}
                                </Text>
                            </View>
                            <View style={styles.serviceList}>
                                {item.items.map((svcBooking, idx) => (
                                    <View key={svcBooking.id || idx} style={[styles.serviceListItem, isArabic && styles.rowReverse]}>
                                        <Text style={styles.serviceListBullet}>•</Text>
                                        <Text style={[styles.serviceListText, isArabic && styles.cairoRegular]} numberOfLines={1}>
                                            {getServiceName(svcBooking)}
                                        </Text>
                                        {svcBooking.Staff?.name ? (
                                            <Text style={styles.serviceListStaff} numberOfLines={1}>
                                                ({svcBooking.Staff.name})
                                            </Text>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <Text style={[styles.serviceName, isArabic && styles.cairoBold]} numberOfLines={2}>
                            {primaryServiceName}
                        </Text>
                    )}

                    {/* Date & Time Row */}
                    <View style={[styles.dateTimeRow, isArabic && styles.rowReverse]}>
                        <AppIcon name="clock" size={14} color="#7C3AED" />
                        <Text style={[styles.dateTimeText, isArabic && styles.cairoRegular]}>
                            {dateStr} • {timeStr}
                        </Text>
                    </View>

                    {/* Specialist Row (Single service fallback) */}
                    {serviceCount === 1 && representative.Staff && (
                        <View style={[styles.staffRow, isArabic && styles.rowReverse]}>
                            <AppIcon name="profile" size={13} color="#6E7596" />
                            <Text style={[styles.staffLabel, isArabic && styles.cairoRegular]}>{t('specialist')}: </Text>
                            <Text style={[styles.staffName, isArabic && styles.cairoBold]} numberOfLines={1}>
                                {representative.Staff.name}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Footer: Price, Payment State & Contextual Action */}
                <View style={[styles.cardFooter, isArabic && styles.rowReverse]}>
                    <View style={[styles.priceBlock, isArabic && styles.alignEnd]}>
                        <Text style={[styles.priceLabel, isArabic && styles.cairoRegular]}>
                            {language === 'ar' ? 'الإجمالي' : 'Total'}
                        </Text>
                        <Text style={[styles.price, isArabic && styles.cairoBold]}>
                            {formatRiyal(item.totalPrice, language)}
                        </Text>
                    </View>

                    <View style={[styles.footerRight, isArabic && styles.rowReverse]}>
                        {hasOutstanding && activeTab === 'upcoming' ? (
                            <View style={styles.dueBadge}>
                                <Text style={[styles.dueBadgeText, isArabic && styles.cairoBold]}>
                                    {language === 'ar' ? 'بانتظار الدفع' : 'Payment Due'}
                                </Text>
                            </View>
                        ) : null}

                        {canLeaveReview ? (
                            <TouchableOpacity
                                style={styles.reviewButton}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    setReviewBooking(representative);
                                }}
                            >
                                <AppIcon name="star" size={13} color="#FFFFFF" />
                                <Text style={[styles.reviewButtonText, isArabic && styles.cairoBold]}>
                                    {t('leaveReview')}
                                </Text>
                            </TouchableOpacity>
                        ) : hasCompletedReview ? (
                            <View style={styles.reviewedBadge}>
                                <AppIcon name="star" size={13} color="#059669" />
                                <Text style={[styles.reviewedBadgeText, isArabic && styles.cairoBold]}>
                                    {language === 'ar' ? 'تم التقييم' : 'Reviewed'}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (!isAuthenticated && !loading) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader
                    title={language === 'ar' ? 'المواعيد' : 'Appointments'}
                    showBack={Boolean(navigation?.canGoBack && navigation.canGoBack())}
                />
                <GuestView
                    type="bookings"
                    onLoginPress={showLogin}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={language === 'ar' ? 'المواعيد' : 'Appointments'}
                showBack={Boolean(navigation?.canGoBack && navigation.canGoBack())}
            />

            {/* Tabs */}
            <View style={[styles.tabsContainer, isRTL && styles.rowReverse]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
                    onPress={() => setActiveTab('upcoming')}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'upcoming' && styles.activeTabText,
                        language === 'ar' && styles.cairoBold,
                    ]}>{t('upcoming')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
                    onPress={() => setActiveTab('completed')}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'completed' && styles.activeTabText,
                        language === 'ar' && styles.cairoBold,
                    ]}>{language === 'ar' ? 'مكتمل' : 'Completed'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'no_show' && styles.activeTab]}
                    onPress={() => setActiveTab('no_show')}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'no_show' && styles.activeTabText,
                        language === 'ar' && styles.cairoBold,
                    ]}>{language === 'ar' ? 'لم يحضر' : 'No Show'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'cancelled' && styles.activeTab]}
                    onPress={() => setActiveTab('cancelled')}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'cancelled' && styles.activeTabText,
                        language === 'ar' && styles.cairoBold,
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
                    <View style={styles.emptyIconCircle}>
                        <AppIcon name="bookings" size={40} color="#7C3AED" />
                    </View>
                    <Text style={[styles.emptyTitle, language === 'ar' && styles.cairoBold]}>
                        {language === 'ar' ? 'لا توجد مواعيد بعد' : 'No appointments yet'}
                    </Text>
                    <Text style={[styles.emptySubtitle, language === 'ar' && styles.cairoRegular]}>
                        {activeTab === 'upcoming'
                            ? (language === 'ar' ? 'ليس لديك أي مواعيد قادمة في الوقت الحالي' : 'You have no upcoming appointments')
                            : activeTab === 'completed'
                                ? (language === 'ar' ? 'لا توجد مواعيد مكتملة سابقة' : 'No completed appointments found')
                                : activeTab === 'no_show'
                                    ? (language === 'ar' ? 'لا توجد مواعيد لم يتم حضورها' : 'No missed appointments')
                                    : (language === 'ar' ? 'لا توجد مواعيد ملغاة' : 'No cancelled appointments')}
                    </Text>
                    <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={handleRefresh}
                        activeOpacity={0.8}
                    >
                        <AppIcon name="refresh" size={16} color="#FFFFFF" />
                        <Text style={[styles.refreshButtonText, language === 'ar' && styles.cairoBold]}>
                            {t('refresh')}
                        </Text>
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

const getStatusBgColor = (status: string) => {
    switch (status) {
        case 'confirmed':
        case 'checked_in':
            return '#ECFDF5';
        case 'in_service':
        case 'completed':
            return '#EFF6FF';
        case 'pending':
            return '#FFFBEB';
        case 'cancelled':
        case 'no_show':
            return '#FEF2F2';
        default:
            return '#F3F4F6';
    }
};

const getStatusTextColor = (status: string) => {
    switch (status) {
        case 'confirmed':
        case 'checked_in':
            return '#059669';
        case 'in_service':
        case 'completed':
            return '#2563EB';
        case 'pending':
            return '#D97706';
        case 'cancelled':
        case 'no_show':
            return '#DC2626';
        default:
            return '#6B7280';
    }
};

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
        backgroundColor: '#F7F4FF',
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    alignEnd: {
        alignItems: 'flex-end',
    },
    salonInfoRTL: {
        flexDirection: 'row-reverse',
    },
    multiServiceBadgeRTL: {
        alignSelf: 'flex-end',
        flexDirection: 'row-reverse',
    },
    rescheduledRibbonRTL: {
        right: undefined,
        left: 12,
    },
    cairoBold: {
        fontFamily: 'Cairo-Bold',
    },
    cairoRegular: {
        fontFamily: 'Cairo-Regular',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E9DDFD',
        gap: 6,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
    },
    activeTab: {
        borderColor: '#7C3AED',
        backgroundColor: '#F5EEFF',
    },
    tabText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#7C3AED',
        fontWeight: '700',
    },
    listContent: {
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: spacing.md + 2,
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E9DDFD',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        position: 'relative',
    },
    rescheduledRibbon: {
        position: 'absolute',
        top: 10,
        right: 12,
        zIndex: 10,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    rescheduledRibbonText: {
        fontSize: 10,
        color: '#2563EB',
        fontWeight: '700',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0EAFB',
    },
    salonInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    salonLogo: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    placeholderLogo: {
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#7C3AED',
        fontWeight: '700',
        fontSize: 14,
    },
    salonTextWrap: {
        flex: 1,
    },
    salonName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A1A44',
    },
    bookingRefText: {
        fontSize: 11,
        color: '#7C3AED',
        fontWeight: '600',
        marginTop: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    cardBody: {
        marginBottom: 8,
    },
    serviceName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#12133A',
        marginBottom: 8,
    },
    multiServiceContainer: {
        marginBottom: 8,
    },
    multiServiceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 5,
        backgroundColor: '#F5EEFF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 6,
    },
    multiServiceBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7C3AED',
    },
    serviceList: {
        gap: 3,
        marginBottom: 4,
    },
    serviceListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    serviceListBullet: {
        fontSize: 12,
        color: '#7C3AED',
    },
    serviceListText: {
        fontSize: 13,
        color: '#374151',
        fontWeight: '600',
        flexShrink: 1,
    },
    serviceListStaff: {
        fontSize: 11,
        color: '#6B7280',
    },
    dateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    dateTimeText: {
        fontSize: 13,
        color: '#4B5563',
    },
    staffRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    staffLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    staffName: {
        fontSize: 12,
        color: '#1F204D',
        fontWeight: '700',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F0EAFB',
    },
    priceBlock: {
        gap: 1,
    },
    priceLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    price: {
        fontSize: 17,
        fontWeight: '800',
        color: '#7C3AED',
    },
    footerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dueBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
    },
    dueBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#D97706',
    },
    reviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#7C3AED',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    reviewButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    reviewedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    reviewedBadgeText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: spacing.xl,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F5EEFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        marginBottom: 6,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing.lg,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#7C3AED',
        borderRadius: 12,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
    },
    refreshButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(18, 13, 33, 0.55)',
        justifyContent: 'flex-end',
    },
    modalTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    rescheduleModalCard: {
        width: '90%',
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        padding: spacing.lg,
        marginBottom: spacing.xl,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 8,
    },
    rescheduleHint: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    rescheduleInput: {
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#F7F4FF',
        color: colors.text,
        marginBottom: 6,
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
        borderColor: '#E9DDFD',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#FFFFFF',
    },
    rescheduleCancelText: {
        color: colors.textSecondary,
        fontWeight: '600',
    },
    rescheduleSaveBtn: {
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#7C3AED',
    },
    rescheduleSaveText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});
