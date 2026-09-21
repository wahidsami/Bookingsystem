import React, { useEffect, useState, useMemo } from 'react';
import {
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Image,
    Alert,
    RefreshControl,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { formatRiyal } from '../utils/currency';
import { api, Order, OrderItem, getImageUrl, orderNeedsPayment } from '../api/client';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { usePopup } from '../contexts/PopupContext';

export function PurchaseDetailsScreen({ route, navigation }: any) {
    const { language } = useLanguage();
    const isRTL = language === 'ar';
    const { scrollBottomPadding } = useScreenSafeArea();
    const { confirm, showDialog } = usePopup();
    
    const purchaseId = route?.params?.purchaseId || route?.params?.id || null;
    const initialOrder = route?.params?.order || null;

    const [order, setOrder] = useState<Order | null>(initialOrder);
    const [loading, setLoading] = useState<boolean>(!initialOrder);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [cancelling, setCancelling] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadOrderDetails = React.useCallback(async (silent = false) => {
        if (!purchaseId) {
            setLoading(false);
            setErrorMessage(isRTL ? 'معرف الطلب غير متوفر' : 'Order ID is missing');
            return;
        }

        if (!silent) setLoading(true);
        setErrorMessage(null);

        try {
            const data = await api.getOrder(purchaseId);
            if (data) {
                setOrder(data);
            } else {
                setErrorMessage(isRTL ? 'تعذر العثور على الطلب' : 'Order not found');
            }
        } catch (err: any) {
            console.error('Failed to load purchase details:', err);
            setErrorMessage(isRTL ? 'تعذر تحميل تفاصيل الطلب. يرجى المحاولة مرة أخرى.' : 'Could not load order details. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isRTL, purchaseId]);

    useEffect(() => {
        loadOrderDetails();
    }, [loadOrderDetails]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadOrderDetails(true);
    };

    const handleCancelOrder = async () => {
        if (!order) return;

        const confirmed = await confirm({
            title: isRTL ? 'إلغاء الطلب' : 'Cancel Order',
            message: isRTL ? 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟' : 'Are you sure you want to cancel this order?',
            confirmText: isRTL ? 'نعم، إلغاء' : 'Yes, Cancel',
            cancelText: isRTL ? 'لا' : 'No',
            variant: 'destructive',
        });

        if (!confirmed) return;

        try {
            setCancelling(true);
            const success = await api.cancelOrder(order.id);
            if (success) {
                await loadOrderDetails(true);
                await showDialog({
                    title: isRTL ? 'تم الإلغاء' : 'Cancelled',
                    message: isRTL ? 'تم إلغاء الطلب بنجاح' : 'Order has been cancelled successfully.',
                    variant: 'success',
                    confirmText: isRTL ? 'حسنًا' : 'OK',
                });
            }
        } catch (err) {
            await showDialog({
                title: isRTL ? 'خطأ' : 'Error',
                message: isRTL ? 'تعذر إلغاء الطلب. يرجى المحاولة مرة أخرى.' : 'Failed to cancel order. Please try again.',
                variant: 'error',
                confirmText: isRTL ? 'حسنًا' : 'OK',
            });
        } finally {
            setCancelling(false);
        }
    };

    const handlePayNow = () => {
        if (!order) return;
        navigation.navigate('Payment', {
            orderId: order.id,
            amount: Number(order.totalAmount),
            tenantId: order.tenantId,
        });
    };

    // Safely parse shipping address (object or JSON string)
    const parsedShippingAddress = useMemo(() => {
        if (!order?.shippingAddress) return null;
        if (typeof order.shippingAddress === 'object') {
            return order.shippingAddress;
        }
        if (typeof order.shippingAddress === 'string') {
            try {
                const parsed = JSON.parse(order.shippingAddress);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch {
                return { street: order.shippingAddress };
            }
        }
        return null;
    }, [order?.shippingAddress]);

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

    const getItemUnitPrice = (orderItem: OrderItem): number => {
        if (orderItem.unitPrice !== undefined) return Number(orderItem.unitPrice);
        if (orderItem.price !== undefined) return Number(orderItem.price);
        return 0;
    };

    const getItemSubtotal = (orderItem: OrderItem): number => {
        if (orderItem.totalPrice !== undefined) return Number(orderItem.totalPrice);
        const qty = Number(orderItem.quantity || 1);
        const unit = getItemUnitPrice(orderItem);
        return qty * unit;
    };

    const statusConfig = useMemo(() => {
        return getOrderStatusColor(order?.status || '');
    }, [order?.status]);

    const paymentConfig = useMemo(() => {
        return getPaymentStatusInfo(order?.paymentStatus || '', isRTL);
    }, [order?.paymentStatus, isRTL]);

    const canCancel = order && ['pending', 'confirmed'].includes(order.status);
    const needsPayment = order && orderNeedsPayment(order);

    const isPickup = order?.deliveryType === 'pickup';

    const timelineSteps = useMemo(() => {
        if (!order) return [];
        if (isPickup) {
            return [
                {
                    key: 'pending',
                    titleAr: 'تم استلام الطلب',
                    titleEn: 'Order Received',
                    descriptionAr: 'تم تسجيل طلبك بنجاح في المتجر',
                    descriptionEn: 'Order placed successfully',
                    timestamp: order.createdAt,
                },
                {
                    key: 'confirmed',
                    titleAr: 'تم تأكيد الطلب',
                    titleEn: 'Order Confirmed',
                    descriptionAr: 'تمت مراجعة الطلب والموافقة عليه من قبل المتجر',
                    descriptionEn: 'Store has confirmed your order',
                },
                {
                    key: 'processing',
                    titleAr: 'جاري تجهيز الطلب',
                    titleEn: 'Preparing Order',
                    descriptionAr: 'المتجر يقوم حالياً بتجهيز وتغليف مشترياتك للاستلام',
                    descriptionEn: 'Store is preparing your items for pickup',
                },
                {
                    key: 'ready_for_pickup',
                    titleAr: 'الطلب جاهز للاستلام',
                    titleEn: 'Ready for Pickup',
                    descriptionAr: 'طلبك جاهز الآن! تفضل بزيارة الفرع لاستلامه',
                    descriptionEn: 'Your order is ready for pickup at the store',
                },
                {
                    key: 'completed',
                    titleAr: 'تم الاستلام',
                    titleEn: 'Picked Up',
                    descriptionAr: 'تم استلام الطلب بنجاح من الفرع',
                    descriptionEn: 'Order picked up from store',
                },
            ];
        }

        return [
            {
                key: 'pending',
                titleAr: 'تم استلام الطلب',
                titleEn: 'Order Received',
                descriptionAr: 'تم تسجيل طلبك بنجاح في النظام',
                descriptionEn: 'Order placed successfully',
                timestamp: order.createdAt,
            },
            {
                key: 'confirmed',
                titleAr: 'تم تأكيد الطلب',
                titleEn: 'Order Confirmed',
                descriptionAr: 'تمت مراجعة الطلب والموافقة عليه من المتجر',
                descriptionEn: 'Store has confirmed your order',
            },
            {
                key: 'processing',
                titleAr: 'جاري تجهيز الطلب',
                titleEn: 'Preparing Order',
                descriptionAr: 'يقوم المتجر حالياً بتجهيز وتغليف المنتجات للشحن',
                descriptionEn: 'Store is packaging your items',
            },
            {
                key: 'shipped',
                titleAr: 'تم تسليم الطلب للتوصيل',
                titleEn: 'Handed to Delivery',
                descriptionAr: order.trackingNumber
                    ? (isRTL ? `رقم التتبع: ${order.trackingNumber}` : `Tracking #: ${order.trackingNumber}`)
                    : (isRTL ? 'الطلب مع مندوب / شركة الشحن للتوصيل' : 'With carrier for delivery'),
                descriptionEn: 'In transit with courier',
            },
            {
                key: 'delivered',
                titleAr: 'تم التوصيل',
                titleEn: 'Delivered',
                descriptionAr: 'تم تسليم الطلب إلى العنوان المحدد',
                descriptionEn: 'Successfully delivered to address',
                timestamp: order.deliveredAt,
            },
            {
                key: 'completed',
                titleAr: 'اكتمل الطلب',
                titleEn: 'Order Completed',
                descriptionAr: 'اكتملت جميع إجراءات الطلب والتسليم',
                descriptionEn: 'Order finalized and closed',
            },
        ];
    }, [isPickup, order, isRTL]);

    const stepSequence = useMemo(() => {
        return isPickup
            ? ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'completed']
            : ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed'];
    }, [isPickup]);

    const currentStepIndex = useMemo(() => {
        if (!order?.status) return -1;
        const s = order.status.trim().toLowerCase();
        if (s === 'cancelled' || s === 'refunded') return -1;
        return stepSequence.indexOf(s);
    }, [order?.status, stepSequence]);

    if (loading && !refreshing) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader
                    title={isRTL ? 'تفاصيل الطلب' : 'Purchase Details'}
                    showBack={true}
                    onBack={() => navigation.goBack()}
                />
                <View style={[styles.centeredContainer]}>
                    <ActivityIndicator size="large" color="#7C3AED" />
                </View>
            </View>
        );
    }

    if (errorMessage || !order) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader
                    title={isRTL ? 'تفاصيل الطلب' : 'Purchase Details'}
                    showBack={true}
                    onBack={() => navigation.goBack()}
                />
                <View style={styles.errorContainer}>
                    <View style={styles.errorIconCircle}>
                        <AppIcon name="close" size={36} color="#DC2626" />
                    </View>
                    <Text style={[styles.errorTitle, isRTL && styles.cairoBold]}>
                        {errorMessage || (isRTL ? 'تعذر العثور على الطلب' : 'Order not found')}
                    </Text>
                    <Text style={[styles.errorSubtitle, isRTL && styles.cairoRegular]}>
                        {isRTL
                            ? 'يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.'
                            : 'Please check your internet connection and try again.'}
                    </Text>
                    <View style={styles.errorActions}>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => loadOrderDetails()}
                            activeOpacity={0.8}
                        >
                            <AppIcon name="refresh" size={18} color="#FFFFFF" />
                            <Text style={[styles.retryButtonText, isRTL && styles.cairoBold]}>
                                {isRTL ? 'إعادة المحاولة' : 'Retry'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.backOutlineButton}
                            onPress={() => navigation.goBack()}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.backOutlineButtonText, isRTL && styles.cairoMedium]}>
                                {isRTL ? 'العودة للمشتريات' : 'Back to Purchases'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    const dateDate = new Date(order.createdAt);
    const dateStr = format(dateDate, 'eeee, d MMMM yyyy - p', { locale: isRTL ? ar : enUS });

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={isRTL ? 'تفاصيل الطلب' : 'Purchase Details'}
                showBack={true}
                onBack={() => navigation.goBack()}
            />

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding + 40 }]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#7C3AED']}
                        tintColor="#7C3AED"
                    />
                }
            >
                {/* Order Summary & Status Card */}
                <View style={styles.card}>
                    <View style={[styles.orderHeaderTop, isRTL && styles.rowReverse]}>
                        <View style={[styles.orderIdBlock, isRTL && styles.alignEnd]}>
                            <Text style={[styles.orderNumberLabel, isRTL && styles.cairoRegular]}>
                                {isRTL ? 'رقم الطلب' : 'Order Reference'}
                            </Text>
                            <Text style={styles.orderNumberValue}>
                                #{(order.orderNumber || order.id.slice(0, 8)).toUpperCase()}
                            </Text>
                        </View>
                        <View style={[styles.headerBadgesCol, isRTL && styles.alignStart]}>
                            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
                                <Text style={[styles.statusText, { color: statusConfig.text }, isRTL && styles.cairoBold]}>
                                    {getOrderStatusText(order.status, order.deliveryType, isRTL)}
                                </Text>
                            </View>
                            <View style={[styles.fulfillmentBadge, isRTL && styles.rowReverse]}>
                                <AppIcon
                                    name={isPickup ? 'storefront' : 'location'}
                                    size={11}
                                    color="#6D28D9"
                                />
                                <Text style={[styles.fulfillmentBadgeText, isRTL && styles.cairoMedium]}>
                                    {isPickup
                                        ? (isRTL ? 'استلام من الفرع' : 'Store Pickup')
                                        : (isRTL ? 'توصيل للمنزل' : 'Home Delivery')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.orderMetaRow, isRTL && styles.rowReverse]}>
                        <AppIcon name="clock" size={15} color={colors.textSecondary} />
                        <Text style={[styles.orderDateText, isRTL && styles.cairoRegular]}>
                            {dateStr}
                        </Text>
                    </View>

                    {/* Store / Tenant info */}
                    <View style={[styles.storeSection, isRTL && styles.rowReverse]}>
                        {order.tenant?.logo ? (
                            <Image
                                source={{ uri: getImageUrl(order.tenant.logo) }}
                                style={styles.storeLogo}
                            />
                        ) : (
                            <View style={[styles.storeLogo, styles.storeLogoPlaceholder]}>
                                <Text style={styles.storeLogoPlaceholderText}>
                                    {order.tenant?.name?.charAt(0) || 'S'}
                                </Text>
                            </View>
                        )}
                        <View style={[styles.storeInfoText, isRTL && styles.alignEnd]}>
                            <Text style={[styles.storeLabel, isRTL && styles.cairoRegular]}>
                                {isRTL ? 'المتجر المورد' : 'Store'}
                            </Text>
                            <Text style={[styles.storeName, isRTL && styles.cairoBold]} numberOfLines={1}>
                                {order.tenant?.name || (isRTL ? 'متجر رِفاه' : 'Refah Store')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Terminal State Alert: Cancelled / Refunded */}
                {(order.status === 'cancelled' || order.status === 'refunded') && (
                    <View style={styles.cancelledAlertCard}>
                        <View style={[styles.cancelledAlertHeader, isRTL && styles.rowReverse]}>
                            <View style={styles.cancelledAlertIconCircle}>
                                <AppIcon name="close" size={18} color="#DC2626" />
                            </View>
                            <View style={[styles.cancelledAlertMeta, isRTL && styles.alignEnd]}>
                                <Text style={[styles.cancelledAlertTitle, isRTL && styles.cairoBold]}>
                                    {order.status === 'refunded'
                                        ? (isRTL ? 'تم استرداد هذا الطلب' : 'This order has been refunded')
                                        : (isRTL ? 'تم إلغاء هذا الطلب' : 'This order has been cancelled')}
                                </Text>
                                {order.cancelledAt && (
                                    <Text style={[styles.cancelledAlertDate, isRTL && styles.cairoRegular]}>
                                        {format(new Date(order.cancelledAt), 'eeee, d MMMM yyyy - p', { locale: isRTL ? ar : enUS })}
                                    </Text>
                                )}
                            </View>
                        </View>
                        {order.cancellationReason && (
                            <Text style={[styles.cancelledAlertReason, isRTL && styles.cairoRegular]}>
                                <Text style={[styles.cancelledAlertReasonBold, isRTL && styles.cairoBold]}>
                                    {isRTL ? 'السبب: ' : 'Reason: '}
                                </Text>
                                {order.cancellationReason}
                            </Text>
                        )}
                    </View>
                )}

                {/* Shipped Highlight Banner */}
                {order.status === 'shipped' && !isPickup && (
                    <View style={[styles.shippedBanner, isRTL && styles.rowReverse]}>
                        <View style={styles.shippedBannerIconBox}>
                            <AppIcon name="location" size={24} color="#2563EB" />
                        </View>
                        <View style={[styles.shippedBannerContent, isRTL && styles.alignEnd]}>
                            <Text style={[styles.shippedBannerTitle, isRTL && styles.cairoBold]}>
                                {isRTL ? 'طلبك في الطريق إليك!' : 'Your order is on the way!'}
                            </Text>
                            <Text style={[styles.shippedBannerSub, isRTL && styles.cairoRegular]}>
                                {isRTL
                                    ? 'تم شحن المنتجات وهي في طريقها إلى عنوانك مع المندوب.'
                                    : 'Your items have been shipped and are in transit to your address.'}
                            </Text>
                            {order.trackingNumber && (
                                <View style={[styles.shippedTrackingBox, isRTL && styles.shippedTrackingBoxRtl]}>
                                    <Text style={[styles.shippedTrackingLabel, isRTL && styles.cairoRegular]}>
                                        {isRTL ? 'رقم التتبع:' : 'Tracking #:'}
                                    </Text>
                                    <Text style={[styles.shippedTrackingCode, { writingDirection: 'ltr' }]}>
                                        {order.trackingNumber}
                                    </Text>
                                </View>
                            )}
                            {order.estimatedDeliveryDate && (
                                <Text style={[styles.shippedDeliveryDateText, isRTL && styles.cairoMedium]}>
                                    {isRTL ? 'الموعد المتوقع: ' : 'Estimated arrival: '}
                                    {format(new Date(order.estimatedDeliveryDate), 'eeee, d MMMM yyyy', { locale: isRTL ? ar : enUS })}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                {/* Ready for Pickup Highlight Banner */}
                {order.status === 'ready_for_pickup' && isPickup && (
                    <View style={[styles.pickupReadyBanner, isRTL && styles.rowReverse]}>
                        <View style={styles.pickupReadyIconBox}>
                            <AppIcon name="storefront" size={24} color="#059669" />
                        </View>
                        <View style={[styles.pickupReadyContent, isRTL && styles.alignEnd]}>
                            <Text style={[styles.pickupReadyTitle, isRTL && styles.cairoBold]}>
                                {isRTL ? 'طلبك جاهز للاستلام الآن!' : 'Your order is ready for pickup!'}
                            </Text>
                            <Text style={[styles.pickupReadySub, isRTL && styles.cairoRegular]}>
                                {isRTL
                                    ? `تفضل بزيارة فرع ${order.tenant?.name || 'المتجر'} واستلم طلبك باستخدام رقم الطلب.`
                                    : `Please visit ${order.tenant?.name || 'the store'} to collect your items.`}
                            </Text>
                            {order.pickupDate && (
                                <Text style={[styles.pickupReadyDateText, isRTL && styles.cairoMedium]}>
                                    {isRTL ? 'تاريخ الاستلام المحدد: ' : 'Scheduled pickup: '}
                                    {order.pickupDate}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                {/* ORDER PROGRESS / ORDER STATUS TIMELINE */}
                <View style={styles.card}>
                    <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
                        <AppIcon name="clock" size={18} color="#7C3AED" />
                        <Text style={[styles.sectionTitle, isRTL && styles.cairoBold]}>
                            {isRTL ? 'مسار وتتبع الطلب' : 'Order Status Timeline'}
                        </Text>
                        <View style={styles.timelineMethodBadge}>
                            <Text style={[styles.timelineMethodText, isRTL && styles.cairoMedium]}>
                                {isPickup ? (isRTL ? 'استلام' : 'Pickup') : (isRTL ? 'توصيل' : 'Delivery')}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.timelineContainer}>
                        {timelineSteps.map((step, idx) => {
                            const isPassed = currentStepIndex > -1 && idx < currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            const isFuture = currentStepIndex === -1 || idx > currentStepIndex;
                            const isLast = idx === timelineSteps.length - 1;

                            return (
                                <View key={step.key} style={[styles.timelineItemRow, isRTL && styles.rowReverse]}>
                                    <View style={styles.timelineTrackCol}>
                                        <View style={[
                                            styles.timelineNode,
                                            isPassed && styles.timelineNodePassed,
                                            isCurrent && styles.timelineNodeCurrent,
                                            isFuture && styles.timelineNodeFuture,
                                        ]}>
                                            {isPassed ? (
                                                <AppIcon name="check" size={11} color="#FFFFFF" />
                                            ) : isCurrent ? (
                                                <View style={styles.timelineNodeCurrentDot} />
                                            ) : (
                                                <View style={styles.timelineNodeFutureDot} />
                                            )}
                                        </View>
                                        {!isLast && (
                                            <View style={[
                                                styles.timelineConnector,
                                                isPassed ? styles.timelineConnectorPassed : styles.timelineConnectorFuture
                                            ]} />
                                        )}
                                    </View>

                                    <View style={[styles.timelineContentCol, isRTL && styles.alignEnd]}>
                                        <View style={[styles.timelineContentHeader, isRTL && styles.rowReverse]}>
                                            <Text style={[
                                                styles.timelineStepTitle,
                                                isCurrent && styles.timelineStepTitleActive,
                                                isFuture && styles.timelineStepTitleFuture,
                                                isRTL && (isCurrent ? styles.cairoBold : styles.cairoMedium)
                                            ]}>
                                                {isRTL ? step.titleAr : step.titleEn}
                                            </Text>
                                            {step.timestamp && (
                                                <Text style={[styles.timelineTimestampText, isRTL && styles.cairoRegular]}>
                                                    {format(new Date(step.timestamp), 'd MMM - p', { locale: isRTL ? ar : enUS })}
                                                </Text>
                                            )}
                                        </View>
                                        {(step.descriptionAr || step.descriptionEn) && (
                                            <Text style={[
                                                styles.timelineStepDesc,
                                                isCurrent && styles.timelineStepDescActive,
                                                isRTL && styles.cairoRegular
                                            ]}>
                                                {isRTL ? step.descriptionAr : step.descriptionEn}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Product Items Card */}
                <View style={styles.card}>
                    <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
                        <AppIcon name="shopping_bag" size={18} color="#7C3AED" />
                        <Text style={[styles.sectionTitle, isRTL && styles.cairoBold]}>
                            {isRTL ? 'عناصر الطلب' : 'Order Items'}
                        </Text>
                        <View style={styles.itemCountBadge}>
                            <Text style={styles.itemCountText}>
                                {order.items?.length || 0}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.itemsList}>
                        {order.items?.map((item: OrderItem, index: number) => {
                            const itemImage = getItemImage(item);
                            const itemName = getItemName(item);
                            const unitPrice = getItemUnitPrice(item);
                            const lineTotal = getItemSubtotal(item);

                            return (
                                <View
                                    key={item.id || `order-item-${index}`}
                                    style={[
                                        styles.itemRow,
                                        isRTL && styles.rowReverse,
                                        index < (order.items?.length || 0) - 1 && styles.itemRowBorder,
                                    ]}
                                >
                                    {itemImage ? (
                                        <Image
                                            source={{ uri: getImageUrl(itemImage) }}
                                            style={styles.itemThumbnail}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={[styles.itemThumbnail, styles.itemThumbnailPlaceholder]}>
                                            <AppIcon name="shopping_bag" size={20} color="#7C3AED" />
                                        </View>
                                    )}

                                    <View style={[styles.itemDetails, isRTL && styles.alignEnd]}>
                                        <Text style={[styles.itemName, isRTL && styles.cairoMedium, isRTL && styles.textRTL]} numberOfLines={2}>
                                            {itemName}
                                        </Text>
                                        <View style={[styles.itemSubRow, isRTL && styles.rowReverse]}>
                                            <Text style={styles.itemQuantity}>
                                                {isRTL ? `الكمية: ${item.quantity}` : `Qty: ${item.quantity}`}
                                            </Text>
                                            <Text style={styles.itemDot}>•</Text>
                                            <Text style={styles.itemUnitPrice}>
                                                {formatRiyal(unitPrice, isRTL ? 'ar' : 'en')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={[styles.itemLineTotalBlock, isRTL ? styles.alignStart : styles.alignEnd]}>
                                        <Text style={[styles.itemLineTotal, isRTL && styles.cairoBold]}>
                                            {formatRiyal(lineTotal, isRTL ? 'ar' : 'en')}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Shipping / Fulfillment Information */}
                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <AppIcon
                            name={order.deliveryType === 'pickup' ? 'storefront' : 'location'}
                            size={18}
                            color="#7C3AED"
                        />
                        <Text style={[styles.sectionTitle, isRTL && styles.cairoBold]}>
                            {order.deliveryType === 'pickup'
                                ? (isRTL ? 'بيانات الاستلام من المتجر' : 'Store Pickup Details')
                                : (isRTL ? 'عنوان التوصيل' : 'Shipping Address')}
                        </Text>
                    </View>

                    {order.deliveryType === 'pickup' ? (
                        <View style={styles.fulfillmentBody}>
                            <View style={styles.addressLine}>
                                <Text style={[styles.addressLabel, isRTL && styles.cairoRegular]}>
                                    {isRTL ? 'طريقة الاستلام:' : 'Method:'}
                                </Text>
                                <Text style={[styles.addressValue, isRTL && styles.cairoMedium]}>
                                    {isRTL ? 'استلام من الفرع' : 'Store Pickup'}
                                </Text>
                            </View>
                            {order.pickupDate && (
                                <View style={styles.addressLine}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular]}>
                                        {isRTL ? 'تاريخ الاستلام:' : 'Pickup Date:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium]}>
                                        {order.pickupDate}
                                    </Text>
                                </View>
                            )}
                            {order.notes && (
                                <View style={styles.addressLine}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular]}>
                                        {isRTL ? 'ملاحظات:' : 'Notes:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium]}>
                                        {order.notes}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ) : parsedShippingAddress ? (
                        <View style={styles.fulfillmentBody}>
                            {(parsedShippingAddress.recipientName || parsedShippingAddress.name) && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'المستلم:' : 'Recipient:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl]}>
                                        {parsedShippingAddress.recipientName || parsedShippingAddress.name}
                                    </Text>
                                </View>
                            )}
                            {parsedShippingAddress.phone && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'الهاتف:' : 'Phone:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl, { writingDirection: 'ltr' }]}>
                                        {parsedShippingAddress.phone}
                                    </Text>
                                </View>
                            )}
                            {(parsedShippingAddress.street || parsedShippingAddress.address) && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'الشارع / العنوان:' : 'Street / Address:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl]}>
                                        {parsedShippingAddress.street || parsedShippingAddress.address}
                                    </Text>
                                </View>
                            )}
                            {parsedShippingAddress.city && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'المدينة:' : 'City:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl]}>
                                        {parsedShippingAddress.city}
                                    </Text>
                                </View>
                            )}
                            {parsedShippingAddress.postalCode && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'الرمز البريدي:' : 'Postal Code:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl, { writingDirection: 'ltr' }]}>
                                        {parsedShippingAddress.postalCode}
                                    </Text>
                                </View>
                            )}
                            {parsedShippingAddress.country && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'الدولة:' : 'Country:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl]}>
                                        {parsedShippingAddress.country}
                                    </Text>
                                </View>
                            )}
                            {parsedShippingAddress.notes && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'تعليمات التوصيل:' : 'Delivery Notes:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl]}>
                                        {parsedShippingAddress.notes}
                                    </Text>
                                </View>
                            )}
                            {order.trackingNumber && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'رقم التتبع:' : 'Tracking #:'}
                                    </Text>
                                    <Text style={[styles.addressValue, styles.trackingNumberHighlight, isRTL && styles.cairoBold, isRTL && styles.addressValueRtl, { writingDirection: 'ltr' }]}>
                                        {order.trackingNumber}
                                    </Text>
                                </View>
                            )}
                            {order.estimatedDeliveryDate && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'الموعد المتوقع:' : 'Estimated Delivery:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl]}>
                                        {format(new Date(order.estimatedDeliveryDate), 'd MMMM yyyy', { locale: isRTL ? ar : enUS })}
                                    </Text>
                                </View>
                            )}
                            {order.deliveredAt && (
                                <View style={[styles.addressLine, isRTL && styles.addressLineRtl]}>
                                    <Text style={[styles.addressLabel, isRTL && styles.cairoRegular, isRTL && styles.addressLabelRtl]}>
                                        {isRTL ? 'تاريخ التوصيل:' : 'Delivered On:'}
                                    </Text>
                                    <Text style={[styles.addressValue, isRTL && styles.cairoMedium, isRTL && styles.addressValueRtl]}>
                                        {format(new Date(order.deliveredAt), 'd MMMM yyyy - p', { locale: isRTL ? ar : enUS })}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <Text style={[styles.emptyFulfillmentText, isRTL && styles.cairoRegular]}>
                            {isRTL
                                ? 'لا توجد تفاصيل شحن مسجلة لهذا الطلب'
                                : 'No shipping details recorded for this order.'}
                        </Text>
                    )}
                </View>

                {/* Financial Summary & Payment Details Card */}
                <View style={styles.card}>
                    <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
                        <AppIcon name="card" size={18} color="#7C3AED" />
                        <Text style={[styles.sectionTitle, isRTL && styles.cairoBold]}>
                            {isRTL ? 'الملخص المالي وطريقة الدفع' : 'Payment & Financial Summary'}
                        </Text>
                    </View>

                    <View style={styles.financialRows}>
                        {/* Subtotal */}
                        <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                            <Text style={[styles.summaryLabel, isRTL && styles.cairoRegular]}>
                                {isRTL ? 'المجموع الفرعي' : 'Subtotal'}
                            </Text>
                            <Text style={styles.summaryValue}>
                                {formatRiyal(
                                    order.subtotal !== undefined
                                        ? Number(order.subtotal)
                                        : (order.items || []).reduce((acc, it) => acc + getItemSubtotal(it), 0),
                                    isRTL ? 'ar' : 'en'
                                )}
                            </Text>
                        </View>

                        {/* Shipping Fee */}
                        {order.shippingFee !== undefined && Number(order.shippingFee) > 0 && (
                            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                                <Text style={[styles.summaryLabel, isRTL && styles.cairoRegular]}>
                                    {isRTL ? 'رسوم التوصيل' : 'Shipping Fee'}
                                </Text>
                                <Text style={styles.summaryValue}>
                                    {formatRiyal(Number(order.shippingFee), isRTL ? 'ar' : 'en')}
                                </Text>
                            </View>
                        )}

                        {/* Tax Amount */}
                        {order.taxAmount !== undefined && Number(order.taxAmount) > 0 && (
                            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                                <Text style={[styles.summaryLabel, isRTL && styles.cairoRegular]}>
                                    {isRTL ? 'ضريبة القيمة المضافة' : 'VAT / Tax'}
                                </Text>
                                <Text style={styles.summaryValue}>
                                    {formatRiyal(Number(order.taxAmount), isRTL ? 'ar' : 'en')}
                                </Text>
                            </View>
                        )}

                        <View style={styles.summaryDivider} />

                        {/* Total Amount */}
                        <View style={[styles.summaryTotalRow, isRTL && styles.rowReverse]}>
                            <Text style={[styles.summaryTotalLabel, isRTL && styles.cairoBold]}>
                                {isRTL ? 'الإجمالي الكلي' : 'Total Amount'}
                            </Text>
                            <Text style={[styles.summaryTotalValue, isRTL && styles.cairoBold]}>
                                {formatRiyal(Number(order.totalAmount || 0), isRTL ? 'ar' : 'en')}
                            </Text>
                        </View>

                        <View style={styles.summaryDivider} />

                        {/* Payment Method & Status */}
                        <View style={[styles.paymentInfoRow, isRTL && styles.rowReverse]}>
                            <View style={[styles.paymentMethodBlock, isRTL && styles.alignEnd]}>
                                <Text style={[styles.paymentMethodLabel, isRTL && styles.cairoRegular]}>
                                    {isRTL ? 'طريقة الدفع' : 'Payment Method'}
                                </Text>
                                <Text style={[styles.paymentMethodValue, isRTL && styles.cairoMedium]}>
                                    {formatPaymentMethod(order.paymentMethod, isRTL)}
                                </Text>
                            </View>

                            <View style={[styles.paymentBadge, { backgroundColor: paymentConfig.bg }]}>
                                <Text style={[styles.paymentBadgeText, { color: paymentConfig.color }, isRTL && styles.cairoBold]}>
                                    {paymentConfig.text}
                                </Text>
                            </View>
                        </View>

                        {order.paidAt && (
                            <View style={[styles.paidAtRow, isRTL && styles.rowReverse]}>
                                <Text style={[styles.paidAtLabel, isRTL && styles.cairoRegular]}>
                                    {isRTL ? 'تاريخ الدفع:' : 'Paid on:'}
                                </Text>
                                <Text style={styles.paidAtValue}>
                                    {format(new Date(order.paidAt), 'd MMM yyyy - p', { locale: isRTL ? ar : enUS })}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Actions: Pay Now / Cancel Order */}
                {(needsPayment || canCancel) && (
                    <View style={styles.actionsCard}>
                        {needsPayment && (
                            <TouchableOpacity
                                style={[styles.primaryPayButton, isRTL && styles.rowReverse]}
                                onPress={handlePayNow}
                                activeOpacity={0.85}
                            >
                                <AppIcon name="card" size={20} color="#FFFFFF" />
                                <Text style={[styles.primaryPayButtonText, isRTL && styles.cairoBold]}>
                                    {isRTL ? 'ادفع الآن' : 'Pay Now'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {canCancel && (
                            <TouchableOpacity
                                style={[styles.cancelOrderButton, isRTL && styles.rowReverse, needsPayment && { marginTop: 10 }]}
                                onPress={handleCancelOrder}
                                disabled={cancelling}
                                activeOpacity={0.85}
                            >
                                {cancelling ? (
                                    <ActivityIndicator size="small" color="#DC2626" />
                                ) : (
                                    <>
                                        <AppIcon name="close" size={18} color="#DC2626" />
                                        <Text style={[styles.cancelOrderButtonText, isRTL && styles.cairoMedium]}>
                                            {isRTL ? 'إلغاء الطلب' : 'Cancel Order'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>
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
            text: isAr ? 'فشل الدفع' : 'Payment Failed',
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

const formatPaymentMethod = (method: string | undefined, isAr: boolean) => {
    const m = `${method || ''}`.trim().toLowerCase();
    if (m === 'card' || m === 'credit_card') return isAr ? 'بطاقة بنكية' : 'Credit / Debit Card';
    if (m === 'online') return isAr ? 'دفع إلكتروني' : 'Online Payment';
    if (m === 'mada') return isAr ? 'مدى' : 'Mada';
    if (m === 'apple_pay') return isAr ? 'آبل باي' : 'Apple Pay';
    if (m === 'cash' || m === 'cod') return isAr ? 'الدفع عند الاستلام' : 'Cash on Delivery';
    if (m === 'wallet') return isAr ? 'المحفظة' : 'Wallet';
    return method || (isAr ? 'دفع إلكتروني' : 'Online');
};

const styles = StyleSheet.create({
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
    },
    alignEnd: {
        alignItems: 'flex-end',
    },
    alignStart: {
        alignItems: 'flex-start',
    },
    container: {
        flex: 1,
        backgroundColor: '#F7F6FB',
    },
    centeredContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        gap: spacing.md,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: spacing.md + 2,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    orderHeaderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    orderIdBlock: {
        flex: 1,
    },
    orderNumberLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    orderNumberValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1D035F',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    orderMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0EAFB',
    },
    orderDateText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    storeSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0EAFB',
    },
    storeLogo: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    storeLogoPlaceholder: {
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    storeLogoPlaceholderText: {
        color: '#7C3AED',
        fontWeight: '700',
        fontSize: 18,
    },
    storeInfoText: {
        flex: 1,
    },
    storeLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    storeName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0EAFB',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        flex: 1,
    },
    itemCountBadge: {
        backgroundColor: '#F5EEFF',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    itemCountText: {
        fontSize: 11,
        color: '#7C3AED',
        fontWeight: '700',
    },
    itemsList: {
        gap: 10,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        gap: 12,
    },
    itemRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F9F5FF',
        paddingBottom: 12,
    },
    itemThumbnail: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#F7F4FF',
    },
    itemThumbnailPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#EAE1FA',
    },
    itemDetails: {
        flex: 1,
    },
    itemName: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 18,
    },
    itemSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    itemQuantity: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    itemDot: {
        fontSize: 10,
        color: colors.textSecondary,
    },
    itemUnitPrice: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    itemLineTotalBlock: {
        alignItems: 'flex-end',
    },
    itemLineTotal: {
        fontSize: 14,
        fontWeight: '700',
        color: '#7C3AED',
    },
    fulfillmentBody: {
        gap: 8,
    },
    addressLine: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    addressLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        width: 90,
    },
    addressValue: {
        fontSize: 13,
        color: colors.text,
        flex: 1,
        lineHeight: 18,
    },
    emptyFulfillmentText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontStyle: 'italic',
        paddingVertical: 8,
    },
    financialRows: {
        gap: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#F0EAFB',
        marginVertical: 4,
    },
    summaryTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2,
    },
    summaryTotalLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1D035F',
    },
    summaryTotalValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#7C3AED',
    },
    paymentInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    paymentMethodBlock: {
        flex: 1,
    },
    paymentMethodLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    paymentMethodValue: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    paymentBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    paymentBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    paidAtRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    paidAtLabel: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    paidAtValue: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    actionsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    primaryPayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#7C3AED',
        borderRadius: 14,
        paddingVertical: 14,
    },
    primaryPayButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    cancelOrderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 14,
        paddingVertical: 12,
    },
    cancelOrderButtonText: {
        color: '#DC2626',
        fontSize: 14,
        fontWeight: '600',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    errorIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
        marginBottom: 8,
    },
    errorSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    errorActions: {
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        maxWidth: 240,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#7C3AED',
        borderRadius: 12,
        paddingVertical: 11,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    backOutlineButton: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 12,
        paddingVertical: 11,
        backgroundColor: '#FFFFFF',
    },
    backOutlineButtonText: {
        color: '#1D035F',
        fontSize: 14,
        fontWeight: '700',
    },
    headerBadgesCol: {
        alignItems: 'flex-end',
        gap: 5,
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
    trackingNumberHighlight: {
        fontFamily: 'monospace',
        fontWeight: '700',
        color: '#1E40AF',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    cancelledAlertCard: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
    },
    cancelledAlertHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    cancelledAlertIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelledAlertMeta: {
        flex: 1,
    },
    cancelledAlertTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#991B1B',
    },
    cancelledAlertDate: {
        fontSize: 11,
        color: '#DC2626',
        marginTop: 2,
    },
    cancelledAlertReason: {
        fontSize: 12,
        color: '#B91C1C',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#FEE2E2',
    },
    cancelledAlertReasonBold: {
        fontWeight: '700',
    },
    shippedBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
    },
    shippedBannerIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shippedBannerContent: {
        flex: 1,
    },
    shippedBannerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E40AF',
        marginBottom: 3,
    },
    shippedBannerSub: {
        fontSize: 12,
        color: '#3B82F6',
        lineHeight: 17,
        marginBottom: 8,
    },
    shippedTrackingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    shippedTrackingBoxRtl: {
        flexDirection: 'row-reverse',
        alignSelf: 'flex-end',
    },
    shippedTrackingLabel: {
        fontSize: 11,
        color: '#6B7280',
    },
    shippedTrackingCode: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'monospace',
        color: '#1E40AF',
    },
    addressLineRtl: {
        flexDirection: 'row-reverse',
    },
    addressLabelRtl: {
        textAlign: 'right',
    },
    addressValueRtl: {
        textAlign: 'right',
    },
    textRtl: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    shippedDeliveryDateText: {
        fontSize: 12,
        color: '#1D4ED8',
    },
    pickupReadyBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
    },
    pickupReadyIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickupReadyContent: {
        flex: 1,
    },
    pickupReadyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#065F46',
        marginBottom: 3,
    },
    pickupReadySub: {
        fontSize: 12,
        color: '#059669',
        lineHeight: 17,
        marginBottom: 6,
    },
    pickupReadyDateText: {
        fontSize: 12,
        color: '#047857',
    },
    timelineMethodBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: '#F3E8FF',
        marginInlineStart: 'auto',
    },
    timelineMethodText: {
        fontSize: 11,
        color: '#6D28D9',
        fontWeight: '600',
    },
    timelineContainer: {
        paddingTop: 4,
        paddingBottom: 2,
    },
    timelineItemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    timelineTrackCol: {
        alignItems: 'center',
        width: 26,
    },
    timelineNode: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    timelineNodePassed: {
        backgroundColor: '#10B981',
    },
    timelineNodeCurrent: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#7C3AED',
    },
    timelineNodeCurrentDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#7C3AED',
    },
    timelineNodeFuture: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    timelineNodeFutureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D1D5DB',
    },
    timelineConnector: {
        width: 2,
        height: 38,
        zIndex: 1,
    },
    timelineConnectorPassed: {
        backgroundColor: '#10B981',
    },
    timelineConnectorFuture: {
        backgroundColor: '#E5E7EB',
    },
    timelineContentCol: {
        flex: 1,
        paddingInlineStart: 12,
        paddingBottom: 16,
    },
    timelineContentHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 6,
        marginBottom: 2,
    },
    timelineStepTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    timelineStepTitleActive: {
        fontSize: 14,
        fontWeight: '700',
        color: '#7C3AED',
    },
    timelineStepTitleFuture: {
        color: '#9CA3AF',
    },
    timelineTimestampText: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    timelineStepDesc: {
        fontSize: 11,
        color: colors.textSecondary,
        lineHeight: 16,
    },
    timelineStepDescActive: {
        color: '#4B5563',
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
