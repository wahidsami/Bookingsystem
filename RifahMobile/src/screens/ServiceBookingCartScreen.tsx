import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { AppIcon } from '../components/AppIcon';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { api } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';

export function ServiceBookingCartScreen({ navigation }: any) {
    const { language, isRTL, t } = useLanguage();
    const { showLogin } = useAppSession();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();
    const { items, itemCount, cartTenant, cartTenantId, totalPrice, payableNowTotal, paymentGroups, removeItem, clearCart } = useServiceBookingCart();
    const [loading, setLoading] = useState(false);
    const sharedBookingSessionId = items.length > 0
        ? items[0].bookingSessionId || null
        : null;
    const sharedBookingReference = items.length > 0
        ? items[0].bookingReference || null
        : null;
    const sharedGroupGuest = items.length > 0
        ? items[0].groupGuest || null
        : null;
    const hasSharedBookingSession = items.length > 0
        && items.every((item) => (item.bookingSessionId || null) === sharedBookingSessionId)
        && items.every((item) => (item.bookingReference || null) === sharedBookingReference);
    const hasSharedGroupGuest = items.length > 0
        && items.every((item) => JSON.stringify(item.groupGuest || null) === JSON.stringify(sharedGroupGuest));

    const groupedByPayment = useMemo(() => paymentGroups.filter((group) => group.count > 0), [paymentGroups]);

    const handleCheckout = async () => {
        if (items.length === 0) {
            return;
        }

        const uniqueTenantIds = Array.from(new Set(items.map((item) => item.tenantId).filter(Boolean)));
        if (uniqueTenantIds.length > 1) {
            Alert.alert(
                language === 'ar' ? 'خطأ في السلة' : 'Cart Error',
                language === 'ar'
                    ? 'لا يمكن دمج خدمات من مراكز مختلفة في نفس الحجز.'
                    : 'You cannot combine services from different centers in one booking.'
            );
            return;
        }

        const user = await api.getUser();
        if (!user) {
            Alert.alert(t('guestTitle'), t('loginToOrderBookings'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('loginNow'), onPress: showLogin },
            ]);
            return;
        }

        try {
            setLoading(true);

            const response = await api.post<{
                success: boolean;
                message?: string;
                bookingSession?: {
                    id: string;
                    bookingReference: string;
                    paymentMethod?: string;
                    itemCount?: number;
                    subtotal?: number;
                    taxAmount?: number;
                    platformFee?: number;
                    totalAmount?: number;
                    paymentSummary?: {
                        atCenterAmount: number;
                        onlineFullAmount: number;
                        bookingFeeAmount: number;
                        totalAmount: number;
                        itemCount: number;
                    };
                };
                appointments?: Array<{ id: string }>;
            }>('/bookings/create', {
                tenantId: cartTenantId || items[0]?.tenantId,
                bookingSessionId: hasSharedBookingSession && sharedBookingSessionId ? sharedBookingSessionId : undefined,
                bookingReference: hasSharedBookingSession && sharedBookingReference ? sharedBookingReference : undefined,
                groupGuest: hasSharedGroupGuest ? sharedGroupGuest || undefined : undefined,
                items: items.map((item) => ({
                    serviceId: item.service.id,
                    variantId: item.variant?.id || null,
                    staffId: item.staff?.id || item.staffId || null,
                    requestedStaffId: item.requestedStaffId || item.staff?.id || null,
                    startTime: item.startTime,
                    notes: item.notes || undefined,
                    paymentMethod: item.paymentMethod,
                })),
            });

            const bookingReference = response.bookingSession?.bookingReference || response.bookingSession?.id || '';
            const bookingSessionId = response.bookingSession?.id;
            clearCart();

            if (payableNowTotal > 0 && bookingSessionId) {
                const tenantForCheckout = cartTenantId || items[0]?.tenantId;
                try {
                    const sourcesResponse = await api.getEligiblePaymentSources({
                        tenantId: tenantForCheckout ? String(tenantForCheckout) : undefined,
                        amount: payableNowTotal,
                    });
                    const hasPayableSource = (sourcesResponse.sources || []).some((source) => source.eligible && (source.source === 'online_payment' || source.source === 'wallet'));
                    if (!hasPayableSource) {
                        Alert.alert(
                            language === 'ar' ? 'مصادر الدفع غير متاحة' : 'Payment sources unavailable',
                            language === 'ar'
                                ? 'لا تتوفر طريقة دفع صالحة لهذا الحجز حالياً. يرجى المحاولة لاحقاً أو اختيار خدمات بدفع عند المركز.'
                                : 'No valid payment source is currently available for this booking. Please try again later or choose pay-at-center services.'
                        );
                        return;
                    }
                } catch {
                    // Keep backward-compatible behavior when the eligibility endpoint is unavailable.
                }

                navigation.navigate('Payment', {
                    bookingSessionId,
                    amount: payableNowTotal,
                    tenantId: tenantForCheckout,
                    paymentChoice: groupedByPayment.some((group) => group.paymentMethod === 'online-full')
                        ? 'online-full'
                        : 'booking-fee',
                });
                return;
            }

            if (payableNowTotal > 0 && !bookingSessionId) {
                Alert.alert(
                    language === 'ar' ? 'فشل بدء الدفع' : 'Payment setup failed',
                    language === 'ar'
                        ? 'تم إنشاء الحجز لكن لا يمكن بدء الدفع الآن. يرجى المحاولة من صفحة المواعيد.'
                        : 'Booking was created, but payment could not be initialized. Please retry from the Appointments page.',
                    [
                        {
                            text: language === 'ar' ? 'عرض المواعيد' : 'View Appointments',
                            onPress: () => navigation.navigate('Tabs', { screen: 'Appointments' }),
                        },
                    ]
                );
                return;
            }

            Alert.alert(
                language === 'ar' ? 'تم تأكيد الحجز' : 'Booking confirmed',
                bookingReference
                    ? (language === 'ar'
                        ? `تم إنشاء ${itemCount} مواعيد مرتبطة. رقم الحجز: ${bookingReference}`
                        : `${itemCount} linked appointments have been created. Booking reference: ${bookingReference}`)
                    : (language === 'ar'
                        ? 'تم إنشاء مواعيدك بنجاح.'
                        : 'Your appointments have been created successfully.'),
                [
                    {
                        text: language === 'ar' ? 'عرض المواعيد' : 'View Appointments',
                        onPress: () => navigation.navigate('Tabs', { screen: 'Appointments' }),
                    },
                ]
            );
        } catch (error: any) {
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', error.message || (language === 'ar' ? 'تعذر إنهاء الحجز' : 'Failed to complete booking'));
        } finally {
            setLoading(false);
        }
    };

    const formatDateTime = (value: string) => {
        const date = new Date(value);
        return format(date, 'PPP p', { locale: isRTL ? ar : enUS });
    };

    const openTenant = () => {
        if (!cartTenantId) {
            navigation.goBack();
            return;
        }

        navigation.navigate('Tenant', {
            tenantId: cartTenantId,
            tenant: cartTenant,
            slug: cartTenant?.slug,
        });
    };

    if (items.length === 0) {
        return (
            <View style={[styles.container, styles.emptyState]}>
                <AppIcon name="bookings" size={72} color={colors.textSecondary} />
                <Text style={styles.emptyTitle}>{language === 'ar' ? 'لا توجد خدمات محفوظة' : 'Your booking cart is empty'}</Text>
                <Text style={styles.emptySubtitle}>
                    {language === 'ar'
                        ? 'أضف خدمة من صفحة الخدمة ثم عد هنا لإكمال الحجز.'
                        : 'Add a service from the tenant page and come back here to complete the booking.'}
                </Text>
                <TouchableOpacity style={styles.emptyCtaButton} onPress={openTenant}>
                    <Text style={styles.emptyCtaButtonText}>
                        {language === 'ar' ? 'تصفح الخدمات' : 'Browse Services'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <View style={[styles.header, { paddingTop: spacing.md + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>
                        {language === 'ar' ? 'سلة الحجز' : 'Booking Cart'}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {itemCount} {language === 'ar' ? 'خدمة محفوظة' : 'service items saved'}
                    </Text>
                </View>
                <TouchableOpacity style={styles.headerAction} onPress={openTenant}>
                    <AppIcon name="plus" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>
                        {language === 'ar' ? 'ملخص الدفع' : 'Payment Summary'}
                    </Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{language === 'ar' ? 'إجمالي الخدمات' : 'Total services'}</Text>
                        <Text style={styles.summaryValue}>{formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{language === 'ar' ? 'المطلوب الآن' : 'Due now'}</Text>
                        <Text style={styles.summaryValue}>{formatRiyal(payableNowTotal, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    {groupedByPayment.map((group) => (
                        <View key={group.paymentMethod} style={styles.paymentGroupRow}>
                            <Text style={styles.summaryLabel}>
                                {group.paymentMethod === 'at-center'
                                    ? (language === 'ar' ? 'الدفع عند المركز' : 'Pay at center')
                                    : group.paymentMethod === 'online-full'
                                        ? (language === 'ar' ? 'الدفع عبر الإنترنت' : 'Pay online')
                                        : (language === 'ar' ? 'عربون الحجز' : 'Booking fee')}
                                {' '}
                                ({group.count})
                            </Text>
                            <Text style={styles.summaryValue}>{formatRiyal(group.payableNowTotal, isRTL ? 'ar' : 'en')}</Text>
                        </View>
                    ))}
                </View>

                {items.map((item) => {
                    const serviceName = isRTL ? item.service.name_ar : item.service.name_en;
                    const variantLabel = item.variant?.description?.trim() || '';
                    const staffLabel = item.staff?.name || (language === 'ar' ? 'أي متخصص' : 'Any professional');
                    const paymentLabel = item.paymentMethod === 'at-center'
                        ? (language === 'ar' ? 'الدفع عند المركز' : 'Pay at center')
                        : item.paymentMethod === 'online-full'
                            ? (language === 'ar' ? 'الدفع عبر الإنترنت' : 'Pay online')
                            : (language === 'ar' ? 'عربون الحجز' : 'Booking fee');

                    return (
                        <View key={item.id} style={styles.itemCard}>
                            <View style={styles.itemHeader}>
                                <View style={styles.itemThumbWrap}>
                                    {item.service.finalPrice ? (
                                        <View style={styles.itemThumb}>
                                            <Text style={styles.itemThumbText}>{serviceName.charAt(0) || 'S'}</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.itemThumb}>
                                            <Text style={styles.itemThumbText}>{serviceName.charAt(0) || 'S'}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{serviceName}</Text>
                                    {!!variantLabel && <Text style={styles.itemMeta}>{variantLabel}</Text>}
                                    <Text style={styles.itemMeta}>{staffLabel}</Text>
                                </View>
                                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeButton}>
                                    <AppIcon name="delete" size={18} color={colors.error} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.itemActionRow}>
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={() => navigation.navigate('Booking', {
                                        service: item.service,
                                        tenant: cartTenant,
                                        selectedStaff: item.staff || undefined,
                                        selectedVariant: item.variant || undefined,
                                        startTime: item.startTime,
                                        endTime: item.startTime,
                                        notes: item.notes || '',
                                        paymentMethod: item.paymentMethod,
                                        cartItemId: item.id,
                                    })}
                                >
                                    <AppIcon name="settings" size={14} color={colors.primary} />
                                    <Text style={styles.editButtonText}>{language === 'ar' ? 'تعديل' : 'Edit'}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.itemDetails}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{language === 'ar' ? 'الموعد' : 'Time'}</Text>
                                    <Text style={styles.detailValue}>{formatDateTime(item.startTime)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{language === 'ar' ? 'نوع الدفع' : 'Payment'}</Text>
                                    <Text style={styles.detailValue}>{paymentLabel}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{language === 'ar' ? 'الإجمالي' : 'Total'}</Text>
                                    <Text style={styles.detailValue}>{formatRiyal(item.totalPrice, isRTL ? 'ar' : 'en')}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{language === 'ar' ? 'يدفع الآن' : 'Due now'}</Text>
                                    <Text style={styles.detailValue}>{formatRiyal(item.payableNowAmount, isRTL ? 'ar' : 'en')}</Text>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: bottomInset }]}>
                <TouchableOpacity style={[styles.secondaryButton, loading && styles.disabledButton]} onPress={openTenant} disabled={loading}>
                    <Text style={styles.secondaryButtonText}>{language === 'ar' ? 'إضافة خدمة أخرى' : 'Add More Services'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} onPress={handleCheckout} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color={colors.textInverse} />
                    ) : (
                        <Text style={styles.primaryButtonText}>{language === 'ar' ? 'تأكيد الحجز' : 'Confirm Booking'}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    emptyState: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
        marginTop: spacing.lg,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
    },
    emptyCtaButton: {
        minWidth: 180,
        maxWidth: 260,
        width: '72%',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
    },
    emptyCtaButtonText: {
        color: colors.textInverse,
        fontWeight: '700',
        fontSize: fontSize.md,
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    headerSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    backButton: {
        padding: spacing.xs,
    },
    headerAction: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${colors.primary}20`,
    },
    scrollContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    summaryCard: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.sm,
    },
    summaryTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentGroupRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.xs,
    },
    summaryLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        flex: 1,
        paddingRight: spacing.sm,
    },
    summaryValue: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.primary,
    },
    itemCard: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.md,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    itemThumbWrap: {
        width: 52,
        height: 52,
    },
    itemThumb: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: `${colors.primary}20`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemThumbText: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.primary,
    },
    itemTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    itemMeta: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    removeButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${colors.error}14`,
    },
    itemDetails: {
        gap: spacing.sm,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    itemActionRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: `${colors.primary}55`,
        backgroundColor: `${colors.primary}14`,
    },
    editButtonText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.primary,
    },
    detailLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        flex: 1,
    },
    detailValue: {
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    footer: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    primaryButtonText: {
        color: colors.textInverse,
        fontWeight: '700',
        fontSize: fontSize.md,
    },
    secondaryButtonText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: fontSize.md,
    },
    disabledButton: {
        opacity: 0.7,
    },
});
