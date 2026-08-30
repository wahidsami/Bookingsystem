import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Alert,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { api, Order, getImageUrl } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { GuestView } from '../components/GuestView';
import { useAppSession } from '../contexts/AppSessionContext';
import { useFocusEffect } from '@react-navigation/native';
import { orderNeedsPayment } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';

export function PurchasesScreen({ navigation, route }: any) {
    const { t, language } = useLanguage();
    const isRTL = language === 'ar';
    const { showLogin, isAuthenticated } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const deepLinkOrderId = `${route?.params?.orderId || ''}`.trim();

    const loadOrders = React.useCallback(async () => {
        try {
            setLoading(true);
            if (!isAuthenticated) {
                return;
            }
            const data = await api.getOrders();
            setOrders(data);
            if (deepLinkOrderId) {
                const matchedOrder = data.find((item) => item.id === deepLinkOrderId || item.orderNumber === deepLinkOrderId);
                if (matchedOrder) {
                    setExpandedOrderId(matchedOrder.id);
                }
            }
        } catch (error: any) {
            if (error.status === 401 || error.message?.includes('unauthorized') || error.message?.includes('Invalid or expired token')) {
                showLogin();
            } else {
                console.error('Failed to load orders:', error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [deepLinkOrderId, isAuthenticated, showLogin]);

    useFocusEffect(
        React.useCallback(() => {
            loadOrders();
        }, [loadOrders])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadOrders();
    };

    const handleCancel = async (id: string) => {
        Alert.alert(
            t('cancelOrder'),
            t('cancelOrderConfirm'),
            [
                { text: t('no'), style: 'cancel' },
                {
                    text: t('yes'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await api.cancelOrder(id);
                            if (success) {
                                loadOrders();
                                Alert.alert(t('success'), t('orderCancelled'));
                            }
                        } catch (error) {
                            Alert.alert(t('error'), t('failedToCancelOrder'));
                        }
                    },
                },
            ]
        );
    };

    const renderOrderCard = ({ item }: { item: Order }) => {
        const isArabic = language === 'ar';
        const dateDate = new Date(item.createdAt);
        const isExpanded = expandedOrderId === item.id;
        const visibleItems = isExpanded ? item.items : item.items.slice(0, 1);

        const firstItem = item.items[0];
        const firstItemName = firstItem 
            ? (isArabic ? firstItem.Product?.name_ar || firstItem.product?.name_ar : firstItem.Product?.name_en || firstItem.product?.name_en)
            : '';
        const extraItemsCount = item.items.length - 1;
        const titleStr = extraItemsCount > 0 
            ? `${firstItemName} (+ ${extraItemsCount} ${t('moreItems')})`
            : firstItemName;

        const dateStr = format(dateDate, 'd MMM yyyy', { locale: isArabic ? ar : enUS });

        return (
            <TouchableOpacity
                activeOpacity={0.95}
                style={[styles.card, styles.compactCard]}
                onPress={() => navigation.navigate('PurchaseDetails', { purchaseId: item.id })}
            >
                {/* Header: Tenant Info & Status (Compact for both) */}
                <View style={[styles.cardHeader, styles.compactCardHeader]}>
                    <View style={styles.salonInfo}>
                        {item.tenant?.logo ? (
                            <Image
                                source={{ uri: getImageUrl(item.tenant.logo) }}
                                style={styles.salonLogo}
                            />
                        ) : (
                            <View style={[styles.salonLogo, styles.placeholderLogo]}>
                                <Text style={styles.placeholderText}>
                                    {item.tenant?.name?.charAt(0) || 'S'}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.salonName} numberOfLines={1}>{item.tenant?.name || 'Store Name'}</Text>
                    </View>
                    <View style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) + '20' }
                    ]}>
                        <Text style={[
                            styles.statusText,
                            { color: getStatusColor(item.status) }
                        ]}>
                            {getStatusText(item.status, language)}
                        </Text>
                    </View>
                </View>

                {/* COMPACT VIEW */}
                <View style={styles.compactBody}>
                    <Text style={styles.compactTitle} numberOfLines={2}>{titleStr}</Text>
                    <View style={styles.compactFooterRow}>
                        <View style={styles.compactDateTimeRow}>
                            <AppIcon name="clock" size={14} color={colors.primary} />
                            <Text style={styles.dateTimeText}>{dateStr}</Text>
                        </View>
                        <Text style={styles.compactPrice}>{formatRiyal(Number(item.totalAmount || 0), isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <Text style={[styles.viewDetailsText, { marginTop: spacing.md }]}>
                        {isArabic ? 'عرض التفاصيل' : 'View Details'}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (!isAuthenticated && !loading) {
        return (
            <>
                <LinearGradient
                    colors={['#F5F0FF', '#FFFFFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.header, { paddingTop: spacing.xl + topInset }]}
                >
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <AppIcon name={language === 'ar' ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('myPurchases' as any)}</Text>
                </LinearGradient>
                <GuestView
                    type="orders"
                    onLoginPress={showLogin}
                />
            </>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#F5F0FF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: spacing.xl + topInset }]}
            >
                {/* Back Button */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <AppIcon name={language === 'ar' ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('myPurchases')}</Text>
            </LinearGradient>

            {/* List */}
            {orders.length > 0 ? (
                <FlatList
                    data={orders}
                    renderItem={renderOrderCard}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPadding }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <AppIcon name="purchases" size={64} color={colors.textSecondary} />
                    <Text style={styles.emptyText}>{t('noOrders')}</Text>
                    <TouchableOpacity
                        style={styles.bookButton}
                        onPress={handleRefresh}
                    >
                        <Text style={styles.bookButtonText}>{t('refresh')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}
        </View>
    );
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'delivered': return colors.success;
        case 'shipped': return colors.info;
        case 'processing': return colors.primary;
        case 'pending': return colors.warning;
        case 'cancelled': return colors.error;
        default: return colors.textSecondary;
    }
};

const getStatusText = (status: string, language: 'ar' | 'en') => {
    const normalized = `${status || ''}`.trim().toLowerCase();
    if (language === 'ar') {
        switch (normalized) {
            case 'pending': return 'قيد الانتظار';
            case 'confirmed': return 'مؤكد';
            case 'processing': return 'قيد المعالجة';
            case 'ready_for_pickup': return 'جاهز للاستلام';
            case 'shipped': return 'تم الشحن';
            case 'delivered': return 'تم التوصيل';
            case 'completed': return 'مكتمل';
            case 'cancelled': return 'ملغي';
            case 'refunded': return 'مسترد';
            default: return status;
        }
    }

    switch (normalized) {
        case 'pending': return 'Pending';
        case 'confirmed': return 'Confirmed';
        case 'processing': return 'Processing';
        case 'ready_for_pickup': return 'Ready for Pickup';
        case 'shipped': return 'Shipped';
        case 'delivered': return 'Delivered';
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        case 'refunded': return 'Refunded';
        default: return status;
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F6FB',
    },
    header: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        borderColor: '#E8E1FA',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#14153C',
    },
    listContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    compactCard: {
        padding: 12,
        borderRadius: 16,
        shadowRadius: 8,
    },
    compactCardHeader: {
        paddingBottom: 8,
        marginBottom: 8,
    },
    compactBody: {
        marginTop: 4,
    },
    compactTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#171840',
        marginBottom: 6,
    },
    compactFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    compactDateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    compactPrice: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.primary,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: spacing.lg,
        shadowColor: '#1A1440',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 2,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#ECE7FA',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#ECE7FA',
    },
    salonInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    salonLogo: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    placeholderLogo: {
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: colors.primary,
        fontWeight: '700',
    },
    salonName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A44',
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    cardBody: {
        marginBottom: spacing.md,
    },
    orderId: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    dateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    dateIcon: {
        fontSize: 16,
    },
    dateTimeText: {
        fontSize: 14,
        color: '#6E7596',
    },
    itemsContainer: {
        marginTop: spacing.xs,
    },
    itemText: {
        fontSize: 14,
        color: '#1D1E49',
        marginBottom: 2,
    },
    moreItemsText: {
        fontSize: 12,
        color: '#6E7596',
        fontStyle: 'italic',
        marginTop: 2,
    },
    viewDetailsText: {
        marginTop: spacing.xs,
        fontSize: 12,
        fontWeight: '700',
        color: colors.primary,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border + '40',
        gap: spacing.sm,
    },
    priceBlock: {
        flex: 1,
        gap: 2,
    },
    price: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.primary,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
    },
    payButton: {
        minWidth: 96,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#6D31D9',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    cancelButton: {
        minWidth: 96,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.error,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: colors.error,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    totalHint: {
        fontSize: 12,
        color: '#6E7596',
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A44',
        marginBottom: spacing.xs,
    },
    bookButton: {
        marginTop: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: 12,
    },
    bookButtonText: {
        color: colors.textInverse,
        fontWeight: '600',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
