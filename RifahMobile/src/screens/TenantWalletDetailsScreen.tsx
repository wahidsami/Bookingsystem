import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';
import { api } from '../api/client';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity } from 'react-native';
import { TenantWalletRechargeModal } from '../components/TenantWalletRechargeModal';

export function TenantWalletDetailsScreen({ navigation, route }: any) {
    const { language, isRTL } = useLanguage();
    const { scrollBottomPadding } = useScreenSafeArea();

    const tenantId: string = route?.params?.tenantId || '';
    const initialTenantName: string = route?.params?.tenantName || (language === 'ar' ? 'الصالون' : 'Salon');
    const tenantLogo: string | null = route?.params?.tenantLogo || null;
    const tenantAddress: string | null = route?.params?.tenantAddress || null;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [balance, setBalance] = useState<number>(Number(route?.params?.balance || 0));
    const [ledger, setLedger] = useState<Array<any>>([]);
    const [rechargeModalVisible, setRechargeModalVisible] = useState(false);

    const loadData = async () => {
        if (!tenantId) return;
        try {
            const res = await api.getTenantWallet(tenantId, 50);
            if (res.success) {
                setBalance(Number(res.balance || 0));
                setLedger(Array.isArray(res.ledger) ? res.ledger : []);
            }
        } catch (error) {
            console.warn('Failed to load tenant wallet details:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [tenantId]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const getTransactionTypeLabel = (type: string) => {
        const key = `${type || ''}`.trim().toLowerCase();
        if (language === 'ar') {
            if (key === 'tenant_wallet_card_recharge') return 'شحن بطاقة بنكية';
            if (key === 'tenant_wallet_card_recharge_refund') return 'استرجاع شحن بطاقة';
            if (key === 'tenant_gift_credit') return 'إيداع بطاقة هدية';
            if (key === 'tenant_gift_redeem_debit') return 'دفع حجز / طلب';
            if (key === 'tenant_gift_refund_credit') return 'استرجاع رصيد';
            if (key === 'tenant_gift_admin_adjustment') return 'تعديل إداري';
            return 'حركة رصيد';
        }
        if (key === 'tenant_wallet_card_recharge') return 'Card Recharge';
        if (key === 'tenant_wallet_card_recharge_refund') return 'Card Recharge Refund';
        if (key === 'tenant_gift_credit') return 'Gift Card Credit';
        if (key === 'tenant_gift_redeem_debit') return 'Booking / Order Payment';
        if (key === 'tenant_gift_refund_credit') return 'Refund Restored';
        if (key === 'tenant_gift_admin_adjustment') return 'Admin Adjustment';
        return 'Wallet Transaction';
    };

    const formatDateTime = (value?: string) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Extract traceable balance credit sources from ledger
    const creditSources = ledger.filter((entry) => entry.direction === 'credit');

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={initialTenantName}
                onBack={() => navigation.goBack()}
            />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#6537C0" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{
                        paddingTop: 16,
                        paddingHorizontal: 16,
                        paddingBottom: scrollBottomPadding + 28,
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6537C0']} />
                    }
                >
                    {/* 1. Tenant Identity & Exclusive Balance Card */}
                    <LinearGradient
                        colors={['#6537C0', '#1D035F']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroCard}
                    >
                        <View style={[styles.tenantHeaderRow, isRTL && styles.rowRTL]}>
                            {tenantLogo ? (
                                <Image source={{ uri: tenantLogo }} style={styles.tenantLogoImage} resizeMode="cover" />
                            ) : (
                                <View style={styles.tenantLogoFallback}>
                                    <Text style={styles.tenantLogoText}>
                                        {initialTenantName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View style={[styles.tenantInfoCol, isRTL && styles.alignRTL]}>
                                <Text style={[styles.tenantNameTitle, isRTL && styles.textRTL]} numberOfLines={1}>
                                    {initialTenantName}
                                </Text>
                                {!!tenantAddress && (
                                    <Text style={[styles.tenantAddressText, isRTL && styles.textRTL]} numberOfLines={1}>
                                        {tenantAddress}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.heroDivider} />

                        <View style={[styles.balanceInfoWrap, isRTL && styles.alignRTL]}>
                            <Text style={[styles.balanceLabel, isRTL && styles.textRTL]}>
                                {language === 'ar' ? 'الرصيد المتاح لدى هذا الصالون' : 'Available Balance at this Salon'}
                            </Text>
                            <Text style={[styles.balanceAmount, isRTL && styles.textRTL]}>
                                {formatRiyal(balance, language)}
                            </Text>
                            <View style={[styles.disclaimerPill, isRTL && styles.rowRTL]}>
                                <AppIcon name="lock" size={13} color="#FFFFFF" />
                                <Text style={styles.disclaimerPillText}>
                                    {language === 'ar'
                                        ? 'مخصص للاستخدام لدى هذا الصالون فقط'
                                        : 'Usable exclusively at this salon'}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.heroRechargeBtn, isRTL && styles.rowRTL]}
                                onPress={() => setRechargeModalVisible(true)}
                                activeOpacity={0.88}
                            >
                                <AppIcon name="card" size={16} color="#6537C0" />
                                <Text style={styles.heroRechargeBtnText}>
                                    {language === 'ar' ? 'شحن رصيد الصالون' : 'Recharge Salon Balance'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    {/* 2. Traceable Balance Sources Section */}
                    <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                        <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                            {language === 'ar' ? 'مصادر الرصيد الموثقة' : 'Verified Balance Sources'}
                        </Text>
                    </View>

                    {creditSources.length > 0 ? (
                        <View style={styles.cardGroup}>
                            {creditSources.slice(0, 5).map((src: any, idx: number) => {
                                const isLast = idx === Math.min(creditSources.length, 5) - 1;
                                const refNumber = src.referenceId ? `#${src.referenceId.slice(0, 10).toUpperCase()}` : null;
                                return (
                                    <View
                                        key={src.id || idx}
                                        style={[
                                            styles.sourceRow,
                                            !isLast && styles.rowDivider,
                                            isRTL && styles.rowRTL,
                                        ]}
                                    >
                                        <View style={styles.sourceIconCircle}>
                                            <AppIcon name="card_giftcard" size={18} color="#6537C0" />
                                        </View>
                                        <View style={[styles.sourceMeta, isRTL && styles.alignRTL]}>
                                            <Text style={[styles.sourceTitle, isRTL && styles.textRTL]}>
                                                {getTransactionTypeLabel(src.type)}
                                            </Text>
                                            <Text style={[styles.sourceDate, isRTL && styles.textRTL]}>
                                                {formatDateTime(src.createdAt)}
                                                {refNumber ? ` • ${refNumber}` : ''}
                                            </Text>
                                        </View>
                                        <Text style={[styles.sourceAmount, isRTL && styles.textRTL]}>
                                            {formatRiyal(Number(src.amount || 0), language, '+')}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={styles.emptyCard}>
                            <AppIcon name="receipt_long" size={32} color="#C4B5FD" />
                            <Text style={[styles.emptyCardText, isRTL && styles.textRTL]}>
                                {language === 'ar'
                                    ? 'لا توجد بطاقات أو إيداعات مسجلة حالياً.'
                                    : 'No balance credit records found.'}
                            </Text>
                        </View>
                    )}

                    {/* 3. Spending History / Ledger Section */}
                    <View style={[styles.sectionHeaderRow, { marginTop: 24 }, isRTL && styles.rowRTL]}>
                        <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                            {language === 'ar' ? 'سجل العمليات والمصروفات' : 'Transaction & Spending Ledger'}
                        </Text>
                    </View>

                    {ledger.length > 0 ? (
                        <View style={styles.cardGroup}>
                            {ledger.map((item: any, index: number) => {
                                const isLast = index === ledger.length - 1;
                                const isCredit = item.direction === 'credit';
                                const sign = isCredit ? '+' : '-';
                                const refId = item.referenceId
                                    ? `${item.referenceType === 'appointment' ? (language === 'ar' ? 'حجز: ' : 'Booking: ') : ''}#${item.referenceId.slice(0, 8).toUpperCase()}`
                                    : null;

                                return (
                                    <View
                                        key={item.id || index}
                                        style={[
                                            styles.ledgerRow,
                                            !isLast && styles.rowDivider,
                                            isRTL && styles.rowRTL,
                                        ]}
                                    >
                                        <View style={[styles.ledgerIconCircle, isCredit ? styles.ledgerIconCredit : styles.ledgerIconDebit]}>
                                            <AppIcon
                                                name={isCredit ? 'plus' : 'minus'}
                                                size={16}
                                                color={isCredit ? '#0F8A4B' : '#E53935'}
                                            />
                                        </View>

                                        <View style={[styles.ledgerMeta, isRTL && styles.alignRTL]}>
                                            <Text style={[styles.ledgerTitle, isRTL && styles.textRTL]}>
                                                {getTransactionTypeLabel(item.type)}
                                            </Text>
                                            <Text style={[styles.ledgerDate, isRTL && styles.textRTL]}>
                                                {formatDateTime(item.createdAt)}
                                                {refId ? ` • ${refId}` : ''}
                                            </Text>
                                            <Text style={[styles.ledgerBalanceAudit, isRTL && styles.textRTL]}>
                                                {language === 'ar'
                                                    ? `قبل: ${formatRiyal(Number(item.balanceBefore || 0), language)}  ←  بعد: ${formatRiyal(Number(item.balanceAfter || 0), language)}`
                                                    : `Before: ${formatRiyal(Number(item.balanceBefore || 0), language)}  →  After: ${formatRiyal(Number(item.balanceAfter || 0), language)}`}
                                            </Text>
                                        </View>

                                        <Text
                                            style={[
                                                styles.ledgerAmount,
                                                isCredit ? styles.amountCredit : styles.amountDebit,
                                                isRTL && styles.textRTL,
                                            ]}
                                        >
                                            {formatRiyal(Number(item.amount || 0), language, sign)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={styles.emptyCard}>
                            <AppIcon name="receipt_long" size={32} color="#C4B5FD" />
                            <Text style={[styles.emptyCardText, isRTL && styles.textRTL]}>
                                {language === 'ar'
                                    ? 'لا توجد حركات مسجلة لهذا الصالون بعد.'
                                    : 'No transaction ledger entries recorded yet.'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Direct Card Recharge Modal (Sprint 3A) */}
            <TenantWalletRechargeModal
                visible={rechargeModalVisible}
                onClose={() => setRechargeModalVisible(false)}
                targetTenantId={tenantId}
                targetTenantName={initialTenantName}
                onSuccess={() => {
                    loadData();
                }}
            />
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
    textRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    alignRTL: {
        alignItems: 'flex-end',
    },
    heroCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    tenantHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tenantLogoImage: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
    },
    tenantLogoFallback: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tenantLogoText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'Cairo-Bold',
    },
    tenantInfoCol: {
        flex: 1,
        marginHorizontal: 12,
    },
    tenantNameTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    tenantAddressText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        marginTop: 2,
        fontFamily: 'Cairo-Regular',
    },
    heroDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginVertical: 14,
    },
    balanceInfoWrap: {
        alignItems: 'flex-start',
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontWeight: '500',
        fontFamily: 'Cairo-Medium',
        marginBottom: 4,
    },
    balanceAmount: {
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: '800',
        fontFamily: 'Cairo-Bold',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    disclaimerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 6,
    },
    disclaimerPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
        fontFamily: 'Cairo-Medium',
    },
    heroRechargeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 18,
        marginTop: 14,
        width: '100%',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
    },
    heroRechargeBtnText: {
        color: '#6537C0',
        fontSize: 14,
        fontWeight: '800',
        fontFamily: 'Cairo-Bold',
    },
    sectionHeaderRow: {
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    cardGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    sourceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    sourceIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sourceMeta: {
        flex: 1,
        marginHorizontal: 12,
    },
    sourceTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-SemiBold',
    },
    sourceDate: {
        fontSize: 11,
        color: '#716B88',
        marginTop: 2,
        fontFamily: 'Cairo-Regular',
    },
    sourceAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F8A4B',
        fontFamily: 'Cairo-Bold',
    },
    ledgerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#F0EAFB',
    },
    ledgerIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ledgerIconCredit: {
        backgroundColor: '#E8F5E9',
    },
    ledgerIconDebit: {
        backgroundColor: '#FFEBEE',
    },
    ledgerMeta: {
        flex: 1,
        marginHorizontal: 12,
    },
    ledgerTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-SemiBold',
    },
    ledgerDate: {
        fontSize: 11,
        color: '#716B88',
        marginTop: 2,
        fontFamily: 'Cairo-Regular',
    },
    ledgerBalanceAudit: {
        fontSize: 10,
        color: '#9C92B5',
        marginTop: 3,
        fontFamily: 'Cairo-Regular',
    },
    ledgerAmount: {
        fontSize: 13,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    amountCredit: {
        color: '#0F8A4B',
    },
    amountDebit: {
        color: '#E53935',
    },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        gap: 8,
    },
    emptyCardText: {
        fontSize: 13,
        color: '#716B88',
        textAlign: 'center',
        fontFamily: 'Cairo-Regular',
    },
});
