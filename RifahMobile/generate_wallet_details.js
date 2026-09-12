const fs = require('fs');

const content = `import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { PageHeader } from '../components/ui/PageHeader';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { api } from '../api/client';

export function WalletBalanceDetailsScreen({ navigation, route }: any) {
  const { language } = useLanguage();
  const { scrollBottomPadding } = useScreenSafeArea();
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
      <PageHeader
        title={language === 'ar' ? 'تفاصيل الرصيد' : 'Wallet Details'}
        showBack
        onBack={() => navigation.goBack()}
        variant="standard"
      />
      <ScrollView contentContainerStyle={{ paddingBottom: scrollBottomPadding + spacing.xl, paddingTop: spacing.md }}>
        <View style={styles.content}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{language === 'ar' ? 'الرصيد الحالي' : 'Current balance'}</Text>
            <Text style={styles.balanceAmount}>{formatRiyal(walletBalance, language)}</Text>
          </View>
          
          <Text style={styles.sectionTitle}>{language === 'ar' ? 'آخر النشاطات' : 'Recent activity'}</Text>
          
          <View style={styles.historyList}>
            {history.length > 0 ? (
              history.map((item: any, index) => (
                <View key={item.id} style={[styles.row, index === history.length - 1 && styles.lastRow]}>
                  <View style={styles.iconWrap}>
                    <AppIcon name="receipt_long" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.status || '-'}</Text>
                    <Text style={styles.rowSub}>
                      {new Date(item.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{language === 'ar' ? 'لا توجد حركات حديثة.' : 'No recent activity.'}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.xl,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  historyList: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandPrimaryLight,
  },
  rowTitle: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowSub: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  emptyWrap: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
`;
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/WalletBalanceDetailsScreen.tsx', content);
