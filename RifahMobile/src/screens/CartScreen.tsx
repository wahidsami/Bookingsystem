import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { Ionicons } from '@expo/vector-icons';
import { api, getImageUrl, Tenant } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';

interface CartScreenProps {
    route: any;
    navigation: any;
}

export function CartScreen({ route, navigation }: CartScreenProps) {
    const { t, isRTL } = useLanguage();
    const { showLogin } = useAppSession();
    const { cartItems, cartTotal, updateQuantity, removeFromCart, clearCart, cartTenantId } = useCart();

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
                <Ionicons name="cart-outline" size={80} color={colors.textSecondary} style={{ opacity: 0.5 }} />
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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Shopping Cart</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Items</Text>
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
                                        <Ionicons name="remove" size={18} color={colors.text} />
                                    </TouchableOpacity>
                                    <Text style={styles.qtyText}>{item.quantity}</Text>
                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product.id, item.quantity + 1)}>
                                        <Ionicons name="add" size={18} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => removeFromCart(item.product.id)} style={styles.removeBtn}>
                                <Ionicons name="trash-outline" size={20} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Full Name *"
                        value={customerName}
                        onChangeText={setCustomerName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Email Address *"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={customerEmail}
                        onChangeText={setCustomerEmail}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Phone Number *"
                        keyboardType="phone-pad"
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Shipping Address</Text>
                    <View style={styles.row}>
                        <TextInput style={[styles.input, { flex: 1, marginRight: spacing.sm }]} placeholder="City *" value={city} onChangeText={setCity} />
                        <TextInput style={[styles.input, { flex: 1 }]} placeholder="District *" value={district} onChangeText={setDistrict} />
                    </View>
                    <TextInput style={styles.input} placeholder="Street Name *" value={street} onChangeText={setStreet} />
                    <TextInput style={styles.input} placeholder="Building/Apartment" value={building} onChangeText={setBuilding} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Delivery Method</Text>
                    <View style={styles.methodOptions}>
                        <TouchableOpacity
                            style={[styles.methodOption, deliveryMethod === 'standard' && styles.methodOptionActive]}
                            onPress={() => setDeliveryMethod('standard')}
                        >
                            <Ionicons name="bicycle-outline" size={24} color={deliveryMethod === 'standard' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, deliveryMethod === 'standard' && styles.methodLabelActive]}>Standard</Text>
                            <Text style={styles.methodDesc}>(2-3 days)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.methodOption, deliveryMethod === 'express' && styles.methodOptionActive]}
                            onPress={() => setDeliveryMethod('express')}
                        >
                            <Ionicons name="rocket-outline" size={24} color={deliveryMethod === 'express' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, deliveryMethod === 'express' && styles.methodLabelActive]}>Express</Text>
                            <Text style={styles.methodDesc}>(Same day)</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Method</Text>
                    <View style={styles.methodOptions}>
                        <TouchableOpacity
                            style={[styles.methodOption, paymentMethod === 'online' && styles.methodOptionActive]}
                            onPress={() => setPaymentMethod('online')}
                        >
                            <Ionicons name="card-outline" size={24} color={paymentMethod === 'online' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, paymentMethod === 'online' && styles.methodLabelActive]}>Credit Card</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.methodOption, paymentMethod === 'cash-on-delivery' && styles.methodOptionActive]}
                            onPress={() => setPaymentMethod('cash-on-delivery')}
                        >
                            <Ionicons name="cash-outline" size={24} color={paymentMethod === 'cash-on-delivery' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, paymentMethod === 'cash-on-delivery' && styles.methodLabelActive]}>Cash on Delivery</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.section, styles.summarySection]}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
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

            <View style={styles.footer}>
                <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.checkoutBtnText}>Place Order • {finalTotal.toFixed(2)} SAR</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        color: 'white',
        fontWeight: 'bold',
        fontSize: fontSize.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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
        paddingBottom: 40,
    },
    section: {
        backgroundColor: 'white',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: spacing.md,
    },
    cartItem: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: spacing.md,
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.md,
        backgroundColor: '#F3F4F6',
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
        backgroundColor: '#F3F4F6',
        borderRadius: borderRadius.sm,
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
        backgroundColor: '#F3F4F6',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        color: colors.text,
        fontFamily: Platform.OS === 'ios' ? 'Cairo-Regular' : undefined,
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
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    methodOptionActive: {
        borderColor: colors.primary,
        backgroundColor: '#EFF6FF',
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
        backgroundColor: 'white',
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg,
    },
    checkoutBtn: {
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    checkoutBtnText: {
        color: 'white',
        fontSize: fontSize.lg,
        fontWeight: 'bold',
    },
});
