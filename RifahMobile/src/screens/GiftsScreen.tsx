import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api } from '../api/client';
import { AppIcon } from '../components/AppIcon';
import { borderRadius, colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { LinearGradient } from 'expo-linear-gradient';

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
  const tenantId = route?.params?.tenantId as string | undefined;
  const tenantName = route?.params?.tenantName as string | undefined;
  const { topInset, scrollBottomPadding } = useScreenSafeArea();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<GiftPackage[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
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

  const getStatusLabel = (status?: string) => {
    const key = (status || '').toLowerCase();
    if (language === 'ar') {
      if (key === 'redeemed') return 'تم الاستلام';
      if (key === 'sent_completed') return 'تم الإرسال';
      if (key === 'sent_pending_claim') return 'بانتظار الاستلام';
      if (key === 'purchased') return 'تم الشراء';
      if (key === 'cancelled') return 'ملغي';
      if (key === 'expired') return 'منتهي';
      return status || 'غير معروف';
    }
    if (key === 'redeemed') return 'Redeemed';
    if (key === 'sent_completed') return 'Sent';
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

  useEffect(() => {
    const token = `${route?.params?.claimToken || ''}`.trim();
    const tenantToken = `${route?.params?.tenantClaimToken || ''}`.trim();
    if (!token && !tenantToken) return;

    const claimGift = async () => {
      try {
        setSaving(true);
        if (tenantToken) {
          const response = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/tenant-gifts/claim', { token: tenantToken });
          if (!response.success) {
            Alert.alert('Error', response.message || 'Failed to claim gift');
          } else {
            Alert.alert('Success', `Gift claimed. New balance: ${Number(response.walletBalance || 0).toFixed(2)} SAR`);
          }
          return;
        }

        try {
          const response = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/gifts/claim', { token });
          if (!response.success) {
            Alert.alert('Error', response.message || 'Failed to claim gift');
          } else {
            Alert.alert('Success', `Gift claimed. New balance: ${Number(response.walletBalance || 0).toFixed(2)} SAR`);
          }
        } catch {
          const tenantResponse = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/tenant-gifts/claim', { token });
          if (!tenantResponse.success) {
            Alert.alert('Error', tenantResponse.message || 'Failed to claim gift');
          } else {
            Alert.alert('Success', `Gift claimed. New balance: ${Number(tenantResponse.walletBalance || 0).toFixed(2)} SAR`);
          }
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

  const loadPackages = async () => {
    try {
      setLoading(true);
      const endpoint = tenantId ? `/public/tenant/${tenantId}/gift-cards` : '/users/gifts/packages';
      const response = await api.get<{ success: boolean; packages: GiftPackage[] }>(endpoint);
      if (response.success) {
        setPackages(response.packages || []);
      }

      if (tenantId) {
        const walletRes = await api.get<{ success: boolean; balance: number; ledger?: any[] }>(`/users/tenant-gifts/wallet?tenantId=${encodeURIComponent(tenantId)}&limit=5`);
        if (walletRes.success) {
          setWalletBalance(Number(walletRes.balance || 0));
        }
        const historyRes = await api.get<{ success: boolean; transactions: GiftHistoryItem[] }>('/users/tenant-gifts/history');
        if (historyRes.success) {
          setHistory((historyRes.transactions || []).filter((tx) => tx.tenantId === tenantId).slice(0, 5));
        }
      } else {
        const generalWallet = await api.getWalletBalance().catch(() => 0);
        setWalletBalance(generalWallet);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load gift packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

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
        ? await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/tenant-gifts/purchase', {
          tenantId,
          packageId: selected.id,
          cardNumber: normalizedCardNumber,
          expiryDate: normalizedExpiry,
          cvv: normalizedCvv,
          cardholderName: normalizedHolder
        })
        : await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/gifts/recharge', {
          packageId: selected.id,
          cardNumber: normalizedCardNumber,
          expiryDate: normalizedExpiry,
          cvv: normalizedCvv,
          cardholderName: normalizedHolder
        });
      if (!finalResponse.success) {
        Alert.alert('Error', finalResponse.message || 'Failed to recharge wallet');
        return;
      }
      Alert.alert('Success', `Wallet recharged. New balance: ${Number(finalResponse.walletBalance || 0).toFixed(2)} SAR`);
      setWalletBalance(Number(finalResponse.walletBalance || 0));
      setSelected(null);
      setCardNumber('');
      setExpiryDate('');
      setCvv('');
      setCardholderName('');
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
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to verify recipient');
    } finally {
      setCheckingRecipient(false);
    }
  };

  const handleConfirm = async () => {
    if (mode === 'self') {
      await handleSelfRecharge();
      return;
    }
    if (!recipientCheck) {
      Alert.alert('Verify recipient', 'Please check recipient first.');
      return;
    }
    if (recipientCheck.exists) {
      if (recipientDecision !== 'send_member') {
        Alert.alert('Confirm recipient', 'Please confirm the recipient first.');
        return;
      }
      await handleSendGift();
      return;
    }

    if (recipientDecision === 'recharge_self') {
      await handleSelfRecharge();
      return;
    }
    if (recipientDecision !== 'send_email') {
      Alert.alert('Choose action', 'Please choose an action for this recipient.');
      return;
    }
    await handleSendGift();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F5F0FF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topInset + spacing.sm }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <AppIcon name="arrow_back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {tenantId
            ? (language === 'ar' ? `بطاقات ${tenantName || 'المركز'}` : `${tenantName || 'Center'} Gift Cards`)
            : (language === 'ar' ? 'الهدايا' : 'Gifts')}
        </Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: scrollBottomPadding + spacing.lg }}>
          {walletBalance !== null && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {tenantId
                  ? (language === 'ar' ? 'رصيد هدايا هذا المركز' : 'This Center Gift Balance')
                  : (language === 'ar' ? 'رصيد المحفظة' : 'Wallet Balance')}
              </Text>
              <Text style={styles.summaryBalance}>{walletBalance.toFixed(2)} SAR</Text>
            </View>
          )}

          {!!history.length && (
            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>{language === 'ar' ? 'آخر العمليات' : 'Recent Transactions'}</Text>
              {history.map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyStatus}>{getStatusLabel(item.status)}</Text>
                    <Text style={styles.historyDate}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.historyAmount}>+{Number(item.totalCreditAmount || 0).toFixed(2)} SAR</Text>
                </View>
              ))}
            </View>
          )}

          {packages.map((pkg) => {
            const title = language === 'ar' ? pkg.title_ar : pkg.title_en;
            const desc = language === 'ar' ? pkg.description_ar : pkg.description_en;
            const totalCredit = Number(pkg.walletCreditAmount || 0) + Number(pkg.bonusAmount || 0);
            return (
              <TouchableOpacity key={pkg.id} style={styles.card} onPress={() => setSelected(pkg)}>
                <Text style={styles.cardTitle}>{title}</Text>
                {desc ? <Text style={styles.cardDesc}>{desc}</Text> : null}
                <View style={styles.amountRow}>
                  <Text style={styles.payText}>{language === 'ar' ? 'السعر' : 'Price'}: {Number(pkg.priceAmount).toFixed(2)} SAR</Text>
                  <Text style={styles.creditText}>{language === 'ar' ? 'الرصيد' : 'Credit'}: {totalCredit.toFixed(2)} SAR</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => {
          setSelected(null);
          setRecipientCheck(null);
          setRecipientDecision('none');
        }}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{language === 'ar' ? 'اختر الإجراء' : 'Choose action'}</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity style={[styles.modeBtn, mode === 'self' && styles.modeBtnActive]} onPress={() => {
                setMode('self');
                setRecipientCheck(null);
                setRecipientDecision('none');
              }}>
                <Text style={[styles.modeText, mode === 'self' && styles.modeTextActive]}>{language === 'ar' ? 'إضافة لمحفظتي' : 'Add to my wallet'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, mode === 'send' && styles.modeBtnActive]} onPress={() => setMode('send')}>
                <Text style={[styles.modeText, mode === 'send' && styles.modeTextActive]}>{language === 'ar' ? 'إرسال لشخص' : 'Send to someone'}</Text>
              </TouchableOpacity>
            </View>

            {mode === 'send' ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.inputLabel}>{language === 'ar' ? 'البريد الإلكتروني للمستلم' : 'Recipient Email'}</Text>
                <TextInput style={styles.input} value={recipientEmail} onChangeText={setRecipientEmail} placeholder={language === 'ar' ? 'بريد المستلم' : 'Recipient email'} keyboardType="email-address" autoCapitalize="none" />
                <Text style={styles.inputLabel}>{language === 'ar' ? 'جوال المستلم' : 'Recipient Phone'}</Text>
                <TextInput style={styles.input} value={recipientPhone} onChangeText={setRecipientPhone} placeholder={language === 'ar' ? 'جوال المستلم' : 'Recipient phone'} keyboardType="phone-pad" />
                <Text style={styles.inputLabel}>{language === 'ar' ? 'الرسالة (اختياري)' : 'Message (Optional)'}</Text>
                <TextInput style={styles.input} value={giftMessage} onChangeText={setGiftMessage} placeholder={language === 'ar' ? 'رسالة (اختياري)' : 'Message (optional)'} />
                <TouchableOpacity style={styles.checkBtn} onPress={checkRecipient} disabled={checkingRecipient}>
                  {checkingRecipient
                    ? <ActivityIndicator color={colors.primary} />
                    : <Text style={styles.checkBtnText}>{language === 'ar' ? 'تحقق من المستلم' : 'Check recipient'}</Text>}
                </TouchableOpacity>

                {!!recipientCheck && recipientCheck.exists && (
                  <View style={styles.recipientCard}>
                    {recipientCheck.recipient?.profileImage ? (
                      <Image source={{ uri: recipientCheck.recipient.profileImage }} style={styles.recipientAvatar} />
                    ) : (
                      <View style={styles.recipientAvatarFallback}>
                        <Text style={styles.recipientAvatarFallbackText}>
                          {`${recipientCheck.recipient?.firstName?.[0] || ''}${recipientCheck.recipient?.lastName?.[0] || ''}`.toUpperCase() || 'R'}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipientName}>{recipientCheck.recipient?.fullName || 'Refah Member'}</Text>
                      <Text style={styles.recipientMeta}>{recipientCheck.recipient?.email || recipientCheck.recipient?.phone || ''}</Text>
                    </View>
                  </View>
                )}

                {!!recipientCheck && !recipientCheck.exists && (
                  <View style={styles.choiceGroup}>
                    <Text style={styles.choiceTitle}>{language === 'ar' ? 'المستلم غير مسجل. اختر الإجراء:' : 'Recipient is not a Refah member. Choose action:'}</Text>
                    <View style={styles.choiceRow}>
                      <TouchableOpacity style={[styles.choiceBtn, recipientDecision === 'send_email' && styles.choiceBtnActive]} onPress={() => setRecipientDecision('send_email')}>
                        <Text style={[styles.choiceText, recipientDecision === 'send_email' && styles.choiceTextActive]}>{language === 'ar' ? 'إرسال عبر البريد' : 'Send email gift card'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.choiceBtn, recipientDecision === 'recharge_self' && styles.choiceBtnActive]} onPress={() => setRecipientDecision('recharge_self')}>
                        <Text style={[styles.choiceText, recipientDecision === 'recharge_self' && styles.choiceTextActive]}>{language === 'ar' ? 'شحن لمحفظتي' : 'Recharge myself'}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.cancelChoiceBtn} onPress={() => {
                      setRecipientDecision('none');
                      setRecipientCheck(null);
                    }}>
                      <Text style={styles.cancelChoiceText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}

            {(mode === 'self' ||
              (mode === 'send' && recipientCheck?.exists && recipientDecision === 'send_member') ||
              (mode === 'send' && !recipientCheck?.exists && (recipientDecision === 'send_email' || recipientDecision === 'recharge_self'))) && (
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

            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.7 }]}
              onPress={handleConfirm}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.submitText}>{language === 'ar' ? 'تأكيد' : 'Confirm'}</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0
  },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3E8FF' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  headerSpacer: { width: 36 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E9DDFD',
    shadowColor: '#2E1065',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E9DDFD',
    shadowColor: '#2E1065',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2
  },
  summaryTitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 4 },
  summaryBalance: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E9DDFD',
    shadowColor: '#2E1065',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2
  },
  historyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm, marginTop: spacing.xs },
  historyStatus: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  historyDate: { fontSize: 11, color: colors.textSecondary },
  historyAmount: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '700' },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  cardDesc: { marginTop: 4, fontSize: fontSize.sm, color: colors.textSecondary },
  amountRow: { marginTop: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  payText: { color: colors.text, fontSize: fontSize.sm },
  creditText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 8, 32, 0.42)' },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E9DDFD'
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#D8C7FA', paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: '#FFFFFF' },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: '#F3E8FF' },
  modeText: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  modeTextActive: { color: colors.primary },
  checkBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: '#F5F3FF'
  },
  checkBtnText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#E9DDFD',
    borderRadius: 14,
    padding: spacing.sm,
    backgroundColor: '#FAFAFF'
  },
  recipientAvatar: { width: 40, height: 40, borderRadius: 20 },
  recipientAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}20`
  },
  recipientAvatarFallbackText: { color: colors.primary, fontWeight: '700' },
  recipientName: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },
  recipientMeta: { color: colors.textSecondary, fontSize: 11 },
  choiceGroup: {
    borderWidth: 1,
    borderColor: '#E9DDFD',
    borderRadius: 14,
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: '#FAFAFF'
  },
  choiceTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  choiceRow: { flexDirection: 'row', gap: spacing.xs },
  choiceBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D8C7FA',
    borderRadius: 14,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  choiceBtnActive: { borderColor: colors.primary, backgroundColor: '#F3E8FF' },
  choiceText: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 6 },
  choiceTextActive: { color: colors.primary },
  cancelChoiceBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  cancelChoiceText: { color: colors.error, fontWeight: '700', fontSize: fontSize.sm },
  paymentTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E9DDFD',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FAFAFF',
    color: colors.text
  },
  submitBtn: { backgroundColor: '#7C3AED', borderRadius: 16, alignItems: 'center', paddingVertical: spacing.md },
  submitText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md }
});
