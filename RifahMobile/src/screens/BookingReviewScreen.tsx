import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, Tenant } from '../api/client';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { processBookingCheckout } from '../utils/bookingOrchestration';

const DEFAULT_BOOKING_PAYMENT_SETTINGS = {
    allowServicePayAtCenter: true,
    allowServiceFullOnline: true,
    allowServiceDeposit: true,
    serviceDepositMode: 'fixed' as const,
    serviceDepositFixedAmount: 50,
    serviceDepositPercentage: 50,
};

export function BookingReviewScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();
    const { tenantId } = route.params || {};
    const { items, totalPrice, cartTenant, clearCart } = useServiceBookingCart();
    
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    const [fullTenant, setFullTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState(items[0]?.notes || '');

    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
    const [walletEnabled, setWalletEnabled] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!tenantId || items.length === 0) {
            if (navigation.isFocused()) navigation.goBack();
            return;
        }

        const fetchTenantAndWallet = async () => {
            try {
                const tenantResponse = await api.get<{ success: boolean; tenant: Tenant }>(`/public/tenant/${tenantId}`);
                if (tenantResponse.success && tenantResponse.tenant) setFullTenant(tenantResponse.tenant);
                
                const sourcesResponse = await api.getEligiblePaymentSources({ tenantId, amount: totalPrice }).catch(() => null);
                if (sourcesResponse && sourcesResponse.sources) {
                    const hasWallet = sourcesResponse.sources.some((s) => s.source === 'wallet' && s.eligible !== false);
                    setWalletEnabled(hasWallet);
                    if (hasWallet) {
                        const balance = await api.getWalletBalance(tenantId).catch(() => 0);
                        setWalletBalance(balance);
                    }
                }
            } catch (error) {
                console.error('Failed to load review screen details', error);
            } finally {
                setLoading(false);
            }
        };

        void fetchTenantAndWallet();
    }, [tenantId, items.length]);

    const tenantToUse = fullTenant || cartTenant;
    const tenantName = isRTL ? (tenantToUse?.name_ar || tenantToUse?.name_en || tenantToUse?.name) : (tenantToUse?.name_en || tenantToUse?.name_ar || tenantToUse?.name);
    
    const overallStartTime = useMemo(() => {
        if (items.length === 0 || !items[0].startTime) return null;
        const starts = items.map(i => new Date(i.startTime).getTime());
        return new Date(Math.min(...starts));
    }, [items]);

    const overallEndTime = useMemo(() => {
        if (items.length === 0 || !items[0].startTime) return null;
        const ends = items.map(i => i.endTime ? new Date(i.endTime).getTime() : new Date(i.startTime).getTime() + (i.service.duration || 0) * 60000);
        return new Date(Math.max(...ends));
    }, [items]);
    
    const displayedDuration = useMemo(() => {
        if (!overallStartTime || !overallEndTime) return 0;
        return Math.round((overallEndTime.getTime() - overallStartTime.getTime()) / 60000);
    }, [overallStartTime, overallEndTime]);

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return isRTL ? `${minutes} دقيقة` : `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) return isRTL ? `${hours} ساعة` : `${hours} hr`;
        return isRTL ? `${hours} س ${mins} د` : `${hours} hr, ${mins} min`;
    };

    const bookingPaymentSettings = useMemo(() => ({
        ...DEFAULT_BOOKING_PAYMENT_SETTINGS,
        ...((tenantToUse as any)?.paymentSettings || {}),
        ...((tenantToUse as any)?.bookingSettings?.payment || {}),
    }), [tenantToUse]);

    const bookingDepositAmount = useMemo(() => {
        if (!bookingPaymentSettings.allowServiceDeposit) return null;
        const calculated = bookingPaymentSettings.serviceDepositMode === 'percentage'
            ? totalPrice * ((bookingPaymentSettings.serviceDepositPercentage || 50) / 100)
            : (bookingPaymentSettings.serviceDepositFixedAmount || 50);
        return Number(Math.max(0, Math.min(totalPrice, calculated)).toFixed(2));
    }, [bookingPaymentSettings, totalPrice]);

    const availablePaymentOptions = useMemo(() => {
        if (items.length === 0) return [];
        const options: Array<{ id: string; label: string; desc?: string; disabled?: boolean; badges?: string[] }> = [];
        
        const tenantAtCenter = bookingPaymentSettings.allowServicePayAtCenter !== false;
        const tenantOnlineFull = bookingPaymentSettings.allowServiceFullOnline !== false;
        const tenantDeposit = bookingPaymentSettings.allowServiceDeposit !== false;

        const allAllowAtCenter = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('at-center'));
        const allAllowOnlineFull = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('online-full'));
        const allAllowDeposit = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('booking-fee'));

        if (tenantOnlineFull && allAllowOnlineFull) {
            options.push({ id: 'online-full', label: isRTL ? 'الدفع كاملاً أونلاين' : 'Pay in full online', badges: ['mada', 'Pay', 'VISA'] });
        }
        if (tenantDeposit && allAllowDeposit && bookingDepositAmount !== null && bookingDepositAmount > 0) {
            options.push({ id: 'booking-fee', label: isRTL ? 'دفع عربون الآن' : 'Pay deposit now', desc: formatRiyal(bookingDepositAmount, isRTL ? 'ar' : 'en') });
        }
        if (tenantAtCenter && allAllowAtCenter) {
            options.push({ id: 'at-center', label: isRTL ? 'الدفع عند المركز' : 'Pay at center', desc: isRTL ? '0 ريال الآن' : '0 SAR now' });
        }
        if (walletEnabled) {
            const hasEnough = walletBalance >= totalPrice;
            options.push({ id: 'wallet', label: isRTL ? 'محفظة' : 'Wallet', desc: formatRiyal(walletBalance, isRTL ? 'ar' : 'en'), disabled: !hasEnough });
        }

        return options;
    }, [bookingPaymentSettings, items, bookingDepositAmount, walletEnabled, walletBalance, isRTL, totalPrice]);

    if (availablePaymentOptions.length > 0 && !selectedPaymentMethod) {
        const firstEnabled = availablePaymentOptions.find(o => !o.disabled);
        if (firstEnabled) setSelectedPaymentMethod(firstEnabled.id);
    }

    const payableNowAmount = useMemo(() => {
        if (selectedPaymentMethod === 'at-center') return 0;
        if (selectedPaymentMethod === 'wallet') return totalPrice;
        if (selectedPaymentMethod === 'online-full') return totalPrice;
        if (selectedPaymentMethod === 'booking-fee' && bookingDepositAmount !== null) return bookingDepositAmount;
        return 0;
    }, [selectedPaymentMethod, totalPrice, bookingDepositAmount]);

    const handleContinue = async () => {
        if (submitting) return;
        setSubmitting(true);
        if (items.length > 0) items[0].notes = notes; 
        
        try {
            await processBookingCheckout({
                tenant: tenantToUse, items, totalPrice, payableNowAmount, bookingDepositAmount,
                selectedPaymentMethod: selectedPaymentMethod || '', isRTL, navigation, clearCart,
            });
        } catch (error) {
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: topInset }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isRTL ? 'مراجعة وتأكيد' : 'Review and Confirm'}</Text>
                <View style={styles.headerRight} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            ) : (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={[styles.contentScroll, { paddingBottom: scrollBottomPadding + 140 }]}>
                        
                        <View style={styles.progressIndicator}>
                            <View style={styles.progressCircle}><Text style={styles.progressNum}>3</Text></View>
                            <Text style={styles.progressText}>{isRTL ? 'الخطوة 3 من 3: المراجعة النهائية' : 'Step 3 of 3: Final Review'}</Text>
                        </View>

                        {/* Salon Card (Where) */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}><Text style={styles.cardTitle}>{isRTL ? 'أين' : 'Where'}</Text></View>
                            <View style={styles.salonInfo}>
                                <Image source={{ uri: getImageUrl(tenantToUse?.logo) || 'https://via.placeholder.com/150' }} style={styles.salonThumbnail} />
                                <View style={styles.salonDetails}>
                                    <View style={styles.salonNameRow}>
                                        <Text style={styles.salonName} numberOfLines={1}>{tenantName}</Text>
                                        <View style={styles.salonRatingPill}>
                                            <AppIcon name="star" size={12} color="#F59E0B" />
                                            <Text style={styles.salonRatingText}>{(fullTenant as any)?.rating || '4.9'}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.salonLocation} numberOfLines={1}>
                                        {fullTenant?.address || fullTenant?.city || (isRTL ? 'الرياض' : 'Riyadh')}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Date & Time Card (When) */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}><Text style={styles.cardTitle}>{isRTL ? 'متى' : 'When'}</Text></View>
                            {overallStartTime && overallEndTime && (
                                <View style={styles.dateTimeRow}>
                                    <View style={styles.dateTimeIcon}><AppIcon name="event" size={24} color={colors.primary} /></View>
                                    <View>
                                        <Text style={styles.dateText}>{format(overallStartTime, 'EEEE, MMMM d', { locale: isRTL ? ar : enUS })}</Text>
                                        <Text style={styles.timeText}>{format(overallStartTime, 'p', { locale: isRTL ? ar : enUS })} – {format(overallEndTime, 'p', { locale: isRTL ? ar : enUS })} ({formatDuration(displayedDuration)})</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Selected Services Card (What) */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}><Text style={styles.cardTitle}>{isRTL ? 'ماذا' : 'What'}</Text></View>
                            {items.map((item, index) => {
                                const staffName = item.staff ? (isRTL ? (item.staff.name_ar || item.staff.name_en || item.staff.name) : (item.staff.name_en || item.staff.name_ar || item.staff.name)) : (isRTL ? 'أي مقدم خدمة' : 'Any professional');
                                const serviceName = isRTL ? (item.service.name_ar || item.service.name_en) : (item.service.name_en || item.service.name_ar);
                                
                                return (
                                    <View key={item.id} style={[styles.serviceRow, index > 0 && styles.borderTop]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.serviceName}>{serviceName}</Text>
                                            <Text style={styles.serviceMeta}>{formatDuration(item.service.duration)} · {staffName}</Text>
                                        </View>
                                        <Text style={styles.servicePrice}>{formatRiyal(item.totalPrice, isRTL ? 'ar' : 'en')}</Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Payment Options (How) */}
                        {availablePaymentOptions.length > 0 && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}><Text style={styles.cardTitle}>{isRTL ? 'كيف' : 'How'}</Text></View>
                                {availablePaymentOptions.map((option, index) => {
                                    const isSelected = selectedPaymentMethod === option.id;
                                    return (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[styles.paymentRow, option.disabled && styles.paymentRowDisabled, index > 0 && styles.borderTop]}
                                            onPress={() => !option.disabled && setSelectedPaymentMethod(option.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                                                {isSelected && <View style={styles.radioInner} />}
                                            </View>
                                            <View style={styles.paymentInfo}>
                                                <Text style={[styles.paymentLabel, option.disabled && styles.textDisabled]}>{option.label}</Text>
                                                {option.badges && (
                                                    <View style={styles.paymentBadges}>
                                                        {option.badges.map(b => <View key={b} style={styles.badge}><Text style={styles.badgeText}>{b}</Text></View>)}
                                                    </View>
                                                )}
                                                {option.desc && !option.badges && <Text style={[styles.paymentDesc, option.disabled && styles.textDisabled]}>{option.desc}</Text>}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Customer Notes */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}><Text style={styles.cardTitle}>{isRTL ? 'ملاحظات' : 'Notes'}</Text></View>
                            <TextInput
                                style={[styles.notesInput, isRTL ? styles.notesInputRtl : null]}
                                placeholder={isRTL ? 'أي طلبات خاصة؟' : 'Any special requests?'}
                                placeholderTextColor={colors.textSecondary}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                maxLength={200}
                            />
                        </View>

                        {/* Price Breakdown */}
                        <View style={styles.card}>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</Text>
                                <Text style={styles.breakdownValue}>{formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}</Text>
                            </View>
                            <View style={[styles.breakdownRow, styles.borderTop, { paddingTop: 12, marginTop: 12 }]}>
                                <Text style={styles.totalLabel}>{isRTL ? 'الإجمالي' : 'Total'}</Text>
                                <Text style={styles.totalValue}>{formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}</Text>
                            </View>
                        </View>

                        <Text style={styles.policyText}>
                            {isRTL ? 'بالنقر على تأكيد، فإنك توافق على سياسة الإلغاء الخاصة بنا. يمكنك الإلغاء مجاناً قبل 24 ساعة من الموعد.' : 'By confirming, you agree to our cancellation policy. Free cancellation up to 24 hours before.'}
                        </Text>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}

            <View style={[styles.bottomBasketContainer, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
                <View style={styles.bottomBasketInfo}>
                    <Text style={styles.bottomBasketItems}>{isRTL ? 'المطلوب دفعه الآن' : 'Payable Now'}</Text>
                    <Text style={styles.bottomBasketTotal}>{formatRiyal(payableNowAmount, isRTL ? 'ar' : 'en')}</Text>
                </View>
                <TouchableOpacity 
                    style={[styles.continueButton, (!selectedPaymentMethod || submitting) && styles.continueButtonDisabled]} 
                    onPress={handleContinue}
                    disabled={!selectedPaymentMethod || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Text style={styles.continueButtonText}>{isRTL ? 'تأكيد وحجز' : 'Confirm & Book'}</Text>
                            <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={20} color="#FFFFFF" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: 'rgba(255,255,255,0.9)', borderBottomWidth: 1, borderBottomColor: colors.border },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    headerRight: { width: 40 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    contentScroll: { padding: spacing.md, gap: spacing.md },
    progressIndicator: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.sm },
    progressCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    progressNum: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    progressText: { fontSize: 14, fontWeight: '600', color: colors.text },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    cardHeader: { marginBottom: spacing.sm },
    cardTitle: { fontSize: 13, fontWeight: 'bold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    salonInfo: { flexDirection: 'row', alignItems: 'center' },
    salonThumbnail: { width: 56, height: 56, borderRadius: 12 },
    salonDetails: { flex: 1, marginLeft: spacing.md },
    salonNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    salonName: { fontSize: 18, fontWeight: 'bold', color: colors.text, flex: 1 },
    salonRatingPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    salonRatingText: { fontSize: 12, fontWeight: 'bold', color: '#92400E', marginLeft: 4 },
    salonLocation: { fontSize: 14, color: colors.textSecondary },
    dateTimeRow: { flexDirection: 'row', alignItems: 'center' },
    dateTimeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    dateText: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 2 },
    timeText: { fontSize: 14, color: colors.textSecondary },
    serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
    borderTop: { borderTopWidth: 1, borderTopColor: colors.border },
    serviceName: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    serviceMeta: { fontSize: 14, color: colors.textSecondary },
    servicePrice: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
    paymentRowDisabled: { opacity: 0.5 },
    radioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    radioOuterSelected: { borderColor: colors.primary },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
    paymentInfo: { flex: 1, marginLeft: spacing.md },
    paymentLabel: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    paymentDesc: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    textDisabled: { color: colors.textSecondary },
    paymentBadges: { flexDirection: 'row', marginTop: 6, gap: 6 },
    badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 11, fontWeight: 'bold', color: colors.textSecondary },
    notesInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, height: 80, textAlignVertical: 'top', color: colors.text, fontSize: 15 },
    notesInputRtl: { textAlign: 'right' },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    breakdownLabel: { fontSize: 15, color: colors.textSecondary },
    breakdownValue: { fontSize: 15, fontWeight: '600', color: colors.text },
    totalLabel: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    totalValue: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
    policyText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginHorizontal: spacing.md, lineHeight: 18 },
    bottomBasketContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.9)', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingTop: spacing.md },
    bottomBasketInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    bottomBasketItems: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    bottomBasketTotal: { fontSize: 24, fontWeight: 'bold', color: colors.text },
    continueButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, width: '100%' },
    continueButtonDisabled: { backgroundColor: colors.border },
    continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
});
