import React, { useMemo } from 'react';
import { ImageBackground, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { LinearGradient } from 'expo-linear-gradient';

const HERO_IMAGE = require('../../assets/wallethero.jpg');

export function CentersBalanceScreen({ navigation, route }: any) {
  const { language } = useLanguage();
  const { topInset, scrollBottomPadding } = useScreenSafeArea();
  const centersBalance = Number(route?.params?.centersBalance || 0);
  const history = Array.isArray(route?.params?.history) ? route.params.history : [];
  const grouped = useMemo(() => {
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
  }, [history, language]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollBottomPadding + spacing.lg }}>
        <ImageBackground source={HERO_IMAGE} style={[styles.hero, { paddingTop: topInset + spacing.sm }]} imageStyle={styles.heroImage}>
          <LinearGradient colors={['rgba(50,28,0,0.75)', 'rgba(120,89,26,0.38)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <AppIcon name="arrow_back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>{language === 'ar' ? 'رصيد المراكز' : 'Centers Balance'}</Text>
          <Text style={styles.heroSub}>{language === 'ar' ? 'رصيدك الموزّع عبر المراكز' : 'Your distributed balances across centers'}</Text>
        </ImageBackground>
        <View style={styles.content}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{language === 'ar' ? 'إجمالي رصيد المراكز' : 'Total centers balance'}</Text>
            <Text style={styles.balanceAmount}>{centersBalance.toFixed(2)} SAR</Text>
          </View>
          <Text style={styles.sectionTitle}>{language === 'ar' ? 'حسب المراكز' : 'By centers'}</Text>
          {grouped.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.storeIcon}><AppIcon name="storefront" size={14} color="#7A4F00" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowHint}>{language === 'ar' ? `${item.count} عمليات` : `${item.count} transactions`}</Text>
              </View>
              <Text style={styles.rowSub}>+{Number(item.total).toFixed(2)} SAR</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8FC' },
  hero: { minHeight: 250, paddingHorizontal: spacing.md, paddingBottom: spacing.lg, justifyContent: 'space-between' },
  heroImage: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.24)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)' },
  heroTitle: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  heroSub: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.92)' },
  content: { padding: spacing.md, marginTop: -36 },
  balanceCard: { borderRadius: 22, borderWidth: 1, borderColor: '#F2E3C3', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md },
  balanceLabel: { fontSize: 12, color: colors.textSecondary },
  balanceAmount: { marginTop: 6, fontSize: 28, fontWeight: '800', color: colors.text },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: { borderRadius: 14, borderWidth: 1, borderColor: '#F2E3C3', backgroundColor: '#FFFFFF', padding: spacing.sm, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  storeIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1D8' },
  rowTitle: { color: colors.text, fontWeight: '700' },
  rowHint: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  rowSub: { color: '#7A4F00', fontSize: 12, fontWeight: '700' }
});
