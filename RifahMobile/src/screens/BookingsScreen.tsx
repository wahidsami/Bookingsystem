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
    const { showLogin } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'no_show' | 'cancelled'>('upcoming');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
    const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
    const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());
    const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleTime, setRescheduleTime] = useState('');
    const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

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

        const isRescheduled = item.items.some((booking) => hasRescheduleAudit(booking));
        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('AppointmentDetails', { bookingGroup: item, activeTab })}
            >
                {isRescheduled && activeTab === 'upcoming' ? (
                    <View style={styles.rescheduledRibbon}>
                        <Text style={styles.rescheduledRibbonText}>{language === 'ar' ? 'أعيدت الجدولة' : 'Rescheduled'}</Text>
                    </View>
                ) : null}
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
                        {language === 'ar' ? 'رقم الحجز' : 'Booking No.'} {getBookingNumber(representative)}
                    </Text>
                    <Text style={styles.serviceName}>
                        {serviceCount > 1
                            ? (language === 'ar' ? `${serviceCount} خدمات مرتبطة` : `${serviceCount} linked services`)
                            : getServiceName(representative)}
                    </Text>
                    {serviceCount === 1 && !!getServiceVariantLabel(representative) && (
                        <Text style={styles.variantLabel}>{getServiceVariantLabel(representative)}</Text>
                    )}
                    {serviceCount > 1 && (
                        <Text style={styles.variantLabel}>
                            {item.items
                                .slice(0, 2)
                                .map((booking) => `${getServiceName(booking)}${getServiceVariantLabel(booking) ? ` · ${getServiceVariantLabel(booking)}` : ''}`)
                                .join('\n')}
                            {item.items.length > 2 ? `\n${language === 'ar' ? '...وغيرها' : '...and more'}` : ''}
                        </Text>
                    )}
                    <View style={styles.dateTimeRow}>
                        <AppIcon name="bookings" size={16} color={colors.primary} />
                        <Text style={styles.dateTimeText}>
                            {format(dateDate, 'eeee, d MMMM yyyy', { locale: isArabic ? ar : enUS })}
                        </Text>
                    </View>
                    <View style={styles.dateTimeRow}>
                        <AppIcon name="clock" size={16} color={colors.primary} />
                        <Text style={styles.dateTimeText}>
                            {format(dateDate, 'h:mm a', { locale: isArabic ? ar : enUS })}
                        </Text>
                    </View>
                    {representative.Staff && (
                        <View style={styles.staffRow}>
                            <Text style={styles.staffLabel}>{t('specialist')}: </Text>
                            <Text style={styles.staffName}>{representative.Staff.name}</Text>
                        </View>
                    )}
                    {groupGuest && activeTab === 'upcoming' && (
                        <View style={styles.staffRow}>
                            <Text style={styles.staffLabel}>{language === 'ar' ? 'الضيف' : 'Guest'}: </Text>
                            <Text style={styles.staffName}>
                                {groupGuest.fullName}
                                {groupGuest.phone ? ` · ${groupGuest.phone}` : ''}
                                {groupGuest.email ? ` · ${groupGuest.email}` : ''}
                                {groupGuest.birthDate ? ` · ${groupGuest.birthDate}` : ''}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Footer: Price & Actions */}
                <View style={styles.cardFooter}>
                    <View style={styles.priceBlock}>
                        <Text style={styles.price}>{formatRiyal(item.totalPrice, isRTL ? 'ar' : 'en')}</Text>
                        <Text style={styles.dueNowText}>
                            {language === 'ar'
                                ? `يدفع الآن: ${formatRiyal(item.payableNowTotal, 'ar')}`
                                : `Due now: ${formatRiyal(item.payableNowTotal, 'en')}`}
                        </Text>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.payButton}
                            onPress={() => navigation.navigate('AppointmentDetails', { bookingGroup: item, activeTab })}
                        >
                            <Text style={styles.payButtonText}>{language === 'ar' ? 'عرض التفاصيل' : 'View Details'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (!isAuthenticated && !loading) {
        return (
            <>
                <LinearGradient
                    colors={['#F5F0FF', '#FFFFFF']}
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
                colors={['#F5F0FF', '#FFFFFF']}
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
        backgroundColor: '#F7F6FB',
    },
    header: {
        padding: spacing.xl,
        backgroundColor: colors.background,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#14153C',
    },
    tabsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.background,
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E7DFFA',
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
    },
    activeTab: {
        borderColor: '#C4ABFB',
        backgroundColor: '#F5EEFF',
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
        padding: spacing.lg,
        gap: spacing.md,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: spacing.lg,
        shadowColor: '#1A1440',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 2,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#ECE7FA',
        position: 'relative',
    },
    rescheduledRibbon: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#E8F1FF',
        borderWidth: 1,
        borderColor: '#C8DDFE',
    },
    rescheduledRibbonText: {
        fontSize: 9,
        color: '#2E5FA8',
        fontWeight: '700',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#EDE8FA',
    },
    salonInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    salonLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
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
        fontSize: 13,
        fontWeight: '700',
        color: '#1A1A44',
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 9,
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
        fontSize: 20,
        fontWeight: '800',
        color: '#171840',
        marginBottom: spacing.sm,
    },
    variantLabel: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.primary,
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
        fontSize: 12,
        color: '#6E7596',
    },
    staffRow: {
        flexDirection: 'row',
        marginTop: spacing.sm,
    },
    staffLabel: {
        fontSize: 12,
        color: '#6E7596',
    },
    staffName: {
        fontSize: 12,
        color: '#1F204D',
        fontWeight: '700',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: spacing.sm,
        gap: spacing.sm,
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
        gap: spacing.sm,
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
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
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
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A44',
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
        color: colors.textInverse,
        fontWeight: '600',
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
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        padding: spacing.lg,
        marginBottom: spacing.xl,
        shadowColor: '#1F123F',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 8,
    },
    rescheduleHint: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    rescheduleInput: {
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#FAFAFF',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    rescheduleActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: spacing.sm,
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
