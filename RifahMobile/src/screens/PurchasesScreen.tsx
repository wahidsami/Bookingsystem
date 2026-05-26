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
import { api, Order, getImageUrl } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { GuestView } from '../components/GuestView';
import { useAppSession } from '../contexts/AppSessionContext';
import { useFocusEffect } from '@react-navigation/native';
import { orderNeedsPayment } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';

export function PurchasesScreen({ navigation }: any) {
    const { t, language } = useLanguage();
    const { showLogin } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

    useFocusEffect(
        React.useCallback(() => {
            loadOrders();
        }, [])
    );

    const loadOrders = async () => {
        try {
            setLoading(true);
            const user = await api.getUser();
            if (!user) {
                setIsAuthenticated(false);
                return;
            }
            setIsAuthenticated(true);
            const data = await api.getOrders();
            setOrders(data);
        } catch (error: any) {
            if (error.status === 401 || error.message?.includes('unauthorized') || error.message?.includes('Invalid or expired token')) {
                setIsAuthenticated(false);
            } else {
                console.error('Failed to load orders:', error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

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

        return (
            <View style={styles.card}>
                {/* Header: Tenant Info & Status */}
                <View style={styles.cardHeader}>
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
                        <Text style={styles.salonName}>{item.tenant?.name || 'Store Name'}</Text>
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

                {/* Body: Order Info */}
                <View style={styles.cardBody}>
                    <Text style={styles.orderId}>#{(item.orderNumber || item.id.slice(0, 8)).toUpperCase()}</Text>
                    <View style={styles.dateTimeRow}>
                        <AppIcon name="bookings" size={16} color={colors.primary} />
                        <Text style={styles.dateTimeText}>
                            {format(dateDate, 'eeee, d MMMM yyyy', { locale: isArabic ? ar : enUS })}
                        </Text>
                    </View>

                    {/* Items Summary */}
                    <View style={styles.itemsContainer}>
                        {item.items.slice(0, 2).map((orderItem, index) => (
                            <Text key={index} style={styles.itemText}>
                                • {isArabic ? orderItem.Product?.name_ar || orderItem.product?.name_ar : orderItem.Product?.name_en || orderItem.product?.name_en} (x{orderItem.quantity})
                            </Text>
                        ))}
                        {item.items.length > 2 && (
                            <Text style={styles.moreItemsText}>
                                + {item.items.length - 2} {t('moreItems')}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Footer: Price & Actions */}
                <View style={styles.cardFooter}>
                    <View style={styles.priceBlock}>
                        <Text style={styles.price}>{Number(item.totalAmount || 0).toFixed(2)} SAR</Text>
                        <Text style={styles.totalHint}>{language === 'ar' ? 'إجمالي الطلب' : 'Order total'}</Text>
                    </View>
                    <View style={styles.actions}>
                        {orderNeedsPayment(item) && (
                            <TouchableOpacity
                                style={styles.payButton}
                                onPress={() => navigation.navigate('Payment', {
                                    orderId: item.id,
                                    amount: Number(item.totalAmount),
                                    tenantId: item.tenantId,
                                })}
                            >
                                <Text style={styles.payButtonText}>{t('payNow')}</Text>
                            </TouchableOpacity>
                        )}
                        {['pending', 'confirmed'].includes(item.status) && (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => handleCancel(item.id)}
                            >
                                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    if (!isAuthenticated && !loading) {
        return (
            <>
                <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('myPurchases' as any)}</Text>
                </View>
                <GuestView
                    type="orders"
                    onLoginPress={showLogin}
                />
            </>
        );
    }

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                {/* Back Button */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('myPurchases')}</Text>
            </View>

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
        backgroundColor: colors.background,
    },
    header: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    backButton: {
        padding: spacing.xs,
    },
    backButtonText: {
        fontSize: fontSize.xl,
        color: colors.text,
        fontWeight: '700',
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    listContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    salonInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    salonLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
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
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardBody: {
        marginBottom: spacing.md,
    },
    orderId: {
        fontSize: fontSize.sm,
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
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    itemsContainer: {
        marginTop: spacing.xs,
    },
    itemText: {
        fontSize: fontSize.sm,
        color: colors.text,
        marginBottom: 2,
    },
    moreItemsText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontStyle: 'italic',
        marginTop: 2,
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
        fontSize: fontSize.lg,
        fontWeight: '700',
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
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
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
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: colors.error,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    totalHint: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
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
        fontSize: fontSize.lg,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    bookButton: {
        marginTop: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
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
