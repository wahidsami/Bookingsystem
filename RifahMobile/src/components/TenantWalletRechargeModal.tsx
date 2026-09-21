import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { AppIcon } from './AppIcon';
import { colors, spacing, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { api } from '../api/client';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const PRESET_AMOUNTS = [100, 200, 500, 1000];

export interface TenantWalletRechargeModalProps {
    visible: boolean;
    onClose: () => void;
    targetTenantId?: string | null;
    targetTenantName?: string;
    availableTenants?: Array<{
        id: string;
        name: string;
        name_en?: string;
        name_ar?: string;
        logo?: string;
    }>;
    onSuccess?: (result: {
        balanceBefore: number;
        balanceAfter: number;
        rechargeAmount: number;
        tenantName: string;
        transactionId: string;
    }) => void;
}

export function TenantWalletRechargeModal({
    visible,
    onClose,
    targetTenantId,
    targetTenantName,
    availableTenants = [],
    onSuccess,
}: TenantWalletRechargeModalProps) {
    const { language, isRTL } = useLanguage();

    const [selectedTenantId, setSelectedTenantId] = useState<string>('');
    const [selectedTenantName, setSelectedTenantName] = useState<string>('');
    const [amount, setAmount] = useState<number>(100);
    const [customAmountText, setCustomAmountText] = useState<string>('');
    const [isCustom, setIsCustom] = useState<boolean>(false);

    // Card details
    const [cardNumber, setCardNumber] = useState<string>('');
    const [expiryDate, setExpiryDate] = useState<string>('');
    const [cvv, setCvv] = useState<string>('');
    const [cardholderName, setCardholderName] = useState<string>('');

    const [loading, setLoading] = useState<boolean>(false);
    const [successResult, setSuccessResult] = useState<{
        balanceBefore: number;
        balanceAfter: number;
        rechargeAmount: number;
        tenantName: string;
        transactionId: string;
    } | null>(null);

    // Initialize or sync tenant selection
    useEffect(() => {
        if (visible) {
            setSuccessResult(null);
            setLoading(false);
            if (targetTenantId) {
                setSelectedTenantId(targetTenantId);
                setSelectedTenantName(targetTenantName || (language === 'ar' ? 'الصالون' : 'Salon'));
            } else if (availableTenants.length > 0) {
                const first = availableTenants[0];
                setSelectedTenantId(first.id);
                setSelectedTenantName(
                    language === 'ar'
                        ? (first.name_ar || first.name || first.name_en || '')
                        : (first.name_en || first.name || first.name_ar || '')
                );
            }
        }
    }, [visible, targetTenantId, targetTenantName, availableTenants, language]);

    const handleSelectTenant = (tenant: { id: string; name: string; name_en?: string; name_ar?: string }) => {
        setSelectedTenantId(tenant.id);
        setSelectedTenantName(
            language === 'ar'
                ? (tenant.name_ar || tenant.name || tenant.name_en || '')
                : (tenant.name_en || tenant.name || tenant.name_ar || '')
        );
    };

    const handleSelectPreset = (val: number) => {
        setIsCustom(false);
        setAmount(val);
        setCustomAmountText('');
    };

    const handleCustomAmountChange = (text: string) => {
        const cleaned = text.replace(/[^0-9.]/g, '');
        setCustomAmountText(cleaned);
        setIsCustom(true);
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && parsed > 0) {
            setAmount(parsed);
        }
    };

    const handleFormatCardNumber = (text: string) => {
        const digits = text.replace(/\D/g, '').slice(0, 16);
        const parts = digits.match(/.{1,4}/g) || [];
        setCardNumber(parts.join(' '));
    };

    const handleFormatExpiry = (text: string) => {
        const digits = text.replace(/\D/g, '').slice(0, 4);
        if (digits.length >= 3) {
            setExpiryDate(`${digits.slice(0, 2)}/${digits.slice(2)}`);
        } else {
            setExpiryDate(digits);
        }
    };

    const fillTestCard = () => {
        setCardNumber('4111 1111 1111 1111');
        setExpiryDate('12/28');
        setCvv('123');
        setCardholderName(language === 'ar' ? 'عميل رفاه' : 'Refah Customer');
    };

    const handleRecharge = async () => {
        if (!selectedTenantId) {
            Alert.alert(
                language === 'ar' ? 'تنبيه' : 'Notice',
                language === 'ar' ? 'يرجى اختيار الصالون المراد شحن رصيده' : 'Please select a salon to recharge'
            );
            return;
        }

        const effectiveAmount = isCustom ? parseFloat(customAmountText) : amount;
        if (!effectiveAmount || isNaN(effectiveAmount) || effectiveAmount <= 0) {
            Alert.alert(
                language === 'ar' ? 'تنبيه' : 'Notice',
                language === 'ar' ? 'يرجى تحديد مبلغ شحن صحيح' : 'Please enter a valid recharge amount'
            );
            return;
        }

        const rawCard = cardNumber.replace(/\s/g, '');
        if (rawCard.length < 13 || rawCard.length > 19) {
            Alert.alert(
                language === 'ar' ? 'تنبيه' : 'Notice',
                language === 'ar' ? 'يرجى إدخال رقم بطاقة صحيح' : 'Please enter a valid card number'
            );
            return;
        }

        if (!expiryDate || expiryDate.length < 4) {
            Alert.alert(
                language === 'ar' ? 'تنبيه' : 'Notice',
                language === 'ar' ? 'يرجى إدخال تاريخ انتهاء البطاقة (MM/YY)' : 'Please enter card expiry date (MM/YY)'
            );
            return;
        }

        if (!cvv || cvv.length < 3) {
            Alert.alert(
                language === 'ar' ? 'تنبيه' : 'Notice',
                language === 'ar' ? 'يرجى إدخال رمز الأمان (CVV)' : 'Please enter card CVV'
            );
            return;
        }

        const idempotencyKey = `mob_recharge_${selectedTenantId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        try {
            setLoading(true);
            const response = await api.rechargeTenantWallet({
                tenantId: selectedTenantId,
                amount: effectiveAmount,
                payment: {
                    cardNumber: rawCard,
                    expiryDate: expiryDate.trim(),
                    cvv: cvv.trim(),
                    cardholderName: cardholderName.trim() || 'Customer',
                },
                idempotencyKey,
            });

            if (response?.success) {
                const result = {
                    balanceBefore: response.balanceBefore,
                    balanceAfter: response.balanceAfter,
                    rechargeAmount: response.rechargeAmount,
                    tenantName: response.tenant?.name || selectedTenantName,
                    transactionId: response.transactionId,
                };
                setSuccessResult(result);
                if (onSuccess) {
                    onSuccess(result);
                }
            } else {
                Alert.alert(
                    language === 'ar' ? 'فشل الشحن' : 'Recharge Failed',
                    response?.message || (language === 'ar' ? 'تعذر إتمام عملية الشحن' : 'Could not complete recharge')
                );
            }
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || (
                language === 'ar' ? 'حدث خطأ أثناء معالجة الدفع' : 'An error occurred during payment'
            );
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseModal = () => {
        setSuccessResult(null);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleCloseModal}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                <Pressable style={styles.backdrop} onPress={handleCloseModal} />

                <View style={styles.sheetContainer}>
                    {/* Header bar */}
                    <View style={[styles.sheetHeader, isRTL && styles.rowRTL]}>
                        <View style={[styles.headerTitleWrap, isRTL && styles.rowRTL]}>
                            <View style={styles.headerIconWrap}>
                                <AppIcon name="card" size={20} color="#6537C0" />
                            </View>
                            <Text style={styles.headerTitle}>
                                {language === 'ar' ? 'شحن رصيد الصالون' : 'Recharge Salon Balance'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleCloseModal}
                            style={styles.closeBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <AppIcon name="close" size={20} color="#716B88" />
                        </TouchableOpacity>
                    </View>

                    {/* Success View */}
                    {successResult ? (
                        <View style={styles.successContainer}>
                            <View style={styles.successIconCircle}>
                                <AppIcon name="check" size={36} color="#10B981" />
                            </View>

                            <Text style={styles.successTitle}>
                                {language === 'ar' ? 'تم شحن الرصيد بنجاح!' : 'Balance Recharged Successfully!'}
                            </Text>

                            <Text style={styles.successSalonName}>
                                {successResult.tenantName}
                            </Text>

                            <View style={styles.receiptBox}>
                                <View style={[styles.receiptRow, isRTL && styles.rowRTL]}>
                                    <Text style={styles.receiptLabel}>
                                        {language === 'ar' ? 'مبلغ الشحن' : 'Recharged Amount'}
                                    </Text>
                                    <Text style={styles.receiptValueAmount}>
                                        +{formatRiyal(successResult.rechargeAmount, language)}
                                    </Text>
                                </View>

                                <View style={styles.receiptDivider} />

                                <View style={[styles.receiptRow, isRTL && styles.rowRTL]}>
                                    <Text style={styles.receiptLabel}>
                                        {language === 'ar' ? 'الرصيد السابق' : 'Previous Balance'}
                                    </Text>
                                    <Text style={styles.receiptValue}>
                                        {formatRiyal(successResult.balanceBefore, language)}
                                    </Text>
                                </View>

                                <View style={[styles.receiptRow, isRTL && styles.rowRTL]}>
                                    <Text style={[styles.receiptLabel, { fontWeight: '700', color: '#1D035F' }]}>
                                        {language === 'ar' ? 'الرصيد الحالي الجديد' : 'New Current Balance'}
                                    </Text>
                                    <Text style={[styles.receiptValue, { fontWeight: '800', color: '#6537C0' }]}>
                                        {formatRiyal(successResult.balanceAfter, language)}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.finishBtn}
                                onPress={handleCloseModal}
                                activeOpacity={0.88}
                            >
                                <Text style={styles.finishBtnText}>
                                    {language === 'ar' ? 'تم والعودة للرصيد' : 'Done & Return'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.formScroll}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Salon Selection (if multiple salons available) */}
                            {availableTenants.length > 1 && !targetTenantId && (
                                <View style={styles.fieldSection}>
                                    <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
                                        {language === 'ar' ? 'اختر الصالون / المركز' : 'Select Salon / Center'}
                                    </Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.tenantsRow}
                                    >
                                        {availableTenants.map((t) => {
                                            const isSelected = t.id === selectedTenantId;
                                            const tName = language === 'ar'
                                                ? (t.name_ar || t.name || t.name_en)
                                                : (t.name_en || t.name || t.name_ar);
                                            return (
                                                <TouchableOpacity
                                                    key={t.id}
                                                    style={[
                                                        styles.tenantChip,
                                                        isSelected && styles.tenantChipActive,
                                                    ]}
                                                    onPress={() => handleSelectTenant(t)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.tenantChipText,
                                                            isSelected && styles.tenantChipTextActive,
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {tName}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Active Salon Banner */}
                            <View style={[styles.activeSalonBanner, isRTL && styles.rowRTL]}>
                                <AppIcon name="storefront" size={18} color="#6537C0" />
                                <Text style={[styles.activeSalonText, isRTL && styles.textRTL]}>
                                    {language === 'ar' ? 'الصالون المستفيد: ' : 'Target Salon: '}
                                    <Text style={{ fontWeight: '700', color: '#1D035F' }}>
                                        {selectedTenantName || (language === 'ar' ? 'الصالون المحدد' : 'Selected Salon')}
                                    </Text>
                                </Text>
                            </View>

                            {/* Amount Selection */}
                            <View style={styles.fieldSection}>
                                <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
                                    {language === 'ar' ? 'حدد مبلغ الشحن' : 'Select Recharge Amount'}
                                </Text>

                                <View style={styles.presetChipsRow}>
                                    {PRESET_AMOUNTS.map((val) => {
                                        const isSelected = !isCustom && amount === val;
                                        return (
                                            <TouchableOpacity
                                                key={val}
                                                style={[
                                                    styles.amountChip,
                                                    isSelected && styles.amountChipActive,
                                                ]}
                                                onPress={() => handleSelectPreset(val)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.amountChipText,
                                                        isSelected && styles.amountChipTextActive,
                                                    ]}
                                                >
                                                    {formatRiyal(val, language)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Custom Amount Input */}
                                <View style={[styles.inputBox, isCustom && styles.inputBoxActive, isRTL && styles.rowRTL]}>
                                    <TextInput
                                        style={[styles.inputField, isRTL && styles.textRTL]}
                                        placeholder={language === 'ar' ? 'أو أدخل مبلغاً مخصصاً (SAR)' : 'Or enter custom amount (SAR)'}
                                        placeholderTextColor="#9E9AA7"
                                        keyboardType="numeric"
                                        value={customAmountText}
                                        onChangeText={handleCustomAmountChange}
                                    />
                                    <Text style={styles.currencyBadge}>SAR</Text>
                                </View>
                            </View>

                            {/* Card Payment Details */}
                            <View style={styles.fieldSection}>
                                <View style={[styles.cardHeaderRow, isRTL && styles.rowRTL]}>
                                    <Text style={[styles.sectionLabel, isRTL && styles.textRTL, { marginBottom: 0 }]}>
                                        {language === 'ar' ? 'بيانات البطاقة البنكية' : 'Card Payment Details'}
                                    </Text>
                                    <TouchableOpacity onPress={fillTestCard} style={styles.testCardChip}>
                                        <Text style={styles.testCardText}>
                                            {language === 'ar' ? '⚡ تعبئة بطاقة تجريبية' : '⚡ Fill Test Card'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Card Number */}
                                <View style={[styles.inputBox, { marginTop: 8 }, isRTL && styles.rowRTL]}>
                                    <AppIcon name="card" size={18} color="#716B88" />
                                    <TextInput
                                        style={[styles.inputField, { marginHorizontal: 8 }]}
                                        placeholder="0000 0000 0000 0000"
                                        placeholderTextColor="#9E9AA7"
                                        keyboardType="numeric"
                                        maxLength={19}
                                        value={cardNumber}
                                        onChangeText={handleFormatCardNumber}
                                    />
                                </View>

                                {/* Expiry & CVV */}
                                <View style={styles.cardRowCols}>
                                    <View style={[styles.inputBox, { flex: 1 }]}>
                                        <TextInput
                                            style={styles.inputField}
                                            placeholder="MM/YY"
                                            placeholderTextColor="#9E9AA7"
                                            keyboardType="numeric"
                                            maxLength={5}
                                            value={expiryDate}
                                            onChangeText={handleFormatExpiry}
                                        />
                                    </View>

                                    <View style={[styles.inputBox, { flex: 1, marginStart: 10 }]}>
                                        <TextInput
                                            style={styles.inputField}
                                            placeholder="CVV"
                                            placeholderTextColor="#9E9AA7"
                                            keyboardType="numeric"
                                            maxLength={4}
                                            secureTextEntry
                                            value={cvv}
                                            onChangeText={(t) => setCvv(t.replace(/\D/g, ''))}
                                        />
                                    </View>
                                </View>

                                {/* Cardholder Name */}
                                <View style={[styles.inputBox, { marginTop: 10 }, isRTL && styles.rowRTL]}>
                                    <TextInput
                                        style={[styles.inputField, isRTL && styles.textRTL]}
                                        placeholder={language === 'ar' ? 'اسم حامل البطاقة' : 'Cardholder Name'}
                                        placeholderTextColor="#9E9AA7"
                                        value={cardholderName}
                                        onChangeText={setCardholderName}
                                    />
                                </View>
                            </View>

                            {/* Disclaimer */}
                            <View style={[styles.legalDisclaimer, isRTL && styles.rowRTL]}>
                                <AppIcon name="lock" size={14} color="#6537C0" />
                                <Text style={[styles.legalDisclaimerText, isRTL && styles.textRTL]}>
                                    {language === 'ar'
                                        ? 'يتم تحويل الرصيد مباشرة إلى محفظتك المخصصة لدى هذا الصالون وتطبيق معايير الدفع الآمن.'
                                        : 'Balance is credited directly to your salon-scoped wallet under secure payment standards.'}
                                </Text>
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                                onPress={handleRecharge}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.submitBtnText}>
                                        {language === 'ar'
                                            ? `تأكيد الدفع وشحن ${formatRiyal(isCustom ? (parseFloat(customAmountText) || 0) : amount, language)}`
                                            : `Confirm & Pay ${formatRiyal(isCustom ? (parseFloat(customAmountText) || 0) : amount, language)}`}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(29, 3, 95, 0.45)',
    },
    backdrop: {
        flex: 1,
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
    },
    headerTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3EAFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1D035F',
    },
    closeBtn: {
        padding: 4,
    },
    formScroll: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    fieldSection: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1D035F',
        marginBottom: 8,
    },
    tenantsRow: {
        gap: 8,
        paddingVertical: 4,
    },
    tenantChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    tenantChipActive: {
        backgroundColor: '#6537C0',
        borderColor: '#6537C0',
    },
    tenantChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#716B88',
    },
    tenantChipTextActive: {
        color: '#FFFFFF',
    },
    activeSalonBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7F3FE',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    activeSalonText: {
        fontSize: 13,
        color: '#716B88',
        flex: 1,
    },
    presetChipsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    amountChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#FAF9FC',
        borderWidth: 1.5,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    amountChipActive: {
        backgroundColor: '#F3EAFD',
        borderColor: '#6537C0',
    },
    amountChipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#716B88',
    },
    amountChipTextActive: {
        color: '#6537C0',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
    },
    inputBoxActive: {
        borderColor: '#6537C0',
        backgroundColor: '#FFFFFF',
    },
    inputField: {
        flex: 1,
        fontSize: 14,
        color: '#1D035F',
        paddingVertical: 0,
    },
    currencyBadge: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6537C0',
        marginStart: 6,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    testCardChip: {
        backgroundColor: '#EDE9FE',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    testCardText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6537C0',
    },
    cardRowCols: {
        flexDirection: 'row',
        marginTop: 10,
    },
    legalDisclaimer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAF9FC',
        padding: 10,
        borderRadius: 10,
        marginBottom: 20,
        gap: 8,
    },
    legalDisclaimerText: {
        fontSize: 11,
        color: '#716B88',
        flex: 1,
        lineHeight: 16,
    },
    submitBtn: {
        backgroundColor: '#6537C0',
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        opacity: 0.65,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    successContainer: {
        paddingHorizontal: 24,
        paddingVertical: 32,
        alignItems: 'center',
    },
    successIconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1D035F',
        marginBottom: 4,
        textAlign: 'center',
    },
    successSalonName: {
        fontSize: 14,
        color: '#716B88',
        marginBottom: 20,
        textAlign: 'center',
    },
    receiptBox: {
        width: '100%',
        backgroundColor: '#FAF9FC',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 24,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    receiptLabel: {
        fontSize: 13,
        color: '#716B88',
    },
    receiptValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D035F',
    },
    receiptValueAmount: {
        fontSize: 15,
        fontWeight: '800',
        color: '#10B981',
    },
    receiptDivider: {
        height: 1,
        backgroundColor: '#E7DDFC',
        marginVertical: 6,
    },
    finishBtn: {
        width: '100%',
        height: 48,
        backgroundColor: '#10B981',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    finishBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
});
