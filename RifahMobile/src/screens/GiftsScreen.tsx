import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api } from '../api/client';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { formatRiyal } from '../utils/currency';
import { useFocusEffect } from '@react-navigation/native';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { TenantWalletRechargeModal } from '../components/TenantWalletRechargeModal';

const HERO_IMAGE = require('../../assets/wallethero.jpg');

type GiftPackage = {
    id: string;
    tenantId?: string;
    title?: string | null;
    description?: string | null;
    title_en: string;
    title_ar: string;
    description_en?: string | null;
    description_ar?: string | null;
    priceAmount: number;
    walletCreditAmount: number;
    bonusAmount: number;
    discountPercent?: number | string | null;
    expirationPreset?: string | null;
    endsAt?: string | null;
    startsAt?: string | null;
    createdAt?: string | null;
};

type TenantBalanceItem = {
    sourceType: string;
    tenantId: string;
    tenantName?: string | null;
    tenantNameEn?: string | null;
    tenantNameAr?: string | null;
    tenantLogo?: string | null;
    tenantAddress?: string | null;
    tenantCity?: string | null;
    balance: number;
    currency: string;
    updatedAt?: string;
};

type GiftHistoryItem = {
    id: string;
    tenantId: string;
    status: string;
    totalCreditAmount: number;
    purchaseAmount: number;
    createdAt: string;
    tenant?: { id: string; name: string; name_en?: string; name_ar?: string; logo?: string } | null;
};

type RecipientCheckResult = {
    exists: boolean;
    recipient: null | {
        id: string;
        firstName?: string;
        lastName?: string;
        fullName?: string;
        email?: string;
        phone?: string;
        profileImage?: string | null;
    };
};

