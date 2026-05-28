import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    ImageBackground,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api, ServiceCategory, Tenant, getImageUrl } from '../api/client';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '../components/AppIcon';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2400&auto=format&fit=crop';
const CATEGORY_ICON_MAP: Record<string, any> = {
    massage: 'sparkles',
    hair: 'star',
    spa: 'sparkles',
    nails: 'star',
    wellness: 'sparkles',
};

export function BrowseScreen({ route, navigation }: any) {
    const { t, isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const { width } = useWindowDimensions();
    const initialCategory = route.params?.category as string | undefined;
    const initialTitle = route.params?.title as string | undefined;
    const isCompact = width < 390;
    const heroTitleSize = isCompact ? 34 : 38;
    const heroTitleLineHeight = isCompact ? 38 : 42;
    const heroSubtitleSize = isCompact ? 14 : 15;
    const heroSubtitleLineHeight = isCompact ? 20 : 22;
    const cardImageHeight = isCompact ? 160 : 176;

    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory || null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [tenantsData, categoriesData] = await Promise.all([
                api.getTenants(),
                api.getCategories().catch(() => [] as ServiceCategory[]),
            ]);
            setTenants(tenantsData || []);
            setCategories(categoriesData || []);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const selectedCategory = useMemo(
        () => categories.find((category) => category.slug === activeCategory) || null,
        [activeCategory, categories]
    );

    const dynamicTitle = useMemo(() => {
        if (selectedCategory) return isRTL ? selectedCategory.name_ar : selectedCategory.name_en;
        if (initialTitle) return initialTitle;
        return isRTL ? 'الفئات' : 'Categories';
    }, [initialTitle, isRTL, selectedCategory]);

    const filteredTenants = useMemo(() => {
        return tenants.filter((tenant) => {
            const displayName = isRTL ? tenant.name_ar || tenant.name : tenant.name_en || tenant.name;
            const businessTypes = Array.isArray(tenant.businessType)
                ? tenant.businessType
                : tenant.businessType
                    ? [tenant.businessType]
                    : [];

            const matchesCategory = !activeCategory || businessTypes.includes(activeCategory);
            const normalizedSearch = search.trim().toLowerCase();
            const matchesSearch = !normalizedSearch
                || displayName?.toLowerCase().includes(normalizedSearch)
                || tenant.city?.toLowerCase().includes(normalizedSearch)
                || businessTypes.some((type) => type.toLowerCase().includes(normalizedSearch));

            return matchesCategory && matchesSearch;
        });
    }, [activeCategory, isRTL, search, tenants]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const renderTenantCard = ({ item, index }: { item: Tenant; index: number }) => {
        const displayName = isRTL ? item.name_ar || item.name : item.name_en || item.name;
        const businessTypes = Array.isArray(item.businessType) ? item.businessType : item.businessType ? [item.businessType] : [];
        const businessTypeLabel = businessTypes.length
            ? businessTypes[0].replace(/_/g, ' ')
            : (isRTL ? 'مركز رفاهية' : 'Wellness Center');
        const cityLabel = item.city || (isRTL ? 'الموقع غير محدد' : 'Location not specified');
        const ratingValue = Number((item as any).rating || (item as any).averageRating || 0);
        const reviewsCount = Number((item as any).reviewsCount || (item as any).ratingsCount || 0);
        const coverUrl = getImageUrl(item.coverImage || item.logo) || HERO_IMAGE;
        const logoUrl = getImageUrl(item.logo || item.coverImage);
        const description = (isRTL ? item.description_ar : item.description_en)
            || item.description
            || (isRTL ? 'تجارب عناية متوازنة تمنحك الهدوء والثقة.' : 'Balanced self-care experiences designed for comfort and confidence.');

        return (
            <TouchableOpacity
                style={styles.tenantCard}
                activeOpacity={0.94}
                onPress={() => navigation.navigate('Tenant', { tenantId: item.id, slug: item.slug, tenant: item })}
            >
                <View style={[styles.tenantCardRow, isRTL ? styles.tenantCardRowRtl : null]}>
                    <View style={[styles.tenantImageWrap, { minHeight: cardImageHeight }]}>
                        <Image source={{ uri: coverUrl }} style={styles.tenantImage} />
                        {index === 0 ? (
                            <View style={styles.badgePill}>
                                <Text style={styles.badgePillText}>{isRTL ? 'الأكثر تميزاً' : 'Most Loved'}</Text>
                            </View>
                        ) : null}
                        {logoUrl ? (
                            <View style={styles.logoOverlay}>
                                <Image source={{ uri: logoUrl }} style={styles.logoOverlayImage} />
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.tenantContent}>
                    <Text style={styles.tenantName} numberOfLines={2}>{displayName}</Text>

                        <View style={[styles.metaRow, isRTL ? styles.metaRowRtl : null]}>
                            <Text style={styles.metaText}>⭐ {ratingValue > 0 ? ratingValue.toFixed(1) : '—'} ({reviewsCount || 0})</Text>
                            <Text style={styles.metaDivider}>|</Text>
                            <Text style={styles.metaText}>{cityLabel}</Text>
                            <Text style={styles.metaDivider}>|</Text>
                            <Text style={styles.metaText}>{businessTypeLabel}</Text>
                        </View>

                        <View style={styles.typePill}>
                            <Text style={styles.typePillText}>{businessTypeLabel}</Text>
                        </View>

                        <Text style={styles.tenantDescription} numberOfLines={2}>
                            {description}
                        </Text>

                        <View style={[styles.tenantCardFooter, isRTL ? styles.tenantCardFooterRtl : null]}>
                            <View />
                            <View style={styles.arrowCircle}>
                                <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={20} color={colors.primary} />
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderListHeader = () => (
        <View>
            <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.hero} imageStyle={styles.heroImage}>
                <LinearGradient
                    colors={isRTL ? ['rgba(74, 34, 128,0.82)', 'rgba(74, 34, 128,0.24)'] : ['rgba(74, 34, 128,0.82)', 'rgba(74, 34, 128,0.24)']}
                    start={isRTL ? { x: 1, y: 0 } : { x: 0, y: 0 }}
                    end={isRTL ? { x: 0, y: 1 } : { x: 1, y: 1 }}
                    style={styles.heroOverlay}
                >
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { marginTop: topInset + 8 }]}>
                        <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.heroTextBlock}>
                        <Text style={[styles.heroTitle, { fontSize: heroTitleSize, lineHeight: heroTitleLineHeight }]}>{dynamicTitle}</Text>
                        <Text style={[styles.heroSubtitle, { fontSize: heroSubtitleSize, lineHeight: heroSubtitleLineHeight }]}>
                            {isRTL ? 'اكتشف تجارب رفاهية مميزة قريبة منك.' : 'Discover premium wellness experiences near you.'}
                        </Text>
                    </View>
                </LinearGradient>
            </ImageBackground>

            <View style={styles.searchFloatingWrap}>
                <View style={[styles.searchCard, isRTL ? styles.searchCardRtl : null]}>
                    <AppIcon name="search" size={20} color="#7F86A6" />
                    <TextInput
                        style={[styles.searchInput, isRTL ? styles.rtlInput : null]}
                        placeholder={isRTL ? 'ابحث عن مركز، جمال، رفاهية...' : 'Search salons, beauty, wellness...'}
                        placeholderTextColor="#7F86A6"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            <View style={styles.chipsSection}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={categories}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.chipsRow}
                    renderItem={({ item }) => {
                        const active = activeCategory === item.slug;
                        const iconName = CATEGORY_ICON_MAP[item.slug?.toLowerCase?.()] || 'sparkles';
                        return (
                            <TouchableOpacity
                                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                                onPress={() => setActiveCategory((prev) => prev === item.slug ? null : item.slug)}
                                activeOpacity={0.9}
                            >
                                <AppIcon name={iconName} size={14} color={active ? '#FFFFFF' : colors.primary} />
                                <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                                    {isRTL ? item.name_ar : item.name_en}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            <View style={styles.featuredHeader}>
                <Text style={styles.featuredTitle}>{isRTL ? 'مراكز الرفاهية المميزة ✨' : 'Featured Wellness Centers ✨'}</Text>
                <Text style={styles.featuredSubtitle}>{isRTL ? 'أماكن مختارة لتجربة أفضل نسخة منك.' : 'Handpicked places for your best self.'}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredTenants}
                    keyExtractor={(item) => item.id}
                    renderItem={renderTenantCard}
                    contentContainerStyle={{ paddingBottom: scrollBottomPadding + 120 }}
                    ListHeaderComponent={renderListHeader}
                    ListFooterComponent={
                        <View style={styles.footerWrap}>
                            <View style={styles.trustRow}>
                                <TrustItem icon="star" title={isRTL ? 'مراكز موثقة' : 'Verified Centers'} subtitle={isRTL ? 'مراكز معتمدة وآمنة' : 'Verified quality & safety'} />
                                <TrustItem icon="sparkles" title={isRTL ? 'أعلى تقييم' : 'Top Rated'} subtitle={isRTL ? 'مختارة بعناية' : 'Handpicked by experts'} />
                                <TrustItem icon="phone" title={isRTL ? 'دعم مستمر' : '24/7 Support'} subtitle={isRTL ? 'نحن معك دائماً' : 'Always here to help'} />
                            </View>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.centerState}>
                            <Text style={styles.emptyText}>
                                {isRTL
                                    ? 'لم نتمكن من العثور على نتائج مطابقة ✨'
                                    : "We couldn't find wellness experiences matching your search ✨"}
                            </Text>
                            <TouchableOpacity style={styles.clearFiltersBtn} onPress={() => { setSearch(''); setActiveCategory(null); }}>
                                <Text style={styles.clearFiltersText}>{isRTL ? 'مسح الفلاتر' : 'Clear Filters'}</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    showsVerticalScrollIndicator={false}
                />
            )}

        </View>
    );
}

