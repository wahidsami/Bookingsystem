const fs = require('fs');

const content = `import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../api/client';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { formatRiyal } from '../utils/currency';
import { useFocusEffect } from '@react-navigation/native';

type WalletSummaryResponse = {
  success: boolean;
  summary?: {
    tenantGiftBalances?: Array<{
      tenantId: string;
      tenantName?: string | null;
      balance: number;
      currency?: string;
    }>;
  };
};

export function GiftsScreen({ navigation, route }: any) {
  const { language, t } = useLanguage();
  const sar = (value: number) => formatRiyal(Number(value || 0), language === 'ar' ? 'ar' : 'en');
  const targetTenantId = route?.params?.tenantId as string | undefined;
  const { scrollBottomPadding } = useScreenSafeArea();

  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<Array<{ tenantId: string; tenantName?: string | null; balance: number }>>([]);

  const loadBalances = async () => {
    try {
      setLoading(true);
      const summaryRes = await api.get<WalletSummaryResponse>('/users/wallet/summary').catch(() => null);
      if (summaryRes?.success && summaryRes.summary?.tenantGiftBalances) {
        setBalances(summaryRes.summary.tenantGiftBalances);
      } else {
        setBalances([]);
      }
    } catch (err) {
      console.warn('Failed to load wallet summary', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadBalances();
    }, [])
  );

  const currentBalance = useMemo(() => {
    if (balances.length === 0) return 0;
    if (targetTenantId) {
      const match = balances.find(b => b.tenantId === targetTenantId);
      if (match) return match.balance;
    }
    // Default to the first balance or primary
    return balances[0].balance;
  }, [balances, targetTenantId]);

  const walletTitle = language === 'ar' ? 'المحفظة' : 'Wallet';

  const currentTenantName = useMemo(() => {
    if (balances.length === 0) return walletTitle;
    if (targetTenantId) {
      const match = balances.find(b => b.tenantId === targetTenantId);
      if (match && match.tenantName) return match.tenantName;
    }
    return balances[0].tenantName || walletTitle;
  }, [balances, targetTenantId, t]);

  return (
    <View style={styles.container}>
      <PageHeader title={walletTitle} showBack onBack={() => navigation.goBack()} />
      
      {loading && balances.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: scrollBottomPadding + spacing.xl, paddingTop: spacing.md }}
        >
          {/* Current Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>
              {language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}
            </Text>
            <Text style={styles.balanceAmount}>{sar(currentBalance)}</Text>
            <Text style={styles.tenantName}>{currentTenantName}</Text>
          </View>

          {/* All Balances */}
          {balances.length > 0 && (
            <View style={styles.allBalancesSection}>
              <Text style={styles.sectionTitle}>
                {language === 'ar' ? 'كل الأرصدة' : 'All Balances'}
              </Text>
              <View style={styles.balancesList}>
                {balances.map((item) => (
                  <View key={item.tenantId} style={styles.balanceItem}>
                    <Text style={styles.itemTenantName} numberOfLines={1}>
                      {item.tenantName || 'BarSpa'}
                    </Text>
                    <Text style={styles.itemBalance}>{sar(item.balance)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
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
    marginBottom: spacing.xs,
  },
  tenantName: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  allBalancesSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  balancesList: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  balanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  itemTenantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  itemBalance: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});
`;
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/GiftsScreen.tsx', content);