export function GiftsScreen({ navigation, route }: any) {
    const { language, isRTL } = useLanguage();
    const sar = (value: number) => formatRiyal(Number(value || 0), language);
    const { scrollBottomPadding } = useScreenSafeArea();

    const tenantId = route?.params?.tenantId as string | undefined;
    const initialTenantName = route?.params?.tenantName as string | undefined;

    // Selected Salon Discovery State
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(tenantId || null);
    const [selectedTenantName, setSelectedTenantName] = useState<string>(initialTenantName || '');
    const [availableTenants, setAvailableTenants] = useState<Array<{
        id: string;
        name: string;
        name_en?: string;
        name_ar?: string;
        logo?: string;
        address?: string;
    }>>([]);

    // Tabs: 'balances' (أرصدة الصالونات) or 'gifts' (بطاقات الهدايا)
    const [activeTab, setActiveTab] = useState<'balances' | 'gifts'>('balances');
    const [giftSubTab, setGiftSubTab] = useState<'received' | 'sent'>('received');

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Tenant Balances (Tab 1)
    const [tenantBalances, setTenantBalances] = useState<TenantBalanceItem[]>([]);

    // Tenant Gift Cards & Packages (Tab 2)
    const [packages, setPackages] = useState<GiftPackage[]>([]);
    const [giftHistory, setGiftHistory] = useState<GiftHistoryItem[]>([]);
    const [receivedGifts, setReceivedGifts] = useState<any[]>([]);
    const [claimCode, setClaimCode] = useState('');

    // Stable Idempotency Key Ref (one per logical operation, reused across retries)
    const idempotencyKeyRef = useRef<string | null>(null);

    // Direct Card Recharge State (Sprint 3A)
    const [rechargeModalVisible, setRechargeModalVisible] = useState(false);
    const [rechargeTargetTenant, setRechargeTargetTenant] = useState<{ id: string; name: string } | null>(null);

    // Gift Purchasing & Sending State
    const [selectedPackage, setSelectedPackage] = useState<GiftPackage | null>(null);
    const [mode, setMode] = useState<'self' | 'send'>('self');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    const [giftMessage, setGiftMessage] = useState('');
    const [checkingRecipient, setCheckingRecipient] = useState(false);
    const [recipientCheck, setRecipientCheck] = useState<RecipientCheckResult | null>(null);
    const [recipientDecision, setRecipientDecision] = useState<'none' | 'send_member' | 'send_email'>('none');
    const [cardNumber, setCardNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardholderName, setCardholderName] = useState('');

    // Informational Total across salons (NEVER presented as a single fungible wallet)
    const totalAcrossSalons = useMemo(() => {
        return tenantBalances.reduce((sum, item) => sum + Number(item.balance || 0), 0);
    }, [tenantBalances]);

    const loadData = async () => {
        try {
            // 1. Fetch live tenant balances summary
            const summaryRes = await api.getWalletSummary().catch(() => null);
            if (summaryRes?.success && Array.isArray(summaryRes.summary?.tenantGiftBalances)) {
                setTenantBalances(summaryRes.summary.tenantGiftBalances.filter((b) => Number(b.balance || 0) > 0));
            } else {
                setTenantBalances([]);
            }

            // 2. Fetch tenant gift history (sent gifts)
            const historyRes = await api.getTenantGiftHistory().catch(() => null);
            if (historyRes?.success && Array.isArray(historyRes.transactions)) {
                setGiftHistory(historyRes.transactions);
            } else {
                setGiftHistory([]);
            }

            // 3. Fetch received tenant gifts
            const receivedRes = await api.getReceivedTenantGifts().catch(() => null);
            if (receivedRes?.success && Array.isArray(receivedRes.gifts)) {
                setReceivedGifts(receivedRes.gifts);
            } else {
                setReceivedGifts([]);
            }

            // 4. Fetch available tenants for salon discovery
            let activeTenantId = selectedTenantId || tenantId;
            const tenantsRes = await api.get<{ success: boolean; tenants: any[] }>('/public/tenants').catch(() => null);
            if (tenantsRes?.success && Array.isArray(tenantsRes.tenants)) {
                setAvailableTenants(tenantsRes.tenants);
                if (!activeTenantId && tenantsRes.tenants.length > 0) {
                    const firstTenant = tenantsRes.tenants[0];
                    activeTenantId = firstTenant.id;
                    setSelectedTenantId(firstTenant.id);
                    setSelectedTenantName(
                        language === 'ar'
                            ? (firstTenant.name_ar || firstTenant.name || firstTenant.name_en)
                            : (firstTenant.name_en || firstTenant.name || firstTenant.name_ar)
                    );
                }
            }

            // 5. Load tenant gift packages for active tenant
            if (activeTenantId) {
                const pkgRes = await api.get<{ success: boolean; packages: GiftPackage[] }>(
                    `/public/tenant/${encodeURIComponent(activeTenantId)}/gift-cards`
                ).catch(() => null);
                if (pkgRes?.success && Array.isArray(pkgRes.packages)) {
                    setPackages(pkgRes.packages);
                } else {
                    setPackages([]);
                }
            } else {
                setPackages([]);
            }
        } catch (error) {
            console.warn('Failed to load wallet hub data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [tenantId, selectedTenantId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleSelectTenant = async (tenant: { id: string; name: string; name_en?: string; name_ar?: string }) => {
        const name = language === 'ar'
            ? (tenant.name_ar || tenant.name || tenant.name_en || 'الصالون')
            : (tenant.name_en || tenant.name || tenant.name_ar || 'Salon');
        setSelectedTenantId(tenant.id);
        setSelectedTenantName(name);
        try {
            const pkgRes = await api.get<{ success: boolean; packages: GiftPackage[] }>(
                `/public/tenant/${encodeURIComponent(tenant.id)}/gift-cards`
            ).catch(() => null);
            if (pkgRes?.success && Array.isArray(pkgRes.packages)) {
                setPackages(pkgRes.packages);
            } else {
                setPackages([]);
            }
        } catch {
            setPackages([]);
        }
    };

    // Handle deep-linked claim token (explicit token endpoint)
    useEffect(() => {
        const token = `${route?.params?.claimToken || route?.params?.tenantClaimToken || ''}`.trim();
        if (!token) return;

        const autoClaim = async () => {
            try {
                setSaving(true);
                const res = await api.claimTenantGiftByToken(token);
                if (res.success) {
                    Alert.alert(
                        language === 'ar' ? 'تم الاستلام بنجاح' : 'Gift Claimed Successfully',
                        language === 'ar'
                            ? `تمت إضافة الهدية إلى رصيد الصالون بنجاح. الرصيد الجديد: ${sar(Number(res.walletBalance || 0))}`
                            : `Gift credited to salon wallet successfully. New balance: ${sar(Number(res.walletBalance || 0))}`
                    );
                    await loadData();
                } else {
                    Alert.alert(language === 'ar' ? 'خطأ' : 'Error', res.message || 'Failed to claim gift');
                }
            } catch (error: any) {
                Alert.alert(language === 'ar' ? 'خطأ' : 'Error', error?.message || 'Failed to claim gift');
            } finally {
                setSaving(false);
                navigation?.setParams?.({ claimToken: undefined, tenantClaimToken: undefined });
            }
        };

        void autoClaim();
    }, [route?.params?.claimToken, route?.params?.tenantClaimToken]);

    // Handle human-readable voucher code claim (explicit code endpoint)
    const handleClaimCode = async () => {
        const code = claimCode.trim();
        if (!code) {
            Alert.alert(
                language === 'ar' ? 'تنبيه' : 'Notice',
                language === 'ar' ? 'أدخل كود الهدية أولاً (مثال: TN-XXXX).' : 'Enter gift code first (e.g. TN-XXXX).'
            );
            return;
        }

        try {
            setSaving(true);
            const res = await api.claimTenantGiftByCode(code);
            if (res.success) {
                setClaimCode('');
                Alert.alert(
                    language === 'ar' ? 'تم استلام الهدية بنجاح' : 'Gift Claimed Successfully',
                    language === 'ar'
                        ? `تمت إضافة رصيد الهدية إلى رصيد الصالون. الرصيد الجديد: ${sar(Number(res.walletBalance || 0))}`
                        : `Gift credited to salon balance. New balance: ${sar(Number(res.walletBalance || 0))}`
                );
                await loadData();
            } else {
                Alert.alert(language === 'ar' ? 'خطأ' : 'Error', res.message || 'Failed to claim gift');
            }
        } catch (error: any) {
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', error?.message || 'Failed to claim gift');
        } finally {
            setSaving(false);
        }
    };

    // Helper for claiming a received gift card directly from received gifts list
    const handleClaimReceivedItem = async (item: any) => {
        try {
            setSaving(true);
            let res;
            if (item.claimToken) {
                res = await api.claimTenantGiftByToken(item.claimToken);
            } else if (item.giftCode?.code) {
                res = await api.claimTenantGiftByCode(item.giftCode.code);
            } else {
                Alert.alert(language === 'ar' ? 'خطأ' : 'Error', 'No claim credentials found for this gift');
                return;
            }

            if (res.success) {
                Alert.alert(
                    language === 'ar' ? 'تم الاستلام بنجاح' : 'Gift Claimed Successfully',
                    language === 'ar'
                        ? `تم شحن رصيد الصالون بنجاح. الرصيد الجديد: ${sar(Number(res.walletBalance || 0))}`
                        : `Gift claimed successfully. New balance: ${sar(Number(res.walletBalance || 0))}`
                );
                await loadData();
            } else {
                Alert.alert(language === 'ar' ? 'خطأ' : 'Error', res.message || 'Failed to claim gift');
            }
        } catch (error: any) {
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', error?.message || 'Failed to claim gift');
        } finally {
            setSaving(false);
        }
    };

    const getLocalizedTenantName = (item: TenantBalanceItem) => {
        if (language === 'ar') {
            return item.tenantNameAr || item.tenantName || item.tenantNameEn || 'الصالون';
        }
        return item.tenantNameEn || item.tenantName || item.tenantNameAr || 'Salon';
    };

    const getStatusLabel = (status?: string) => {
        const key = (status || '').toLowerCase();
        if (language === 'ar') {
            if (key === 'redeemed') return 'تم الاستلام في المحفظة';
            if (key === 'sent_completed' || key === 'sent_completed_auto_wallet') return 'تم الإرسال للمستلم';
            if (key === 'sent_pending_external_redeem') return 'بانتظار استخدام الكود';
            if (key === 'sent_pending_claim') return 'بانتظار الاستلام';
            if (key === 'purchased') return 'تم الشراء';
            if (key === 'cancelled') return 'ملغي';
            if (key === 'expired') return 'منتهي';
            return status || 'حركة هدية';
        }
        if (key === 'redeemed') return 'Credited to Wallet';
        if (key === 'sent_completed' || key === 'sent_completed_auto_wallet') return 'Sent to Member';
        if (key === 'sent_pending_external_redeem') return 'Pending Code Redeem';
        if (key === 'sent_pending_claim') return 'Pending Claim';
        if (key === 'purchased') return 'Purchased';
        if (key === 'cancelled') return 'Cancelled';
        if (key === 'expired') return 'Expired';
        return status || 'Gift Transaction';
    };

    const checkRecipient = async () => {
        const email = recipientEmail.trim();
        const phone = recipientPhone.trim();
        if (!email && !phone) {
            Alert.alert(
                language === 'ar' ? 'المستلم مطلوب' : 'Recipient required',
                language === 'ar' ? 'يرجى إدخال البريد الإلكتروني أو رقم جوال المستلم.' : 'Please enter recipient email or phone.'
            );
            return;
        }

        try {
            setCheckingRecipient(true);
            setRecipientCheck(null);
            setRecipientDecision('none');
            const query = `recipientEmail=${encodeURIComponent(email)}&recipientPhone=${encodeURIComponent(phone)}`;
            const result = await api.get<{ success: boolean; exists: boolean; recipient: RecipientCheckResult['recipient'] }>(
                `/users/tenant-gifts/recipient-check?${query}`
            );

            if (!result.success) {
                Alert.alert(language === 'ar' ? 'خطأ' : 'Error', 'Failed to verify recipient');
                return;
            }

            const next = { exists: !!result.exists, recipient: result.recipient || null };
            setRecipientCheck(next);
            if (next.exists) {
                setRecipientDecision('send_member');
                return;
            }

            if (!email) {
                setRecipientDecision('none');
                Alert.alert(
                    language === 'ar' ? 'لا يوجد حساب' : 'No account found',
                    language === 'ar'
                        ? 'لم يتم العثور على حساب مسجل لهذا الجوال. أضف بريد المستلم لإرسال كود الهدية عبر البريد.'
                        : 'No account matched this phone. Add recipient email to send gift code by email.'
                );
                return;
            }

            Alert.alert(
                language === 'ar' ? 'المستلم ليس لديه حساب مسجل' : 'Recipient has no account',
                language === 'ar'
                    ? 'هل تريد إرسال بطاقة الهدية وكود الاستبدال إلى بريده الإلكتروني؟'
                    : 'Would you like to send the gift card code to their email instead?',
                [
                    {
                        text: language === 'ar' ? 'إلغاء' : 'Cancel',
                        style: 'cancel',
                        onPress: () => setRecipientDecision('none'),
                    },
                    {
                        text: language === 'ar' ? 'إرسال بالبريد' : 'Send by Email',
                        onPress: () => setRecipientDecision('send_email'),
                    },
                ]
            );
        } catch (error: any) {
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', error?.message || 'Failed to verify recipient');
        } finally {
            setCheckingRecipient(false);
        }
    };

    const handleSelfPurchase = async () => {
        const targetTenantId = selectedPackage?.tenantId || selectedTenantId || tenantId;
        if (!selectedPackage || !targetTenantId) {
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'يرجى اختيار باقة وصالون صالحين' : 'Valid package and salon are required');
            return;
        }
        const normalizedCard = cardNumber.replace(/\s+/g, '').trim();
        const normalizedExp = expiryDate.trim();
        const normalizedCvv = cvv.trim();
        const normalizedHolder = cardholderName.trim();

        if (!normalizedCard || !normalizedExp || !normalizedCvv || !normalizedHolder) {
            Alert.alert(
                language === 'ar' ? 'بيانات الدفع مطلوبة' : 'Payment required',
                language === 'ar' ? 'يرجى إدخال بيانات البطاقة البنكية لإتمام العملية.' : 'Please enter card details to continue.'
            );
            return;
        }

        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = `gift-buy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        const keyToUse = idempotencyKeyRef.current;

        try {
            setSaving(true);
            const res = await api.post<{ success: boolean; walletBalance: number; message?: string }>(
                '/users/tenant-gifts/purchase',
                {
                    tenantId: targetTenantId,
                    packageId: selectedPackage.id,
                    cardNumber: normalizedCard,
                    expiryDate: normalizedExp,
                    cvv: normalizedCvv,
                    cardholderName: normalizedHolder,
                    idempotencyKey: keyToUse
                }
            );

            if (!res.success) {
                Alert.alert(language === 'ar' ? 'خطأ' : 'Error', res.message || 'Failed to recharge wallet');
                return;
            }

            // Operation succeeded: clear idempotency key
            idempotencyKeyRef.current = null;

            Alert.alert(
                language === 'ar' ? 'تمت العملية بنجاح' : 'Success',
                language === 'ar'
                    ? `تم شحن رصيد الصالون بنجاح. الرصيد الجديد: ${sar(Number(res.walletBalance || 0))}`
                    : `Salon wallet recharged successfully. New balance: ${sar(Number(res.walletBalance || 0))}`
            );
            setSelectedPackage(null);
            setCardNumber('');
            setExpiryDate('');
            setCvv('');
            setCardholderName('');
            await loadData();
        } catch (error: any) {
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', error?.message || 'Failed to complete purchase');
        } finally {
            setSaving(false);
        }
    };

    const handleSendGift = async () => {
        const targetTenantId = selectedPackage?.tenantId || selectedTenantId || tenantId;
        if (!selectedPackage || !targetTenantId) {
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'يرجى اختيار باقة وصالون صالحين' : 'Valid package and salon are required');
            return;
        }
        const normalizedCard = cardNumber.replace(/\s+/g, '').trim();
        const normalizedExp = expiryDate.trim();
        const normalizedCvv = cvv.trim();
        const normalizedHolder = cardholderName.trim();

        if (!normalizedCard || !normalizedExp || !normalizedCvv || !normalizedHolder) {
            Alert.alert(
                language === 'ar' ? 'بيانات الدفع مطلوبة' : 'Payment required',
                language === 'ar' ? 'يرجى إدخال بيانات البطاقة البنكية لإتمام الإرسال.' : 'Please enter card details to continue.'
            );
            return;
        }

        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = `gift-send-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        const keyToUse = idempotencyKeyRef.current;

        try {
            setSaving(true);
            const res = await api.post<{ success: boolean; message?: string }>(
                '/users/tenant-gifts/send',
                {
                    tenantId: targetTenantId,
                    packageId: selectedPackage.id,
                    recipientEmail: recipientEmail.trim() || undefined,
                    recipientPhone: recipientPhone.trim() || undefined,
                    message: giftMessage.trim() || undefined,
                    cardNumber: normalizedCard,
                    expiryDate: normalizedExp,
                    cvv: normalizedCvv,
                    cardholderName: normalizedHolder,
                    idempotencyKey: keyToUse
                }
            );

            if (!res.success) {
                Alert.alert(language === 'ar' ? 'خطأ' : 'Error', res.message || 'Failed to send gift');
                return;
            }

            // Operation succeeded: clear idempotency key
            idempotencyKeyRef.current = null;

            Alert.alert(
                language === 'ar' ? 'تم إرسال الهدية بنجاح' : 'Gift Sent',
                res.message || (language === 'ar' ? 'تم إرسال بطاقة الهدية بنجاح.' : 'Gift card sent successfully.')
            );
            setSelectedPackage(null);
            setRecipientEmail('');
            setRecipientPhone('');
            setGiftMessage('');
            setCardNumber('');
            setExpiryDate('');
            setCvv('');
            setCardholderName('');
            await loadData();
        } catch (error: any) {
            Alert.alert(language === 'ar' ? 'خطأ' : 'Error', error?.message || 'Failed to send gift');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={language === 'ar' ? 'الهدايا والمحفظة' : 'Gifts & Wallet'}
                onBack={() => navigation.goBack()}
            />

            {/* Segmented Tabs Navigation */}
            <View style={[styles.tabBarWrap, isRTL && styles.rowRTL]}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'balances' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('balances')}
                    activeOpacity={0.85}
                >
                    <AppIcon
                        name="storefront"
                        size={17}
                        color={activeTab === 'balances' ? '#6537C0' : '#716B88'}
                    />
                    <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
                        {language === 'ar' ? 'أرصدة الصالونات' : 'Salon Balances'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'gifts' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('gifts')}
                    activeOpacity={0.85}
                >
                    <AppIcon
                        name="card_giftcard"
                        size={17}
                        color={activeTab === 'gifts' ? '#6537C0' : '#716B88'}
                    />
                    <Text style={[styles.tabText, activeTab === 'gifts' && styles.tabTextActive]}>
                        {language === 'ar' ? 'بطاقات الهدايا' : 'Gift Cards'}
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#6537C0" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{
                        paddingTop: 16,
                        paddingHorizontal: 16,
                        paddingBottom: scrollBottomPadding + 28,
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6537C0']} />
                    }
                >
                    {/* =================================================== */}
                    {/* TAB 1: SALON BALANCES (DEFAULT VIEW)                */}
                    {/* =================================================== */}
                    {activeTab === 'balances' && (
                        <View>
                            {/* Phase B: Informational Aggregation Header with Mandatory Disclaimer */}
                            <LinearGradient
                                colors={['#6537C0', '#1D035F']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.overviewSummaryCard}
                            >
                                <View style={[styles.overviewHeaderRow, isRTL && styles.rowRTL]}>
                                    <View style={styles.overviewIconCircle}>
                                        <AppIcon name="storefront" size={20} color="#FFFFFF" />
                                    </View>
                                </View>

                                <Text style={[styles.overviewTotalAmount, isRTL && styles.textRTL]}>
                                    {sar(totalAcrossSalons)}
                                </Text>

                                <View style={[styles.overviewDisclaimerBox, isRTL && styles.rowRTL]}>
                                    <AppIcon name="info" size={15} color="#E7DDFC" />
                                    <Text style={[styles.overviewDisclaimerText, isRTL && styles.textRTL]}>
                                        {language === 'ar'
                                            ? 'رصيد كل صالون مخصص للاستخدام لدى ذلك الصالون فقط ولا يمكن تحويله.'
                                            : "Each salon's balance is dedicated exclusively to that specific salon."}
                                    </Text>
                                </View>
                            </LinearGradient>

                            {/* Section Header with Quick Recharge Action */}
                            <View style={[styles.sectionTitleRow, isRTL && styles.rowRTL]}>
                                <View style={[styles.sectionHeaderLeftWrap, isRTL && styles.rowRTL]}>
                                    <Text style={[styles.sectionTitleText, isRTL && styles.textRTL]}>
                                        {language === 'ar' ? 'أرصدة الصالونات والمراكز' : 'Salon Balance Cards'}
                                    </Text>
                                    <Text style={styles.sectionBadgeCount}>
                                        {tenantBalances.length}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.rechargeHeaderBtn, isRTL && styles.rowRTL]}
                                    onPress={() => {
                                        setRechargeTargetTenant(null);
                                        setRechargeModalVisible(true);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <AppIcon name="plus" size={15} color="#FFFFFF" />
                                    <Text style={styles.rechargeHeaderBtnText}>
                                        {language === 'ar' ? 'شحن رصيد' : 'Recharge'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Tenant Balance Cards */}
                            {tenantBalances.length > 0 ? (
                                <View style={{ gap: 12 }}>
                                    {tenantBalances.map((item) => {
                                        const localizedName = getLocalizedTenantName(item);
                                        return (
                                            <View key={item.tenantId} style={styles.salonBalanceCard}>
                                                <View style={[styles.salonCardTopRow, isRTL && styles.rowRTL]}>
                                                    {item.tenantLogo ? (
                                                        <Image source={{ uri: item.tenantLogo }} style={styles.salonCardLogo} resizeMode="cover" />
                                                    ) : (
                                                        <View style={styles.salonCardLogoFallback}>
                                                            <Text style={styles.salonCardLogoText}>
                                                                {localizedName.charAt(0).toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}

                                                    <View style={[styles.salonCardMetaCol, isRTL && styles.alignRTL]}>
                                                        <Text style={[styles.salonCardName, isRTL && styles.textRTL]} numberOfLines={1}>
                                                            {localizedName}
                                                        </Text>
                                                        {!!item.tenantAddress && (
                                                            <Text style={[styles.salonCardAddress, isRTL && styles.textRTL]} numberOfLines={1}>
                                                                {item.tenantAddress}
                                                            </Text>
                                                        )}
                                                    </View>

                                                    <View style={[styles.activeStatusPill, isRTL && styles.rowRTL]}>
                                                        <View style={styles.activeDot} />
                                                        <Text style={styles.activeStatusText}>
                                                            {language === 'ar' ? 'نشط' : 'Active'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <View style={styles.cardDivider} />

                                                <View style={[styles.salonCardBottomRow, isRTL && styles.rowRTL]}>
                                                    <View style={isRTL && styles.alignRTL}>
                                                        <Text style={[styles.balanceSubLabel, isRTL && styles.textRTL]}>
                                                            {language === 'ar' ? 'الرصيد المتاح' : 'Available Balance'}
                                                        </Text>
                                                        <Text style={[styles.cardBalanceValue, isRTL && styles.textRTL]}>
                                                            {sar(Number(item.balance || 0))}
                                                        </Text>
                                                    </View>

                                                    <View style={[styles.cardActionButtonsRow, isRTL && styles.rowRTL]}>
                                                        <TouchableOpacity
                                                            style={[styles.quickRechargeBtn, isRTL && styles.rowRTL]}
                                                            onPress={() => {
                                                                setRechargeTargetTenant({ id: item.tenantId, name: localizedName });
                                                                setRechargeModalVisible(true);
                                                            }}
                                                            activeOpacity={0.85}
                                                        >
                                                            <AppIcon name="card" size={14} color="#6537C0" />
                                                            <Text style={styles.quickRechargeBtnText}>
                                                                {language === 'ar' ? 'شحن' : 'Recharge'}
                                                            </Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[styles.viewDetailsBtn, isRTL && styles.rowRTL]}
                                                            onPress={() =>
                                                                navigation.navigate('TenantWalletDetails', {
                                                                    tenantId: item.tenantId,
                                                                    tenantName: localizedName,
                                                                    tenantLogo: item.tenantLogo,
                                                                    tenantAddress: item.tenantAddress,
                                                                    balance: item.balance,
                                                                })
                                                            }
                                                            activeOpacity={0.85}
                                                        >
                                                            <Text style={styles.viewDetailsBtnText}>
                                                                {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                                                            </Text>
                                                            <AppIcon
                                                                name={isRTL ? 'arrow_back' : 'arrow_forward'}
                                                                size={14}
                                                                color="#6537C0"
                                                            />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View style={styles.emptyCardWrap}>
                                    <View style={styles.emptyIconCircle}>
                                        <AppIcon name="storefront" size={32} color="#6537C0" />
                                    </View>
                                    <Text style={[styles.emptyTitleText, isRTL && styles.textRTL]}>
                                        {language === 'ar' ? 'لا توجد أرصدة صالونات نشطة' : 'No Active Salon Balances'}
                                    </Text>
                                    <Text style={[styles.emptySubText, isRTL && styles.textRTL]}>
                                        {language === 'ar'
                                            ? 'عند شحن رصيد صالون بالبطاقة البنكية أو استلام بطاقة هدية، سيظهر رصيده وتفاصيل حركاته هنا.'
                                            : 'When you recharge a salon balance or receive a gift card, its balance and ledger will appear here.'}
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.emptyRechargeBtn, isRTL && styles.rowRTL]}
                                        onPress={() => {
                                            setRechargeTargetTenant(null);
                                            setRechargeModalVisible(true);
                                        }}
                                        activeOpacity={0.88}
                                    >
                                        <AppIcon name="card" size={16} color="#FFFFFF" />
                                        <Text style={styles.emptyRechargeBtnText}>
                                            {language === 'ar' ? 'شحن رصيد صالون الآن' : 'Recharge Salon Balance Now'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* =================================================== */}
                    {/* TAB 2: GIFT CARDS (TENANT GIFTS ONLY)               */}
                    {/* =================================================== */}
                    {activeTab === 'gifts' && (
                        <View>
                            {/* Redeem / Claim Gift Code Bar */}
                            <View style={styles.claimContainerCard}>
                                <View style={[styles.claimHeaderRow, isRTL && styles.rowRTL]}>
                                    <View style={styles.claimIconWrap}>
                                        <AppIcon name="sparkles" size={17} color="#6537C0" />
                                    </View>
                                    <Text style={[styles.claimHeaderTitle, isRTL && styles.textRTL]}>
                                        {language === 'ar' ? 'استبدال كود الهدية' : 'Redeem Gift Card Code'}
                                    </Text>
                                </View>

                                <View style={[styles.claimInputRow, isRTL && styles.rowRTL]}>
                                    <TextInput
                                        style={[styles.claimTextInput, isRTL && styles.rtlTextInput]}
                                        value={claimCode}
                                        onChangeText={setClaimCode}
                                        placeholder={language === 'ar' ? 'أدخل كود الهدية (مثال: TN-XXXX)' : 'Enter gift code (e.g. TN-XXXX)'}
                                        placeholderTextColor="#9C92B5"
                                        autoCapitalize="characters"
                                    />
                                    <TouchableOpacity
                                        style={styles.claimSubmitBtn}
                                        onPress={handleClaimCode}
                                        disabled={saving}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={styles.claimSubmitBtnText}>
                                            {language === 'ar' ? 'استبدال' : 'Claim'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Phase A: Salon Discovery Carousel */}
                            {availableTenants.length > 0 && (
                                <View style={styles.salonSelectorSection}>
                                    <View style={[styles.sectionTitleRow, isRTL && styles.rowRTL]}>
                                        <Text style={[styles.sectionTitleText, isRTL && styles.textRTL]}>
                                            {language === 'ar' ? 'اختر الصالون لشراء بطاقة إهداء' : 'Select Salon for Gift Card'}
                                        </Text>
                                    </View>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={[styles.salonSelectorScroll, isRTL && styles.rowRTL]}
                                    >
                                        {availableTenants.map((t) => {
                                            const isSelected = selectedTenantId === t.id;
                                            const name = language === 'ar'
                                                ? (t.name_ar || t.name || t.name_en || 'الصالون')
                                                : (t.name_en || t.name || t.name_ar || 'Salon');
                                            return (
                                                <TouchableOpacity
                                                    key={t.id}
                                                    style={[styles.salonSelectorItem, isSelected && styles.salonSelectorItemActive]}
                                                    onPress={() => handleSelectTenant(t)}
                                                    activeOpacity={0.85}
                                                >
                                                    {t.logo ? (
                                                        <Image source={{ uri: t.logo }} style={styles.salonSelectorLogo} resizeMode="cover" />
                                                    ) : (
                                                        <View style={styles.salonSelectorLogoFallback}>
                                                            <Text style={styles.salonSelectorLogoText}>
                                                                {name.charAt(0).toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    <Text
                                                        style={[styles.salonSelectorName, isSelected && styles.salonSelectorNameActive]}
                                                        numberOfLines={1}
                                                    >
                                                        {name}
                                                    </Text>
                                                    {isSelected && (
                                                        <View style={styles.selectedBadgeCheck}>
                                                            <AppIcon name="check" size={10} color="#FFFFFF" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Gift Packages for Selected Salon */}
                            {packages.length > 0 ? (
                                <View style={{ marginTop: 16 }}>
                                    <View style={[styles.sectionTitleRow, isRTL && styles.rowRTL]}>
                                        <Text style={[styles.sectionTitleText, isRTL && styles.textRTL]}>
                                            {language === 'ar'
                                                ? `باقات إهداء ${selectedTenantName || initialTenantName || 'المركز'}`
                                                : `${selectedTenantName || initialTenantName || 'Salon'} Gift Packages`}
                                        </Text>
                                    </View>

                                    {packages.map((pkg) => {
                                        const title = language === 'ar'
                                            ? (pkg.title_ar || pkg.title || pkg.title_en)
                                            : (pkg.title_en || pkg.title || pkg.title_ar);
                                        const totalCredit = Number(pkg.walletCreditAmount || 0) + Number(pkg.bonusAmount || 0);
                                        return (
                                            <TouchableOpacity
                                                key={pkg.id}
                                                style={styles.giftPackageCard}
                                                onPress={() => {
                                                    setSelectedPackage(pkg);
                                                    if (!idempotencyKeyRef.current) {
                                                        idempotencyKeyRef.current = `gift-buy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                                                    }
                                                }}
                                                activeOpacity={0.9}
                                            >
                                                <ImageBackground source={HERO_IMAGE} style={styles.giftPkgHero} imageStyle={{ borderRadius: 14 }}>
                                                    <View style={styles.pricePill}>
                                                        <Text style={styles.pricePillText}>{sar(Number(pkg.priceAmount))}</Text>
                                                    </View>
                                                </ImageBackground>

                                                <View style={styles.giftPkgBody}>
                                                    <Text style={[styles.giftPkgTitle, isRTL && styles.textRTL]}>{title}</Text>
                                                    <View style={[styles.payGetRow, isRTL && styles.rowRTL]}>
                                                        <Text style={styles.payGetLabel}>
                                                            {language === 'ar' ? `ادفع ${sar(Number(pkg.priceAmount))} واحصل على ` : `Pay ${sar(Number(pkg.priceAmount))} and get `}
                                                            <Text style={{ fontWeight: '800', color: '#0F8A4B' }}>{sar(totalCredit)}</Text>
                                                        </Text>
                                                    </View>

                                                    <TouchableOpacity
                                                        style={styles.buySendBtn}
                                                        onPress={() => {
                                                            setSelectedPackage(pkg);
                                                            if (!idempotencyKeyRef.current) {
                                                                idempotencyKeyRef.current = `gift-buy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                                                            }
                                                        }}
                                                    >
                                                        <Text style={styles.buySendBtnText}>
                                                            {language === 'ar' ? 'شراء / إهداء' : 'Purchase / Send'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View style={styles.emptyPackagesCard}>
                                    <Text style={[styles.emptyPackagesText, isRTL && styles.textRTL]}>
                                        {language === 'ar'
                                            ? `لا توجد باقات هدايا متاحة حالياً لدى ${selectedTenantName || 'هذا الصالون'}.`
                                            : `No gift packages currently available for ${selectedTenantName || 'this salon'}.`}
                                    </Text>
                                </View>
                            )}

                            {/* Sub-Tabs: Received Gifts vs Sent Gifts */}
                            <View style={[styles.subTabBar, isRTL && styles.rowRTL]}>
                                <TouchableOpacity
                                    style={[styles.subTabBtn, giftSubTab === 'received' && styles.subTabBtnActive]}
                                    onPress={() => setGiftSubTab('received')}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.subTabText, giftSubTab === 'received' && styles.subTabTextActive]}>
                                        {language === 'ar' ? `الهدايا المستلمة (${receivedGifts.length})` : `Received Gifts (${receivedGifts.length})`}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.subTabBtn, giftSubTab === 'sent' && styles.subTabBtnActive]}
                                    onPress={() => setGiftSubTab('sent')}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.subTabText, giftSubTab === 'sent' && styles.subTabTextActive]}>
                                        {language === 'ar' ? `الهدايا المرسلة (${giftHistory.length})` : `Sent Gifts (${giftHistory.length})`}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Section View: Received Gifts */}
                            {giftSubTab === 'received' && (
                                <View>
                                    {receivedGifts.length > 0 ? (
                                        <View style={styles.historyGroupCard}>
                                            {receivedGifts.map((item, index) => {
                                                const isLast = index === receivedGifts.length - 1;
                                                const tenantName = language === 'ar'
                                                    ? (item.tenant?.name_ar || item.tenant?.name || item.tenant?.name_en || 'مركز شريك')
                                                    : (item.tenant?.name_en || item.tenant?.name || 'Partner Salon');
                                                const senderName = item.sender
                                                    ? `${item.sender.firstName || ''} ${item.sender.lastName || ''}`.trim()
                                                    : null;
                                                const canClaim = item.status === 'sent_pending_claim' || item.status === 'sent_pending_external_redeem';

                                                return (
                                                    <View
                                                        key={item.id}
                                                        style={[
                                                            styles.historyRow,
                                                            !isLast && styles.rowDivider,
                                                            isRTL && styles.rowRTL,
                                                        ]}
                                                    >
                                                        <View style={styles.historyIconCircle}>
                                                            <AppIcon name="card_giftcard" size={17} color="#0F8A4B" />
                                                        </View>

                                                        <View style={[styles.historyMetaCol, isRTL && styles.alignRTL]}>
                                                            <Text style={[styles.historyTenantName, isRTL && styles.textRTL]}>
                                                                {tenantName}
                                                            </Text>
                                                            {senderName && (
                                                                <Text style={[styles.receivedSenderText, isRTL && styles.textRTL]}>
                                                                    {language === 'ar' ? `من: ${senderName}` : `From: ${senderName}`}
                                                                </Text>
                                                            )}
                                                            <Text style={[styles.historyStatusText, isRTL && styles.textRTL]}>
                                                                {getStatusLabel(item.status)}
                                                            </Text>
                                                        </View>

                                                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                                            <Text style={[styles.historyAmountText, { color: '#0F8A4B' }, isRTL && styles.textRTL]}>
                                                                +{sar(Number(item.totalCreditAmount || 0))}
                                                            </Text>
                                                            {canClaim && (
                                                                <TouchableOpacity
                                                                    style={styles.receivedClaimBtn}
                                                                    onPress={() => handleClaimReceivedItem(item)}
                                                                    disabled={saving}
                                                                >
                                                                    <Text style={styles.receivedClaimBtnText}>
                                                                        {language === 'ar' ? 'استلام' : 'Claim'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        <View style={styles.emptyCardWrap}>
                                            <View style={styles.emptyIconCircle}>
                                                <AppIcon name="card_giftcard" size={32} color="#6537C0" />
                                            </View>
                                            <Text style={[styles.emptyTitleText, isRTL && styles.textRTL]}>
                                                {language === 'ar' ? 'لا توجد بطاقات هدايا مستلمة' : 'No Received Gift Cards'}
                                            </Text>
                                            <Text style={[styles.emptySubText, isRTL && styles.textRTL]}>
                                                {language === 'ar'
                                                    ? 'أي بطاقات هدايا يتم إرسالها إليك ستظهر هنا مع إمكانية استلامها.'
                                                    : 'Any gift cards sent to your email or phone will appear here for claiming.'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Section View: Sent Gifts */}
                            {giftSubTab === 'sent' && (
                                <View>
                                    {giftHistory.length > 0 ? (
                                        <View style={styles.historyGroupCard}>
                                            {giftHistory.map((item, index) => {
                                                const isLast = index === giftHistory.length - 1;
                                                const tenantName = language === 'ar'
                                                    ? (item.tenant?.name_ar || item.tenant?.name || item.tenant?.name_en || 'مركز شريك')
                                                    : (item.tenant?.name_en || item.tenant?.name || 'Partner Salon');

                                                return (
                                                    <View
                                                        key={item.id}
                                                        style={[
                                                            styles.historyRow,
                                                            !isLast && styles.rowDivider,
                                                            isRTL && styles.rowRTL,
                                                        ]}
                                                    >
                                                        <View style={styles.historyIconCircle}>
                                                            <AppIcon name="card_giftcard" size={17} color="#6537C0" />
                                                        </View>

                                                        <View style={[styles.historyMetaCol, isRTL && styles.alignRTL]}>
                                                            <Text style={[styles.historyTenantName, isRTL && styles.textRTL]}>
                                                                {tenantName}
                                                            </Text>
                                                            <Text style={[styles.historyStatusText, isRTL && styles.textRTL]}>
                                                                {getStatusLabel(item.status)}
                                                            </Text>
                                                        </View>

                                                        <Text style={[styles.historyAmountText, isRTL && styles.textRTL]}>
                                                            +{sar(Number(item.totalCreditAmount || 0))}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        <View style={styles.emptyCardWrap}>
                                            <View style={styles.emptyIconCircle}>
                                                <AppIcon name="card_giftcard" size={32} color="#6537C0" />
                                            </View>
                                            <Text style={[styles.emptyTitleText, isRTL && styles.textRTL]}>
                                                {language === 'ar' ? 'لا يوجد سجل بطاقات هدايا مرسلة' : 'No Sent Gift Cards'}
                                            </Text>
                                            <Text style={[styles.emptySubText, isRTL && styles.textRTL]}>
                                                {language === 'ar'
                                                    ? 'البطاقات التي تشتريها أو تهديها للآخرين ستظهر هنا.'
                                                    : 'Gift cards you purchase or send will be tracked here.'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Gift Purchase / Send Modal */}
            <Modal
                visible={!!selectedPackage}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setSelectedPackage(null);
                    idempotencyKeyRef.current = null;
                }}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => {
                        setSelectedPackage(null);
                        idempotencyKeyRef.current = null;
                    }}
                >
                    <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.modalTitle}>
                            {language === 'ar' ? 'شراء أو إهداء بطاقة صالون' : 'Purchase or Send Gift Card'}
                        </Text>

                        {/* Mode Selector (Self vs Send) */}
                        <View style={[styles.modeSelectorRow, isRTL && styles.rowRTL]}>
                            <TouchableOpacity
                                style={[styles.modeBtn, mode === 'self' && styles.modeBtnActive]}
                                onPress={() => setMode('self')}
                            >
                                <Text style={[styles.modeBtnText, mode === 'self' && styles.modeBtnTextActive]}>
                                    {language === 'ar' ? 'شحن رصيدي' : 'Recharge Myself'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeBtn, mode === 'send' && styles.modeBtnActive]}
                                onPress={() => setMode('send')}
                            >
                                <Text style={[styles.modeBtnText, mode === 'send' && styles.modeBtnTextActive]}>
                                    {language === 'ar' ? 'إهداء لشخص آخر' : 'Send as a Gift'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                            {mode === 'send' && (
                                <View style={{ gap: 10, marginBottom: 12 }}>
                                    <TextInput
                                        style={[styles.modalInput, isRTL && styles.rtlTextInput]}
                                        value={recipientEmail}
                                        onChangeText={setRecipientEmail}
                                        placeholder={language === 'ar' ? 'البريد الإلكتروني للمستلم' : 'Recipient Email'}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                    <TextInput
                                        style={[styles.modalInput, isRTL && styles.rtlTextInput]}
                                        value={recipientPhone}
                                        onChangeText={setRecipientPhone}
                                        placeholder={language === 'ar' ? 'رقم جوال المستلم' : 'Recipient Phone'}
                                        keyboardType="phone-pad"
                                    />
                                    <TextInput
                                        style={[styles.modalInput, isRTL && styles.rtlTextInput]}
                                        value={giftMessage}
                                        onChangeText={setGiftMessage}
                                        placeholder={language === 'ar' ? 'رسالة إهداء (اختياري)' : 'Gift Message (Optional)'}
                                    />
                                    <TouchableOpacity
                                        style={styles.verifyRecipientBtn}
                                        onPress={checkRecipient}
                                        disabled={checkingRecipient}
                                    >
                                        <Text style={styles.verifyRecipientBtnText}>
                                            {checkingRecipient
                                                ? (language === 'ar' ? 'جاري التحقق...' : 'Checking...')
                                                : (language === 'ar' ? 'التحقق من حساب المستلم' : 'Verify Recipient Account')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Card Details */}
                            <View style={{ gap: 10 }}>
                                <Text style={styles.inputGroupLabel}>
                                    {language === 'ar' ? 'بيانات البطاقة البنكية' : 'Payment Card Details'}
                                </Text>
                                <TextInput
                                    style={[styles.modalInput, isRTL && styles.rtlTextInput]}
                                    value={cardholderName}
                                    onChangeText={setCardholderName}
                                    placeholder={language === 'ar' ? 'اسم حامل البطاقة' : 'Cardholder Name'}
                                />
                                <TextInput
                                    style={[styles.modalInput, isRTL && styles.rtlTextInput]}
                                    value={cardNumber}
                                    onChangeText={setCardNumber}
                                    placeholder="4000 0000 0000 0000"
                                    keyboardType="numeric"
                                />
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TextInput
                                        style={[styles.modalInput, { flex: 1 }, isRTL && styles.rtlTextInput]}
                                        value={expiryDate}
                                        onChangeText={setExpiryDate}
                                        placeholder="MM/YY"
                                    />
                                    <TextInput
                                        style={[styles.modalInput, { flex: 1 }, isRTL && styles.rtlTextInput]}
                                        value={cvv}
                                        onChangeText={setCvv}
                                        placeholder="CVV"
                                        keyboardType="numeric"
                                        maxLength={4}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalActionRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => {
                                    setSelectedPackage(null);
                                    idempotencyKeyRef.current = null;
                                }}
                            >
                                <Text style={styles.modalCancelBtnText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmBtn}
                                onPress={mode === 'self' ? handleSelfPurchase : handleSendGift}
                                disabled={saving}
                            >
                                <Text style={styles.modalConfirmBtnText}>
                                    {saving
                                        ? (language === 'ar' ? 'جاري التنفيذ...' : 'Processing...')
                                        : (language === 'ar' ? 'تأكيد الدفع' : 'Confirm Payment')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Direct Card Wallet Recharge Modal (Sprint 3A) */}
            <TenantWalletRechargeModal
                visible={rechargeModalVisible}
                onClose={() => setRechargeModalVisible(false)}
                targetTenantId={rechargeTargetTenant?.id}
                targetTenantName={rechargeTargetTenant?.name}
                availableTenants={availableTenants}
                onSuccess={() => {
                    loadData();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    alignRTL: {
        alignItems: 'flex-end',
    },
    tabBarWrap: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
        gap: 8,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F5F2FC',
        gap: 6,
    },
    tabButtonActive: {
        backgroundColor: '#EDE7FB',
        borderWidth: 1,
        borderColor: '#C4B5FD',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#716B88',
        fontFamily: 'Cairo-Medium',
    },
    tabTextActive: {
        color: '#6537C0',
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    overviewSummaryCard: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 5,
    },
    overviewHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    overviewIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overviewTitleLabel: {
        fontSize: 13,
        color: '#E7DDFC',
        fontWeight: '600',
        fontFamily: 'Cairo-Medium',
    },
    overviewTotalAmount: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    overviewDisclaimerBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
    },
    overviewDisclaimerText: {
        flex: 1,
        fontSize: 11,
        color: '#E7DDFC',
        fontFamily: 'Cairo-Regular',
        lineHeight: 16,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionHeaderLeftWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rechargeHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6537C0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 4,
    },
    rechargeHeaderBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    sectionTitleText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    sectionBadgeCount: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6537C0',
        backgroundColor: '#EDE7FB',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        fontFamily: 'Cairo-Bold',
    },
    salonBalanceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 2,
    },
    salonCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    salonCardLogo: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F3E8FF',
    },
    salonCardLogoFallback: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    salonCardLogoText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Cairo-Bold',
    },
    salonCardMetaCol: {
        flex: 1,
        marginHorizontal: 12,
    },
    salonCardName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    salonCardAddress: {
        fontSize: 12,
        color: '#716B88',
        marginTop: 2,
        fontFamily: 'Cairo-Regular',
    },
    activeStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 5,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#0F8A4B',
    },
    activeStatusText: {
        fontSize: 11,
        color: '#0F8A4B',
        fontWeight: '600',
        fontFamily: 'Cairo-Medium',
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#F3E8FF',
        marginVertical: 12,
    },
    salonCardBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    balanceSubLabel: {
        fontSize: 11,
        color: '#716B88',
        fontFamily: 'Cairo-Regular',
    },
    cardBalanceValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginTop: 1,
    },
    cardActionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    quickRechargeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3EAFD',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 5,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    quickRechargeBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    viewDetailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F2FC',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    viewDetailsBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    emptyCardWrap: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        gap: 8,
    },
    emptyIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F5F2FC',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    emptyTitleText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    emptySubText: {
        fontSize: 12,
        color: '#716B88',
        textAlign: 'center',
        lineHeight: 18,
        fontFamily: 'Cairo-Regular',
    },
    emptyRechargeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6537C0',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        marginTop: 10,
    },
    emptyRechargeBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    claimContainerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 16,
    },
    claimHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    claimIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F5F2FC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    claimHeaderTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    claimInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    claimTextInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#FAF9FC',
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        fontSize: 13,
        color: '#1D035F',
        fontFamily: 'Cairo-Regular',
    },
    rtlTextInput: {
        textAlign: 'right',
    },
    claimSubmitBtn: {
        height: 44,
        backgroundColor: '#6537C0',
        borderRadius: 12,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    claimSubmitBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    giftPackageCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 12,
        overflow: 'hidden',
    },
    giftPkgHero: {
        height: 100,
        padding: 12,
        alignItems: 'flex-start',
    },
    pricePill: {
        backgroundColor: 'rgba(0,0,0,0.65)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    pricePillText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    giftPkgBody: {
        padding: 14,
    },
    giftPkgTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    payGetRow: {
        marginTop: 6,
        marginBottom: 12,
    },
    payGetLabel: {
        fontSize: 12,
        color: '#716B88',
        fontFamily: 'Cairo-Regular',
    },
    buySendBtn: {
        backgroundColor: '#6537C0',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buySendBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    historyGroupCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#F0EAFB',
    },
    historyIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F5F2FC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    historyMetaCol: {
        flex: 1,
        marginHorizontal: 12,
    },
    historyTenantName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-SemiBold',
    },
    historyStatusText: {
        fontSize: 11,
        color: '#716B88',
        marginTop: 2,
        fontFamily: 'Cairo-Regular',
    },
    historyAmountText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F8A4B',
        fontFamily: 'Cairo-Bold',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
        marginBottom: 16,
        fontFamily: 'Cairo-Bold',
    },
    modeSelectorRow: {
        flexDirection: 'row',
        backgroundColor: '#F5F2FC',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
        gap: 6,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
    },
    modeBtnActive: {
        backgroundColor: '#6537C0',
    },
    modeBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#716B88',
        fontFamily: 'Cairo-Medium',
    },
    modeBtnTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    modalInput: {
        height: 44,
        backgroundColor: '#FAF9FC',
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        fontSize: 13,
        color: '#1D035F',
        fontFamily: 'Cairo-Regular',
    },
    inputGroupLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginTop: 4,
    },
    verifyRecipientBtn: {
        backgroundColor: '#EDE7FB',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    verifyRecipientBtnText: {
        color: '#6537C0',
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    modalActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#F5F2FC',
        alignItems: 'center',
    },
    modalCancelBtnText: {
        color: '#716B88',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Cairo-Medium',
    },
    modalConfirmBtn: {
        flex: 2,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#6537C0',
        alignItems: 'center',
    },
    modalConfirmBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    salonSelectorSection: {
        marginTop: 18,
        marginBottom: 8,
    },
    salonSelectorScroll: {
        paddingVertical: 4,
        gap: 10,
    },
    salonSelectorItem: {
        alignItems: 'center',
        padding: 10,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        minWidth: 85,
        maxWidth: 100,
        position: 'relative',
    },
    salonSelectorItemActive: {
        borderColor: '#6537C0',
        backgroundColor: '#F5EEFC',
        borderWidth: 2,
    },
    salonSelectorLogo: {
        width: 44,
        height: 44,
        borderRadius: 12,
        marginBottom: 6,
        backgroundColor: '#F3E8FF',
    },
    salonSelectorLogoFallback: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    salonSelectorLogoText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Cairo-Bold',
    },
    salonSelectorName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#716B88',
        fontFamily: 'Cairo-Medium',
        textAlign: 'center',
    },
    salonSelectorNameActive: {
        color: '#6537C0',
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    selectedBadgeCheck: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyPackagesCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 18,
        marginTop: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    emptyPackagesText: {
        fontSize: 13,
        color: '#716B88',
        fontFamily: 'Cairo-Regular',
        textAlign: 'center',
    },
    subTabBar: {
        flexDirection: 'row',
        backgroundColor: '#F5F2FC',
        borderRadius: 14,
        padding: 4,
        marginTop: 22,
        marginBottom: 12,
        gap: 6,
    },
    subTabBtn: {
        flex: 1,
        paddingVertical: 9,
        alignItems: 'center',
        borderRadius: 10,
    },
    subTabBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    subTabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#716B88',
        fontFamily: 'Cairo-Medium',
    },
    subTabTextActive: {
        color: '#6537C0',
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    receivedSenderText: {
        fontSize: 11,
        color: '#716B88',
        fontFamily: 'Cairo-Regular',
        marginTop: 1,
    },
    receivedClaimBtn: {
        backgroundColor: '#6537C0',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    receivedClaimBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
});
