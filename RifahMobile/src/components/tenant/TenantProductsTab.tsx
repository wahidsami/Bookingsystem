import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { Product } from '../../api/client';
import { formatRiyal } from '../../utils/currency';

export interface TenantProductsTabProps {
    products: Product[];
    categories: string[];
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onAddProduct: (product: Product) => void;
    onOpenProductDetails?: (product: Product) => void;
    cartProductIds?: string[];
    isLoading?: boolean;
}

export function TenantProductsTab({
    products,
    categories,
    selectedCategory,
    onSelectCategory,
    searchQuery,
    onSearchChange,
    onAddProduct,
    onOpenProductDetails,
    cartProductIds = [],
    isLoading = false,
}: TenantProductsTabProps) {
    const { isRTL } = useLanguage();

    const filteredProducts = products.filter((p) => {
        const matchesCat =
            selectedCategory === 'all' ||
            (p.category || '').toLowerCase() === selectedCategory.toLowerCase();
        const matchesQuery =
            !searchQuery.trim() ||
            (p.name_en || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.name_ar || '').includes(searchQuery);
        return matchesCat && matchesQuery;
    });

    return (
        <View style={styles.container}>
            {/* 1. Search Bar */}
            <View style={styles.searchWrapper}>
                <View style={[styles.searchBar, isRTL && styles.rowRTL]}>
                    <AppIcon name="search" size={20} color="#716B88" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={onSearchChange}
                        placeholder={isRTL ? 'البحث عن منتج...' : 'Search products...'}
                        placeholderTextColor="#716B88"
                        style={[
                            styles.searchInput,
                            isRTL && styles.inputRTL,
                        ]}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => onSearchChange('')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <AppIcon name="close" size={18} color="#716B88" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 2. Category Filter Chips */}
            {categories.length > 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.chipsContainer,
                        isRTL && styles.rowRTL,
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => onSelectCategory('all')}
                        style={[
                            styles.chip,
                            selectedCategory === 'all' ? styles.chipActive : styles.chipInactive,
                        ]}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                selectedCategory === 'all' ? styles.chipTextActive : styles.chipTextInactive,
                                isRTL && styles.textRTL,
                            ]}
                        >
                            {isRTL ? 'الكل' : 'All'}
                        </Text>
                    </TouchableOpacity>

                    {categories
                        .filter((c) => c.toLowerCase() !== 'all')
                        .map((cat) => {
                            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                            return (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => onSelectCategory(cat)}
                                    style={[
                                        styles.chip,
                                        isSelected ? styles.chipActive : styles.chipInactive,
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            isSelected ? styles.chipTextActive : styles.chipTextInactive,
                                            isRTL && styles.textRTL,
                                        ]}
                                    >
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                </ScrollView>
            )}

            {/* 3. Product Cards List */}
            <View style={styles.productsList}>
                {filteredProducts.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <AppIcon name="shopping_bag" size={48} color="#A379E2" />
                        <Text style={[styles.emptyStateTitle, isRTL && styles.textRTL]}>
                            {isRTL ? 'لا توجد منتجات مطابقة' : 'No matching products'}
                        </Text>
                        <Text style={[styles.emptyStateSubtitle, isRTL && styles.textRTL]}>
                            {isRTL ? 'جرب البحث بكلمات أخرى أو اختر تصنيفاً مختلفاً' : 'Try searching with different keywords or select another category'}
                        </Text>
                    </View>
                ) : (
                    filteredProducts.map((product) => {
                        const isInCart = cartProductIds.includes(product.id);
                        const isOutOfStock = product.stock !== undefined && product.stock <= 0;
                        const price = Number(product.price || product.rawPrice || 0).toFixed(0);
                        const title = (isRTL ? product.name_ar || product.name_en : product.name_en || product.name_ar) || (isRTL ? 'منتج' : 'Product');
                        const imageUri = product.images && product.images.length > 0 ? product.images[0] : null;

                        return (
                            <TouchableOpacity
                                key={product.id}
                                style={[styles.productCard, isRTL && styles.rowRTL]}
                                onPress={() => onOpenProductDetails?.(product)}
                                activeOpacity={0.85}
                            >
                                {/* 80x80 Compact Image Thumbnail */}
                                {imageUri ? (
                                    <Image
                                        source={{ uri: imageUri }}
                                        style={styles.productImage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.productImagePlaceholder}>
                                        <AppIcon name="shopping_bag" size={28} color="#6537C0" />
                                    </View>
                                )}

                                {/* Product Information */}
                                <View style={[styles.productInfo, isRTL && styles.productInfoRTL]}>
                                    <Text
                                        style={[styles.productTitle, isRTL && styles.textRTL]}
                                        numberOfLines={1}
                                    >
                                        {title}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.stockText,
                                            isOutOfStock ? styles.stockOutOfStock : styles.stockInStock,
                                            isRTL && styles.textRTL,
                                        ]}
                                    >
                                        {isOutOfStock
                                            ? (isRTL ? 'نفدت الكمية' : 'Out of Stock')
                                            : (isRTL ? 'متوفر' : 'In Stock')}
                                    </Text>
                                    <Text style={[styles.productPrice, isRTL && styles.textRTL]}>
                                        {formatRiyal(price, isRTL ? 'ar' : 'en')}
                                    </Text>
                                </View>

                                {/* Action Button */}
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        isOutOfStock && styles.actionButtonDisabled,
                                        isInCart && styles.actionButtonInCart,
                                    ]}
                                    onPress={() => onAddProduct(product)}
                                    disabled={isOutOfStock}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.actionButtonText,
                                            isInCart && styles.actionButtonTextInCart,
                                            isRTL && styles.textRTL,
                                        ]}
                                    >
                                        {isInCart
                                            ? (isRTL ? '✓ بالسلة' : '✓ In Cart')
                                            : (isRTL ? '+ إضافة' : '+ Add')}
                                    </Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingTop: 16,
        paddingBottom: 32,
        gap: 16,
    },
    searchWrapper: {
        paddingHorizontal: 20,
    },
    searchBar: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1D035F',
        padding: 0,
    },
    inputRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    chipsContainer: {
        paddingHorizontal: 20,
        gap: 8,
        alignItems: 'center',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
    },
    chipActive: {
        backgroundColor: '#6537C0',
        borderColor: '#6537C0',
    },
    chipInactive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E7DDFC',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    chipTextInactive: {
        color: '#716B88',
    },
    productsList: {
        paddingHorizontal: 20,
        gap: 12,
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#FAF9FC',
    },
    productImagePlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#FAF9FC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productInfo: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    productInfoRTL: {
        alignItems: 'flex-end',
    },
    productTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1D035F',
    },
    stockText: {
        fontSize: 13,
        fontWeight: '500',
    },
    stockInStock: {
        color: '#059669',
    },
    stockOutOfStock: {
        color: '#E11D48',
    },
    productPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6537C0',
        marginTop: 2,
    },
    currencyText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#716B88',
    },
    actionButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
    },
    actionButtonDisabled: {
        backgroundColor: '#E7DDFC',
        shadowOpacity: 0,
        elevation: 0,
    },
    actionButtonInCart: {
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: '#6537C0',
        shadowOpacity: 0,
        elevation: 0,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    actionButtonTextInCart: {
        color: '#6537C0',
    },
    emptyStateContainer: {
        paddingVertical: 48,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1D035F',
        marginTop: 8,
    },
    emptyStateSubtitle: {
        fontSize: 13,
        color: '#716B88',
        textAlign: 'center',
    },
});
