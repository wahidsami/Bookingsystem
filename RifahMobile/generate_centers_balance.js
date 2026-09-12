const fs = require('fs');

const content = `import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { PageHeader } from '../components/ui/PageHeader';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { api } from '../api/client';

export function CentersBalanceScreen({ navigation, route }: any) {
  const { language } = useLanguage();
  const { scrollBottomPadding } = useScreenSafeArea();
  const hasRouteCentersBalance = route?.params?.centersBalance !== undefined && route?.params?.centersBalance !== null;
  const hasRouteHistory = Array.isArray(route?.params?.history);
  const [centersBalance, setCentersBalance] = useState(Number(route?.params?.centersBalance || 0));
  const [history, setHistory] = useState<Array<any>>(hasRouteHistory ? route.params.history : []);
  const [summaryCenters, setSummaryCenters] = useState<Array<{ id: string; name: string; total: number; count: number }>>([]);
  const [loading, setLoading] = useState(!(hasRouteCentersBalance && hasRouteHistory));

  useEffect(() => {
    let cancelled = false;

    const loadCenters = async () => {
      if (hasRouteCentersBalance && hasRouteHistory) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get<{
          success: boolean;
          summary?: {
            wallet?: { balance: number };
            tenantGiftBalances?: Array<{
              tenantId: string;
              tenantName?: string | null;
              balance: number;
            }>;
          };
        }>('/users/wallet/summary');

        if (cancelled) return;

        const balances = response?.summary?.tenantGiftBalances || [];
        setCentersBalance(hasRouteCentersBalance ? Number(route?.params?.centersBalance || 0) : Number(response?.summary?.wallet?.balance || 0));
        setSummaryCenters(
          balances.map((entry) => ({
            id: entry.tenantId,
            name: entry.tenantName || (language === 'ar' ? 'مركز' : 'Center'),
            total: Number(entry.balance || 0),
            count: 1,
          }))
        );
        setHistory(hasRouteHistory ? route.params.history : []);
      } catch {
        if (!cancelled) {
          setCentersBalance(Number(route?.params?.centersBalance || 0));
          setSummaryCenters([]);
          setHistory(hasRouteHistory ? route.params.history : []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadCenters();

    return () => {
      cancelled = true;
    };
  }, [hasRouteCentersBalance, hasRouteHistory, language, route?.params?.centersBalance, route?.params?.history]);

  const grouped = useMemo(() => {
    if (!history.length && summaryCenters.length > 0) {
      return summaryCenters;
    }
    const map = new Map<string, { name: string; total: number; count: number }>();
    history.forEach((item: any) => {
      const id = item?.tenantId || 'unknown';
      const name = item?.tenant?.name_en || item?.tenant?.name || (language === 'ar' ? 'مركز' : 'Center');
      const amount = Number(item?.totalCreditAmount || 0);
      const prev = map.get(id);
      if (prev) {
        prev.total += amount;
        prev.count += 1;
      } else {
        map.set(id, { name, total: amount, count: 1 });
      }
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [history, summaryCenters, language]);

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
        title={language === 'ar' ? 'رصيد المراكز' : 'Centers Balance'}
        showBack
        onBack={() => navigation.goBack()}
        variant="standard"
      />
      <ScrollView contentContainerStyle={{ paddingBottom: scrollBottomPadding + spacing.xl, paddingTop: spacing.md }}>
        <View style={styles.content}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{language === 'ar' ? 'إجمالي رصيد المراكز' : 'Total centers balance'}</Text>
            <Text style={styles.balanceAmount}>{formatRiyal(centersBalance, language)}</Text>
          </View>
          
          <Text style={styles.sectionTitle}>{language === 'ar' ? 'حسب المراكز' : 'By centers'}</Text>
          
          <View style={styles.historyList}>
            {grouped.length > 0 ? (
              grouped.map((item, index) => (
                <View key={item.id} style={[styles.row, index === grouped.length - 1 && styles.lastRow]}>
                  <View style={styles.iconWrap}>
                    <AppIcon name="storefront" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <Text style={styles.rowHint}>{language === 'ar' ? \`\${item.count} عمليات\` : \`\${item.count} transactions\`}</Text>
                  </View>
                  <Text style={styles.rowSub}>+{formatRiyal(Number(item.total), language)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{language === 'ar' ? 'لا توجد أرصدة موزعة.' : 'No distributed balances yet.'}</Text>
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
  rowHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  rowSub: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
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
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/CentersBalanceScreen.tsx', content);
