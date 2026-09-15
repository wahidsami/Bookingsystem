import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    ActivityIndicator, RefreshControl, Platform, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { getEarnings, EarningsSummary } from '../../src/services/financials';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { canViewEarnings } from '../../src/utils/capabilities';
import { formatDateSafe } from '../../src/utils/safeDate';

export default function EarningsScreen() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [data, setData] = useState<EarningsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'processed' | 'draft'>('all');
    const [expandedPayrollId, setExpandedPayrollId] = useState<string | null>(null);
    const earningsAllowed = canViewEarnings(user);

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

    const payrolls = data?.payrolls || [];
    const filteredPayrolls = payrolls.filter((item) => statusFilter === 'all' ? true : item.status === statusFilter);
    const paidCount = payrolls.filter((item) => item.status === 'paid').length;
    const processedCount = payrolls.filter((item) => item.status === 'processed').length;
    const draftCount = payrolls.filter((item) => item.status === 'draft').length;
    const statusOptions: { key: 'all' | 'paid' | 'processed' | 'draft'; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: payrolls.length },
        { key: 'paid', label: 'Paid', count: paidCount },
        { key: 'processed', label: 'Processed', count: processedCount },
        { key: 'draft', label: 'Pending', count: draftCount },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {!earningsAllowed ? (
                <View style={styles.center}>
                    <Ionicons name="lock-closed-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{t('earnings.notEnabledTitle')}</Text>
                    <Text style={styles.emptySub}>{t('earnings.notEnabledSubtitle')}</Text>
                </View>
            ) : loading ? (
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
                    {data.currentMonth ? (
                        <View style={styles.heroCard}>
                            <View style={styles.heroHeader}>
                                <Text style={styles.heroLabel}>{t('earnings.currentCycle')}</Text>
                                <View style={[styles.heroStatusBadge, { backgroundColor: `${statusColor(data.currentMonth.status)}20` }]}>
                                    <Text style={[styles.heroStatusText, { color: statusColor(data.currentMonth.status) }]}>
                                        {t(`earnings.${data.currentMonth.status}`).toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.heroAmount}>{currency(data.currentMonth.totalNet)}</Text>
                            <Text style={styles.heroPeriod}>
                                {formatDateSafe(data.currentMonth.periodStart, 'MMM d')} – {formatDateSafe(data.currentMonth.periodEnd, 'MMM d, yyyy')}
                            </Text>
                        </View>
                    ) : null}

                    {/* Summary Cards */}
                    <View style={styles.cardsRow}>
                        {[
                            { label: t('earnings.totalEarned'), value: currency(data.totals.totalNet), icon: 'cash-outline', color: '#10b981' },
                            { label: t('earnings.commission'), value: currency(data.totals.totalCommission), icon: 'trending-up-outline', color: '#3b82f6' },
                            { label: t('earnings.tips'), value: currency(data.totals.totalTips), icon: 'heart-outline', color: '#f59e0b' },
                            { label: t('earnings.baseSalary'), value: currency(data.totals.totalBase), icon: 'wallet-outline', color: '#8B5ADF' },
                            { label: t('earnings.bonuses'), value: currency(data.totals.totalBonuses), icon: 'sparkles-outline', color: '#10b981' },
                            { label: t('earnings.deductions'), value: currency(data.totals.totalDeductions), icon: 'remove-circle-outline', color: '#ef4444' },
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
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                    >
                        {statusOptions.map((option) => {
                            const active = statusFilter === option.key;
                            return (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[styles.filterChip, active && styles.filterChipActive]}
                                    onPress={() => setStatusFilter(option.key)}
                                >
                                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                        {option.label} ({option.count})
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <Text style={styles.resultsLabel}>
                        Showing {filteredPayrolls.length} of {payrolls.length} payroll records
                    </Text>

                    {filteredPayrolls.length === 0 ? (
                        <View style={styles.emptyFilterState}>
                            <Ionicons name="funnel-outline" size={48} color="#d1d5db" />
                            <Text style={styles.emptyTitle}>{t('earnings.emptyFilterTitle')}</Text>
                            <Text style={styles.emptySub}>{t('earnings.emptyFilterSubtitle')}</Text>
                        </View>
                    ) : filteredPayrolls.map(p => {
                        const expanded = expandedPayrollId === p.id;

                        return (
                            <TouchableOpacity
                                key={p.id}
                                style={styles.paySlip}
                                activeOpacity={0.9}
                                onPress={() => setExpandedPayrollId(expanded ? null : p.id)}
                            >
                                <View style={styles.paySlipHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.payPeriod}>
                                            {formatDateSafe(p.periodStart, 'MMM d')} – {formatDateSafe(p.periodEnd, 'MMM d, yyyy')}
                                        </Text>
                                        <Text style={styles.payCreatedAt}>
                                            Added {formatDateSafe(p.createdAt, 'MMM d, yyyy')}
                                        </Text>
                                    </View>
                                    <View style={styles.paySlipHeaderRight}>
                                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor(p.status)}20` }]}>
                                            <Text style={[styles.statusText, { color: statusColor(p.status) }]}>{t(`earnings.${p.status}`).toUpperCase()}</Text>
                                        </View>
                                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" style={{ marginTop: 8 }} />
                                    </View>
                                </View>

                                <View style={styles.paySlipTopline}>
                                    <View>
                                        <Text style={styles.toplineLabel}>{t('earnings.netPay')}</Text>
                                        <Text style={styles.toplineValue}>{currency(p.totalNet)}</Text>
                                    </View>
                                    <View style={styles.toplineMiniStats}>
                                        <Text style={styles.toplineMiniText}>Base {currency(p.baseSalary)}</Text>
                                        <Text style={styles.toplineMiniText}>Tips {currency(p.tipsTotal)}</Text>
                                    </View>
                                </View>

                                {expanded ? (
                                    <>
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
                                        <View style={styles.paySlipRow}>
                                            <Text style={styles.paySlipLabel}>{t('earnings.bonuses')}</Text>
                                            <Text style={[styles.paySlipValue, { color: p.bonuses > 0 ? '#10b981' : '#374151' }]}>
                                                {p.bonuses > 0 ? '+' : ''}{currency(p.bonuses)}
                                            </Text>
                                        </View>
                                        <View style={styles.paySlipRow}>
                                            <Text style={styles.paySlipLabel}>{t('earnings.deductions')}</Text>
                                            <Text style={[styles.paySlipValue, { color: p.deductions > 0 ? '#ef4444' : '#374151' }]}>
                                                {p.deductions > 0 ? '-' : ''}{currency(p.deductions)}
                                            </Text>
                                        </View>
                                        <View style={[styles.paySlipRow, styles.payTotal]}>
                                            <Text style={styles.payTotalLabel}>{t('earnings.netPay')}</Text>
                                            <Text style={styles.payTotalValue}>{currency(p.totalNet)}</Text>
                                        </View>
                                    </>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#4b5563', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
    heroCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    heroLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    heroStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    heroStatusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    heroAmount: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 6,
    },
    heroPeriod: {
        fontSize: 14,
        color: '#6b7280',
    },
    cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24, justifyContent: 'space-between' },
    summaryCard: {
        width: '48%', backgroundColor: '#fff', borderRadius: 16, padding: 14,
        alignItems: 'center', shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    cardValue: { fontSize: 15, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
    cardLabel: { fontSize: 11, color: '#6b7280', textAlign: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
    filterRow: {
        paddingBottom: 10,
        gap: 10,
        marginBottom: 6,
    },
    filterChip: {
        backgroundColor: '#ffffff',
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    filterChipActive: {
        backgroundColor: '#ede9fe',
        borderColor: '#8B5ADF',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4b5563',
    },
    filterChipTextActive: {
        color: '#6d28d9',
    },
    resultsLabel: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 14,
    },
    paySlip: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    paySlipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    paySlipHeaderRight: { alignItems: 'flex-end' },
    payPeriod: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
    payCreatedAt: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: 'bold' },
    paySlipTopline: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8f5ff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    toplineLabel: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    toplineValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#6d28d9',
    },
    toplineMiniStats: {
        alignItems: 'flex-end',
    },
    toplineMiniText: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 2,
    },
    paySlipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    paySlipLabel: { fontSize: 14, color: '#6b7280' },
    paySlipValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
    payTotal: { borderBottomWidth: 0, marginTop: 6, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#e5e7eb' },
    payTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    payTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#8B5ADF' },
    emptyFilterState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 36,
    },
});
