import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { Service, ServiceCategoryFull, ServiceBundle, getServicePrice, getImageUrl } from '../../api/client';
import { formatRiyal } from '../../utils/currency';

export interface TenantServicesTabProps {
    services: Service[];
    categories: (ServiceCategoryFull | string)[];
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
    onSelectService: (service: Service) => void;
    onOpenServiceDetails: (service: Service) => void;
    selectedServiceIds: string[];
    getServiceImageUri: (service: Service) => string | null;
    bundles?: ServiceBundle[];
    onAddBundle?: (bundle: ServiceBundle) => void;
    selectedBundleIds?: string[];
}

export function TenantServicesTab({
    services,
    categories,
    selectedCategory,
    onSelectCategory,
    onSelectService,
    onOpenServiceDetails,
    selectedServiceIds,
    getServiceImageUri,
    bundles = [],
    onAddBundle,
    selectedBundleIds = [],
}: TenantServicesTabProps) {
    const { isRTL } = useLanguage();

    const getCategoryKey = (cat: ServiceCategoryFull | string): string => {
        if (typeof cat === 'string') return cat;
        return cat.id || cat.slug;
    };

    const getCategoryLabel = (cat: ServiceCategoryFull | string): string => {
        if (typeof cat === 'string') {
            if (cat.toLowerCase() === 'all') return isRTL ? 'الكل' : 'All';
            return cat;
        }
        return isRTL ? cat.name_ar || cat.name_en || cat.slug : cat.name_en || cat.name_ar || cat.slug;
    };

    const isServiceInSelectedCategory = (service: Service): boolean => {
        if (selectedCategory === 'all') return true;
        if (service.tenantServiceCategoryId && service.tenantServiceCategoryId === selectedCategory) return true;
        if ((service.category || '').toLowerCase() === selectedCategory.toLowerCase()) return true;
        return false;
    };

    const filteredServices = services.filter(isServiceInSelectedCategory);

    const isBundleInSelectedCategory = (bundle: ServiceBundle): boolean => {
        if (selectedCategory === 'all') return true;
        if (bundle.tenantServiceCategoryId && bundle.tenantServiceCategoryId === selectedCategory) return true;
        if ((bundle.tenantCategory?.slug || '').toLowerCase() === selectedCategory.toLowerCase()) return true;
        if ((bundle.tenantCategory?.id || '') === selectedCategory) return true;
        // Authoritative fallback: bundle matches if any of its child services belongs to selected category
        if (bundle.items?.some((it) => {
            const svc = it.service;
            if (!svc) return false;
            if (svc.tenantServiceCategoryId && svc.tenantServiceCategoryId === selectedCategory) return true;
            if ((svc.category || '').toLowerCase() === selectedCategory.toLowerCase()) return true;
            return false;
        })) {
            return true;
        }
        return false;
    };

    const filteredBundles = (bundles || []).filter(isBundleInSelectedCategory);

    const handleServicePress = (service: Service) => {
        const hasVariants = Boolean(service.variants && service.variants.length > 0);

        if (hasVariants) {
            onOpenServiceDetails(service);
        } else {
            onSelectService(service);
        }
    };

    return (
        <View style={styles.container}>
            {/* 1. Category Filter Chips */}
            {categories.length > 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.chipsContainer,
                        isRTL && styles.chipsContainerRTL,
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
                        .filter((cat) => {
                            if (typeof cat === 'string') return cat.toLowerCase() !== 'all';
                            return cat.slug?.toLowerCase() !== 'all' && cat.id?.toLowerCase() !== 'all';
                        })
                        .map((cat) => {
                            const key = getCategoryKey(cat);
                            const label = getCategoryLabel(cat);
                            const isSelected =
                                selectedCategory.toLowerCase() === key.toLowerCase() ||
                                (typeof cat !== 'string' && selectedCategory.toLowerCase() === (cat.slug || '').toLowerCase());

                            return (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => onSelectCategory(key)}
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
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                </ScrollView>
            )}

            {/* 2. Service Cards List */}
            <View style={styles.servicesList}>
                {filteredServices.length === 0 && filteredBundles.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <AppIcon name="sparkles" size={48} color="#A379E2" />
                        <Text style={[styles.emptyStateTitle, isRTL && styles.textRTL]}>
                            {isRTL ? 'لا توجد خدمات في هذا التصنيف' : 'No services in this category'}
                        </Text>
                        <Text style={[styles.emptyStateSubtitle, isRTL && styles.textRTL]}>
                            {isRTL ? 'يرجى اختيار تصنيف آخر أو العودة لاحقاً' : 'Please select another category or check back later'}
                        </Text>
                    </View>
                ) : (
                    filteredServices.map((service) => {
                        const isSelected = selectedServiceIds.includes(service.id);
                        const imageUri = getServiceImageUri(service);
                        const durationMinutes = service.duration || 45;
                        const rawPrice = getServicePrice(service) || (service.variants && service.variants[0] ? getServicePrice(service, service.variants[0]) : 0);
                        const price = Number(rawPrice).toFixed(0);
                        const title = (isRTL ? service.name_ar || service.name_en : service.name_en || service.name_ar) || (isRTL ? 'خدمة' : 'Service');

                        return (
                            <TouchableOpacity
                                key={service.id}
                                style={[styles.serviceCard, isRTL && styles.rowRTL]}
                                onPress={() => handleServicePress(service)}
                                activeOpacity={0.85}
                            >
                                {/* 80x80 Compact Image Thumbnail */}
                                {imageUri ? (
                                    <Image
                                        source={{ uri: imageUri }}
                                        style={styles.serviceImage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.serviceImagePlaceholder}>
                                        <AppIcon name="sparkles" size={28} color="#6537C0" />
                                    </View>
                                )}

                                {/* Service Information */}
                                <View style={[styles.serviceInfo, isRTL && styles.serviceInfoRTL]}>
                                    <Text
                                        style={[styles.serviceTitle, isRTL && styles.textRTL]}
                                        numberOfLines={1}
                                    >
                                        {title}
                                    </Text>
                                    <Text style={[styles.serviceDuration, isRTL && styles.textRTL]}>
                                        {durationMinutes} {isRTL ? 'دقيقة' : 'min'}
                                    </Text>
                                    <Text style={[styles.servicePrice, isRTL && styles.textRTL]}>
                                        {formatRiyal(price, isRTL ? 'ar' : 'en')}
                                    </Text>
                                </View>

                                {/* Action Button */}
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        isSelected && styles.actionButtonSelected,
                                    ]}
                                    onPress={() => handleServicePress(service)}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.actionButtonText,
                                            isSelected && styles.actionButtonTextSelected,
                                            isRTL && styles.textRTL,
                                        ]}
                                    >
                                        {isSelected
                                            ? (isRTL ? '✓ تم' : '✓ Added')
                                            : (isRTL ? '+ إضافة' : '+ Add')}
                                    </Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })
                )}

                {/* 3. Bundles Section */}
                {filteredBundles.length > 0 && (
                    <View style={styles.bundlesSection}>
                        <View style={[styles.bundlesSectionHeader, isRTL && styles.rowRTL]}>
                            <View style={[styles.bundlesTitleWithIcon, isRTL && styles.rowRTL]}>
                                <AppIcon name="gift" size={18} color="#6537C0" />
                                <Text style={[styles.bundlesSectionHeading, isRTL && styles.textRTL]}>
                                    {isRTL ? 'الباقات والعروض الخاصة' : 'Packages & Bundles'}
                                </Text>
                            </View>
                            <Text style={[styles.bundlesCount, isRTL && styles.textRTL]}>
                                {filteredBundles.length} {isRTL ? 'باقة' : 'bundles'}
                            </Text>
                        </View>

                        {filteredBundles.map((bundle) => {
                            const isSelected = selectedBundleIds.includes(bundle.id);
                            const bundleImageUri = bundle.image ? getImageUrl(bundle.image) : null;
                            const bundleTitle = (isRTL ? bundle.name_ar || bundle.name_en : bundle.name_en || bundle.name_ar) || (isRTL ? 'باقة' : 'Bundle');
                            const bundlePrice = Number(bundle.totalPrice || 0).toFixed(0);
                            const itemCount = bundle.items?.length || 0;
                            const durationMinutes = bundle.totalDuration || 60;

                            return (
                                <TouchableOpacity
                                    key={bundle.id}
                                    style={[styles.serviceCard, styles.bundleCard, isRTL && styles.rowRTL]}
                                    onPress={() => onAddBundle && onAddBundle(bundle)}
                                    activeOpacity={0.85}
                                >
                                    {/* 80x80 Compact Image Thumbnail */}
                                    {bundleImageUri ? (
                                        <Image
                                            source={{ uri: bundleImageUri }}
                                            style={styles.serviceImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={[styles.serviceImagePlaceholder, styles.bundlePlaceholder]}>
                                            <AppIcon name="gift" size={28} color="#6537C0" />
                                        </View>
                                    )}

                                    {/* Bundle Information */}
                                    <View style={[styles.serviceInfo, isRTL && styles.serviceInfoRTL]}>
                                        <View style={[styles.bundleBadgeRow, isRTL && styles.rowRTL]}>
                                            <View style={[styles.bundleBadge, isRTL && styles.bundleBadgeRTL]}>
                                                <Text style={styles.bundleBadgeText}>
                                                    {isRTL ? 'باقة' : 'Bundle'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text
                                            style={[styles.serviceTitle, isRTL && styles.textRTL]}
                                            numberOfLines={1}
                                        >
                                            {bundleTitle}
                                        </Text>
                                        <Text style={[styles.serviceDuration, isRTL && styles.textRTL]}>
                                            {itemCount} {isRTL ? 'خدمات' : 'services'} · {durationMinutes} {isRTL ? 'دقيقة' : 'min'}
                                        </Text>
                                        <Text style={[styles.servicePrice, isRTL && styles.textRTL]}>
                                            {formatRiyal(bundlePrice, isRTL ? 'ar' : 'en')}
                                        </Text>
                                    </View>

                                    {/* Action Button */}
                                    <TouchableOpacity
                                        style={[
                                            styles.actionButton,
                                            isSelected && styles.actionButtonSelected,
                                        ]}
                                        onPress={() => onAddBundle && onAddBundle(bundle)}
                                        activeOpacity={0.85}
                                    >
                                        <Text
                                            style={[
                                                styles.actionButtonText,
                                                isSelected && styles.actionButtonTextSelected,
                                                isRTL && styles.textRTL,
                                            ]}
                                        >
                                            {isSelected
                                                ? (isRTL ? '✓ تم' : '✓ Added')
                                                : (isRTL ? '+ إضافة' : '+ Add')}
                                        </Text>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
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
    chipsContainer: {
        paddingHorizontal: 20,
        gap: 8,
        alignItems: 'center',
    },
    chipsContainerRTL: {
        minWidth: '100%',
        justifyContent: 'flex-end',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    serviceInfoRTL: {
        alignItems: 'flex-end',
    },
    bundleBadgeRTL: {
        alignSelf: 'flex-end',
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
    servicesList: {
        paddingHorizontal: 20,
        gap: 12,
    },
    serviceCard: {
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
    serviceImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#FAF9FC',
    },
    serviceImagePlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#FAF9FC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceInfo: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1D035F',
    },
    serviceDuration: {
        fontSize: 13,
        color: '#716B88',
    },
    servicePrice: {
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
    actionButtonSelected: {
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
    actionButtonTextSelected: {
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
    bundlesSection: {
        marginTop: 12,
        gap: 12,
    },
    bundlesSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        marginBottom: 4,
    },
    bundlesTitleWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bundlesSectionHeading: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1D035F',
    },
    bundlesCount: {
        fontSize: 13,
        color: '#716B88',
    },
    bundleCard: {
        borderColor: '#DDD6FE',
        backgroundColor: '#FCFBFF',
    },
    bundlePlaceholder: {
        backgroundColor: '#F5F3FF',
        borderColor: '#DDD6FE',
    },
    bundleBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    bundleBadge: {
        backgroundColor: '#EDE9FE',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    bundleBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6537C0',
    },
});