function TrustItem({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
    return (
        <View style={styles.trustItemBox}>
            <AppIcon name={icon} size={18} color={colors.primary} />
            <Text style={styles.trustItemTitle}>{title}</Text>
            <Text style={styles.trustItemSubtitle}>{subtitle}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF8FC',
    },
    hero: {
        height: 342,
    },
    heroImage: {
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
    },
    heroOverlay: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTextBlock: {
        marginTop: spacing.lg,
        maxWidth: '76%',
    },
    heroTitle: {
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.8,
    },
    heroSubtitle: {
        marginTop: 10,
        color: 'rgba(255,255,255,0.92)',
        fontWeight: '500',
    },
    searchFloatingWrap: {
        marginTop: -32,
        paddingHorizontal: spacing.lg,
    },
    searchCard: {
        height: 68,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EFE9FB',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        gap: 10,
        shadowColor: '#1A1543',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    searchCardRtl: {
        flexDirection: 'row-reverse',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#3A3F62',
        paddingVertical: 0,
    },
    rtlInput: {
        textAlign: 'right',
    },
    chipsSection: {
        marginTop: spacing.lg,
    },
    chipsRow: {
        paddingHorizontal: spacing.lg,
        gap: 10,
        paddingBottom: 2,
    },
    chip: {
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    chipActive: {
        backgroundColor: colors.primary,
    },
    chipInactive: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8DDFB',
    },
    chipText: {
        fontSize: 14,
        fontWeight: '700',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    chipTextInactive: {
        color: '#4F5577',
    },
    featuredHeader: {
        marginTop: spacing.xl + 4,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md + 2,
    },
    featuredTitle: {
        fontSize: 32,
        lineHeight: 36,
        color: '#15153E',
        fontWeight: '800',
    },
    featuredSubtitle: {
        marginTop: 6,
        fontSize: 15,
        color: '#66708F',
    },
    tenantCard: {
        marginHorizontal: spacing.lg,
        marginBottom: 20,
        borderRadius: 32,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#ECE6FA',
        padding: 14,
        shadowColor: '#1B1540',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    tenantCardRow: {
        flexDirection: 'row',
        gap: 12,
    },
    tenantCardRowRtl: {
        flexDirection: 'row-reverse',
    },
    tenantImageWrap: {
        width: 132,
        height: 176,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#EFEAFD',
    },
    tenantImage: {
        width: '100%',
        height: '100%',
    },
    badgePill: {
        position: 'absolute',
        top: 8,
        left: 8,
        borderRadius: 999,
        backgroundColor: '#6F33D8',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    badgePillText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    logoOverlay: {
        position: 'absolute',
        left: 10,
        bottom: 10,
        width: 68,
        height: 68,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.65)',
        backgroundColor: 'rgba(18, 18, 43, 0.62)',
        overflow: 'hidden',
    },
    logoOverlayImage: {
        width: '100%',
        height: '100%',
    },
    tenantContent: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    tenantName: {
        fontSize: 20,
        lineHeight: 24,
        color: '#171742',
        fontWeight: '800',
    },
    metaRow: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    metaRowRtl: {
        flexDirection: 'row-reverse',
    },
    metaText: {
        fontSize: 14,
        color: '#65708F',
        fontWeight: '600',
    },
    metaDivider: {
        fontSize: 14,
        color: '#A5A8BA',
    },
    typePill: {
        marginTop: 8,
        alignSelf: 'flex-start',
        borderRadius: 999,
        backgroundColor: '#EFE7FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    typePillText: {
        color: '#5D33B6',
        fontSize: 13,
        fontWeight: '700',
    },
    tenantDescription: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: '#61698A',
    },
    tenantCardFooter: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tenantCardFooterRtl: {
        flexDirection: 'row-reverse',
    },
    arrowCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F2EAFE',
    },
    footerWrap: {
        marginTop: 6,
        marginHorizontal: spacing.lg,
    },
    trustRow: {
        borderRadius: 24,
        backgroundColor: '#F3EEFF',
        borderWidth: 1,
        borderColor: '#E9DDFF',
        paddingHorizontal: 10,
        paddingVertical: 14,
        flexDirection: 'row',
        gap: 8,
    },
    trustItemBox: {
        flex: 1,
        alignItems: 'flex-start',
        gap: 4,
    },
    trustItemTitle: {
        fontSize: 14,
        color: '#2D2854',
        fontWeight: '800',
    },
    trustItemSubtitle: {
        fontSize: 12,
        color: '#666C89',
        lineHeight: 17,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    clearFiltersBtn: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 999,
        backgroundColor: '#EFE7FF',
    },
    clearFiltersText: {
        color: colors.primary,
        fontWeight: '700',
    },
});
