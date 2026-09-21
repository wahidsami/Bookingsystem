import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useCart } from '../contexts/CartContext';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, Tenant, UserAddress } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';

interface CartScreenProps {
    route: any;
    navigation: any;
}

export function CartScreen({ route, navigation }: CartScreenProps) {
    const { t, isRTL } = useLanguage();
    const { showLogin, isAuthenticated, user, refreshSession } = useAppSession();
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

    // Saved Addresses State
    const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [useManualAddress, setUseManualAddress] = useState(false);

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
        if (isAuthenticated && !user) {
            void refreshSession();
            return;
        }

        let isMounted = true;

        const hydrateCustomerDefaults = async () => {
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
    }, [isAuthenticated, refreshSession, user]);

    const fetchSavedAddresses = async () => {
        if (!isAuthenticated) return;
        try {
            const list = await api.getAddresses();
            setSavedAddresses(list);
            if (list.length > 0) {
                setSelectedAddressId((prev) => {
                    if (prev && list.some((a) => a.id === prev)) return prev;
                    const def = list.find((a) => a.isDefault) || list[0];
                    if (def) {
                        setStreet(def.street || '');
                        setCity(def.city || '');
                        setBuilding(def.building || '');
                        if (def.phone) setCustomerPhone((p) => p || def.phone || '');
                        return def.id;
                    }
                    return null;
                });
            }
        } catch (e) {
            console.warn('Failed to load saved addresses in Cart', e);
        }
    };

    useEffect(() => {
        fetchSavedAddresses();
        const unsubscribe = navigation.addListener('focus', () => {
            fetchSavedAddresses();
        });
        return unsubscribe;
    }, [navigation, isAuthenticated]);

    const handleSelectAddress = (addr: UserAddress) => {
        setSelectedAddressId(addr.id);
        setStreet(addr.street || '');
        setCity(addr.city || '');
        setBuilding(addr.building || '');
        if (addr.phone) setCustomerPhone(addr.phone);
        setUseManualAddress(false);
    };

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
        const itemTenantIds = Array.from(new Set(cartItems.map((item) => item.product?.tenantId).filter(Boolean)));
        const checkoutTenantId = tenant?.id || cartTenantId || itemTenantIds[0];

        if (!checkoutTenantId) {
            Alert.alert('Error', 'Tenant information is missing.');
            return;
        }

        if (itemTenantIds.length > 1) {
            Alert.alert('Error', 'Your cart contains products from multiple tenants. Please keep one tenant per order.');
            return;
        }

        if (!isAuthenticated) {
            Alert.alert(t('guestTitle'), t('loginToOrderOrders'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('loginNow'), onPress: showLogin },
            ]);
            return;
        }

        let shippingPayload: any = null;
        if (!useManualAddress && selectedAddressId) {
            const chosen = savedAddresses.find((a) => a.id === selectedAddressId);
            if (chosen) {
                shippingPayload = {
                    title: chosen.title,
                    street: chosen.street,
                    city: chosen.city,
                    building: chosen.building,
                    floor: chosen.floor,
                    apartment: chosen.apartment,
                    phone: chosen.phone || customerPhone,
                    notes: chosen.notes || '',
                };
            }
        }

        if (!shippingPayload) {
            if (!city.trim() || !street.trim()) {
                Alert.alert(
                    isRTL ? 'بيانات العنوان ناقصة' : 'Missing Address',
                    isRTL ? 'يرجى اختيار عنوان محفوظ أو إدخال المدينة والشارع' : 'Please select a saved address or enter City and Street.'
                );
                return;
            }
            shippingPayload = {
                city: city.trim(),
                district: district.trim() || city.trim(),
                street: street.trim(),
                building: building.trim(),
                phone: customerPhone,
                notes: '',
            };
        }

        if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
            Alert.alert(
                isRTL ? 'بيانات شخصية ناقصة' : 'Missing Details',
                isRTL ? 'يرجى إكمال الاسم والبريد الإلكتروني ورقم الجوال' : 'Please fill in Name, Email, and Phone Number.'
            );
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
            shippingAddress: shippingPayload,
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
                    checkoutType: 'product',
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
            <View style={[styles.header, isRTL && styles.rowRTL, { paddingTop: spacing.md + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{labels.cartTitle}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}>
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{labels.orderItems}</Text>
                    {cartItems.map((item, idx) => {
                        if (!item?.product) return null;
                        const prod = item.product;
                        return (
                            <View key={prod.id || `cart-item-${idx}`} style={[styles.cartItem, isRTL && styles.rowRTL]}>
                                <Image
                                    source={{ uri: prod.images?.length ? getImageUrl(prod.images[0]) : 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600&auto=format&fit=crop' }}
                                    style={styles.itemImage}
                                />
                                <View style={[styles.itemInfo, isRTL && styles.itemInfoRTL]}>
                                    <Text style={[styles.itemName, isRTL && styles.rtlText]} numberOfLines={2}>{isRTL ? (prod.name_ar || prod.name_en) : (prod.name_en || prod.name_ar)}</Text>
                                    <Text style={[styles.itemPrice, isRTL && styles.rtlText]}>{formatRiyal(prod.price || 0, isRTL ? 'ar' : 'en')}</Text>
                                    <View style={[styles.qtyControls, isRTL && styles.rowRTL]}>
                                        <TouchableOpacity style={styles.qtyBtn} onPress={() => prod.id && updateQuantity(prod.id, item.quantity - 1)}>
                                            <AppIcon name="minus" size={18} color={colors.text} />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyText}>{item.quantity}</Text>
                                        <TouchableOpacity style={styles.qtyBtn} onPress={() => prod.id && updateQuantity(prod.id, item.quantity + 1)}>
                                            <AppIcon name="plus" size={18} color={colors.text} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => prod.id && removeFromCart(prod.id)} style={styles.removeBtn}>
                                    <AppIcon name="delete" size={20} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{labels.personalInfo}</Text>
                    <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        placeholder={isRTL ? 'ادخل الاسم الكامل' : 'Enter full name'}
                        placeholderTextColor={colors.textSecondary}
                        value={customerName}
                        onChangeText={setCustomerName}
                    />
                    <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? 'البريد الإلكتروني *' : 'Email Address *'}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.emailInputRtl]}
                        placeholder={isRTL ? 'ادخل البريد الإلكتروني' : 'Enter email address'}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={customerEmail}
                        onChangeText={setCustomerEmail}
                    />
                    <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{isRTL ? 'رقم الجوال *' : 'Phone Number *'}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.phoneInputRtl]}
                        placeholder={isRTL ? 'ادخل رقم الجوال' : 'Enter phone number'}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="phone-pad"
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                    />
                </View>

                <View style={styles.section}>
                    <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{labels.shippingAddress}</Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('SavedAddresses')}
                            style={[styles.manageAddressesBtn, isRTL && styles.rowRTL]}
                        >
                            <Text style={styles.manageAddressesText}>
                                {isRTL ? 'إدارة العناوين' : 'Manage Addresses'}
                            </Text>
                            <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={14} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {savedAddresses.length > 0 && !useManualAddress ? (
                        <View style={styles.addressListContainer}>
                            {savedAddresses.map((addr) => {
                                const isSelected = selectedAddressId === addr.id;
                                return (
                                    <TouchableOpacity
                                        key={addr.id}
                                        style={[
                                            styles.savedAddressCard,
                                            isRTL && styles.rowRTL,
                                            isSelected && styles.savedAddressCardSelected,
                                        ]}
                                        onPress={() => handleSelectAddress(addr)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.radioIndicator, isSelected && styles.radioIndicatorSelected]}>
                                            {isSelected && <View style={styles.radioIndicatorActive} />}
                                        </View>
                                        <View style={[styles.savedAddressContent, isRTL && { alignItems: 'flex-end' }]}>
                                            <View style={[styles.savedAddressTitleRow, isRTL && styles.rowRTL]}>
                                                <Text style={[styles.savedAddressTitle, isSelected && styles.savedAddressTitleSelected]}>
                                                    {addr.title}
                                                </Text>
                                                {addr.isDefault && (
                                                    <View style={styles.addressDefaultTag}>
                                                        <Text style={styles.addressDefaultTagText}>
                                                            {isRTL ? 'الافتراضي' : 'Default'}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={[styles.savedAddressDetails, isRTL && styles.rtlText]}>
                                                {addr.street}, {addr.city}
                                                {addr.building ? ` - ${isRTL ? 'مبنى' : 'Bldg'} ${addr.building}` : ''}
                                                {addr.apartment ? ` | ${isRTL ? 'شقة' : 'Apt'} ${addr.apartment}` : ''}
                                            </Text>
                                            {addr.phone ? (
                                                <Text style={styles.savedAddressPhone}>📞 {addr.phone}</Text>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity
                                style={styles.addOrManualToggle}
                                onPress={() => setUseManualAddress(true)}
                            >
                                <Text style={styles.addOrManualToggleText}>
                                    {isRTL ? '+ إدخال عنوان يدوي مخصص' : '+ Enter a different address manually'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View>
                            {savedAddresses.length > 0 && (
                                <TouchableOpacity
                                    style={styles.chooseSavedBtn}
                                    onPress={() => setUseManualAddress(false)}
                                >
                                    <Text style={styles.chooseSavedBtnText}>
                                        {isRTL ? '→ استخدام أحد العناوين المحفوظة' : '← Use a saved address instead'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {savedAddresses.length === 0 && (
                                <View style={[styles.noAddressBanner, isRTL && styles.rowRTL]}>
                                    <AppIcon name="location" size={24} color={colors.primary} />
                                    <View style={[{ flex: 1, marginHorizontal: spacing.sm }, isRTL && { alignItems: 'flex-end' }]}>
                                        <Text style={[styles.noAddressTitle, isRTL && styles.rtlText]}>
                                            {isRTL ? 'لا توجد عناوين محفوظة' : 'No saved addresses'}
                                        </Text>
                                        <Text style={[styles.noAddressSubtitle, isRTL && styles.rtlText]}>
                                            {isRTL ? 'أضف عنوانك لتسريع عملية الطلب' : 'Save your address for faster checkout'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.quickAddAddressBtn}
                                        onPress={() => navigation.navigate('SavedAddresses')}
                                    >
                                        <Text style={styles.quickAddAddressText}>{isRTL ? 'إضافة' : 'Add'}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
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
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{labels.deliveryMethod}</Text>
                    <View style={[styles.methodOptions, isRTL && styles.rowRTL]}>
                        <TouchableOpacity
                            style={[styles.methodOption, deliveryMethod === 'standard' && styles.methodOptionActive]}
                            onPress={() => setDeliveryMethod('standard')}
                        >
                            <AppIcon name="bicycle" size={24} color={deliveryMethod === 'standard' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, deliveryMethod === 'standard' && styles.methodLabelActive]}>
                                {isRTL ? 'توصيل عادي' : 'Standard'}
                            </Text>
                            <Text style={styles.methodDesc}>
                                {isRTL ? '(خلال 2-3 أيام)' : '(2-3 days)'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.methodOption, deliveryMethod === 'express' && styles.methodOptionActive]}
                            onPress={() => setDeliveryMethod('express')}
                        >
                            <AppIcon name="rocket" size={24} color={deliveryMethod === 'express' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, deliveryMethod === 'express' && styles.methodLabelActive]}>
                                {isRTL ? 'توصيل سريع' : 'Express'}
                            </Text>
                            <Text style={styles.methodDesc}>
                                {isRTL ? '(خلال نفس اليوم)' : '(Same day)'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{labels.paymentMethod}</Text>
                    <View style={[styles.methodOptions, isRTL && styles.rowRTL]}>
                        <TouchableOpacity
                            style={[styles.methodOption, paymentMethod === 'online' && styles.methodOptionActive]}
                            onPress={() => setPaymentMethod('online')}
                        >
                            <AppIcon name="card" size={24} color={paymentMethod === 'online' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, paymentMethod === 'online' && styles.methodLabelActive]}>
                                {isRTL ? 'بطاقة بنكية' : 'Credit Card'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.methodOption, paymentMethod === 'cash-on-delivery' && styles.methodOptionActive]}
                            onPress={() => setPaymentMethod('cash-on-delivery')}
                        >
                            <AppIcon name="cash" size={24} color={paymentMethod === 'cash-on-delivery' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.methodLabel, paymentMethod === 'cash-on-delivery' && styles.methodLabelActive]}>
                                {isRTL ? 'دفع عند الاستلام' : 'Cash on Delivery'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.section, styles.summarySection]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{labels.orderSummary}</Text>
                    <View style={[styles.summaryRow, isRTL && styles.rowRTL]}>
                        <Text style={styles.summaryLabel}>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</Text>
                        <Text style={styles.summaryValue}>{formatRiyal(cartTotal, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <View style={[styles.summaryRow, isRTL && styles.rowRTL]}>
                        <Text style={styles.summaryLabel}>{isRTL ? 'التوصيل' : 'Delivery'}</Text>
                        <Text style={styles.summaryValue}>{formatRiyal(deliveryFee, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <View style={[styles.summaryRow, isRTL && styles.rowRTL]}>
                        <Text style={styles.summaryLabel}>{isRTL ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</Text>
                        <Text style={styles.summaryValue}>{formatRiyal(tax, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow, isRTL && styles.rowRTL]}>
                        <Text style={styles.totalLabel}>{isRTL ? 'الإجمالي' : 'Total'}</Text>
                        <Text style={styles.totalValue}>{formatRiyal(finalTotal, isRTL ? 'ar' : 'en')}</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: bottomInset }]}>
                <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.checkoutBtnText}>{labels.placeOrder} • {formatRiyal(finalTotal, isRTL ? 'ar' : 'en')}</Text>
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
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    manageAddressesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    manageAddressesText: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.primary,
    },
    addressListContainer: {
        gap: spacing.sm,
    },
    savedAddressCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing.md,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#EDE9FE',
        backgroundColor: '#FAF9FE',
        gap: spacing.sm,
    },
    savedAddressCardSelected: {
        borderColor: colors.primary,
        backgroundColor: '#F5EEFF',
    },
    radioIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#C4B5FD',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    radioIndicatorSelected: {
        borderColor: colors.primary,
    },
    radioIndicatorActive: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    savedAddressContent: {
        flex: 1,
    },
    savedAddressTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 2,
    },
    savedAddressTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    savedAddressTitleSelected: {
        color: colors.primary,
    },
    addressDefaultTag: {
        backgroundColor: colors.primary + '18',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    addressDefaultTagText: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.primary,
    },
    savedAddressDetails: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    savedAddressPhone: {
        fontSize: fontSize.xs,
        color: '#6B7280',
        marginTop: 2,
    },
    addOrManualToggle: {
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    addOrManualToggleText: {
        fontSize: fontSize.sm,
        color: colors.primary,
        fontWeight: '600',
    },
    chooseSavedBtn: {
        paddingVertical: spacing.xs,
        marginBottom: spacing.sm,
    },
    chooseSavedBtnText: {
        fontSize: fontSize.sm,
        color: colors.primary,
        fontWeight: '600',
    },
    noAddressBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3E8FF',
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    noAddressTitle: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: '#5B21B6',
    },
    noAddressSubtitle: {
        fontSize: fontSize.xs,
        color: '#6B7280',
    },
    quickAddAddressBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    quickAddAddressText: {
        color: '#FFFFFF',
        fontSize: fontSize.xs,
        fontWeight: '700',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    rtlText: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    rtlInput: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    emailInputRtl: {
        textAlign: 'left',
        writingDirection: 'ltr',
    },
    phoneInputRtl: {
        textAlign: 'left',
        writingDirection: 'ltr',
    },
    itemInfoRTL: {
        alignItems: 'flex-end',
        marginRight: spacing.md,
        marginLeft: 0,
    },
});
