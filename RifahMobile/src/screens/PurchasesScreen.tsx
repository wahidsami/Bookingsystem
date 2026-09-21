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
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { api, Order, OrderItem, getImageUrl, orderNeedsPayment } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { GuestView } from '../components/GuestView';
import { useAppSession } from '../contexts/AppSessionContext';
import { useFocusEffect } from '@react-navigation/native';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { usePopup } from '../contexts/PopupContext';

export function PurchasesScreen({ navigation, route }: any) {
    const { t, language } = useLanguage();
    const isRTL = language === 'ar';
    const { showLogin, isAuthenticated } = useAppSession();
    const { scrollBottomPadding } = useScreenSafeArea();
    const { confirm, showDialog } = usePopup();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
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
                    navigation.navigate('PurchaseDetails', { purchaseId: matchedOrder.id });
                }
            }
        } catch (error: any) {
            if (error?.status === 401 || error?.message?.includes('unauthorized') || error?.message?.includes('Invalid or expired token')) {
                showLogin();
            } else {
                console.error('Failed to load orders:', error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [deepLinkOrderId, isAuthenticated, navigation, showLogin]);

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
        const confirmed = await confirm({
            title: isRTL ? 'إلغاء الطلب' : 'Cancel Order',
            message: isRTL ? 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟' : 'Are you sure you want to cancel this order?',
            confirmText: isRTL ? 'نعم، إلغاء' : 'Yes, Cancel',
            cancelText: isRTL ? 'لا' : 'No',
            variant: 'destructive',
        });

        if (!confirmed) return;

        try {
            setCancellingOrderId(id);
            const success = await api.cancelOrder(id);
            if (success) {
                await loadOrders();
                await showDialog({
                    title: isRTL ? 'تم الإلغاء' : 'Cancelled',
                    message: isRTL ? 'تم إلغاء الطلب بنجاح' : 'Order has been cancelled successfully.',
                    variant: 'success',
                    confirmText: isRTL ? 'حسنًا' : 'OK',
                });
            }
        } catch (error) {
            await showDialog({
                title: isRTL ? 'خطأ' : 'Error',
                message: isRTL ? 'تعذر إلغاء الطلب. يرجى المحاولة مرة أخرى.' : 'Failed to cancel order. Please try again.',
                variant: 'error',
                confirmText: isRTL ? 'حسنًا' : 'OK',
            });
        } finally {
            setCancellingOrderId(null);
        }
    };

    const getItemImage = (orderItem: OrderItem): string | null => {
        if (orderItem.productImage) return orderItem.productImage;
        if (orderItem.Product?.images && orderItem.Product.images.length > 0) return orderItem.Product.images[0];
        if (orderItem.product?.images && orderItem.product.images.length > 0) return orderItem.product.images[0];
        return null;
    };

    const getItemName = (orderItem: OrderItem): string => {
        if (isRTL) {
            return orderItem.productNameAr || orderItem.Product?.name_ar || orderItem.product?.name_ar || orderItem.productName || orderItem.Product?.name_en || orderItem.product?.name_en || (isRTL ? 'منتج' : 'Product');
        }
        return orderItem.productName || orderItem.Product?.name_en || orderItem.product?.name_en || orderItem.productNameAr || orderItem.Product?.name_ar || orderItem.product?.name_ar || 'Product';
    };

    const renderOrderCard = ({ item }: { item: Order }) => {
        const dateDate = new Date(item.createdAt);
        const dateStr = format(dateDate, 'd MMM yyyy', { locale: isRTL ? ar : enUS });
        const statusConfig = getOrderStatusColor(item.status);
        const paymentConfig = getPaymentStatusInfo(item.paymentStatus, isRTL);
        const firstItem = item.items?.[0];
        const extraItemsCount = Math.max(0, (item.items?.length || 0) - 1);
        const firstItemImage = firstItem ? getItemImage(firstItem) : null;
        const firstItemName = firstItem ? getItemName(firstItem) : (isRTL ? 'طلب منتجات' : 'Products Order');
        const canCancel = ['pending', 'confirmed'].includes(item.status);
        const needsPayment = orderNeedsPayment(item);

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                style={styles.card}
                onPress={() => navigation.navigate('PurchaseDetails', { purchaseId: item.id })}
            >
                {/* Store Header & Status */}
                <View style={[styles.cardHeader, isRTL && styles.rowReverse]}>
                    <View style={[styles.storeInfo, isRTL && styles.rowReverse]}>
                        {item.tenant?.logo ? (
                            <Image
                                source={{ uri: getImageUrl(item.tenant.logo) }}
                                style={styles.storeLogo}
                            />
                        ) : (
                            <View style={[styles.storeLogo, styles.placeholderLogo]}>
                                <Text style={styles.placeholderText}>
                                    {item.tenant?.name?.charAt(0) || 'S'}
                                </Text>
                            </View>
                        )}
                        <View style={[styles.storeNameContainer, isRTL && styles.alignEnd]}>
                            <Text style={[styles.storeName, isRTL && styles.cairoBold]} numberOfLines={1}>
                                {item.tenant?.name || (isRTL ? 'المتجر' : 'Store')}
                            </Text>
                            <View style={[styles.orderRefRow, isRTL && styles.rowReverse]}>
                                <Text style={styles.orderNumberText}>
                                    #{(item.orderNumber || item.id.slice(0, 8)).toUpperCase()}
                                </Text>
                                <Text style={styles.orderDot}>•</Text>
                                <Text style={styles.orderDateText}>{dateStr}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.headerBadgesCol, isRTL && styles.alignStart]}>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
                            <Text style={[styles.statusText, { color: statusConfig.text }, isRTL && styles.cairoBold]}>
                                {getOrderStatusText(item.status, item.deliveryType, isRTL)}
                            </Text>
                        </View>
                        <View style={[styles.fulfillmentBadge, isRTL && styles.rowReverse]}>
                            <AppIcon
                                name={item.deliveryType === 'pickup' ? 'storefront' : 'location'}
                                size={11}
                                color="#6D28D9"
                            />
                            <Text style={[styles.fulfillmentBadgeText, isRTL && styles.cairoMedium]}>
                                {item.deliveryType === 'pickup'
                                    ? (isRTL ? 'استلام' : 'Pickup')
                                    : (isRTL ? 'توصيل' : 'Delivery')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Items Preview */}
                <View style={[styles.itemPreviewRow, isRTL && styles.rowReverse]}>
                    {firstItemImage ? (
                        <Image
                            source={{ uri: getImageUrl(firstItemImage) }}
                            style={styles.itemThumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.itemThumbnail, styles.placeholderThumbnail]}>
                            <AppIcon name="shopping_bag" size={24} color="#7C3AED" />
                        </View>
                    )}

                    <View style={[styles.itemMeta, isRTL && styles.alignEnd]}>
                        <Text style={[styles.itemName, isRTL && styles.cairoMedium]} numberOfLines={2}>
                            {firstItemName}
                        </Text>
                        <View style={[styles.qtyAndExtraRow, isRTL && styles.rowReverse]}>
                            {firstItem && (
                                <Text style={styles.itemQty}>
                                    {isRTL ? `الكمية: ${firstItem.quantity}` : `Qty: ${firstItem.quantity}`}
                                </Text>
                            )}
                            {extraItemsCount > 0 && (
                                <View style={styles.extraBadge}>
                                    <Text style={[styles.extraBadgeText, isRTL && styles.cairoMedium]}>
                                        {isRTL ? `+${extraItemsCount} منتجات إضافية` : `+${extraItemsCount} more items`}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Footer: Payment & Total Amount */}
                <View style={[styles.cardFooter, isRTL && styles.rowReverse]}>
                    <View style={styles.paymentStatusRow}>
                        <View style={[styles.paymentBadge, { backgroundColor: paymentConfig.bg }]}>
                            <Text style={[styles.paymentBadgeText, { color: paymentConfig.color }, isRTL && styles.cairoMedium]}>
                                {paymentConfig.text}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.totalPriceBlock, isRTL ? styles.alignStart : styles.alignEnd]}>
                        <Text style={[styles.totalLabel, isRTL && styles.cairoRegular]}>
                            {isRTL ? 'إجمالي الطلب' : 'Total'}
                        </Text>
                        <Text style={[styles.totalAmount, isRTL && styles.cairoBold]}>
                            {formatRiyal(Number(item.totalAmount || 0), isRTL ? 'ar' : 'en')}
                        </Text>
                    </View>
                </View>

                {/* Actions */}
                {(needsPayment || canCancel) && (
                    <View style={[styles.actionsContainer, isRTL && { justifyContent: 'flex-start', flexDirection: 'row-reverse' }]}>
                        {canCancel && (
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={(e) => {
                                    e.stopPropagation && e.stopPropagation();
                                    handleCancel(item.id);
                                }}
                                disabled={cancellingOrderId === item.id}
                            >
                                {cancellingOrderId === item.id ? (
                                    <ActivityIndicator size="small" color="#DC2626" />
                                ) : (
                                    <Text style={[styles.cancelBtnText, isRTL && styles.cairoMedium]}>
                                        {isRTL ? 'إلغاء الطلب' : 'Cancel Order'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}
                        {needsPayment && (
                            <TouchableOpacity
                                style={[styles.payBtn, isRTL && styles.rowReverse]}
                                onPress={(e) => {
                                    e.stopPropagation && e.stopPropagation();
                                    navigation.navigate('Payment', {
                                        orderId: item.id,
                                        amount: Number(item.totalAmount),
                                        tenantId: item.tenantId,
                                    });
                                }}
                            >
                                <AppIcon name="card" size={16} color="#FFFFFF" />
                                <Text style={[styles.payBtnText, isRTL && styles.cairoBold]}>
                                    {isRTL ? 'ادفع الآن' : 'Pay Now'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (!isAuthenticated && !loading) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader
                    title={isRTL ? 'مشترياتي' : 'My Purchases'}
                    showBack={Boolean(navigation?.canGoBack && navigation.canGoBack())}
                />
                <GuestView
                    type="orders"
                    onLoginPress={showLogin}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={isRTL ? 'مشترياتي' : 'My Purchases'}
                showBack={Boolean(navigation?.canGoBack && navigation.canGoBack())}
            />

            {orders.length > 0 ? (
                <FlatList
                    data={orders}
                    renderItem={renderOrderCard}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPadding + 24 }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
                    }
                />
            ) : !loading ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconCircle}>
                        <AppIcon name="shopping_bag" size={48} color="#7C3AED" />
                    </View>
                    <Text style={[styles.emptyTitle, isRTL && styles.cairoBold]}>
                        {isRTL ? 'لا توجد مشتريات بعد' : 'No purchases yet'}
                    </Text>
                    <Text style={[styles.emptySubtitle, isRTL && styles.cairoRegular]}>
                        {isRTL ? 'ستظهر جميع طلباتك ومشترياتك هنا فور إتمامها' : 'All your orders and purchases will appear here.'}
                    </Text>
                    <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={handleRefresh}
                        activeOpacity={0.8}
                    >
                        <AppIcon name="refresh" size={18} color="#FFFFFF" />
                        <Text style={[styles.refreshButtonText, isRTL && styles.cairoBold]}>
                            {isRTL ? 'تحديث' : 'Refresh'}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {loading && !refreshing && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#7C3AED" />
                </View>
            )}
        </View>
    );
}

const getOrderStatusColor = (status: string) => {
    const s = `${status || ''}`.trim().toLowerCase();
    switch (s) {
        case 'delivered':
        case 'completed':
        case 'confirmed':
            return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
        case 'shipped':
        case 'ready_for_pickup':
        case 'processing':
            return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
        case 'pending':
            return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
        case 'cancelled':
        case 'refunded':
            return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
        default:
            return { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };
    }
};

const getOrderStatusText = (status: string, deliveryType: string | undefined, isAr: boolean) => {
    const s = `${status || ''}`.trim().toLowerCase();
    const isPickup = deliveryType === 'pickup';

    if (isAr) {
        if (isPickup) {
            switch (s) {
                case 'pending': return 'تم استلام الطلب';
                case 'confirmed': return 'تم تأكيد الطلب';
                case 'processing': return 'جاري تجهيز الطلب';
                case 'ready_for_pickup': return 'الطلب جاهز للاستلام';
                case 'completed': return 'تم الاستلام';
                case 'cancelled': return 'تم إلغاء الطلب';
                case 'refunded': return 'تم استرداد الطلب';
                default: return status;
            }
        }
        switch (s) {
            case 'pending': return 'تم استلام الطلب';
            case 'confirmed': return 'تم تأكيد الطلب';
            case 'processing': return 'جاري تجهيز الطلب';
            case 'shipped': return 'تم تسليم الطلب للتوصيل';
            case 'delivered': return 'تم التوصيل';
            case 'completed': return 'اكتمل الطلب';
            case 'cancelled': return 'تم إلغاء الطلب';
            case 'refunded': return 'تم استرداد الطلب';
            default: return status;
        }
    }

    if (isPickup) {
        switch (s) {
            case 'pending': return 'Order Received';
            case 'confirmed': return 'Order Confirmed';
            case 'processing': return 'Preparing Order';
            case 'ready_for_pickup': return 'Ready for Pickup';
            case 'completed': return 'Picked Up';
            case 'cancelled': return 'Order Cancelled';
            case 'refunded': return 'Order Refunded';
            default: return status;
        }
    }
    switch (s) {
        case 'pending': return 'Order Received';
        case 'confirmed': return 'Order Confirmed';
        case 'processing': return 'Preparing Order';
        case 'shipped': return 'Handed to Delivery';
        case 'delivered': return 'Delivered';
        case 'completed': return 'Order Completed';
        case 'cancelled': return 'Order Cancelled';
        case 'refunded': return 'Order Refunded';
        default: return status;
    }
};

const getPaymentStatusInfo = (paymentStatus: string, isAr: boolean) => {
    const raw = `${paymentStatus || ''}`.trim().toLowerCase();
    if (raw === 'paid' || raw === 'completed' || raw === 'successful') {
        return {
            text: isAr ? 'مدفوع' : 'Paid',
            color: '#059669',
            bg: '#ECFDF5',
        };
    }
    if (raw === 'partially_paid' || raw === 'deposit_paid') {
        return {
            text: isAr ? 'مدفوع جزئياً' : 'Partially Paid',
            color: '#2563EB',
            bg: '#EFF6FF',
        };
    }
    if (raw === 'refunded') {
        return {
            text: isAr ? 'مسترد' : 'Refunded',
            color: '#DC2626',
            bg: '#FEF2F2',
        };
    }
    if (raw === 'failed') {
        return {
            text: isAr ? 'فشل الدفع' : 'Failed',
            color: '#DC2626',
            bg: '#FEF2F2',
        };
    }
    return {
        text: isAr ? 'بانتظار الدفع' : 'Payment Pending',
        color: '#D97706',
        bg: '#FFFBEB',
    };
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F6FB',
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    alignEnd: {
        alignItems: 'flex-end',
    },
    alignStart: {
        alignItems: 'flex-start',
    },
    listContent: {
        paddingTop: spacing.md,
        paddingHorizontal: spacing.md,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: spacing.md + 2,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0EAFB',
    },
    storeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    storeLogo: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    placeholderLogo: {
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#7C3AED',
        fontWeight: '700',
        fontSize: 15,
    },
    storeNameContainer: {
        flex: 1,
    },
    storeName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
    },
    orderRefRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 6,
    },
    orderNumberText: {
        fontSize: 11,
        color: '#7C3AED',
        fontWeight: '600',
    },
    orderDot: {
        fontSize: 10,
        color: colors.textSecondary,
    },
    orderDateText: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    headerBadgesCol: {
        alignItems: 'flex-end',
        gap: 4,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    fulfillmentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: '#F3E8FF',
    },
    fulfillmentBadgeText: {
        fontSize: 10,
        color: '#6D28D9',
        fontWeight: '600',
    },
    itemPreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    itemThumbnail: {
        width: 54,
        height: 54,
        borderRadius: 12,
        backgroundColor: '#F7F4FF',
    },
    placeholderThumbnail: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#EAE1FA',
    },
    itemMeta: {
        flex: 1,
    },
    itemName: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 18,
    },
    qtyAndExtraRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 8,
    },
    itemQty: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    extraBadge: {
        backgroundColor: '#F5EEFF',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    extraBadgeText: {
        fontSize: 10,
        color: '#7C3AED',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0EAFB',
        marginVertical: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
    },
    paymentStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    paymentBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    paymentBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    totalPriceBlock: {
        alignItems: 'flex-end',
    },
    totalLabel: {
        fontSize: 10,
        color: colors.textSecondary,
    },
    totalAmount: {
        fontSize: 15,
        fontWeight: '800',
        color: '#7C3AED',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0EAFB',
    },
    cancelBtn: {
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#FEF2F2',
    },
    cancelBtnText: {
        fontSize: 12,
        color: '#DC2626',
        fontWeight: '600',
    },
    payBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: '#7C3AED',
    },
    payBtnText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        marginTop: 60,
    },
    emptyIconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#F5EEFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1D035F',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#7C3AED',
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    refreshButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(247, 246, 251, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cairoBold: {
        fontFamily: 'Cairo-Bold',
    },
    cairoMedium: {
        fontFamily: 'Cairo-Medium',
    },
    cairoRegular: {
        fontFamily: 'Cairo-Regular',
    },
});
