import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { api } from '../api/client';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { LinearGradient } from 'expo-linear-gradient';

export function WalletBalanceDetailsScreen({ navigation, route }: any) {
    const { language, isRTL } = useLanguage();
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
            const tenantId = route?.params?.tenantId;
            if (!tenantId) {
                // No tenant context: navigate to the tenant-scoped Gifts & Wallet hub
                navigation.replace('Gifts');
                return;
            }

            try {
                const res = await api.getTenantWallet(tenantId).catch(() => null);
                if (cancelled) return;
                if (res?.success) {
                    setWalletBalance(Number(res.balance || 0));
                    setHistory(Array.isArray(res.ledger) ? res.ledger : []);
                } else {
                    setWalletBalance(Number(route?.params?.walletBalance || 0));
                    setHistory(hasRouteHistory ? route.params.history : []);
                }
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
    }, [hasRouteWalletBalance, hasRouteHistory, route?.params?.walletBalance, route?.params?.history, route?.params?.tenantId]);

    if (loading) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader
                    title={language === 'ar' ? 'رصيد BarSpa' : 'BarSpa Balance'}
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
                title={language === 'ar' ? 'رصيد BarSpa' : 'BarSpa Balance'}
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
                {/* 1. Wallet Balance Hero Card */}
                <LinearGradient
                    colors={['#6537C0', '#4C1D95']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroBalanceCard}
                >
                    <View style={[styles.heroIconWrap, isRTL && styles.rowRTL]}>
                        <View style={styles.heroIconCircle}>
                            <AppIcon name="wallet" size={20} color="#FFFFFF" />
                        </View>
                        <Text style={styles.heroBalanceLabel}>
                            {language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}
                        </Text>
                    </View>

                    <Text style={[styles.heroBalanceAmount, isRTL && styles.textRTL]}>
                        {formatRiyal(walletBalance, language)}
                    </Text>

                    <Text style={[styles.heroBalanceSub, isRTL && styles.textRTL]}>
                        {language === 'ar'
                            ? 'رصيدك المتاح للاستخدام في جميع حجوزات الخدمات والمشتريات'
                            : 'Your available balance for all bookings and product purchases'}
                    </Text>
                </LinearGradient>

                {/* 2. Recent Transactions Section */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {language === 'ar' ? 'آخر النشاطات' : 'Recent Activity'}
                    </Text>
                </View>

                {history.length > 0 ? (
                    <View style={styles.groupCard}>
                        {history.map((item: any, index: number) => {
                            const isLast = index === history.length - 1;
                            const formattedDate = item.createdAt
                                ? new Date(item.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')
                                : '-';

                            return (
                                <View
                                    key={item.id || index}
                                    style={[
                                        styles.transactionRow,
                                        !isLast && styles.rowDivider,
                                        isRTL && styles.rowRTL,
                                    ]}
                                >
                                    <View style={styles.transactionIconCircle}>
                                        <AppIcon name="receipt_long" size={18} color="#6537C0" />
                                    </View>
                                    <View style={[styles.transactionMeta, isRTL && styles.alignRTL]}>
                                        <Text style={[styles.transactionTitle, isRTL && styles.textRTL]}>
                                            {item.status || (language === 'ar' ? 'عملية محفظة' : 'Wallet Transaction')}
                                        </Text>
                                        <Text style={[styles.transactionSub, isRTL && styles.textRTL]}>
                                            {formattedDate}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyCard}>
                        <AppIcon name="receipt_long" size={40} color="#C4B5FD" />
                        <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
                            {language === 'ar'
                                ? 'لا توجد حركات حديثة في المحفظة.'
                                : 'No recent activity in wallet.'}
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
    transactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#F5F0FF',
    },
    transactionIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    transactionMeta: {
        flex: 1,
        marginHorizontal: 12,
    },
    transactionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    transactionSub: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        marginTop: 2,
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
