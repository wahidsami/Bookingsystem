import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    ActivityIndicator, RefreshControl, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getEarnings, EarningsSummary } from '../../src/services/financials';
import { format } from 'date-fns';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function EarningsScreen() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [data, setData] = useState<EarningsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        try {
            const result = await getEarnings();
            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

    const currency = (n: number) => `SAR ${Number(n).toFixed(2)}`;

    const statusColor = (s: string) => {
        if (s === 'paid') return '#10b981';
        if (s === 'processed') return '#3b82f6';
        return '#f59e0b';
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <Text style={styles.headerTitle}>{t('earnings.title')}</Text>
            </LinearGradient>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#8B5ADF" /></View>
            ) : !data || data.payrolls.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="wallet-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{t('earnings.noPayroll')}</Text>
                    <Text style={styles.emptySub}>{t('earnings.noPayrollSub')}</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={['#8B5ADF']} />}
                >
                    {/* Summary Cards */}
                    <View style={styles.cardsRow}>
                        {[
                            { label: t('earnings.totalEarned'), value: currency(data.totals.totalNet), icon: 'cash-outline', color: '#10b981' },
                            { label: t('earnings.commission'), value: currency(data.totals.totalCommission), icon: 'trending-up-outline', color: '#3b82f6' },
                            { label: t('earnings.tips'), value: currency(data.totals.totalTips), icon: 'heart-outline', color: '#f59e0b' },
                        ].map(card => (
                            <View key={card.label} style={styles.summaryCard}>
                                <Ionicons name={card.icon as any} size={22} color={card.color} />
                                <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
                                <Text style={styles.cardLabel}>{card.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Pay History */}
                    <Text style={styles.sectionTitle}>{t('earnings.payHistory')}</Text>
                    {data.payrolls.map(p => (
                        <View key={p.id} style={styles.paySlip}>
                            <View style={styles.paySlipHeader}>
                                <Text style={styles.payPeriod}>
                                    {format(new Date(p.periodStart), 'MMM d')} – {format(new Date(p.periodEnd), 'MMM d, yyyy')}
                                </Text>
                                <View style={[styles.statusBadge, { backgroundColor: `${statusColor(p.status)}20` }]}>
                                    <Text style={[styles.statusText, { color: statusColor(p.status) }]}>{t(`earnings.${p.status}`).toUpperCase()}</Text>
                                </View>
                            </View>
                            <View style={styles.paySlipRow}>
                                <Text style={styles.paySlipLabel}>{t('earnings.baseSalary')}</Text>
                                <Text style={styles.paySlipValue}>{currency(p.baseSalary)}</Text>
                            </View>
                            <View style={styles.paySlipRow}>
                                <Text style={styles.paySlipLabel}>{t('earnings.commission')}</Text>
                                <Text style={styles.paySlipValue}>{currency(p.commission)}</Text>
                            </View>
                            <View style={styles.paySlipRow}>
                                <Text style={styles.paySlipLabel}>{t('earnings.tips')}</Text>
                                <Text style={styles.paySlipValue}>{currency(p.tipsTotal)}</Text>
                            </View>
                            {p.bonuses > 0 && (
                                <View style={styles.paySlipRow}>
                                    <Text style={styles.paySlipLabel}>{t('earnings.bonuses')}</Text>
                                    <Text style={[styles.paySlipValue, { color: '#10b981' }]}>+{currency(p.bonuses)}</Text>
                                </View>
                            )}
                            {p.deductions > 0 && (
                                <View style={styles.paySlipRow}>
                                    <Text style={styles.paySlipLabel}>{t('earnings.deductions')}</Text>
                                    <Text style={[styles.paySlipValue, { color: '#ef4444' }]}>-{currency(p.deductions)}</Text>
                                </View>
                            )}
                            <View style={[styles.paySlipRow, styles.payTotal]}>
                                <Text style={styles.payTotalLabel}>{t('earnings.netPay')}</Text>
                                <Text style={styles.payTotalValue}>{currency(p.totalNet)}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#4b5563', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
    cardsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    summaryCard: {
        flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14,
        alignItems: 'center', shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    cardValue: { fontSize: 15, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
    cardLabel: { fontSize: 11, color: '#6b7280', textAlign: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
    paySlip: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    paySlipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    payPeriod: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: 'bold' },
    paySlipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    paySlipLabel: { fontSize: 14, color: '#6b7280' },
    paySlipValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
    payTotal: { borderBottomWidth: 0, marginTop: 6, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#e5e7eb' },
    payTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    payTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#8B5ADF' },
});
