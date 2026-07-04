import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api/client';

const HERO_IMAGE = require('../../assets/wallethero.jpg');

export function WalletBalanceDetailsScreen({ navigation, route }: any) {
  const { language } = useLanguage();
  const { topInset, scrollBottomPadding } = useScreenSafeArea();
  const hasRouteWalletBalance = route?.params?.walletBalance !== undefined && route?.params?.walletBalance !== null;
  const hasRouteHistory = Array.isArray(route?.params?.history);
  const [walletBalance, setWalletBalance] = useState(Number(route?.params?.walletBalance || 0));
  const [history, setHistory] = useState<Array<{ id: string; status?: string; createdAt?: string }>>(
    hasRouteHistory ? route.params.history : []
  );
  const [loading, setLoading] = useState(!(hasRouteWalletBalance && hasRouteHistory));

  useEffect(() => {
    let cancelled = false;

    const loadWallet = async () => {
      if (hasRouteWalletBalance && hasRouteHistory) {
        setLoading(false);
        return;
      }

      try {
        const balance = hasRouteWalletBalance ? Number(route?.params?.walletBalance || 0) : await api.getWalletBalance();
        const historyResponse = hasRouteHistory
          ? { transactions: route.params.history }
          : await api.get<{ success: boolean; transactions: Array<{ id: string; status?: string; createdAt?: string }> }>('/users/gifts/history').catch(() => null);

        if (cancelled) return;
        setWalletBalance(Number(balance || 0));
        setHistory(Array.isArray(historyResponse?.transactions) ? historyResponse.transactions : []);
      } catch {
        if (!cancelled) {
          setWalletBalance(Number(route?.params?.walletBalance || 0));
          setHistory(hasRouteHistory ? route.params.history : []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadWallet();

    return () => {
      cancelled = true;
    };
  }, [hasRouteWalletBalance, hasRouteHistory, route?.params?.walletBalance, route?.params?.history]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollBottomPadding + spacing.lg }}>
        <ImageBackground source={HERO_IMAGE} style={[styles.hero, { paddingTop: topInset + spacing.sm }]} imageStyle={styles.heroImage}>
          <LinearGradient colors={['rgba(38,12,89,0.85)', 'rgba(93,47,153,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <AppIcon name="arrow_back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>{language === 'ar' ? 'رصيد رفاه' : 'Refah Balance'}</Text>
          <Text style={styles.heroSub}>{language === 'ar' ? 'تفاصيل الرصيد والعمليات الأخيرة' : 'Balance details and recent transactions'}</Text>
        </ImageBackground>
        <View style={styles.content}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{language === 'ar' ? 'الرصيد الحالي' : 'Current balance'}</Text>
            <Text style={styles.balanceAmount}>{formatRiyal(walletBalance, language)}</Text>
          </View>
          <Text style={styles.sectionTitle}>{language === 'ar' ? 'آخر النشاطات' : 'Recent activity'}</Text>
          {history.length > 0 ? (
            history.map((item: any) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.iconWrap}><AppIcon name="receipt_long" size={14} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.status || '-'}</Text>
                  <Text style={styles.rowSub}>{new Date(item.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>{language === 'ar' ? 'لا توجد حركات حديثة.' : 'No recent activity.'}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8FC' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8FC' },
  hero: { minHeight: 250, paddingHorizontal: spacing.md, paddingBottom: spacing.lg, justifyContent: 'space-between' },
  heroImage: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.24)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)' },
  heroTitle: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  heroSub: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.92)' },
  content: { padding: spacing.md, marginTop: -36 },
  balanceCard: { borderRadius: 22, borderWidth: 1, borderColor: '#EDE3FD', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md },
  balanceLabel: { fontSize: 12, color: colors.textSecondary },
  balanceAmount: { marginTop: 6, fontSize: 28, fontWeight: '800', color: colors.text },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: { borderRadius: 14, borderWidth: 1, borderColor: '#ECE3FA', backgroundColor: '#FFFFFF', padding: spacing.sm, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2E9FF' },
  rowTitle: { color: colors.text, fontWeight: '700' },
  rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.sm }
});
