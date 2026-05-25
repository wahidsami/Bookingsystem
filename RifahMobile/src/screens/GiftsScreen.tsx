import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api } from '../api/client';
import { AppIcon } from '../components/AppIcon';
import { borderRadius, colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';

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
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');

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
    if (!cardNumber.trim() || !expiryDate.trim() || !cvv.trim() || !cardholderName.trim()) {
      Alert.alert('Payment required', 'Please enter card details to continue.');
      return;
    }
    try {
      setSaving(true);
      const finalResponse = tenantId
        ? await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/tenant-gifts/purchase', {
          tenantId,
          packageId: selected.id,
          cardNumber: cardNumber.trim(),
          expiryDate: expiryDate.trim(),
          cvv: cvv.trim(),
          cardholderName: cardholderName.trim()
        })
        : await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/gifts/recharge', {
          packageId: selected.id,
          cardNumber: cardNumber.trim(),
          expiryDate: expiryDate.trim(),
          cvv: cvv.trim(),
          cardholderName: cardholderName.trim()
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
    if (!cardNumber.trim() || !expiryDate.trim() || !cvv.trim() || !cardholderName.trim()) {
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
        cardNumber: cardNumber.trim(),
        expiryDate: expiryDate.trim(),
        cvv: cvv.trim(),
        cardholderName: cardholderName.trim()
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <AppIcon name="arrow_back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {tenantId
            ? (language === 'ar' ? `بطاقات ${tenantName || 'المركز'}` : `${tenantName || 'Center'} Gift Cards`)
            : (language === 'ar' ? 'الهدايا' : 'Gifts')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

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
                    <Text style={styles.historyStatus}>{item.status}</Text>
                    <Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleString()}</Text>
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
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setSelected(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{language === 'ar' ? 'اختر الإجراء' : 'Choose action'}</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity style={[styles.modeBtn, mode === 'self' && styles.modeBtnActive]} onPress={() => setMode('self')}>
                <Text style={[styles.modeText, mode === 'self' && styles.modeTextActive]}>{language === 'ar' ? 'إضافة لمحفظتي' : 'Add to my wallet'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, mode === 'send' && styles.modeBtnActive]} onPress={() => setMode('send')}>
                <Text style={[styles.modeText, mode === 'send' && styles.modeTextActive]}>{language === 'ar' ? 'إرسال لشخص' : 'Send to someone'}</Text>
              </TouchableOpacity>
            </View>

            {mode === 'send' ? (
              <View style={{ gap: spacing.sm }}>
                <TextInput style={styles.input} value={recipientEmail} onChangeText={setRecipientEmail} placeholder={language === 'ar' ? 'بريد المستلم' : 'Recipient email'} />
                <TextInput style={styles.input} value={recipientPhone} onChangeText={setRecipientPhone} placeholder={language === 'ar' ? 'جوال المستلم' : 'Recipient phone'} />
                <TextInput style={styles.input} value={giftMessage} onChangeText={setGiftMessage} placeholder={language === 'ar' ? 'رسالة (اختياري)' : 'Message (optional)'} />
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Text style={styles.paymentTitle}>{language === 'ar' ? 'بيانات الدفع' : 'Payment details'}</Text>
              <TextInput style={styles.input} value={cardholderName} onChangeText={setCardholderName} placeholder={language === 'ar' ? 'اسم حامل البطاقة' : 'Cardholder name'} />
              <TextInput style={styles.input} value={cardNumber} onChangeText={setCardNumber} placeholder={language === 'ar' ? 'رقم البطاقة' : 'Card number'} keyboardType="number-pad" />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={expiryDate} onChangeText={setExpiryDate} placeholder="MM/YY" />
                <TextInput style={[styles.input, { flex: 1 }]} value={cvv} onChangeText={setCvv} placeholder="CVV" keyboardType="number-pad" secureTextEntry />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.7 }]}
              onPress={mode === 'self' ? handleSelfRecharge : handleSendGift}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>{language === 'ar' ? 'تأكيد' : 'Confirm'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  headerSpacer: { width: 36 },
  card: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryTitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 4 },
  summaryBalance: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  historyCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#E5E7EB' },
  historyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: spacing.sm, marginTop: spacing.xs },
  historyStatus: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  historyDate: { fontSize: 11, color: colors.textSecondary },
  historyAmount: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '700' },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  cardDesc: { marginTop: 4, fontSize: fontSize.sm, color: colors.textSecondary },
  amountRow: { marginTop: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  payText: { color: '#374151', fontSize: fontSize.sm },
  creditText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.lg, gap: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeBtn: { flex: 1, borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#D1D5DB', paddingVertical: spacing.sm, alignItems: 'center' },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: '#F3E8FF' },
  modeText: { color: '#374151', fontSize: fontSize.sm, fontWeight: '600' },
  modeTextActive: { color: colors.primary },
  paymentTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#F9FAFB' },
  submitBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, alignItems: 'center', paddingVertical: spacing.md },
  submitText: { color: '#fff', fontWeight: '700', fontSize: fontSize.md }
});
