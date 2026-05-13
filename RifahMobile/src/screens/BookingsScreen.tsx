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
    ScrollView,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, Booking, getBookingOutstandingAmount, getImageUrl } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { GuestView } from '../components/GuestView';
import { useAppSession } from '../contexts/AppSessionContext';
import { useFocusEffect } from '@react-navigation/native';
import { bookingNeedsPayment } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import { ReviewPromptModal } from '../components/ReviewPromptModal';

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
    const { showLogin } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
    const [selectedBookingGroup, setSelectedBookingGroup] = useState<BookingGroup | null>(null);
    const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
    const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());

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
                api.getBookings(activeTab === 'upcoming' ? 'upcoming' : 'completed'),
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

    const getServiceVariantLabel = (booking: Booking) => {
        const variantName = booking.serviceVariantName?.trim();
        if (!variantName) {
            return '';
        }

        return language === 'ar' ? `النوع: ${variantName}` : `Variant: ${variantName}`;
    };

    const getStaffName = (booking: Booking) =>
        booking.Staff?.name || booking.staff?.name || '-';

    const getPaymentStatusText = (booking: Booking) => {
        const paymentStatus = booking.paymentStatus;
        const outstandingAmount = getBookingOutstandingAmount(booking);
        const normalizedPaymentStatus = (() => {
            const raw = `${paymentStatus || ''}`.trim().toLowerCase();
            if ((raw === 'fully_paid' || raw === 'paid') && outstandingAmount > 0.009) {
                return 'deposit_paid';
            }
            if (raw === 'deposit_paid' && outstandingAmount <= 0.009) {
                return 'fully_paid';
            }
            return raw || 'pending';
        })();

        if (language === 'ar') {
            switch (normalizedPaymentStatus) {
                case 'pending': return 'بانتظار الدفع';
                case 'deposit_paid': return 'عربون مدفوع';
                case 'fully_paid':
                case 'paid': return 'مدفوع بالكامل';
                case 'refunded': return 'مسترد';
                case 'partially_refunded': return 'مسترد جزئياً';
                default: return paymentStatus || '-';
            }
        }

        switch (normalizedPaymentStatus) {
            case 'pending': return 'Pending';
            case 'deposit_paid': return 'Deposit Paid';
            case 'fully_paid':
            case 'paid': return 'Fully Paid';
            case 'refunded': return 'Refunded';
            case 'partially_refunded': return 'Partially Refunded';
            default: return paymentStatus || '-';
        }
    };

    const renderBookingCard = ({ item }: { item: BookingGroup }) => {
        const isArabic = language === 'ar';
        const representative = item.items[0];
        const dateDate = new Date(item.startTime);
        const serviceCount = item.items.length;

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => setSelectedBookingGroup(item)}
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
                </View>

                {/* Footer: Price & Actions */}
                <View style={styles.cardFooter}>
                    <View style={styles.priceBlock}>
                        <Text style={styles.price}>{item.totalPrice.toFixed(2)} SAR</Text>
                        <Text style={styles.dueNowText}>
                            {language === 'ar'
                                ? `يدفع الآن: ${item.payableNowTotal.toFixed(2)} SAR`
                                : `Due now: ${item.payableNowTotal.toFixed(2)} SAR`}
                        </Text>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.payButton}
                            onPress={() => setSelectedBookingGroup(item)}
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
                <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
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
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
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
                visible={!!selectedBookingGroup}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedBookingGroup(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
                        >
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTitle}>
                                        {language === 'ar' ? 'تفاصيل الحجز' : 'Booking Details'}
                                    </Text>
                                    {selectedBookingGroup && (
                                        <Text style={styles.modalReference}>
                                            {language === 'ar' ? 'رقم الحجز' : 'Booking No.'} {getBookingNumber(selectedBookingGroup.items[0])}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={styles.modalCloseButton}
                                    onPress={() => setSelectedBookingGroup(null)}
                                >
                                    <Text style={styles.modalCloseText}>×</Text>
                                </TouchableOpacity>
                            </View>

                            {selectedBookingGroup && (
                                <View style={styles.modalBody}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'المركز' : 'Center'}</Text>
                                        <Text style={styles.detailValue}>{selectedBookingGroup.tenant?.name || '-'}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'عدد الخدمات' : 'Services'}</Text>
                                        <Text style={styles.detailValue}>{selectedBookingGroup.items.length}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'الموعد الأول' : 'First time'}</Text>
                                        <Text style={styles.detailValue}>
                                            {format(new Date(selectedBookingGroup.startTime), 'eeee, d MMMM yyyy', {
                                                locale: language === 'ar' ? ar : enUS,
                                            })}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'الإجمالي' : 'Total'}</Text>
                                        <Text style={styles.detailValue}>{selectedBookingGroup.totalPrice.toFixed(2)} SAR</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{language === 'ar' ? 'يدفع الآن' : 'Due now'}</Text>
                                        <Text style={styles.detailValue}>{selectedBookingGroup.payableNowTotal.toFixed(2)} SAR</Text>
                                    </View>

                                    <Text style={styles.modalSectionTitle}>{language === 'ar' ? 'العناصر' : 'Items'}</Text>
                                    {selectedBookingGroup.items.map((booking) => (
                                        <View key={booking.id} style={styles.groupItemCard}>
                                            <View style={styles.detailRow}>
                                                <Text style={styles.detailLabel}>{language === 'ar' ? 'الخدمة' : 'Service'}</Text>
                                                <Text style={styles.detailValue}>{getServiceName(booking)}</Text>
                                            </View>
                                            {booking.serviceVariantName && (
                                                <View style={styles.detailRow}>
                                                    <Text style={styles.detailLabel}>{language === 'ar' ? 'النوع' : 'Variant'}</Text>
                                                    <Text style={styles.detailValue}>{booking.serviceVariantName}</Text>
                                                </View>
                                            )}
                                            <View style={styles.detailRow}>
                                                <Text style={styles.detailLabel}>{language === 'ar' ? 'الوقت' : 'Time'}</Text>
                                                <Text style={styles.detailValue}>
                                                    {format(new Date(booking.startTime), 'PPP p', {
                                                        locale: language === 'ar' ? ar : enUS,
                                                    })}
                                                </Text>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <Text style={styles.detailLabel}>{language === 'ar' ? 'الموظف' : 'Employee'}</Text>
                                                <Text style={styles.detailValue}>{getStaffName(booking)}</Text>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <Text style={styles.detailLabel}>{language === 'ar' ? 'الحالة' : 'Status'}</Text>
                                                <Text style={styles.detailValue}>{getStatusText(booking.status, t, language)}</Text>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <Text style={styles.detailLabel}>{language === 'ar' ? 'حالة الدفع' : 'Payment Status'}</Text>
                                                <Text style={styles.detailValue}>{getPaymentStatusText(booking)}</Text>
                                            </View>
                                            <View style={styles.detailRow}>
                                                <Text style={styles.detailLabel}>{language === 'ar' ? 'السعر' : 'Amount'}</Text>
                                                <Text style={styles.detailValue}>{Number(booking.price || 0).toFixed(2)} SAR</Text>
                                            </View>
                                            {booking.paymentMethod && (
                                                <View style={styles.detailRow}>
                                                    <Text style={styles.detailLabel}>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</Text>
                                                    <Text style={styles.detailValue}>{booking.paymentMethod}</Text>
                                                </View>
                                            )}
                                            {booking.notes && (
                                                <View style={styles.notesBlock}>
                                                    <Text style={styles.detailLabel}>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Text>
                                                    <Text style={styles.notesText}>{booking.notes}</Text>
                                                </View>
                                            )}

                                            {bookingNeedsPayment(booking.paymentStatus) && !['cancelled', 'completed', 'no_show'].includes(booking.status) && activeTab === 'upcoming' && (
                                                <TouchableOpacity
                                                    style={styles.payButton}
                                                    onPress={() => (navigation as any).navigate('Payment', {
                                                        appointmentId: booking.id,
                                                        amount: getBookingOutstandingAmount(booking),
                                                        tenantId: booking.tenantId || booking.tenant?.id,
                                                        paymentChoice: booking.paymentStatus === 'pending' && booking.paymentMethod === 'booking-fee'
                                                            ? 'booking-fee'
                                                            : undefined,
                                                    })}
                                                >
                                                    <Text style={styles.payButtonText}>{t('payNow')}</Text>
                                                </TouchableOpacity>
                                            )}

                                            {['confirmed', 'pending'].includes(booking.status) && activeTab === 'upcoming' && (
                                                <TouchableOpacity
                                                    style={styles.cancelButton}
                                                    onPress={() => handleCancel(booking.id)}
                                                >
                                                    <Text style={styles.cancelButtonText}>{t('cancel' as any)}</Text>
                                                </TouchableOpacity>
                                            )}
                                            {booking.status === 'completed' && activeTab === 'history' && (
                                                reviewedAppointmentIds.has(booking.id) ? (
                                                    <View style={[styles.reviewButton, styles.reviewedButton]}>
                                                        <AppIcon name="star" size={16} color="#065f46" />
                                                        <Text style={[styles.reviewButtonText, styles.reviewedButtonText]}>
                                                            {language === 'ar' ? 'تم التقييم' : 'Reviewed'}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.reviewButton}
                                                        onPress={() => setReviewBooking(booking)}
                                                    >
                                                        <AppIcon name="star" size={16} color="#FFFFFF" />
                                                        <Text style={styles.reviewButtonText}>{language === 'ar' ? 'أضف تقييم' : 'Write Review'}</Text>
                                                    </TouchableOpacity>
                                                )
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            <ReviewPromptModal
                visible={!!reviewBooking}
                appointment={reviewBooking}
                onClose={() => setReviewBooking(null)}
                onSuccess={() => {
                    setReviewBooking(null);
                    loadBookings();
                }}
            />
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
            case 'pending': return 'غير مؤكد';
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
        case 'pending': return 'Unconfirmed';
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
        alignItems: 'flex-end',
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    priceBlock: {
        flex: 1,
        gap: 2,
    },
    price: {
        fontSize: fontSize.lg,
        fontWeight: '700',
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
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    dueNowText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
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
        marginTop: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
    },
    reviewButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    reviewedButton: {
        backgroundColor: '#ECFDF3',
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    reviewedButtonText: {
        color: '#166534',
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
    modalSectionTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    groupItemCard: {
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.border,
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
