import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, Tenant } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';

interface CartScreenProps {
    route: any;
    navigation: any;
}

export function CartScreen({ route, navigation }: CartScreenProps) {
    const { t, isRTL } = useLanguage();
    const { showLogin } = useAppSession();
    const { cartItems, cartTotal, updateQuantity, removeFromCart, clearCart, cartTenantId } = useCart();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    // We expect tenant to be passed from TenantScreen when navigating to Cart
    const tenant: Tenant = route.params?.tenant;

    const [loading, setLoading] = useState(false);

    // Form State
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    const [city, setCity] = useState('');
    const [district, setDistrict] = useState('');
    const [street, setStreet] = useState('');
    const [building, setBuilding] = useState('');

    const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');
    const [paymentMethod, setPaymentMethod] = useState<'cash-on-delivery' | 'online'>('online');

    const labels = {
        cartTitle: isRTL ? 'سلة الشراء' : 'Shopping Cart',
        orderItems: isRTL ? 'عناصر الطلب' : 'Order Items',
        personalInfo: isRTL ? 'المعلومات الشخصية' : 'Personal Information',
        shippingAddress: isRTL ? 'عنوان التوصيل' : 'Shipping Address',
        deliveryMethod: isRTL ? 'طريقة التوصيل' : 'Delivery Method',
        paymentMethod: isRTL ? 'طريقة الدفع' : 'Payment Method',
        orderSummary: isRTL ? 'ملخص الطلب' : 'Order Summary',
        continueShopping: isRTL ? 'متابعة التسوق' : 'Continue Shopping',
        placeOrder: isRTL ? 'إتمام الطلب' : 'Place Order',
    };

    useEffect(() => {
        let isMounted = true;

        const hydrateCustomerDefaults = async () => {
            const user = await api.getUser();
            if (!user || !isMounted) {
                return;
            }

            setCustomerName((value) => value || `${user.firstName} ${user.lastName}`.trim());
            setCustomerEmail((value) => value || user.email || '');
            setCustomerPhone((value) => value || user.addressPhone || user.phone || '');
            setCity((value) => value || user.addressCity || '');
            setStreet((value) => value || user.addressStreet || '');
            setBuilding((value) => value || user.addressBuilding || '');
        };

        hydrateCustomerDefaults().catch(() => undefined);

        return () => {
            isMounted = false;
        };
    }, []);

    // Calculations
    const deliveryFee = deliveryMethod === 'express' ? 50 : (cartTotal >= 200 ? 0 : 25);
    const tax = cartTotal * 0.15;
    const finalTotal = cartTotal + tax + deliveryFee;

    const syncProfileAddress = async () => {
        try {
            await api.updateProfile({
                addressCity: city,
                addressStreet: street,
                addressBuilding: building || undefined,
                addressPhone: customerPhone,
            });
        } catch (error) {
            console.error('Failed to sync checkout profile data:', error);
        }
    };

    const handleCheckout = async () => {
        const itemTenantIds = Array.from(new Set(cartItems.map((item) => item.product.tenantId).filter(Boolean)));
        const checkoutTenantId = tenant?.id || cartTenantId || itemTenantIds[0];

        if (!checkoutTenantId) {
            Alert.alert('Error', 'Tenant information is missing.');
            return;
        }

        if (itemTenantIds.length > 1) {
            Alert.alert('Error', 'Your cart contains products from multiple tenants. Please keep one tenant per order.');
            return;
        }

        const user = await api.getUser();
        if (!user) {
            Alert.alert(t('guestTitle'), t('loginToOrderOrders'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('loginNow'), onPress: showLogin },
            ]);
            return;
        }

        if (!customerName || !customerEmail || !customerPhone || !city || !district || !street) {
            Alert.alert('Missing Details', 'Please fill in all required fields (Name, Email, Phone, City, District, Street).');
            return;
        }

        const payload = {
            tenantId: checkoutTenantId,
            items: cartItems.map(item => ({
                productId: item.product.id,
                quantity: item.quantity
            })),
            paymentMethod: paymentMethod === 'online' ? 'online' : 'cash_on_delivery',
            deliveryType: 'delivery',
            shippingAddress: {
                city,
                district,
                street,
                building,
                phone: customerPhone,
                notes: '',
            },
            notes: `${customerName} | ${customerEmail}`,
        };

        try {
            setLoading(true);
            const res = await api.post<{ success: boolean; order: any; message?: string }>('/orders', payload);
            if (!res.success || !res.order) {
                Alert.alert('Error', res.message || 'Failed to place order.');
                return;
            }

            await syncProfileAddress();

            if (paymentMethod === 'online') {
                clearCart();
                navigation.navigate('Payment', {
                    orderId: res.order.id,
                    amount: Number(res.order.totalAmount),
                    tenantId: checkoutTenantId,
                });
                return;
            }

            clearCart();
            Alert.alert('Success', 'Order placed successfully!', [
                { text: 'OK', onPress: () => navigation.navigate('Tabs', { screen: 'Purchases' }) }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to place order.');
        } finally {
            setLoading(false);
        }
    };

    if (cartItems.length === 0) {
        return (
            <View style={[styles.container, styles.centerAll]}>
                <AppIcon name="cart" size={80} color={colors.textSecondary} />
                <Text style={styles.emptyTitle}>Your cart is empty</Text>
                <Text style={styles.emptySubtitle}>Looks like you haven't added any products yet.</Text>
                <TouchableOpacity style={styles.continueButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.continueButtonText}>Continue Shopping</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <View style={[styles.header, { paddingTop: spacing.md + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{labels.cartTitle}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.orderItems}</Text>
                    {cartItems.map(item => (
                        <View key={item.product.id} style={styles.cartItem}>
                            <Image
                                source={{ uri: item.product.images?.length ? getImageUrl(item.product.images[0]) : 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600&auto=format&fit=crop' }}
                                style={styles.itemImage}
                            />
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName} numberOfLines={2}>{isRTL ? item.product.name_ar : item.product.name_en}</Text>
                                <Text style={styles.itemPrice}>{item.product.price} SAR</Text>
                                <View style={styles.qtyControls}>
                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product.id, item.quantity - 1)}>
                                        <AppIcon name="minus" size={18} color={colors.text} />
                                    </TouchableOpacity>
                                    <Text style={styles.qtyText}>{item.quantity}</Text>
                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product.id, item.quantity + 1)}>
                                        <AppIcon name="plus" size={18} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => removeFromCart(item.product.id)} style={styles.removeBtn}>
                                <AppIcon name="delete" size={20} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.personalInfo}</Text>
                    <Text style={styles.fieldLabel}>{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={isRTL ? 'ادخل الاسم الكامل' : 'Enter full name'}
                        placeholderTextColor={colors.textSecondary}
                        value={customerName}
                        onChangeText={setCustomerName}
                    />
                    <Text style={styles.fieldLabel}>{isRTL ? 'البريد الإلكتروني *' : 'Email Address *'}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={isRTL ? 'ادخل البريد الإلكتروني' : 'Enter email address'}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={customerEmail}
                        onChangeText={setCustomerEmail}
                    />
                    <Text style={styles.fieldLabel}>{isRTL ? 'رقم الجوال *' : 'Phone Number *'}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={isRTL ? 'ادخل رقم الجوال' : 'Enter phone number'}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="phone-pad"
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.shippingAddress}</Text>
                    <View style={styles.row}>
                        <View style={[styles.flexField, { marginRight: spacing.sm }]}>
                            <Text style={styles.fieldLabel}>{isRTL ? 'المدينة *' : 'City *'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={isRTL ? 'المدينة' : 'City'}
                                placeholderTextColor={colors.textSecondary}
                                value={city}
                                onChangeText={setCity}
                            />
                        </View>
                        <View style={styles.flexField}>
                            <Text style={styles.fieldLabel}>{isRTL ? 'الحي *' : 'District *'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={isRTL ? 'الحي' : 'District'}
                                placeholderTextColor={colors.textSecondary}
                                value={district}
                                onChangeText={setDistrict}
                            />
                        </View>
                    </View>
                    <Text style={styles.fieldLabel}>{isRTL ? 'اسم الشارع *' : 'Street Name *'}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={isRTL ? 'الشارع' : 'Street name'}
                        placeholderTextColor={colors.textSecondary}
                        value={street}
                        onChangeText={setStreet}
                    />
                    <Text style={styles.fieldLabel}>{isRTL ? 'المبنى / الشقة' : 'Building / Apartment'}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={isRTL ? 'المبنى أو الشقة' : 'Building or apartment'}
                        placeholderTextColor={colors.textSecondary}
                        value={building}
                        onChangeText={setBuilding}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.deliveryMethod}</Text>
                    <View style={styles.methodOptions}>
                        <TouchableOpacity
                            style={[styles.methodOption, deliveryMethod === 'standard' && styles.methodOptionActive]}
                            onPress={() => setDeliveryMethod('standard')}
                        >
                            <AppIcon name="bicycle" size={24} color={deliveryMethod === 'standard' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, deliveryMethod === 'standard' && styles.methodLabelActive]}>Standard</Text>
                            <Text style={styles.methodDesc}>(2-3 days)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.methodOption, deliveryMethod === 'express' && styles.methodOptionActive]}
                            onPress={() => setDeliveryMethod('express')}
                        >
                            <AppIcon name="rocket" size={24} color={deliveryMethod === 'express' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, deliveryMethod === 'express' && styles.methodLabelActive]}>Express</Text>
                            <Text style={styles.methodDesc}>(Same day)</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.paymentMethod}</Text>
                    <View style={styles.methodOptions}>
                        <TouchableOpacity
                            style={[styles.methodOption, paymentMethod === 'online' && styles.methodOptionActive]}
                            onPress={() => setPaymentMethod('online')}
                        >
                            <AppIcon name="card" size={24} color={paymentMethod === 'online' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, paymentMethod === 'online' && styles.methodLabelActive]}>Credit Card</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.methodOption, paymentMethod === 'cash-on-delivery' && styles.methodOptionActive]}
                            onPress={() => setPaymentMethod('cash-on-delivery')}
                        >
                            <AppIcon name="cash" size={24} color={paymentMethod === 'cash-on-delivery' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, paymentMethod === 'cash-on-delivery' && styles.methodLabelActive]}>Cash on Delivery</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.section, styles.summarySection]}>
                    <Text style={styles.sectionTitle}>{labels.orderSummary}</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>{cartTotal.toFixed(2)} SAR</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Delivery</Text>
                        <Text style={styles.summaryValue}>{deliveryFee.toFixed(2)} SAR</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>VAT (15%)</Text>
                        <Text style={styles.summaryValue}>{tax.toFixed(2)} SAR</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{finalTotal.toFixed(2)} SAR</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: bottomInset }]}>
                <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.checkoutBtnText}>{labels.placeOrder} • {finalTotal.toFixed(2)} SAR</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F4FF',
    },
    centerAll: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyTitle: {
        fontSize: fontSize.xl,
        fontWeight: 'bold',
        color: colors.text,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    continueButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
    },
    continueButtonText: {
        color: colors.textInverse,
        fontWeight: 'bold',
        fontSize: fontSize.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 0,
    },
    backButton: {
        padding: spacing.sm,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
    },
    scrollContent: {
        padding: spacing.md,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: spacing.lg,
        marginBottom: spacing.md,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: '#111827',
        marginBottom: spacing.md,
    },
    fieldLabel: {
        fontSize: fontSize.sm,
        color: '#4B5563',
        marginBottom: spacing.xs,
        fontWeight: '600',
    },
    cartItem: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#EDE9FE',
        paddingVertical: spacing.md,
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.md,
        backgroundColor: colors.backgroundGray,
    },
    itemInfo: {
        flex: 1,
        marginLeft: spacing.md,
        justifyContent: 'center',
    },
    itemName: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    itemPrice: {
        fontSize: fontSize.md,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: spacing.sm,
    },
    qtyControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F0FF',
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    qtyBtn: {
        padding: 6,
    },
    qtyText: {
        paddingHorizontal: 12,
        fontWeight: 'bold',
        color: colors.text,
    },
    removeBtn: {
        padding: spacing.sm,
        justifyContent: 'center',
    },
    input: {
        backgroundColor: '#FAFAFF',
        padding: spacing.md,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        marginBottom: spacing.md,
        color: colors.text,
        fontFamily: Platform.OS === 'ios' ? 'Cairo-Regular' : undefined,
    },
    flexField: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
    },
    methodOptions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    methodOption: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#DDD6FE',
        borderRadius: 14,
        padding: spacing.md,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    methodOptionActive: {
        borderColor: colors.primary,
        backgroundColor: '#F3E8FF',
    },
    methodLabel: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    methodLabelActive: {
        color: colors.primary,
    },
    methodDesc: {
        fontSize: 10,
        color: colors.textSecondary,
    },
    summarySection: {
        marginBottom: spacing.xl,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    summaryLabel: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
    },
    summaryValue: {
        color: colors.text,
        fontWeight: '600',
        fontSize: fontSize.md,
    },
    totalRow: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    totalLabel: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
    },
    totalValue: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.primary,
    },
    footer: {
        backgroundColor: '#FFFFFF',
        padding: spacing.lg,
        borderTopWidth: 0,
    },
    checkoutBtn: {
        backgroundColor: '#7C3AED',
        padding: spacing.md,
        borderRadius: 16,
        alignItems: 'center',
    },
    checkoutBtnText: {
        color: colors.textInverse,
        fontSize: fontSize.lg,
        fontWeight: 'bold',
    },
});
