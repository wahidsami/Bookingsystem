import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors } from '../theme/colors';
import { getImageUrl, Product, Tenant } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useCart } from '../contexts/CartContext';
import { useScreenSafeArea } from '../utils/safeArea';

export function ProductDetailsScreen({ route, navigation }: any) {
    const { product, tenant } = route.params;
    const { isRTL, t } = useLanguage();
    const { addToCart } = useCart();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [qty, setQty] = useState(1);

    const images = useMemo(() => {
        const source = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
        if (source.length > 0) return source.map((img: string) => getImageUrl(img));
        return ['https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=1200&auto=format&fit=crop'];
    }, [product.images]);

    const productName = isRTL ? product.name_ar : product.name_en;
    const description = (isRTL ? product.description_ar : product.description_en)
        || product.description_en
        || product.description_ar
        || '';

    const handleAddToCart = () => {
        for (let i = 0; i < qty; i += 1) {
            addToCart(product);
        }
        navigation.navigate('Cart', { tenant });
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={{ paddingBottom: Math.max(scrollBottomPadding, 120) }}>
                <View style={[styles.topBar, { paddingTop: topInset + 6 }]}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                        <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.topActions}>
                        <TouchableOpacity style={styles.iconBtn}>
                            <AppIcon name="share" size={18} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                <Image source={{ uri: images[activeImageIndex] }} style={styles.heroImage} />
                <Text style={styles.imageCounter}>{activeImageIndex + 1}/{images.length}</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                    {images.map((uri: string, index: number) => (
                        <TouchableOpacity
                            key={`${uri}-${index}`}
                            onPress={() => setActiveImageIndex(index)}
                            style={[styles.thumbWrap, activeImageIndex === index ? styles.thumbWrapActive : null]}
                        >
                            <Image source={{ uri }} style={styles.thumbImage} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.contentCard}>
                    <Text style={styles.title}>{productName}</Text>
                    <View style={styles.metaRow}>
                        <View style={[styles.chip, product.stock > 0 ? styles.chipSuccess : styles.chipMuted]}>
                            <Text style={[styles.chipText, product.stock > 0 ? styles.chipTextSuccess : null]}>
                                {product.stock > 0 ? (isRTL ? 'متوفر' : 'In stock') : (isRTL ? 'غير متوفر' : 'Out of stock')}
                            </Text>
                        </View>
                        <Text style={styles.price}>{formatRiyal(product.price, isRTL ? 'ar' : 'en')}</Text>
                    </View>

                    {description ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{isRTL ? 'عن المنتج' : 'About this product'}</Text>
                            <Text style={styles.description}>{description}</Text>
                        </View>
                    ) : null}

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{isRTL ? 'تفاصيل' : 'Details'}</Text>
                        <Text style={styles.detailItem}>{isRTL ? 'الفئة' : 'Category'}: {product.category || (isRTL ? 'عام' : 'General')}</Text>
                        <Text style={styles.detailItem}>{isRTL ? 'الكمية المتاحة' : 'Available stock'}: {product.stock}</Text>
                        {tenant?.name ? <Text style={styles.detailItem}>{isRTL ? 'المركز' : 'Center'}: {tenant.name}</Text> : null}
                    </View>

                    <View style={styles.qtyRow}>
                        <Text style={styles.sectionTitle}>{isRTL ? 'الكمية' : 'Quantity'}</Text>
                        <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                                <AppIcon name="minus" size={16} color={colors.primary} />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{qty}</Text>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
                                <AppIcon name="plus" size={16} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(scrollBottomPadding, 14) }]}>
                <TouchableOpacity
                    style={[styles.addBtn, product.stock <= 0 ? styles.addBtnDisabled : null]}
                    onPress={handleAddToCart}
                    disabled={product.stock <= 0}
                >
                    <Text style={styles.addBtnText}>{t('addToCart' as any) || 'Add to Cart'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7F6FB' },
    topBar: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topActions: { flexDirection: 'row', gap: 10 },
    iconBtn: {
        width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
    },
    heroImage: { width: '100%', height: 290, marginTop: 10 },
    imageCounter: {
        position: 'absolute', right: 16, top: 314, backgroundColor: 'rgba(0,0,0,0.45)',
        color: '#FFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden',
    },
    thumbRow: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
    thumbWrap: { borderRadius: 12, borderWidth: 1, borderColor: '#E6E0F7', padding: 2 },
    thumbWrapActive: { borderColor: colors.primary },
    thumbImage: { width: 68, height: 68, borderRadius: 10 },
    contentCard: { margin: 16, backgroundColor: '#FFF', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#ECE6FA' },
    title: { fontSize: 30, fontWeight: '800', color: '#14153C' },
    metaRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    chipSuccess: { backgroundColor: '#EAF8EF' },
    chipMuted: { backgroundColor: '#ECECF3' },
    chipText: { color: '#4D5475', fontSize: 12, fontWeight: '700' },
    chipTextSuccess: { color: '#15803D' },
    price: { fontSize: 24, color: colors.primary, fontWeight: '800' },
    section: { marginTop: 16, gap: 6 },
    sectionTitle: { fontSize: 22, color: '#1B1C49', fontWeight: '800' },
    description: { fontSize: 16, color: '#616A89', lineHeight: 24 },
    detailItem: { fontSize: 15, color: '#42496A', lineHeight: 22 },
    qtyRow: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qtyBtn: {
        width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#DCCEFF',
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F4FF',
    },
    qtyText: { fontSize: 18, fontWeight: '700', color: '#1D1D45', minWidth: 24, textAlign: 'center' },
    bottomBar: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 14,
        shadowColor: '#1D1442', shadowOpacity: 0.08, shadowRadius: 14, elevation: 8,
    },
    addBtn: { height: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    addBtnDisabled: { backgroundColor: '#B9AADF' },
    addBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
