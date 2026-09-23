import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { Service, ServiceCategoryFull, ServiceBundle, getServicePrice, getImageUrl } from '../../api/client';
import { formatRiyal } from '../../utils/currency';

export const CATEGORY_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
    body: { ar: 'العناية بالجسم والمساج', en: 'Body & Massage' },
    massage: { ar: 'المساج والاسترخاء', en: 'Massage & Relaxation' },
    nails: { ar: 'العناية بالأظافر', en: 'Nails Care' },
    hair: { ar: 'العناية بالشعر والتصفيف', en: 'Hair & Styling' },
    face: { ar: 'العناية بالبشرة والوجه', en: 'Facial & Skincare' },
    facial: { ar: 'العناية بالبشرة والوجه', en: 'Facial & Skincare' },
    skincare: { ar: 'العناية بالبشرة', en: 'Skincare' },
    makeup: { ar: 'المكياج والتجميل', en: 'Makeup & Beauty' },
    spa: { ar: 'خدمات السبا', en: 'Spa Services' },
    waxing: { ar: 'إزالة الشعر بالشمع', en: 'Waxing & Depilation' },
    barber: { ar: 'الحلاقة والعناية الرجالية', en: 'Barber & Grooming' },
    general: { ar: 'خدمات عامة', en: 'General Services' },
    other: { ar: 'خدمات أخرى', en: 'Other Services' },
};

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
            const lower = cat.toLowerCase();
            if (lower === 'all') return isRTL ? 'الكل' : 'All';
            if (CATEGORY_TRANSLATIONS[lower]) {
                return isRTL ? CATEGORY_TRANSLATIONS[lower].ar : CATEGORY_TRANSLATIONS[lower].en;
            }
            return cat.charAt(0).toUpperCase() + cat.slice(1);
        }
        return isRTL ? cat.name_ar || cat.name_en || cat.slug : cat.name_en || cat.name_ar || cat.slug;
    };

    const isServiceInSelectedCategory = (service: Service): boolean => {
        if (selectedCategory === 'all') return true;
        if (service.tenantServiceCategoryId && service.tenantServiceCategoryId.toLowerCase() === selectedCategory.toLowerCase()) return true;
        if ((service.category || '').toLowerCase() === selectedCategory.toLowerCase()) return true;
        return false;
    };

    const filteredServices = services.filter(isServiceInSelectedCategory);

    const isBundleInSelectedCategory = (bundle: ServiceBundle): boolean => {
        if (selectedCategory === 'all') return true;
        if (bundle.tenantServiceCategoryId && bundle.tenantServiceCategoryId.toLowerCase() === selectedCategory.toLowerCase()) return true;
        if ((bundle.tenantCategory?.slug || '').toLowerCase() === selectedCategory.toLowerCase()) return true;
        if ((bundle.tenantCategory?.id || '').toLowerCase() === selectedCategory.toLowerCase()) return true;
        // Authoritative fallback: bundle matches if any of its child services belongs to selected category
        if (bundle.items?.some((it) => {
            const svc = it.service;
            if (!svc) return false;
            if (svc.tenantServiceCategoryId && svc.tenantServiceCategoryId.toLowerCase() === selectedCategory.toLowerCase()) return true;
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

    // Category-aware service grouping
    const groupedServices = useMemo(() => {
        if (selectedCategory !== 'all') {
            const currentCatObj = categories.find((c) => getCategoryKey(c).toLowerCase() === selectedCategory.toLowerCase()) || selectedCategory;
            return [{
                key: selectedCategory,
                label: getCategoryLabel(currentCatObj),
                services: filteredServices,
            }];
        }

        // When "all" is selected, group services under their natural categories
        const groupsMap = new Map<string, { key: string; label: string; services: Service[] }>();

        // Pre-populate defined categories to preserve clean catalog ordering
        categories.forEach((cat) => {
            const key = getCategoryKey(cat);
            if (key.toLowerCase() !== 'all') {
                groupsMap.set(key.toLowerCase(), {
                    key,
                    label: getCategoryLabel(cat),
                    services: [],
                });
            }
        });

        // Distribute services to groups
        services.forEach((service) => {
            let matchedKey = '';
            if (service.tenantServiceCategoryId) {
                matchedKey = service.tenantServiceCategoryId.toLowerCase();
            } else if (service.category) {
                matchedKey = service.category.trim().toLowerCase();
            }

            if (matchedKey && groupsMap.has(matchedKey)) {
                groupsMap.get(matchedKey)!.services.push(service);
            } else if (matchedKey) {
                const newGroup = {
                    key: matchedKey,
                    label: getCategoryLabel(matchedKey),
                    services: [service],
                };
                groupsMap.set(matchedKey, newGroup);
            } else {
                const otherKey = 'other';
                if (!groupsMap.has(otherKey)) {
                    groupsMap.set(otherKey, {
                        key: otherKey,
                        label: isRTL ? 'خدمات أخرى' : 'Other Services',
                        services: [],
                    });
                }
                groupsMap.get(otherKey)!.services.push(service);
            }
        });

        return Array.from(groupsMap.values()).filter((g) => g.services.length > 0);
    }, [services, filteredServices, selectedCategory, categories, isRTL]);

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

            {/* 2. Service Groups List */}
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
                    groupedServices.map((group) => (
                        <View key={group.key} style={styles.categorySection}>
                            {/* Category Section Header when multiple categories are present */}
                            {(selectedCategory === 'all' || categories.length > 1) && (
                                <View style={[styles.categorySectionHeader, isRTL && styles.rowRTL]}>
                                    <Text style={[styles.categorySectionHeading, isRTL && styles.textRTL]}>
                                        {group.label}
                                    </Text>
                                    <Text style={[styles.categorySectionCount, isRTL && styles.textRTL]}>
                                        {group.services.length} {isRTL ? 'خدمات' : 'services'}
                                    </Text>
                                </View>
                            )}

                            {/* Category Service Cards */}
                            {group.services.map((service) => {
                                const isSelected = selectedServiceIds.includes(service.id);
                                const imageUri = getServiceImageUri(service);
                                const durationMinutes = service.duration || 45;
                                const rawPrice = getServicePrice(service) || (service.variants && service.variants[0] ? getServicePrice(service, service.variants[0]) : 0);
                                const price = Number(rawPrice).toFixed(0);
                                const title = (isRTL ? service.name_ar || service.name_en : service.name_en || service.name_ar) || (isRTL ? 'خدمة' : 'Service');
                                const hasVariants = Boolean(service.variants && service.variants.length > 0);

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

                                            {/* Variant Discoverability Badge */}
                                            {hasVariants && (
                                                <View style={[styles.variantBadge, isRTL && styles.rowRTL]}>
                                                    <AppIcon name="sparkles" size={11} color="#6537C0" />
                                                    <Text style={[styles.variantBadgeText, isRTL && styles.textRTL]}>
                                                        {service.variants!.length} {isRTL ? 'خيارات متاحة' : 'options available'}
                                                    </Text>
                                                </View>
                                            )}

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
                                                    : hasVariants
                                                        ? (isRTL ? 'خيارات' : 'Options')
                                                        : (isRTL ? '+ إضافة' : '+ Add')}
                                            </Text>
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))
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
        gap: 16,
    },
    categorySection: {
        gap: 10,
    },
    categorySectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        paddingTop: 6,
        paddingBottom: 2,
    },
    categorySectionHeading: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        letterSpacing: 0.3,
    },
    categorySectionCount: {
        fontSize: 12,
        fontWeight: '500',
        color: '#716B88',
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
    variantBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
        alignSelf: 'flex-start',
        marginTop: 1,
        marginBottom: 1,
    },
    variantBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6537C0',
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
