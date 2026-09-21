import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { api } from '../api/client';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { LinearGradient } from 'expo-linear-gradient';

export function CentersBalanceScreen({ navigation, route }: any) {
    const { language, isRTL } = useLanguage();
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
                const computedSum = balances.reduce((sum, entry) => sum + Number(entry.balance || 0), 0);
                setCentersBalance(hasRouteCentersBalance ? Number(route?.params?.centersBalance || 0) : computedSum);
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
            <View style={styles.container}>
                <CustomerSubpageHeader
                    title={language === 'ar' ? 'رصيد المراكز' : 'Centers Balance'}
                    onBack={() => navigation.goBack()}
                />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#6537C0" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={language === 'ar' ? 'رصيد المراكز' : 'Centers Balance'}
                onBack={() => navigation.goBack()}
            />

            <ScrollView
                contentContainerStyle={{
                    paddingTop: 16,
                    paddingHorizontal: 16,
                    paddingBottom: scrollBottomPadding + 24,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Balance Hero Card */}
                <LinearGradient
                    colors={['#6537C0', '#4C1D95']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroBalanceCard}
                >
                    <View style={[styles.heroIconWrap, isRTL && styles.rowRTL]}>
                        <View style={styles.heroIconCircle}>
                            <AppIcon name="storefront" size={20} color="#FFFFFF" />
                        </View>
                        <Text style={styles.heroBalanceLabel}>
                            {language === 'ar' ? 'إجمالي رصيد المراكز' : 'Total Centers Balance'}
                        </Text>
                    </View>

                    <Text style={[styles.heroBalanceAmount, isRTL && styles.textRTL]}>
                        {formatRiyal(centersBalance, language)}
                    </Text>

                    <Text style={[styles.heroBalanceSub, isRTL && styles.textRTL]}>
                        {language === 'ar'
                            ? 'رصيدك المتاح الموزّع عبر المراكز والصالونات الشريكة'
                            : 'Your available balance distributed across partner salons'}
                    </Text>
                </LinearGradient>

                {/* 2. Breakdown Section */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {language === 'ar' ? 'حسب المراكز' : 'By Centers'}
                    </Text>
                </View>

                {grouped.length > 0 ? (
                    <View style={styles.groupCard}>
                        {grouped.map((item, index) => {
                            const isLast = index === grouped.length - 1;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.centerRow,
                                        !isLast && styles.rowDivider,
                                        isRTL && styles.rowRTL,
                                    ]}
                                    onPress={() =>
                                        navigation.navigate('TenantWalletDetails', {
                                            tenantId: item.id,
                                            tenantName: item.name,
                                            balance: item.total,
                                        })
                                    }
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.centerIconCircle}>
                                        <AppIcon name="storefront" size={18} color="#6537C0" />
                                    </View>
                                    <View style={[styles.centerMeta, isRTL && styles.alignRTL]}>
                                        <Text style={[styles.centerTitle, isRTL && styles.textRTL]}>
                                            {item.name}
                                        </Text>
                                        <Text style={[styles.centerHint, isRTL && styles.textRTL]}>
                                            {language === 'ar' ? 'عرض تفاصيل وسجل المحفظة' : 'View wallet & ledger details'}
                                        </Text>
                                    </View>
                                    <Text style={styles.centerAmount}>
                                        +{formatRiyal(Number(item.total), language)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyCard}>
                        <AppIcon name="storefront" size={40} color="#C4B5FD" />
                        <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
                            {language === 'ar'
                                ? 'لا توجد أرصدة موزعة عبر المراكز حالياً.'
                                : 'No distributed balances across centers yet.'}
                        </Text>
                    </View>
                )}
            </ScrollView>
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
    alignRTL: {
        alignItems: 'flex-end',
    },
    textRTL: {
        textAlign: 'right',
    },
    heroBalanceCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 4,
    },
    heroIconWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    heroIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroBalanceLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: 'Cairo-Bold',
    },
    heroBalanceAmount: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
        marginBottom: 8,
    },
    heroBalanceSub: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.85)',
        fontFamily: 'Cairo-Regular',
        lineHeight: 18,
    },
    sectionHeaderRow: {
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7C3AED',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontFamily: 'Cairo-Bold',
    },
    groupCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        overflow: 'hidden',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    centerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#F5F0FF',
    },
    centerIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerMeta: {
        flex: 1,
        marginHorizontal: 12,
    },
    centerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    centerHint: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        marginTop: 2,
    },
    centerAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#10B981',
        fontFamily: 'Cairo-Bold',
    },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 13,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        textAlign: 'center',
    },
});
