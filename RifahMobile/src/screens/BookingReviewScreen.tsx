import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
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
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
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
    const { items, updateItem, totalPrice, cartTenant, clearCart } = useServiceBookingCart();
    
    const { isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const isFocused = useIsFocused();

    const [fullTenant, setFullTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState(items[0]?.notes || '');

    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
    const [walletEnabled, setWalletEnabled] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if ((!tenantId || items.length === 0) && isFocused) {
            navigation.goBack();
        }
    }, [tenantId, items.length, isFocused, navigation]);

    useEffect(() => {
        if (!tenantId || items.length === 0) {
            return;
        }

        const fetchTenantAndWallet = async () => {
            try {
                const tenantResponse = await api.get<{ success: boolean; tenant: Tenant }>(`/public/tenant/${tenantId}`);
                if (tenantResponse.success && tenantResponse.tenant) {
                    setFullTenant(tenantResponse.tenant);
                }
                
                // Fetch Wallet eligibility and balance
                const sourcesResponse = await api.getEligiblePaymentSources({ tenantId, amount: totalPrice }).catch(() => null);
                if (sourcesResponse && sourcesResponse.sources) {
                    const hasWallet = sourcesResponse.sources.some((s) => s.source === 'wallet' && s.eligible !== false);
                    setWalletEnabled(hasWallet);
                    if (hasWallet) {
                        const balance = await api.getWalletBalance().catch(() => 0);
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
        if (minutes < 60) {
            return isRTL ? `${minutes} دقيقة` : `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) {
            return isRTL ? `${hours} ساعة` : `${hours} hr`;
        }
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
        const options: Array<{ id: string; label: string; desc?: string; disabled?: boolean }> = [];
        
        const tenantAtCenter = bookingPaymentSettings.allowServicePayAtCenter !== false;
        const tenantOnlineFull = bookingPaymentSettings.allowServiceFullOnline !== false;
        const tenantDeposit = bookingPaymentSettings.allowServiceDeposit !== false;

        const allAllowAtCenter = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('at-center'));
        const allAllowOnlineFull = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('online-full'));
        const allAllowDeposit = items.every(item => !item.service.paymentOptions || item.service.paymentOptions.includes('booking-fee'));

        if (tenantAtCenter && allAllowAtCenter) {
            options.push({ id: 'at-center', label: isRTL ? 'الدفع عند المركز' : 'Pay at center', desc: isRTL ? 'الدفع عند وصولك' : 'Pay when you arrive' });
        }
        if (tenantOnlineFull && allAllowOnlineFull) {
            options.push({ id: 'online-full', label: isRTL ? 'الدفع كاملاً أونلاين' : 'Pay in full online', desc: formatRiyal(totalPrice, isRTL ? 'ar' : 'en') });
        }
        if (tenantDeposit && allAllowDeposit && bookingDepositAmount !== null && bookingDepositAmount > 0) {
            options.push({ id: 'booking-fee', label: isRTL ? 'دفع عربون' : 'Pay deposit now', desc: `${formatRiyal(bookingDepositAmount, isRTL ? 'ar' : 'en')} ${isRTL ? 'الآن' : 'now'}, ${formatRiyal(totalPrice - bookingDepositAmount, isRTL ? 'ar' : 'en')} ${isRTL ? 'متبقي' : 'remaining'}` });
        }
        if (walletEnabled) {
            const hasEnough = walletBalance >= totalPrice;
            if (hasEnough) {
                options.push({ id: 'wallet', label: isRTL ? 'الدفع من المحفظة' : 'Pay from wallet', desc: `${isRTL ? 'الرصيد المتاح:' : 'Available balance:'} ${formatRiyal(walletBalance, isRTL ? 'ar' : 'en')}` });
            }
        }

        return options;
    }, [bookingPaymentSettings, items, bookingDepositAmount, walletEnabled, walletBalance, isRTL, totalPrice]);

    if (availablePaymentOptions.length > 0 && !selectedPaymentMethod) {
        setSelectedPaymentMethod(availablePaymentOptions[0].id);
    } else if (availablePaymentOptions.length > 0 && selectedPaymentMethod) {
        if (!availablePaymentOptions.some(opt => opt.id === selectedPaymentMethod)) {
            setSelectedPaymentMethod(availablePaymentOptions[0].id);
        }
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
        if (items.length > 0) {
            // update notes in local context before checkout
            items[0].notes = notes; 
        }
        
        try {
            await processBookingCheckout({
                tenant: tenantToUse,
                items,
                totalPrice,
                payableNowAmount,
                bookingDepositAmount,
                selectedPaymentMethod: selectedPaymentMethod || '',
                isRTL,
                navigation,
                clearCart,
            });
        } catch (error) {
            // error handled inside
        } finally {
            setSubmitting(false);
        }
    };

    const renderCenterCard = () => {
        const rating = (fullTenant as any)?.rating || '4.8'; // Fallback if no rating provided by API
        const reviewCount = (fullTenant as any)?.reviewCount || '120+';
        const locationText = fullTenant?.address || fullTenant?.city || (isRTL ? 'الرياض، المملكة العربية السعودية' : 'Riyadh, Saudi Arabia');

        return (
            <View style={styles.centerCard}>
                <View style={styles.centerCardTop}>
                    {tenantToUse?.logo ? (
                        <Image source={{ uri: getImageUrl(tenantToUse.logo) }} style={styles.centerLogo} />
                    ) : (
                        <View style={styles.centerLogoPlaceholder}>
                            <AppIcon name="storefront" size={24} color={colors.primary} />
                        </View>
                    )}
                    <View style={styles.centerInfo}>
                        <Text style={styles.centerName} numberOfLines={1}>{tenantName}</Text>
                        <View style={styles.centerMetaRow}>
                            <AppIcon name="star" size={14} color="#F59E0B" />
                            <Text style={styles.centerRating}>{rating}</Text>
                            <Text style={styles.centerReviewCount}>({reviewCount} {isRTL ? 'تقييم' : 'reviews'})</Text>
                        </View>
                        <View style={styles.centerMetaRow}>
                            <AppIcon name="location" size={14} color={colors.textSecondary} />
                            <Text style={styles.centerLocation} numberOfLines={1}>{locationText}</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderDateTimeBlock = () => {
        if (!overallStartTime || !overallEndTime) return null;

        return (
            <View style={styles.dateTimeCard}>
                <View style={styles.dateTimeRow}>
                    <View style={styles.dateTimeIconContainer}>
                        <AppIcon name="event" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.dateTimeInfo}>
                        <Text style={styles.dateTimeValue}>
                            {format(overallStartTime, 'EEEE, MMMM d', { locale: isRTL ? ar : enUS })}
                        </Text>
                        <Text style={styles.dateTimeDuration}>
                            {format(overallStartTime, 'p', { locale: isRTL ? ar : enUS })} – {format(overallEndTime, 'p', { locale: isRTL ? ar : enUS })} · {formatDuration(displayedDuration)} {isRTL ? 'مدة' : 'duration'}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderServicesList = () => {
        return (
            <View style={styles.servicesCard}>
                <Text style={styles.sectionTitle}>{isRTL ? 'خدمات الحجز' : 'BOOKING SERVICES'}</Text>
                {items.map((item, index) => {
                    const staffName = item.staff ? (isRTL ? (item.staff.name_ar || item.staff.name_en || item.staff.name) : (item.staff.name_en || item.staff.name_ar || item.staff.name)) : (isRTL ? 'أي مقدم خدمة' : 'Any professional');
                    const serviceName = isRTL ? (item.service.name_ar || item.service.name_en) : (item.service.name_en || item.service.name_ar);
                    
                    return (
                        <View key={item.id} style={[styles.serviceRow, index < items.length - 1 && styles.serviceRowBorder]}>
                            <View style={styles.serviceRowLeft}>
                                <Text style={styles.serviceName}>{serviceName}</Text>
                                <Text style={styles.serviceMeta}>
                                    {formatDuration(item.service.duration)} · {staffName}
                                </Text>
                                {item.variant && (
                                    <Text style={styles.serviceMeta}>
                                        {item.variant.description}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.serviceRowRight}>
                                <Text style={styles.servicePrice}>{formatRiyal(item.totalPrice, isRTL ? 'ar' : 'en')}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderPaymentSection = () => {
                        return (
            <View style={styles.paymentCard}>
                <Text style={styles.sectionTitle}>{isRTL ? 'طريقة الدفع' : 'Payment'}</Text>
                
                {availablePaymentOptions.map((option, index) => {
                    const isSelected = selectedPaymentMethod === option.id;
                    return (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.paymentOptionRow,
                                index < availablePaymentOptions.length - 1 && styles.serviceRowBorder
                            ]}
                            onPress={() => setSelectedPaymentMethod(option.id)}
                            disabled={submitting}
                        >
                            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                                {isSelected && <View style={styles.radioInner} />}
                            </View>
                            <View style={styles.paymentOptionInfo}>
                                <Text style={[styles.paymentOptionTitle, isRTL ? { textAlign: 'right' } : null]}>{option.label}</Text>
                                {option.desc && (
                                    <Text style={[styles.paymentOptionDesc, isRTL ? { textAlign: 'right' } : null]}>{option.desc}</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderTotalAndNotes = () => {
        return (
            <View style={styles.summaryCard}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{isRTL ? 'المجموع' : 'Total'}</Text>
                    <Text style={styles.totalValue}>{formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}</Text>
                </View>

                {selectedPaymentMethod !== 'at-center' && payableNowAmount > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, { color: colors.primary }]}>{isRTL ? 'المطلوب دفعه الآن' : 'Amount due now'}</Text>
                        <Text style={[styles.totalValue, { color: colors.primary }]}>{formatRiyal(payableNowAmount, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                )}
                {selectedPaymentMethod === 'at-center' && (
                    <>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>{isRTL ? 'ستدفع الآن' : 'You\'ll pay now'}</Text>
                            <Text style={styles.totalValue}>{formatRiyal(0, isRTL ? 'ar' : 'en')}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>{isRTL ? 'المتبقي عند المركز' : 'Remaining at center'}</Text>
                            <Text style={styles.totalValue}>{formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}</Text>
                        </View>
                    </>
                )}

                <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>{isRTL ? 'التعليقات أو الطلبات' : 'Comments or requests'}</Text>
                    <TextInput
                        style={[styles.notesInput, isRTL ? styles.notesInputRtl : null]}
                        placeholder={isRTL ? 'أي شيء ترغب في إعلامنا به؟' : 'Anything you\'d like us to know?'}
                        placeholderTextColor={colors.textSecondary}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        maxLength={200}
                    />
                </View>
            </View>
        );
    };

    const renderPolicies = () => {
        return (
            <View style={styles.policiesCard}>
                <Text style={styles.sectionTitle}>{isRTL ? 'مزيد من التفاصيل' : 'MORE DETAILS'}</Text>
                
                <View style={styles.policyItem}>
                    <AppIcon name="info" size={18} color={colors.textSecondary} />
                    <View style={styles.policyInfo}>
                        <Text style={styles.policyTitle}>{isRTL ? 'معلومات هامة' : 'Important information'}</Text>
                        <Text style={styles.policyText}>
                            {isRTL ? 'يرجى الوصول قبل الموعد بـ 10 دقائق.' : 'Please arrive 10 minutes before your appointment time.'}
                        </Text>
                    </View>
                </View>

                <View style={styles.policyItem}>
                    <AppIcon name="warning" size={18} color={colors.textSecondary} />
                    <View style={styles.policyInfo}>
                        <Text style={styles.policyTitle}>{isRTL ? 'سياسة الإلغاء' : 'Cancellation policy'}</Text>
                        <Text style={styles.policyText}>
                            {isRTL ? 'يمكنك الإلغاء مجاناً قبل 24 ساعة من الموعد.' : 'Free cancellation up to 24 hours before the appointment.'}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: topInset }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isRTL ? 'مراجعة وتأكيد' : 'Review and confirm'}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.navigate('TenantScreen', { tenantId })}>
                    <AppIcon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            ) : (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={[styles.contentScroll, { paddingBottom: scrollBottomPadding + 100 }]}>
                        {renderCenterCard()}
                        {renderDateTimeBlock()}
                        {renderServicesList()}
                        {availablePaymentOptions.length > 0 && renderPaymentSection()}
                        {renderTotalAndNotes()}
                        {renderPolicies()}
                    </ScrollView>
                </KeyboardAvoidingView>
            )}

            {/* Bottom Fixed Action */}
            <View style={[styles.bottomBasketContainer, { paddingBottom: Math.max(scrollBottomPadding, spacing.md) }]}>
                <View style={styles.bottomBasketLeft}>
                    <Text style={styles.bottomBasketPriceLabel}>{isRTL ? 'الإجمالي' : 'Total'}</Text>
                    <Text style={styles.bottomBasketPrice}>
                        {formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}
                    </Text>
                </View>
                <TouchableOpacity 
                    style={[styles.bottomBasketButton, (!selectedPaymentMethod || submitting) && styles.bottomBasketButtonDisabled]} 
                    onPress={handleContinue}
                    disabled={!selectedPaymentMethod || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.bottomBasketButtonText}>{isRTL ? 'تأكيد' : 'Confirm'}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundGray || '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentScroll: {
        padding: spacing.md,
        gap: spacing.md,
    },
    centerCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    centerCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    centerLogo: {
        width: 60,
        height: 60,
        borderRadius: 12,
    },
    centerLogoPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    centerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    centerMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    centerRating: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
        marginLeft: 4,
        marginRight: 4,
    },
    centerReviewCount: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    centerLocation: {
        fontSize: 13,
        color: colors.textSecondary,
        marginLeft: 4,
        flex: 1,
    },
    dateTimeCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dateTimeRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dateTimeIconContainer: {
        width: 40,
        alignItems: 'flex-start',
        paddingTop: 2,
    },
    dateTimeInfo: {
        flex: 1,
    },
    dateTimeLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.textSecondary,
        letterSpacing: 1,
        marginBottom: 4,
    },
    dateTimeValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    dateTimeDuration: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.md,
        marginLeft: 40,
    },
    servicesCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: spacing.md,
    },
    serviceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
    },
    serviceRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    serviceRowLeft: {
        flex: 1,
        paddingRight: spacing.sm,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    serviceMeta: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    serviceRowRight: {
        alignItems: 'flex-end',
    },
    servicePrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    paymentCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    paymentOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    paymentOptionInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    paymentOptionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
    paymentOptionDesc: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    summaryCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    notesSection: {
        marginTop: spacing.sm,
    },
    notesLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    notesInput: {
        backgroundColor: colors.backgroundGray || '#F9FAFB',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: spacing.md,
        height: 80,
        textAlignVertical: 'top',
        color: colors.text,
        fontSize: 15,
    },
    notesInputRtl: {
        textAlign: 'right',
    },
    policiesCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    policyItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    policyInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    policyTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    policyText: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    bottomBasketContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    bottomBasketLeft: {
        flex: 1,
    },
    bottomBasketPriceLabel: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    bottomBasketPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    bottomBasketButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: 14,
        borderRadius: 8,
    },
    bottomBasketButtonDisabled: {
        opacity: 0.7,
    },
    bottomBasketButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
