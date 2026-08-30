import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { formatRiyal } from '../utils/currency';
import { api, Order } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export function PurchaseDetailsScreen({ route, navigation }: any) {
    const { isRTL, language } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();
    
    const purchaseId = route.params?.purchaseId || null;
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!purchaseId) {
            setLoading(false);
            return;
        }

        api.getOrder(purchaseId)
            .then(setOrder)
            .catch((err) => {
                console.error('Failed to load purchase:', err);
            })
            .finally(() => setLoading(false));
    }, [purchaseId]);

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!order) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text>{isRTL ? 'تعذر تحميل التفاصيل.' : 'Could not load details.'}</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary }}>{isRTL ? 'عودة' : 'Go Back'}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const dateDate = new Date(order.createdAt);
    const dateStr = format(dateDate, 'eeee, d MMMM yyyy - p', { locale: isRTL ? ar : enUS });

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: topInset + spacing.md }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <AppIcon name={isRTL ? "arrow_forward" : "arrow_back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isRTL ? 'تفاصيل الطلب' : 'Purchase Details'}</Text>
                <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding + 32 }]}>
                <View style={styles.heroCard}>
                    <View style={styles.heroIcon}>
                        <AppIcon name="purchases" size={30} color={colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>#{order.orderNumber || order.id.slice(0,8).toUpperCase()}</Text>
                    <Text style={styles.heroSubtitle}>
                        {dateStr}
                    </Text>
                </View>

                <View style={styles.summaryCard}>
                    <Text style={styles.sectionTitle}>{isRTL ? 'العناصر' : 'Items'}</Text>
                    {order.items?.map((orderItem, index) => {
                        const itemName = isRTL 
                            ? (orderItem.Product?.name_ar || orderItem.product?.name_ar) 
                            : (orderItem.Product?.name_en || orderItem.product?.name_en);
                        return (
                            <View key={index} style={styles.itemRow}>
                                <Text style={styles.itemName}>• {itemName}</Text>
                                <Text style={styles.itemQty}>x{orderItem.quantity}</Text>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.summaryCard}>
                    <Text style={styles.sectionTitle}>{isRTL ? 'الملخص المالي' : 'Payment summary'}</Text>
                    <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>{isRTL ? 'المجموع' : 'Total'}</Text>
                        <Text style={styles.amountValue}>{formatRiyal(Number(order.totalAmount || 0), isRTL ? 'ar' : 'en')}</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F4FF',
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: '#F7F4FF',
    },
    backButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    content: {
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
    },
    heroCard: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: '#EAE1FA',
        shadowColor: '#241444',
        shadowOpacity: 0.06,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 2,
        marginTop: spacing.md,
    },
    heroIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F4EEFF',
        marginBottom: spacing.md,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: colors.text,
        textAlign: 'center',
    },
    heroSubtitle: {
        marginTop: 8,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#EAE1FA',
        padding: spacing.lg,
        gap: spacing.sm,
    },
    sectionTitle: {
        fontSize: fontSize.xs,
        fontWeight: '900',
        letterSpacing: 0.6,
        color: colors.primary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    itemName: {
        fontSize: 14,
        color: colors.text,
        flex: 1,
    },
    itemQty: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '600',
        marginLeft: spacing.sm,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    amountLabel: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    amountValue: {
        flex: 1,
        fontSize: fontSize.md,
        fontWeight: '900',
        color: colors.primary,
        textAlign: 'right',
    },
});
