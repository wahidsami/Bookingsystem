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

export function GiftsScreen({ navigation, route }: any) {
  const { language, isRTL } = useLanguage();
  const { topInset, scrollBottomPadding } = useScreenSafeArea();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<GiftPackage[]>([]);
  const [selected, setSelected] = useState<GiftPackage | null>(null);
  const [mode, setMode] = useState<'self' | 'send'>('self');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [giftMessage, setGiftMessage] = useState('');

  useEffect(() => {
    const token = `${route?.params?.claimToken || ''}`.trim();
    if (!token) return;

    const claimGift = async () => {
      try {
        setSaving(true);
        const response = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/gifts/claim', { token });
        if (!response.success) {
          Alert.alert('Error', response.message || 'Failed to claim gift');
        } else {
          Alert.alert('Success', `Gift claimed. New balance: ${Number(response.walletBalance || 0).toFixed(2)} SAR`);
        }
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to claim gift');
      } finally {
        setSaving(false);
        if (route?.params?.claimToken) {
          navigation?.setParams?.({ claimToken: undefined });
        }
      }
    };

    claimGift();
  }, [route?.params?.claimToken]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; packages: GiftPackage[] }>('/users/gifts/packages');
      if (response.success) {
        setPackages(response.packages || []);
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
    try {
      setSaving(true);
      const response = await api.post<{ success: boolean; walletBalance: number; message?: string }>('/users/gifts/recharge', {
        packageId: selected.id
      });
      if (!response.success) {
        Alert.alert('Error', response.message || 'Failed to recharge wallet');
        return;
      }
      Alert.alert('Success', `Wallet recharged. New balance: ${Number(response.walletBalance || 0).toFixed(2)} SAR`);
      setSelected(null);
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

    try {
      setSaving(true);
      const response = await api.post<{ success: boolean; message?: string }>('/users/gifts/send', {
        packageId: selected.id,
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        message: giftMessage.trim() || undefined
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
        <Text style={styles.headerTitle}>{language === 'ar' ? 'الهدايا' : 'Gifts'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: scrollBottomPadding + spacing.lg }}>
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
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#F9FAFB' },
  submitBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, alignItems: 'center', paddingVertical: spacing.md },
  submitText: { color: '#fff', fontWeight: '700', fontSize: fontSize.md }
});
