import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api } from '../api/client';
import { AppIcon } from '../components/AppIcon';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { LinearGradient } from 'expo-linear-gradient';
import { formatRiyal } from '../utils/currency';
import { useFocusEffect } from '@react-navigation/native';

type GiftPackage = {
  id: string;
  title_en: string;
  title_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  priceAmount: number;
  walletCreditAmount: number;
  bonusAmount: number;
};

type GiftHistoryItem = {
  id: string;
  tenantId?: string;
  status: string;
  totalCreditAmount: number;
  purchaseAmount: number;
  createdAt: string;
  tenant?: { name?: string; name_en?: string; name_ar?: string } | null;
};

type WalletSummaryResponse = {
  success: boolean;
  summary?: {
    wallet?: {
      balance: number;
      currency?: string;
    };
    platformGift?: {
      receivedTotal?: number;
      pendingToOthersTotal?: number;
      sentPurchaseTotal?: number;
      transactionCount?: number;
    };
    tenantGiftBalances?: Array<{
      tenantId: string;
      tenantName?: string | null;
      balance: number;
      currency?: string;
    }>;
  };
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

const HERO_IMAGE = require('../../assets/wallethero.jpg');

export function GiftsScreen({ navigation, route }: any) {
  const { language, isRTL } = useLanguage();
  const sar = (value: number) => formatRiyal(Number(value || 0), language === 'ar' ? 'ar' : 'en');
  const tenantId = route?.params?.tenantId as string | undefined;
  const tenantName = route?.params?.tenantName as string | undefined;
  const [previewOnly, setPreviewOnly] = useState(Boolean(route?.params?.previewOnly));
  const showTenantGiftCards = Boolean(tenantId);
  const { topInset, scrollBottomPadding } = useScreenSafeArea();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<GiftPackage[]>([]);
  const [refahBalance, setRefahBalance] = useState<number>(0);
  const [tenantCenterBalance, setTenantCenterBalance] = useState<number>(0);
  const [tenantCentersSummary, setTenantCentersSummary] = useState<Array<{ tenantId: string; balance: number }>>([]);
  const [history, setHistory] = useState<GiftHistoryItem[]>([]);
  const [selected, setSelected] = useState<GiftPackage | null>(null);
  const [mode, setMode] = useState<'self' | 'send'>('self');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [checkingRecipient, setCheckingRecipient] = useState(false);
  const [recipientCheck, setRecipientCheck] = useState<RecipientCheckResult | null>(null);
  const [recipientDecision, setRecipientDecision] = useState<'none' | 'send_member' | 'send_email' | 'recharge_self'>('none');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [platformGiftReceivedTotal, setPlatformGiftReceivedTotal] = useState(0);

  const centersBalance = useMemo(() => {
    if (tenantId) return Number(tenantCenterBalance || 0);
    return tenantCentersSummary.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  }, [tenantId, tenantCenterBalance, tenantCentersSummary]);
  const centersCount = useMemo(() => {
    if (tenantId) return tenantCenterBalance > 0 ? 1 : 0;
    return tenantCentersSummary.length;
  }, [tenantId, tenantCenterBalance, tenantCentersSummary]);

  const getStatusLabel = (status?: string) => {
    const key = (status || '').toLowerCase();
    if (language === 'ar') {
      if (key === 'redeemed') return 'تم الاستلام';
      if (key === 'sent_completed' || key === 'sent_completed_auto_wallet') return 'تم الإرسال';
      if (key === 'sent_pending_external_redeem') return 'بانتظار استخدام الكود';
      if (key === 'sent_pending_claim') return 'بانتظار الاستلام';
      if (key === 'purchased') return 'تم الشراء';
      if (key === 'cancelled') return 'ملغي';
      if (key === 'expired') return 'منتهي';
      return status || 'غير معروف';
    }
    if (key === 'redeemed') return 'Redeemed';
    if (key === 'sent_completed' || key === 'sent_completed_auto_wallet') return 'Sent';
    if (key === 'sent_pending_external_redeem') return 'Pending code redeem';
    if (key === 'sent_pending_claim') return 'Pending claim';
    if (key === 'purchased') return 'Purchased';
    if (key === 'cancelled') return 'Cancelled';
    if (key === 'expired') return 'Expired';
    return status || 'Unknown';
  };

  const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  const maskEmail = (value?: string) => {
    const email = `${value || ''}`.trim();
    if (!email.includes('@')) return email;
    const [name, domain] = email.split('@');
    if (!name) return email;
    const head = name.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  };

  const maskPhone = (value?: string) => {
    const phone = `${value || ''}`.trim();
    if (phone.length <= 4) return phone;
    return `${phone.slice(0, 3)}${'*'.repeat(Math.max(2, phone.length - 5))}${phone.slice(-2)}`;
  };

  useEffect(() => {
    const token = `${route?.params?.claimToken || ''}`.trim();
    const tenantToken = `${route?.params?.tenantClaimToken || ''}`.trim();
    if (!token && !tenantToken) return;

    const claimGift = async () => {
      try {
        setSaving(true);
        if (tenantToken) {
          const response = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/tenant-gifts/claim', { token: tenantToken });
          if (!response.success) Alert.alert('Error', response.message || 'Failed to claim gift');
          else Alert.alert('Success', `Gift claimed. New balance: ${sar(Number(response.walletBalance || 0))}`);
          await loadPackages();
          return;
        }
        try {
          const response = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/gifts/claim', { token });
          if (!response.success) Alert.alert('Error', response.message || 'Failed to claim gift');
          else Alert.alert('Success', `Gift claimed. New balance: ${sar(Number(response.walletBalance || 0))}`);
          await loadPackages();
        } catch {
          const tenantResponse = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/tenant-gifts/claim', { token });
          if (!tenantResponse.success) Alert.alert('Error', tenantResponse.message || 'Failed to claim gift');
          else Alert.alert('Success', `Gift claimed. New balance: ${sar(Number(tenantResponse.walletBalance || 0))}`);
          await loadPackages();
        }
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to claim gift');
      } finally {
        setSaving(false);
        if (route?.params?.claimToken || route?.params?.tenantClaimToken) {
          navigation?.setParams?.({ claimToken: undefined, tenantClaimToken: undefined });
        }
      }
    };

    claimGift();
  }, [route?.params?.claimToken, route?.params?.tenantClaimToken]);

  useEffect(() => {
    setPreviewOnly(Boolean(route?.params?.previewOnly));
  }, [route?.params?.previewOnly]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      if (tenantId) {
        const response = await api.get<{ success: boolean; packages: GiftPackage[] }>(`/public/tenant/${tenantId}/gift-cards`);
        if (response.success) setPackages(response.packages || []);
        const summaryRes = await api.get<WalletSummaryResponse>('/users/wallet/summary').catch(() => null);
        if (summaryRes?.success && summaryRes.summary) {
          setRefahBalance(Number(summaryRes.summary.wallet?.balance || 0));
          const tenantBucket = (summaryRes.summary.tenantGiftBalances || []).find((entry) => entry.tenantId === tenantId);
          setTenantCenterBalance(Number(tenantBucket?.balance || 0));
          setTenantCentersSummary((summaryRes.summary.tenantGiftBalances || []).map((entry) => ({
            tenantId: entry.tenantId,
            balance: Number(entry.balance || 0),
          })));
        } else {
          const generalWallet = await api.getWalletBalance().catch(() => 0);
          setRefahBalance(Number(generalWallet || 0));
          const walletRes = await api.get<{ success: boolean; balance: number }>(`/users/tenant-gifts/wallet?tenantId=${encodeURIComponent(tenantId)}&limit=5`);
          if (walletRes.success) setTenantCenterBalance(Number(walletRes.balance || 0));
          setTenantCentersSummary([]);
        }
        const historyRes = await api.get<{ success: boolean; transactions: GiftHistoryItem[] }>('/users/tenant-gifts/history');
        if (historyRes.success) setHistory((historyRes.transactions || []).filter((tx) => tx.tenantId === tenantId).slice(0, 10));
      } else {
        setPackages([]);
        const summaryRes = await api.get<WalletSummaryResponse>('/users/wallet/summary').catch(() => null);
        if (summaryRes?.success && summaryRes.summary?.wallet) {
          setRefahBalance(Number(summaryRes.summary.wallet.balance || 0));
          setPlatformGiftReceivedTotal(Number(summaryRes.summary.platformGift?.receivedTotal || 0));
          setTenantCentersSummary((summaryRes.summary.tenantGiftBalances || []).map((entry) => ({
            tenantId: entry.tenantId,
            balance: Number(entry.balance || 0),
          })));
        } else {
          const generalWallet = await api.getWalletBalance().catch(() => 0);
          setRefahBalance(generalWallet);
          setPlatformGiftReceivedTotal(0);
          setTenantCentersSummary([]);
        }
        setTenantCenterBalance(0);
        const historyRes = await api.get<{ success: boolean; transactions: GiftHistoryItem[] }>('/users/gifts/history');
        if (historyRes.success) {
          setHistory((historyRes.transactions || []).slice(0, 10));
        } else {
          setHistory([]);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load gift packages');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadPackages();
    }, [tenantId])
  );

  const handleSelfRecharge = async () => {
    if (!selected) return;
    const normalizedCardNumber = cardNumber.replace(/\s+/g, '').trim();
    const normalizedExpiry = expiryDate.trim();
    const normalizedCvv = cvv.trim();
    const normalizedHolder = cardholderName.trim();
    if (!normalizedCardNumber || !normalizedExpiry || !normalizedCvv || !normalizedHolder) {
      Alert.alert('Payment required', 'Please enter card details to continue.');
      return;
    }

    try {
      setSaving(true);
      const finalResponse = tenantId
        ? await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/tenant-gifts/purchase', { tenantId, packageId: selected.id, cardNumber: normalizedCardNumber, expiryDate: normalizedExpiry, cvv: normalizedCvv, cardholderName: normalizedHolder })
        : await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/gifts/recharge', { packageId: selected.id, cardNumber: normalizedCardNumber, expiryDate: normalizedExpiry, cvv: normalizedCvv, cardholderName: normalizedHolder });

      if (!finalResponse.success) {
        Alert.alert('Error', finalResponse.message || 'Failed to recharge wallet');
        return;
      }
      Alert.alert('Success', `Wallet recharged. New balance: ${sar(Number(finalResponse.walletBalance || 0))}`);
      setPreviewOnly(false);
      setSelected(null);
      setCardNumber('');
      setExpiryDate('');
      setCvv('');
      setCardholderName('');
      await loadPackages();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to recharge wallet');
    } finally {
      setSaving(false);
    }
  };

  const handleSendGift = async () => {
    if (!selected) return;
    if (!recipientEmail.trim() && !recipientPhone.trim()) {
      Alert.alert('Recipient required', 'Please enter recipient email or phone.');
      return;
    }
    const normalizedCardNumber = cardNumber.replace(/\s+/g, '').trim();
    const normalizedExpiry = expiryDate.trim();
    const normalizedCvv = cvv.trim();
    const normalizedHolder = cardholderName.trim();
    if (!normalizedCardNumber || !normalizedExpiry || !normalizedCvv || !normalizedHolder) {
      Alert.alert('Payment required', 'Please enter card details to continue.');
      return;
    }

    try {
      setSaving(true);
      const endpoint = tenantId ? '/users/tenant-gifts/send' : '/users/gifts/send';
      const response = await api.post<{ success: boolean; message?: string }>(endpoint, {
        ...(tenantId ? { tenantId } : {}),
        packageId: selected.id,
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        message: giftMessage.trim() || undefined,
        cardNumber: normalizedCardNumber,
        expiryDate: normalizedExpiry,
        cvv: normalizedCvv,
        cardholderName: normalizedHolder
      });
      if (!response.success) {
        Alert.alert('Error', response.message || 'Failed to send gift');
        return;
      }
      Alert.alert('Success', response.message || 'Gift sent successfully.');
      setPreviewOnly(false);
      setSelected(null);
      setRecipientEmail('');
      setRecipientPhone('');
      setGiftMessage('');
      setCardNumber('');
      setExpiryDate('');
      setCvv('');
      setCardholderName('');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to send gift');
    } finally {
      setSaving(false);
    }
  };

  const checkRecipient = async () => {
    const email = recipientEmail.trim();
    const phone = recipientPhone.trim();
    if (!email && !phone) {
      Alert.alert('Recipient required', 'Please enter recipient email or phone.');
      return;
    }
    try {
      setCheckingRecipient(true);
      setRecipientCheck(null);
      setRecipientDecision('none');
      const endpoint = tenantId ? '/users/tenant-gifts/recipient-check' : '/users/gifts/recipient-check';
      const query = `recipientEmail=${encodeURIComponent(email)}&recipientPhone=${encodeURIComponent(phone)}`;
      const result = await api.get<{ success: boolean; exists: boolean; recipient: RecipientCheckResult['recipient'] }>(`${endpoint}?${query}`);
      if (!result.success) {
        Alert.alert('Error', 'Failed to verify recipient');
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
            ? 'لم يتم العثور على حساب لهذا الجوال. أضف بريد المستلم لإرسال كود الهدية عبر البريد.'
            : 'No account matched this phone. Add recipient email to send gift code by email.'
        );
        return;
      }

      Alert.alert(
        language === 'ar' ? 'المستلم لا يملك حساباً' : 'Recipient has no account',
        language === 'ar'
          ? 'هل تريد إرسال بطاقة الهدية إلى بريده الإلكتروني بدلاً من ذلك؟'
          : 'Would you like to send the gift card to their email instead?',
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
      Alert.alert('Error', error?.message || 'Failed to verify recipient');
    } finally {
      setCheckingRecipient(false);
    }
  };

  const handleConfirm = async () => {
    if (mode === 'self') return handleSelfRecharge();
    if (!recipientCheck) return Alert.alert('Verify recipient', 'Please check recipient first.');
    if (recipientCheck.exists) {
      if (recipientDecision !== 'send_member') return Alert.alert('Confirm recipient', 'Please confirm the recipient first.');
      return handleSendGift();
    }
    if (recipientDecision === 'recharge_self') return handleSelfRecharge();
    if (recipientDecision !== 'send_email') return Alert.alert('Choose action', 'Please choose an action for this recipient.');
    return handleSendGift();
  };

  const handleClaimCode = async () => {
    const token = claimCode.trim();
    if (!token) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'أدخل كود الهدية أولاً.' : 'Enter gift code first.');
      return;
    }
    try {
      setSaving(true);
      let response;
      try {
        response = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/gifts/claim', { token });
      } catch {
        response = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/tenant-gifts/claim', { token });
      }
      if (!response.success) {
        Alert.alert('Error', response.message || 'Failed to claim gift');
        return;
      }
      setClaimCode('');
      Alert.alert(language === 'ar' ? 'نجاح' : 'Success', language === 'ar' ? 'تم استلام الهدية بنجاح.' : 'Gift claimed successfully.');
      await loadPackages();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to claim gift');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollBottomPadding + spacing.xl }}>
        <ImageBackground source={HERO_IMAGE} style={[styles.hero, { paddingTop: topInset + spacing.sm }]} imageStyle={styles.heroImage}>
          <LinearGradient colors={['rgba(38,12,89,0.85)', 'rgba(93,47,153,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          <View style={styles.heroTopBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroGlassBtn}>
              <AppIcon name="arrow_back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroGlassBtn}>
              <AppIcon name="card_giftcard" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>{language === 'ar' ? 'الهدايا والمحفظة' : 'Gifts & Wallet'}</Text>
          <Text style={styles.heroSubTitle}>{language === 'ar' ? 'أرصدة الهدايا ونشاطك في مكان واحد.' : 'Your balances, gifts and activity in one place.'}</Text>
        </ImageBackground>

        <View style={styles.contentWrap}>
          {!previewOnly ? (
            <View style={styles.balanceRow}>
              <TouchableOpacity style={[styles.balanceCard, { marginRight: spacing.sm }]} onPress={() => navigation.navigate('WalletBalanceDetails', { walletBalance: refahBalance || 0, history })} activeOpacity={0.9}>
                <View style={styles.balanceIcon}><AppIcon name="account_balance_wallet" size={20} color={colors.primary} /></View>
                <Text style={styles.balanceLabel}>{language === 'ar' ? 'رصيد رفاه' : 'Refah Balance'}</Text>
                <Text style={styles.balanceAmount}>{sar(Number(refahBalance || 0))}</Text>
                <Text style={styles.balanceMeta}>
                  {tenantId
                    ? (language === 'ar' ? 'رصيد بطاقات هذا المركز' : 'This center gift balance')
                    : (language === 'ar'
                      ? `متاح لكل المراكز${platformGiftReceivedTotal > 0 ? ` • هدايا مستلمة ${sar(platformGiftReceivedTotal)}` : ''}`
                      : `Usable across all centers${platformGiftReceivedTotal > 0 ? ` • Received gifts ${sar(platformGiftReceivedTotal)}` : ''}`)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.balanceCard, styles.centerBalanceCard]} onPress={() => navigation.navigate('CentersBalance', { centersBalance, history })} activeOpacity={0.9}>
                <View style={[styles.balanceIcon, styles.centerBalanceIcon]}><AppIcon name="storefront" size={20} color="#7A4F00" /></View>
                <Text style={styles.balanceLabel}>{language === 'ar' ? 'رصيد المراكز' : 'Centers Balance'}</Text>
                <Text style={styles.balanceAmount}>{sar(Number(centersBalance || 0))}</Text>
                <Text style={styles.balanceMeta}>{language === 'ar' ? `عبر ${centersCount || 0} مراكز` : `Across ${centersCount || 0} centers`}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.previewNotice}>
              <AppIcon name="info" size={16} color={colors.primary} />
              <Text style={styles.previewNoticeText}>
                {language === 'ar'
                  ? 'استعرض بطاقات هذا المركز أولاً. سيتم تحديث الرصيد فقط بعد إتمام الشراء.'
                  : 'Browse this center first. Balance updates only after purchase is completed.'}
              </Text>
            </View>
          )}

          {!previewOnly && showTenantGiftCards ? (
            <>
              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickCard} onPress={handleClaimCode}>
                  <View style={styles.quickIconWrap}>
                    <AppIcon name="sparkles" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.quickText}>{language === 'ar' ? 'استبدال كود الهدية' : 'Redeem Gift Code'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('WalletBalanceDetails', { walletBalance: refahBalance || 0, history })}>
                  <View style={styles.quickIconWrap}>
                    <AppIcon name="file" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.quickText}>{language === 'ar' ? 'سجل المحفظة والهدايا' : 'Wallet & Gift History'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.claimRow}>
                <TextInput
                  style={[styles.input, styles.claimInput]}
                  value={claimCode}
                  onChangeText={setClaimCode}
                  placeholder={language === 'ar' ? 'أدخل كود الهدية' : 'Enter gift code'}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.claimBtn} onPress={handleClaimCode} disabled={saving}>
                  <Text style={styles.claimBtnText}>{language === 'ar' ? 'استلام' : 'Claim'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {showTenantGiftCards ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{language === 'ar' ? 'بطاقات رفاه ✨' : 'Refah Gift Cards ✨'}</Text>
                  <Text style={styles.sectionSubTitle}>{language === 'ar' ? 'أهدِ الرفاهية والعناية لمن تحب.' : 'Give the gift of wellness, self-care and joy.'}</Text>
                </View>
              </View>

              {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}
              {packages.map((pkg, index) => {
                const title = language === 'ar' ? pkg.title_ar : pkg.title_en;
                const desc = language === 'ar' ? pkg.description_ar : pkg.description_en;
                const totalCredit = Number(pkg.walletCreditAmount || 0) + Number(pkg.bonusAmount || 0);
                return (
                  <TouchableOpacity key={pkg.id} style={styles.giftCard} onPress={() => setSelected(pkg)} activeOpacity={0.95}>
                    <ImageBackground source={HERO_IMAGE} style={styles.giftHero} imageStyle={styles.giftHeroImage}>
                      {index === 0 ? <View style={styles.badgePill}><Text style={styles.badgeText}>{language === 'ar' ? 'الأكثر شعبية' : 'Most Popular'}</Text></View> : null}
                      <View style={styles.pricePill}><Text style={styles.pricePillText}>{sar(Number(pkg.priceAmount))}</Text></View>
                    </ImageBackground>
                    <View style={styles.giftBody}>
                      <Text style={styles.giftTitle}>{title}</Text>
                      {!!desc ? <Text style={styles.giftDesc} numberOfLines={2}>{desc}</Text> : null}
                      <View style={styles.payGetBlock}>
                        <View>
                          <Text style={styles.payGetLabel}>{language === 'ar' ? 'أنت تدفع' : 'You Pay'}</Text>
                          <Text style={styles.payGetPay}>{sar(Number(pkg.priceAmount))}</Text>
                        </View>
                        <Text style={styles.payGetArrow}>{isRTL ? '←' : '→'}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.payGetLabel, { color: '#0F8A4B' }]}>{language === 'ar' ? 'تحصل على' : 'You Get'}</Text>
                          <Text style={styles.payGetGet}>{sar(totalCredit)}</Text>
                        </View>
                      </View>
                      {Number(pkg.bonusAmount || 0) > 0 ? <View style={styles.bonusPill}><Text style={styles.bonusText}>+ {sar(Number(pkg.bonusAmount))} {language === 'ar' ? 'مكافأة' : 'Bonus'}</Text></View> : null}
                      <View style={styles.validityRow}><AppIcon name="event" size={14} color={colors.textSecondary} /><Text style={styles.validityText}>{language === 'ar' ? 'صلاحية 12 شهر' : '12 months validity'}</Text></View>
                      <TouchableOpacity style={styles.buyBtn} onPress={() => setSelected(pkg)}>
                        <Text style={styles.buyBtnText}>{language === 'ar' ? 'شراء / إرسال هدية' : 'Buy / Send Gift'}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : null}

          {!!history.length && (
            <View style={styles.activityCard}>
              <Text style={styles.sectionTitle}>{language === 'ar' ? 'آخر نشاط الهدايا ✨' : 'Recent Gift Activity ✨'}</Text>
              {history.map((item) => (
                <View key={item.id} style={styles.activityRow}>
                  <View style={styles.activityIconWrap}><AppIcon name="receipt_long" size={16} color={colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{getStatusLabel(item.status)}</Text>
                    <Text style={styles.activitySub}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.activityAmount}>+{sar(Number(item.totalCreditAmount || 0))}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.trustBanner}>
            <AppIcon name="verified_user" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.trustTitle}>{language === 'ar' ? 'آمن وموثوق' : 'Secure & Trusted'}</Text>
              <Text style={styles.trustSub}>{language === 'ar' ? 'جميع العمليات مشفرة وبياناتك محمية دائماً.' : 'All transactions are secure and your data is always protected.'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => { setSelected(null); setRecipientCheck(null); setRecipientDecision('none'); }}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{language === 'ar' ? 'اختر الإجراء' : 'Choose action'}</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity style={[styles.modeBtn, mode === 'self' && styles.modeBtnActive]} onPress={() => { setMode('self'); setRecipientCheck(null); setRecipientDecision('none'); }}><Text style={[styles.modeText, mode === 'self' && styles.modeTextActive]}>{language === 'ar' ? 'إضافة لمحفظتي' : 'Add to my wallet'}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, mode === 'send' && styles.modeBtnActive]} onPress={() => setMode('send')}><Text style={[styles.modeText, mode === 'send' && styles.modeTextActive]}>{language === 'ar' ? 'إرسال لشخص' : 'Send to someone'}</Text></TouchableOpacity>
            </View>
            {mode === 'send' ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.inputLabel}>{language === 'ar' ? 'البريد الإلكتروني للمستلم' : 'Recipient Email'}</Text>
                <TextInput style={styles.input} value={recipientEmail} onChangeText={setRecipientEmail} placeholder={language === 'ar' ? 'بريد المستلم' : 'Recipient email'} keyboardType="email-address" autoCapitalize="none" />
                <Text style={styles.inputLabel}>{language === 'ar' ? 'جوال المستلم' : 'Recipient Phone'}</Text>
                <TextInput style={styles.input} value={recipientPhone} onChangeText={setRecipientPhone} placeholder={language === 'ar' ? 'جوال المستلم' : 'Recipient phone'} keyboardType="phone-pad" />
                <Text style={styles.inputLabel}>{language === 'ar' ? 'الرسالة (اختياري)' : 'Message (Optional)'}</Text>
                <TextInput style={styles.input} value={giftMessage} onChangeText={setGiftMessage} placeholder={language === 'ar' ? 'رسالة (اختياري)' : 'Message (optional)'} />
                <TouchableOpacity style={styles.checkBtn} onPress={checkRecipient} disabled={checkingRecipient}>{checkingRecipient ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.checkBtnText}>{language === 'ar' ? 'تحقق من المستلم' : 'Check recipient'}</Text>}</TouchableOpacity>
                {recipientCheck?.exists && recipientCheck.recipient ? (
                  <View style={styles.recipientCard}>
                    <Text style={styles.recipientTitle}>{language === 'ar' ? 'تم العثور على المستلم' : 'Recipient found'}</Text>
                    <Text style={styles.recipientLine}>
                      {(recipientCheck.recipient.fullName || `${recipientCheck.recipient.firstName || ''} ${recipientCheck.recipient.lastName || ''}`.trim() || (language === 'ar' ? 'مستخدم رفاه' : 'Refah User'))}
                    </Text>
                    {!!recipientCheck.recipient.email && <Text style={styles.recipientMeta}>{maskEmail(recipientCheck.recipient.email)}</Text>}
                    {!!recipientCheck.recipient.phone && <Text style={styles.recipientMeta}>{maskPhone(recipientCheck.recipient.phone)}</Text>}
                  </View>
                ) : null}
                {recipientCheck && !recipientCheck.exists && recipientDecision === 'send_email' ? (
                  <View style={styles.recipientCard}>
                    <Text style={styles.recipientTitle}>{language === 'ar' ? 'المستلم لا يملك حساباً' : 'Recipient has no account'}</Text>
                    <Text style={styles.recipientMeta}>
                      {language === 'ar'
                        ? 'سيتم إرسال كود الهدية إلى البريد الإلكتروني الذي أدخلته.'
                        : 'Gift code will be sent to the entered email.'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {(mode === 'self' || (mode === 'send' && recipientCheck?.exists && recipientDecision === 'send_member') || (mode === 'send' && !recipientCheck?.exists && (recipientDecision === 'send_email' || recipientDecision === 'recharge_self'))) && (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.paymentTitle}>{language === 'ar' ? 'بيانات الدفع' : 'Payment details'}</Text>
                <Text style={styles.inputLabel}>{language === 'ar' ? 'اسم حامل البطاقة' : 'Cardholder Name'}</Text>
                <TextInput style={styles.input} value={cardholderName} onChangeText={setCardholderName} placeholder={language === 'ar' ? 'اسم حامل البطاقة' : 'Cardholder name'} autoCapitalize="words" />
                <Text style={styles.inputLabel}>{language === 'ar' ? 'رقم البطاقة' : 'Card Number'}</Text>
                <TextInput style={styles.input} value={cardNumber} onChangeText={setCardNumber} placeholder={language === 'ar' ? 'رقم البطاقة' : 'Card number'} keyboardType="number-pad" />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.inputLabel}>{language === 'ar' ? 'تاريخ الانتهاء (MM/YY)' : 'Expiry Date (MM/YY)'}</Text>
                    <TextInput style={[styles.input, { flex: 1 }]} value={expiryDate} onChangeText={setExpiryDate} placeholder="MM/YY" />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.inputLabel}>{language === 'ar' ? 'رمز الأمان (CVV)' : 'CVV'}</Text>
                    <TextInput style={[styles.input, { flex: 1 }]} value={cvv} onChangeText={setCvv} placeholder="CVV" keyboardType="number-pad" secureTextEntry />
                  </View>
                </View>
              </View>
            )}
            <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.7 }]} onPress={handleConfirm} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.submitText}>{language === 'ar' ? 'تأكيد' : 'Confirm'}</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8FC' },
  hero: { minHeight: 320, paddingHorizontal: spacing.md, paddingBottom: spacing.lg, justifyContent: 'space-between' },
  heroImage: { borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  heroTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroGlassBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.24)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)' },
  heroTitle: { fontSize: 36, lineHeight: 40, fontWeight: '800', color: '#FFFFFF', marginTop: spacing.xl },
  heroSubTitle: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs },
  contentWrap: { paddingHorizontal: spacing.md, marginTop: -50 },
  balanceRow: { flexDirection: 'row', marginBottom: spacing.md },
  balanceCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, padding: spacing.md, borderWidth: 1, borderColor: '#EDE3FD' },
  centerBalanceCard: { borderColor: '#F2E3C3' },
  balanceIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2E9FF', marginBottom: spacing.xs },
  centerBalanceIcon: { backgroundColor: '#FFF4DC' },
  balanceLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '600' },
  balanceAmount: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  balanceMeta: { color: colors.textSecondary, fontSize: 9, marginTop: 4 },
  previewNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F4F0FF', borderRadius: 16, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: '#E6DBFF' },
  previewNoticeText: { flex: 1, color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  quickCard: { flex: 1, minHeight: 84, borderRadius: 20, backgroundColor: '#F6F0FF', borderWidth: 1, borderColor: '#E7DAFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, gap: 8 },
  quickIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEE5FF' },
  quickText: { fontSize: 11, color: colors.primary, fontWeight: '700', textAlign: 'center', lineHeight: 15 },
  claimRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  claimInput: { flex: 1 },
  claimBtn: { minWidth: 96, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6D28D9', paddingHorizontal: spacing.md },
  claimBtnText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: '700' },
  sectionHeaderRow: { marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  sectionSubTitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  giftCard: { borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDE3FD', overflow: 'hidden', marginBottom: spacing.md },
  giftHero: { height: 185, padding: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  giftHeroImage: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  badgePill: { backgroundColor: '#7C3AED', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  pricePill: { backgroundColor: 'rgba(20,16,30,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pricePillText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  giftBody: { padding: spacing.md, gap: spacing.sm },
  giftTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  giftDesc: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  payGetBlock: { borderRadius: 18, padding: spacing.sm, borderWidth: 1, borderColor: '#E8E0F8', backgroundColor: '#F8F5FF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payGetLabel: { fontSize: 9, color: colors.textSecondary, fontWeight: '600' },
  payGetPay: { fontSize: 12, color: colors.text, fontWeight: '800' },
  payGetArrow: { color: colors.primary, fontWeight: '700', fontSize: fontSize.lg },
  payGetGet: { fontSize: 12, color: '#0F8A4B', fontWeight: '800' },
  bonusPill: { alignSelf: 'flex-start', backgroundColor: '#E8F7EE', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  bonusText: { color: '#0F8A4B', fontSize: 10, fontWeight: '700' },
  validityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validityText: { color: colors.textSecondary, fontSize: 10 },
  buyBtn: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6D28D9' },
  buyBtnText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: '700' },
  activityCard: { borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDE3FD', padding: spacing.md, marginBottom: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: '#F0E9FC', paddingTop: spacing.sm, marginTop: spacing.sm },
  activityIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2E9FF' },
  activityTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  activitySub: { color: colors.textSecondary, fontSize: 9 },
  activityAmount: { color: colors.primary, fontWeight: '800', fontSize: fontSize.sm },
  trustBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 24, backgroundColor: '#F3ECFF', borderWidth: 1, borderColor: '#E9DBFF', padding: spacing.md },
  trustTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  trustSub: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18, 13, 33, 0.55)' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: '#E9DDFD' },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#D8C7FA', paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: '#FFFFFF' },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: '#F3E8FF' },
  modeText: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  modeTextActive: { color: colors.primary },
  checkBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 14, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: '#F5F3FF' },
  checkBtnText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  recipientCard: { borderRadius: 14, borderWidth: 1, borderColor: '#D8C7FA', backgroundColor: '#F6F1FF', padding: spacing.sm, gap: 4 },
  recipientTitle: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  recipientLine: { color: colors.text, fontSize: 13, fontWeight: '700' },
  recipientMeta: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  paymentTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#E9DDFD', borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#FAFAFF', color: colors.text },
  submitBtn: { backgroundColor: '#7C3AED', borderRadius: 16, alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.md },
  submitText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md }
});
