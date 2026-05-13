import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Platform, Image, TouchableOpacity, ActivityIndicator, ImageBackground, Dimensions, Alert, Share, Linking, Modal } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { api, Tenant, Service, ServiceVariant, Staff, Product, getImageUrl, getServicePrice, normalizeProduct, normalizeService, normalizeStaff, normalizeTenant } from '../api/client';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '../components/AppIcon';
import { useScreenSafeArea } from '../utils/safeArea';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';

interface TenantDetailsProps {
    route: any;
    navigation: any;
}

type TenantReview = {
    id: string;
    rating: number;
    comment?: string | null;
    customerName?: string | null;
    staffReply?: string | null;
    createdAt: string;
    staff?: {
        id: string;
        name?: string | null;
    } | null;
};

type StaffReview = {
    id: string;
    rating: number;
    comment?: string | null;
    customerName?: string | null;
    staffReply?: string | null;
    createdAt: string;
};

const { width } = Dimensions.get('window');

export function TenantScreen({ route, navigation }: TenantDetailsProps) {
    const { tenantId, slug, selectedServiceId } = route.params; // Expect tenantId or slug from navigation
    const { t, isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [pageData, setPageData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'services' | 'products' | 'reviews' | 'about'>('services');
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [showServicesTab, setShowServicesTab] = useState(true);
    const [showProductsTab, setShowProductsTab] = useState(false);
    const [showReviewsTab, setShowReviewsTab] = useState(true);
    const [showAboutTab, setShowAboutTab] = useState(true);
    const [reviews, setReviews] = useState<TenantReview[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsSummary, setReviewsSummary] = useState<{ total: number; avgRating: number | null }>({ total: 0, avgRating: null });
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedServiceDetails, setSelectedServiceDetails] = useState<(Service & { employees?: Staff[]; variants?: ServiceVariant[] }) | null>(null);
    const [selectedServiceLoading, setSelectedServiceLoading] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<Staff | null>(null);
    const [providerReviews, setProviderReviews] = useState<StaffReview[]>([]);
    const [providerReviewsLoading, setProviderReviewsLoading] = useState(false);
    const [providerReviewsSummary, setProviderReviewsSummary] = useState<{ total: number; avgRating: number | null }>({ total: 0, avgRating: null });
    const { itemCount, addToCart, clearCart } = useCart();
    const { itemCount: serviceBookingItemCount } = useServiceBookingCart();

    useEffect(() => {
        loadTenantDetails();
    }, [tenantId, slug]);

    useEffect(() => {
        if (!selectedServiceId || services.length === 0) {
            return;
        }

        const matchedService = services.find((service) => service.id === selectedServiceId);
        if (matchedService) {
            setActiveTab('services');
            setSelectedService(matchedService);
        }
    }, [selectedServiceId, services]);

    const loadTenantDetails = async () => {
        try {
            setLoading(true);
            let resolvedTenant: Tenant | null = route.params.tenant || null;

            if (resolvedTenant) {
                setTenant(resolvedTenant);
            } else if (slug) {
                const tenantRes = await api.get<{ success: boolean; data: Tenant }>(`/public/tenant/${slug}`);
                if (tenantRes.success && tenantRes.data) {
                    resolvedTenant = normalizeTenant(tenantRes.data);
                    setTenant(resolvedTenant);
                }
            } else {
                const tenantsRes = await api.get<{ success: boolean; tenants: Tenant[] }>('/public/tenants');
                const matchedTenant = (tenantsRes.tenants || [])
                    .map((item) => normalizeTenant(item))
                    .find((item) => item.id === tenantId);
                if (matchedTenant) {
                    resolvedTenant = matchedTenant;
                    setTenant(resolvedTenant);
                }
            }

            const idToFetch = tenantId || resolvedTenant?.id;
            if (!idToFetch) {
                throw new Error('Tenant information is missing.');
            }

            // 2. Fetch page-data for dynamic sections
            const pageDataRes = await api.get<{ success: boolean; data: any }>(`/public/tenant/${idToFetch}/page-data`);
            let isProductsEnabled = false;
            let isServicesEnabled = true;
            let isReviewsEnabled = false;
            let isAboutEnabled = true;

            if (pageDataRes.success && pageDataRes.data) {
                setPageData(pageDataRes.data);
            }

            if (pageDataRes.success && pageDataRes.data?.generalSettings?.sections) {
                const sections = pageDataRes.data.generalSettings.sections;
                isProductsEnabled = sections.products !== false;
                isServicesEnabled = sections.services !== false;
                isAboutEnabled = sections.about !== false && sections.callToAction !== false;
                isReviewsEnabled = sections.reviews === true;

                setShowProductsTab(isProductsEnabled);
                setShowServicesTab(isServicesEnabled);
                setShowReviewsTab(isReviewsEnabled);
                setShowAboutTab(isAboutEnabled);
            } else {
                setShowProductsTab(true); // Fallback to true if no settings found
                isProductsEnabled = true;
                setShowReviewsTab(false);
                setShowAboutTab(true);
            }

            // Fallback for activeTab if the default 'services' is hidden
            if (!isServicesEnabled) {
                if (isProductsEnabled) setActiveTab('products');
                else if (isReviewsEnabled) setActiveTab('reviews');
                else if (isAboutEnabled) setActiveTab('about');
            }

            // 3. Fetch Services
            if (isServicesEnabled) {
                try {
                    const servicesRes = await api.get<{ success: boolean; services: Service[] }>(`/public/tenant/${idToFetch}/services`);
                    if (servicesRes.success) setServices((servicesRes.services || []).map((service) => normalizeService(service)));
                } catch {
                    setServices([]);
                }
            }

            // 4. Fetch Products (if tab is enabled)
            if (isProductsEnabled) {
                try {
                    const productsRes = await api.get<{ success: boolean; products: Product[] }>(`/public/tenant/${idToFetch}/products`);
                    if (productsRes.success) {
                        setProducts((productsRes.products || []).map((product) => normalizeProduct({
                            ...product,
                            tenantId: idToFetch,
                        })));
                    }
                } catch {
                    setProducts([]);
                }
            }

            // 5. Fetch Staff
            try {
                const staffRes = await api.get<{ success: boolean; staff: Staff[] }>(`/public/tenant/${idToFetch}/staff`);
                if (staffRes.success) setStaff((staffRes.staff || []).map((member) => normalizeStaff(member)));
            } catch {
                setStaff([]);
            }

            if (isReviewsEnabled) {
                try {
                    setReviewsLoading(true);
                    const reviewsRes = await api.get<{ success: boolean; reviews: TenantReview[]; summary?: { total: number; avgRating: number | null } }>(
                        `/public/tenant/${idToFetch}/reviews?limit=30`
                    );
                    if (reviewsRes.success) {
                        const nextReviews = reviewsRes.reviews || [];
                        setReviews(nextReviews);
                        setReviewsSummary({
                            total: reviewsRes.summary?.total || nextReviews.length,
                            avgRating: reviewsRes.summary?.avgRating ?? null,
                        });
                    } else {
                        setReviews([]);
                        setReviewsSummary({ total: 0, avgRating: null });
                    }
                } catch {
                    setReviews([]);
                    setReviewsSummary({ total: 0, avgRating: null });
                } finally {
                    setReviewsLoading(false);
                }
            } else {
                setReviews([]);
                setReviewsSummary({ total: 0, avgRating: null });
            }

        } catch (error) {
            console.error('Failed to load tenant details:', error);
        } finally {
            setLoading(false);
        }
    };

    const getBusinessTypeLabel = () => {
        if (!tenant?.businessType) {
            return null;
        }

        const rawValue = Array.isArray(tenant.businessType) ? tenant.businessType[0] : tenant.businessType;
        if (!rawValue) {
            return null;
        }

        return `${rawValue}`.replace(/_/g, ' ');
    };

    const getLocalizedText = (enValue?: string | null, arValue?: string | null, fallback?: string | null) =>
        (isRTL ? arValue || enValue : enValue || arValue) || fallback || null;

    const normalizeList = (items: unknown): string[] => {
        if (!Array.isArray(items)) {
            return [];
        }

        return items
            .map((item) => {
                if (typeof item === 'string') {
                    return item.trim();
                }

                if (item && typeof item === 'object') {
                    return getLocalizedText((item as any).en, (item as any).ar, '');
                }

                return '';
            })
            .filter(Boolean) as string[];
    };

    const openExternalUrl = async (url?: string | null) => {
        if (!url) {
            return;
        }

        try {
            await Linking.openURL(url);
        } catch (error) {
            Alert.alert('Error', 'Unable to open this link right now.');
        }
    };

    const handleShareTenant = async () => {
        if (!tenant) {
            return;
        }

        const tenantUrl = tenant.slug ? `https://www.refah.sa/${tenant.slug}` : tenant.googleMapLink;

        try {
            await Share.share({
                message: tenantUrl ? `${tenant.name}\n${tenantUrl}` : tenant.name,
            });
        } catch (error) {
            console.error('Share tenant error:', error);
        }
    };

    const aboutStory = getLocalizedText(
        pageData?.aboutUs?.storyEn,
        pageData?.aboutUs?.storyAr,
        isRTL
            ? tenant?.description_ar || tenant?.descriptionAr || tenant?.description
            : tenant?.description_en || tenant?.description || null
    );
    const missions = normalizeList(pageData?.aboutUs?.missions);
    const visions = normalizeList(pageData?.aboutUs?.visions);
    const pageSetup = pageData?.generalSettings?.pageSetup || {};
    const socialLinks = [
        { key: 'instagram', url: pageSetup?.instagramUrl || tenant?.instagramUrl, icon: 'instagram' as const, color: '#E1306C' },
        { key: 'twitter', url: pageSetup?.twitterUrl || tenant?.twitterUrl, icon: 'twitter' as const, color: '#1DA1F2' },
        { key: 'facebook', url: tenant?.facebookUrl, icon: 'link' as const, color: '#1877F2' },
        { key: 'linkedin', url: pageSetup?.linkedinUrl || tenant?.linkedinUrl, icon: 'linkedin' as const, color: '#0A66C2' },
        { key: 'youtube', url: pageSetup?.youtubeUrl || tenant?.youtubeUrl, icon: 'youtube' as const, color: '#FF0000' },
        { key: 'tiktok', url: pageSetup?.tiktokUrl || tenant?.tiktokUrl, icon: 'tiktok' as const, color: '#111111' },
        { key: 'snapchat', url: pageSetup?.snapchatUrl || tenant?.snapchatUrl, icon: 'snapchat' as const, color: '#FACC15' },
    ].filter((item) => item.url);
    const locationLine = pageSetup?.addressText || [
        tenant?.buildingNumber,
        tenant?.street,
        tenant?.district,
        tenant?.city,
        tenant?.country,
    ].filter(Boolean).join(', ') || tenant?.address || null;

    const handleAddProduct = (product: Product) => {
        const result = addToCart(product);
        if (result.success) {
            return;
        }

        if (result.reason === 'different_tenant') {
            Alert.alert(
                'Replace cart?',
                'Your cart already contains products from another tenant. Clear it and add this product instead?',
                [
                    { text: t('cancel'), style: 'cancel' },
                    {
                        text: 'Replace Cart',
                        style: 'destructive',
                        onPress: () => {
                            clearCart();
                            addToCart(product);
                        },
                    },
                ]
            );
        }
    };

    const getServiceDescription = (service: Service) =>
        (isRTL ? service.description_ar : service.description_en)
        || service.description_en
        || service.description_ar
        || '';

    const closeServiceDetails = () => {
        setSelectedService(null);
        setSelectedServiceDetails(null);
        setSelectedServiceLoading(false);
    };

    const openServiceDetails = async (service: Service) => {
        setSelectedService(service);
        setSelectedServiceDetails(null);
        setSelectedServiceLoading(true);

        try {
            const serviceRes = await api.get<{ success: boolean; service: Service & { employees?: Staff[]; variants?: ServiceVariant[] } }>(
                `/public/tenant/${tenant?.id || tenantId}/services/${service.id}`
            );

            if (serviceRes.success && serviceRes.service) {
                const normalizedEmployees = Array.isArray(serviceRes.service.employees)
                    ? serviceRes.service.employees.map((employee) => normalizeStaff(employee))
                    : [];

                setSelectedServiceDetails({
                    ...normalizeService(serviceRes.service),
                    employees: normalizedEmployees,
                });
                return;
            }
        } catch (error) {
            console.warn('Failed to load service details:', error);
        } finally {
            setSelectedServiceLoading(false);
        }

        setSelectedServiceDetails(service);
    };

    const openProviderProfile = async (provider: Staff) => {
        setSelectedProvider(provider);
        setProviderReviews([]);
        setProviderReviewsSummary({ total: 0, avgRating: null });
        try {
            setProviderReviewsLoading(true);
            const response = await api.get<{ success: boolean; reviews: StaffReview[]; summary?: { total: number; avgRating: number | null } }>(
                `/public/staff/${provider.id}/reviews?limit=20`
            );
            if (response.success) {
                const reviews = response.reviews || [];
                setProviderReviews(reviews);
                setProviderReviewsSummary({
                    total: response.summary?.total || reviews.length,
                    avgRating: response.summary?.avgRating ?? null,
                });
            }
        } catch (error) {
            console.warn('Failed to load provider reviews:', error);
        } finally {
            setProviderReviewsLoading(false);
        }
    };

    const handleBookService = (service: Service, staff?: Staff | null, variant?: ServiceVariant | null) => {
        closeServiceDetails();
        navigation.navigate('Booking', {
            service,
            tenant,
            selectedStaff: staff || undefined,
            selectedVariant: variant || undefined,
        });
    };

    const renderServiceVariants = (service: Service & { variants?: ServiceVariant[] }) => {
        const activeVariants = Array.isArray(service.variants)
            ? service.variants.filter((variant) => variant?.isActive !== false)
            : [];

        if (activeVariants.length === 0) {
            return null;
        }

        return (
            <View style={styles.variantSection}>
                <Text style={styles.employeeSectionTitle}>
                    {isRTL ? 'النسخ المتاحة' : 'Available Variants'}
                </Text>
                {activeVariants.map((variant) => {
                    const variantPrice = getServicePrice(service, variant);

                    return (
                        <View key={variant.id} style={styles.variantCard}>
                            <View style={styles.variantHeaderRow}>
                                <View style={styles.variantTitleWrap}>
                                    <Text style={styles.variantTitle}>
                                        {variant.description || (isRTL ? 'متغير' : 'Variant')}
                                    </Text>
                                    <Text style={styles.variantMeta}>
                                        {(variant.duration || service.duration)} mins
                                    </Text>
                                </View>
                                <Text style={styles.variantPrice}>{variantPrice.toFixed(2)} SAR</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.variantBookButton}
                                onPress={() => handleBookService(service, undefined, variant)}
                            >
                                <Text style={styles.variantBookButtonText}>
                                    {isRTL ? 'احجز هذه النسخة' : 'Book this Variant'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderHero = () => {
        if (!tenant) return null;

        const coverImage = getImageUrl(tenant.coverImage || tenant.logo) || 'https://images.unsplash.com/photo-1560066984-12186d305d4d?q=80&w=2574&auto=format&fit=crop';

        return (
            <View style={styles.heroContainer}>
                <ImageBackground source={{ uri: coverImage }} style={styles.heroImage} resizeMode="cover">
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.heroGradient}
                    >
                        <View style={styles.heroContent}>
                            <View style={[styles.heroHeader, { marginTop: topInset }]}>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color="white" />
                                </TouchableOpacity>
                                <View style={styles.heroActions}>
                                    <TouchableOpacity style={styles.iconButton} onPress={handleShareTenant}>
                                        <AppIcon name="share" size={24} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={() => navigation.navigate('ServiceBookingCart')}
                                    >
                                        <AppIcon name="bookings" size={24} color="white" />
                                        {serviceBookingItemCount > 0 && (
                                            <View style={styles.badgeContainer}>
                                                <Text style={styles.badgeText}>{serviceBookingItemCount}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Cart', { tenant })}>
                                        <AppIcon name="cart" size={24} color="white" />
                                        {itemCount > 0 && (
                                            <View style={styles.badgeContainer}>
                                                <Text style={styles.badgeText}>{itemCount}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.heroInfo}>
                                <Text style={styles.heroTitle}>{tenant.name}</Text>
                                <Text style={styles.heroSubtitle}>
                                    {[getBusinessTypeLabel(), tenant.city].filter(Boolean).join(' • ') || tenant.slug}
                                </Text>

                                <View style={styles.openStatus}>
                                    <View style={[styles.statusDot, { backgroundColor: tenant.isAvailable ? '#10B981' : colors.error }]} />
                                    <Text style={[styles.statusText, { color: tenant.isAvailable ? '#10B981' : colors.error }]}>
                                        {tenant.isAvailable ? t('available') : t('closed')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </View>
        );
    };

    const renderTabs = () => {
        const availableTabs: string[] = [];
        if (showServicesTab) availableTabs.push('services');
        if (showProductsTab) availableTabs.push('products');
        if (showReviewsTab) availableTabs.push('reviews');
        if (showAboutTab) availableTabs.push('about');

        if (availableTabs.length === 0) return null;

        return (
            <View style={styles.tabContainer}>
                {availableTabs.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab as any)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {t(tab as any) || tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderServices = () => {
        // Group services by category
        const categories = Array.from(new Set(services.map(s => s.category || 'General'))); // Fallback category

        return (
            <View style={styles.contentSection}>
                {serviceBookingItemCount > 0 && (
                    <View style={styles.serviceBookingBanner}>
                        <View style={styles.serviceBookingBannerLeft}>
                            <View style={styles.serviceBookingBannerIcon}>
                                <AppIcon name="bookings" size={18} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.serviceBookingBannerTitle}>
                                    {isRTL ? 'خدمات محفوظة للحجز' : 'Saved booking services'}
                                </Text>
                                <Text style={styles.serviceBookingBannerText}>
                                    {serviceBookingItemCount}{' '}
                                    {isRTL ? 'خدمة في سلة الحجز' : 'service items are in your booking cart'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.serviceBookingBannerButton}
                            onPress={() => navigation.navigate('ServiceBookingCart')}
                        >
                            <Text style={styles.serviceBookingBannerButtonText}>
                                {isRTL ? 'عرض السلة' : 'View Cart'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
                {services.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No services available yet.</Text>
                    </View>
                ) : (
                    categories.map(category => (
                        <View key={category} style={styles.categorySection}>
                            <Text style={styles.categoryTitle}>{category}</Text>
                            {services.filter(s => (s.category || 'General') === category).map(service => (
                                <View key={service.id} style={styles.serviceCard}>
                                    <TouchableOpacity
                                        style={styles.serviceMainAction}
                                        onPress={() => openServiceDetails(service)}
                                        activeOpacity={0.85}
                                    >
                                    <View style={styles.serviceInfo}>
                                        <Text style={styles.serviceName}>{isRTL ? service.name_ar : service.name_en}</Text>
                                        <Text style={styles.serviceDuration}>{service.duration} mins</Text>
                                        <Text style={styles.servicePrice}>{getServicePrice(service).toFixed(2)} SAR</Text>
                                    </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.addButton} onPress={() => handleBookService(service)}>
                                        <AppIcon name="plus" size={24} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ))
                )}
            </View>
        );
    };

    const renderProducts = () => {
        return (
            <View style={styles.contentSection}>
                {products.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No products available yet.</Text>
                    </View>
                ) : (
                    <View style={styles.productGrid}>
                        {products.map(product => {
                            const imageUri = product.images && product.images.length > 0
                                ? getImageUrl(product.images[0])
                                : 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600&auto=format&fit=crop';

                            return (
                                <View key={product.id} style={styles.productCard}>
                                    <Image
                                        source={{ uri: imageUri }}
                                        style={styles.productImage}
                                    />
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productName} numberOfLines={2}>{isRTL ? product.name_ar : product.name_en}</Text>
                                        <Text style={styles.productPrice}>{product.price.toFixed(2)} SAR</Text>
                                    </View>
                                    <TouchableOpacity style={styles.addToCartButton} onPress={() => handleAddProduct(product)}>
                                        <Text style={styles.addToCartText}>{t('addToCart' as any) || 'Add'}</Text>
                                        <AppIcon name="cart" size={18} color="white" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        );
    };

    const renderReviews = () => (
        <View style={styles.contentSection}>
            <View style={styles.reviewSummaryCard}>
                <View style={styles.reviewSummaryMetric}>
                    <Text style={styles.reviewSummaryValue}>{reviewsSummary.avgRating ? reviewsSummary.avgRating.toFixed(1) : '-'}</Text>
                    <Text style={styles.reviewSummaryLabel}>{isRTL ? 'المتوسط' : 'Average'}</Text>
                </View>
                <View style={styles.reviewSummaryDivider} />
                <View style={styles.reviewSummaryMetric}>
                    <Text style={styles.reviewSummaryValue}>{reviewsSummary.total}</Text>
                    <Text style={styles.reviewSummaryLabel}>{isRTL ? 'عدد التقييمات' : 'Reviews'}</Text>
                </View>
            </View>

            {reviewsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            ) : reviews.length === 0 ? (
                <Text style={styles.emptyText}>{isRTL ? 'لا توجد تقييمات منشورة بعد.' : 'No published reviews yet.'}</Text>
            ) : (
                reviews.map((review) => (
                    <View key={review.id} style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                            <Text style={styles.reviewAuthor}>{review.customerName || (isRTL ? 'عميل' : 'Customer')}</Text>
                            <View style={styles.reviewStarsRow}>
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <Text key={`${review.id}-star-${index}`} style={[styles.reviewStar, index < Number(review.rating || 0) ? styles.reviewStarActive : null]}>
                                        ★
                                    </Text>
                                ))}
                            </View>
                        </View>

                        {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                        {review.staff?.name ? (
                            <Text style={styles.reviewStaffName}>
                                {isRTL ? `مقدم الخدمة: ${review.staff.name}` : `Provider: ${review.staff.name}`}
                            </Text>
                        ) : null}
                        {review.staffReply ? (
                            <View style={styles.reviewReplyBox}>
                                <Text style={styles.reviewReplyLabel}>{isRTL ? 'رد المركز' : 'Center reply'}</Text>
                                <Text style={styles.reviewReplyText}>{review.staffReply}</Text>
                            </View>
                        ) : null}
                    </View>
                ))
            )}
        </View>
    );

    const renderAbout = () => (
        <View style={styles.contentSection}>
            {aboutStory ? (
                <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('about')}</Text>
                    <Text style={styles.aboutText}>{aboutStory}</Text>
                </View>
            ) : null}

            {missions.length > 0 ? (
                <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('mission')}</Text>
                    {missions.map((item, index) => (
                        <Text key={`mission-${index}`} style={styles.listItemText}>• {item}</Text>
                    ))}
                </View>
            ) : null}

            {visions.length > 0 ? (
                <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('vision')}</Text>
                    {visions.map((item, index) => (
                        <Text key={`vision-${index}`} style={styles.listItemText}>• {item}</Text>
                    ))}
                </View>
            ) : null}

            {locationLine || pageSetup?.googleMapLink || tenant?.googleMapLink ? (
                <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('location')}</Text>
                    {locationLine ? <Text style={styles.addressText}>{locationLine}</Text> : null}
                    {pageSetup?.googleMapLink || tenant?.googleMapLink ? (
                        <TouchableOpacity style={styles.mapPlaceholder} onPress={() => openExternalUrl(pageSetup?.googleMapLink || tenant?.googleMapLink)}>
                            <AppIcon name="location" size={32} color={colors.textSecondary} />
                            <Text style={styles.mapText}>{t('viewOnMap')}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {tenant?.workingHours ? (
                <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('workingHours')}</Text>
                    <View style={styles.hoursContainer}>
                        {Object.entries(tenant.workingHours).map(([day, hours]: [string, any]) => (
                            <View key={day} style={styles.hoursRow}>
                                <Text style={styles.dayText}>{t(day as any) || day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                                <Text style={[styles.timeText, !hours.isOpen && { color: colors.error }]}>
                                    {hours.isOpen ? `${hours.open} - ${hours.close}` : t('closed')}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            ) : null}

            {pageSetup?.phone || tenant?.phone || tenant?.mobile || pageSetup?.email || tenant?.email || pageSetup?.website || tenant?.website ? (
                <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('contact')}</Text>
                    {pageSetup?.phone || tenant?.phone || tenant?.mobile ? (
                        <View style={styles.contactRow}>
                            <AppIcon name="phone" size={20} color={colors.primary} />
                            <Text style={styles.contactText}>{pageSetup?.phone || tenant?.phone || tenant?.mobile}</Text>
                        </View>
                    ) : null}
                    {pageSetup?.email || tenant?.email ? (
                        <View style={styles.contactRow}>
                            <AppIcon name="mail" size={20} color={colors.primary} />
                            <Text style={styles.contactText}>{pageSetup?.email || tenant?.email}</Text>
                        </View>
                    ) : null}
                    {pageSetup?.website || tenant?.website ? (
                        <TouchableOpacity style={styles.contactRow} onPress={() => openExternalUrl(pageSetup?.website || tenant?.website)}>
                            <AppIcon name="globe" size={20} color={colors.primary} />
                            <Text style={styles.contactText}>{pageSetup?.website || tenant?.website}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {socialLinks.length > 0 ? (
                <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('followUs')}</Text>
                    <View style={styles.socialRow}>
                        {socialLinks.map((item) => (
                            <TouchableOpacity key={item.key} style={styles.socialIcon} onPress={() => openExternalUrl(item.url)}>
                                <AppIcon name={item.icon as any} size={24} color={item.color} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ) : null}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            >
                {renderHero()}
                {renderTabs()}
                {activeTab === 'services' && renderServices()}
                {activeTab === 'products' && renderProducts()}
                {activeTab === 'reviews' && renderReviews()}
                {activeTab === 'about' && renderAbout()}
            </ScrollView>

            <Modal
                visible={!!selectedService}
                transparent
                animationType="slide"
                onRequestClose={closeServiceDetails}
            >
                <View style={styles.modalBackdrop}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeServiceDetails} />
                    {selectedService ? (
                        selectedServiceLoading ? (
                            <View style={styles.serviceModalCard}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : (
                        <View style={styles.serviceModalCard}>
                            <View style={styles.serviceModalHeader}>
                                <View style={styles.serviceModalTitleWrap}>
                                    <Text style={styles.serviceModalCategory}>{selectedServiceDetails?.category || selectedService.category}</Text>
                                    <Text style={styles.serviceModalTitle}>{isRTL ? (selectedServiceDetails?.name_ar || selectedService.name_ar) : (selectedServiceDetails?.name_en || selectedService.name_en)}</Text>
                                </View>
                                <TouchableOpacity onPress={closeServiceDetails} style={styles.serviceModalClose}>
                                    <AppIcon name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.serviceMetaRow}>
                                <View style={styles.serviceMetaBadge}>
                                    <AppIcon name="clock" size={16} color={colors.primary} />
                                    <Text style={styles.serviceMetaText}>{(selectedServiceDetails?.duration || selectedService.duration)} mins</Text>
                                </View>
                                <View style={styles.serviceMetaBadge}>
                                    <AppIcon name="cash" size={16} color={colors.primary} />
                                    <Text style={styles.serviceMetaText}>{getServicePrice(selectedServiceDetails || selectedService).toFixed(2)} SAR</Text>
                                </View>
                                {(selectedServiceDetails?.employees || []).length > 0 ? (
                                    <View style={styles.serviceMetaBadge}>
                                        <AppIcon name="star" size={16} color={colors.primary} />
                                        <Text style={styles.serviceMetaText}>
                                            {(selectedServiceDetails!.employees!.reduce((sum, member) => sum + (member.rating || 0), 0) / selectedServiceDetails!.employees!.length).toFixed(1)} ⭐
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <Text style={styles.serviceModalDescription}>
                                {getServiceDescription(selectedServiceDetails || selectedService) || 'Service details will appear here soon.'}
                            </Text>

                            {renderServiceVariants(selectedServiceDetails || selectedService)}

                            {(selectedServiceDetails?.employees || []).length > 0 ? (
                                <View style={styles.employeeSection}>
                                    <Text style={styles.employeeSectionTitle}>
                                        {isRTL ? 'المتخصصون المتاحون' : 'Available Professionals'}
                                    </Text>
                                    {(selectedServiceDetails?.employees || []).map((employee) => {
                                        const avatarUrl = getImageUrl(employee.avatar || employee.image);
                                        const initials = employee.name?.charAt(0)?.toUpperCase() || '?';
                                        const experienceLabel = employee.experience
                                            ? (isRTL ? `الخبرة: ${employee.experience}` : `Experience: ${employee.experience}`)
                                            : (isRTL ? 'الخبرة غير متاحة' : 'Experience not listed');

                                        return (
                                            <View key={employee.id} style={styles.employeeCard}>
                                                {avatarUrl ? (
                                                    <Image source={{ uri: avatarUrl }} style={styles.employeeAvatar} />
                                                ) : (
                                                    <View style={styles.employeeAvatarPlaceholder}>
                                                        <Text style={styles.employeeAvatarText}>{initials}</Text>
                                                    </View>
                                                )}
                                                <View style={styles.employeeContent}>
                                                    <View style={styles.employeeHeaderRow}>
                                                        <Text style={styles.employeeName}>{employee.name}</Text>
                                                        <View style={styles.employeeRatingBadge}>
                                                            <AppIcon name="star" size={12} color="#D97706" />
                                                            <Text style={styles.employeeRatingText}>{(employee.rating || 0).toFixed(1)}</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.employeeExperience}>{experienceLabel}</Text>
                                                    {employee.bio ? (
                                                        <Text style={styles.employeeBio} numberOfLines={3}>
                                                            {employee.bio}
                                                        </Text>
                                                    ) : null}
                                                    {Array.isArray(employee.skills) && employee.skills.length > 0 ? (
                                                        <Text style={styles.employeeSkills} numberOfLines={1}>
                                                            {employee.skills.join(' • ')}
                                                        </Text>
                                                    ) : null}
                                                    <View style={styles.employeeActionsRow}>
                                                        <TouchableOpacity style={styles.employeeProfileButton} onPress={() => openProviderProfile(employee)}>
                                                            <Text style={styles.employeeProfileButtonText}>
                                                                {isRTL ? 'عرض الملف' : 'View Profile'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={styles.employeeBookButton} onPress={() => handleBookService(selectedServiceDetails || selectedService, employee)}>
                                                            <Text style={styles.employeeBookButtonText}>
                                                                {isRTL ? 'احجز مع هذا المتخصص' : 'Book with this Professional'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : null}

                            <TouchableOpacity style={styles.serviceBookButton} onPress={() => handleBookService(selectedServiceDetails || selectedService)}>
                                <Text style={styles.serviceBookButtonText}>{isRTL ? 'احجز هذه الخدمة' : 'Book This Service'}</Text>
                            </TouchableOpacity>
                        </View>
                        )
                    ) : null}
                </View>
            </Modal>

            <Modal
                visible={!!selectedProvider}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedProvider(null)}
            >
                <View style={styles.modalBackdrop}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setSelectedProvider(null)} />
                    <View style={styles.providerModalCard}>
                        {selectedProvider ? (
                            <>
                                <View style={styles.providerModalHeader}>
                                    <Text style={styles.providerModalTitle}>{selectedProvider.name}</Text>
                                    <TouchableOpacity onPress={() => setSelectedProvider(null)} style={styles.serviceModalClose}>
                                        <AppIcon name="close" size={24} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.providerSummaryRow}>
                                    <View style={styles.providerSummaryBadge}>
                                        <AppIcon name="star" size={14} color="#D97706" />
                                        <Text style={styles.providerSummaryText}>
                                            {providerReviewsSummary.avgRating ? providerReviewsSummary.avgRating.toFixed(1) : (selectedProvider.rating || 0).toFixed(1)}
                                        </Text>
                                    </View>
                                    <View style={styles.providerSummaryBadge}>
                                        <AppIcon name="bookings" size={14} color={colors.primary} />
                                        <Text style={styles.providerSummaryText}>
                                            {providerReviewsSummary.total} {isRTL ? 'تقييم' : 'reviews'}
                                        </Text>
                                    </View>
                                </View>
                                {selectedProvider.experience ? (
                                    <Text style={styles.providerExperienceText}>
                                        {isRTL ? `الخبرة: ${selectedProvider.experience}` : `Experience: ${selectedProvider.experience}`}
                                    </Text>
                                ) : null}
                                {selectedProvider.bio ? (
                                    <Text style={styles.providerBioText}>{selectedProvider.bio}</Text>
                                ) : null}
                                {Array.isArray(selectedProvider.skills) && selectedProvider.skills.length > 0 ? (
                                    <Text style={styles.providerSkillsText}>{selectedProvider.skills.join(' • ')}</Text>
                                ) : null}
                                <Text style={styles.providerReviewsHeading}>{isRTL ? 'تقييمات العملاء' : 'Customer Reviews'}</Text>
                                {providerReviewsLoading ? (
                                    <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
                                ) : providerReviews.length === 0 ? (
                                    <Text style={styles.emptyText}>{isRTL ? 'لا توجد تقييمات منشورة بعد.' : 'No published reviews yet.'}</Text>
                                ) : (
                                    <ScrollView style={styles.providerReviewsList} showsVerticalScrollIndicator={false}>
                                        {providerReviews.map((review) => (
                                            <View key={review.id} style={styles.providerReviewCard}>
                                                <View style={styles.reviewHeader}>
                                                    <Text style={styles.reviewAuthor}>{review.customerName || (isRTL ? 'عميل' : 'Customer')}</Text>
                                                    <View style={styles.reviewStarsRow}>
                                                        {Array.from({ length: 5 }).map((_, index) => (
                                                            <Text key={`${review.id}-provider-star-${index}`} style={[styles.reviewStar, index < Number(review.rating || 0) ? styles.reviewStarActive : null]}>
                                                                ★
                                                            </Text>
                                                        ))}
                                                    </View>
                                                </View>
                                                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                                                {review.staffReply ? (
                                                    <View style={styles.reviewReplyBox}>
                                                        <Text style={styles.reviewReplyLabel}>{isRTL ? 'رد المركز' : 'Center reply'}</Text>
                                                        <Text style={styles.reviewReplyText}>{review.staffReply}</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* Bottom Action Bar (if needed, e.g. View Cart or Quick Book) */}
            {/* For now, individual service booking is sufficient */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroContainer: {
        height: 300,
        width: '100%',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroGradient: {
        flex: 1,
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    iconButton: {
        width: 40,
        height: 40,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    heroInfo: {
        marginBottom: spacing.md,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: spacing.xs,
        gap: 4,
    },
    ratingText: {
        color: 'white',
        fontSize: fontSize.xs,
        fontWeight: 'bold',
    },
    heroTitle: {
        color: 'white',
        fontSize: fontSize.xxl,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: fontSize.sm,
        marginBottom: spacing.sm,
    },
    openStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981', // Green for open
    },
    statusText: {
        color: '#10B981',
        fontSize: fontSize.xs,
        fontWeight: '600',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: spacing.md,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: colors.primary,
    },
    contentSection: {
        padding: spacing.lg,
    },
    sectionTitle: {
        fontSize: fontSize.xl,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: spacing.md,
    },
    reviewSummaryCard: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    reviewSummaryMetric: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reviewSummaryDivider: {
        width: 1,
        height: 40,
        backgroundColor: colors.border,
    },
    reviewSummaryValue: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    reviewSummaryLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    reviewCard: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reviewAuthor: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
    },
    reviewStarsRow: {
        flexDirection: 'row',
    },
    reviewStar: {
        fontSize: fontSize.md,
        color: '#D1D5DB',
    },
    reviewStarActive: {
        color: '#F59E0B',
    },
    reviewComment: {
        marginTop: spacing.sm,
        fontSize: fontSize.sm,
        color: colors.text,
        lineHeight: 20,
    },
    reviewStaffName: {
        marginTop: spacing.sm,
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    reviewReplyBox: {
        marginTop: spacing.sm,
        backgroundColor: '#F9FAFB',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    reviewReplyLabel: {
        fontSize: fontSize.xs,
        color: colors.primary,
        fontWeight: '600',
        marginBottom: 2,
    },
    reviewReplyText: {
        fontSize: fontSize.sm,
        color: colors.text,
        lineHeight: 18,
    },
    categorySection: {
        marginBottom: spacing.lg,
    },
    categoryTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    serviceCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    serviceMainAction: {
        flex: 1,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    serviceDuration: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    servicePrice: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.primary,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.primary,
        marginLeft: spacing.md,
    },
    serviceBookingBanner: {
        backgroundColor: 'rgba(124, 77, 255, 0.08)',
        borderColor: 'rgba(124, 77, 255, 0.18)',
        borderWidth: 1,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    serviceBookingBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    serviceBookingBannerIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(124, 77, 255, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    serviceBookingBannerTitle: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    serviceBookingBannerText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    serviceBookingBannerButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
    },
    serviceBookingBannerButtonText: {
        color: 'white',
        fontSize: fontSize.xs,
        fontWeight: '700',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'flex-end',
    },
    serviceModalCard: {
        backgroundColor: colors.background,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        gap: spacing.md,
        maxHeight: '75%',
    },
    serviceModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    serviceModalTitleWrap: {
        flex: 1,
        gap: 4,
    },
    serviceModalCategory: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    serviceModalTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    serviceModalClose: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.backgroundGray,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    serviceMetaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: '#F3E8FF',
    },
    serviceMetaText: {
        fontSize: fontSize.sm,
        color: colors.primaryDark,
        fontWeight: '600',
    },
    employeeSection: {
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    variantSection: {
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    variantCard: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#FFFFFF',
        padding: spacing.md,
        gap: spacing.sm,
    },
    variantHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    variantTitleWrap: {
        flex: 1,
        gap: 2,
    },
    variantTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    variantMeta: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    variantPrice: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.primary,
    },
    variantBookButton: {
        alignSelf: 'flex-start',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    variantBookButtonText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    employeeSectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    employeeCard: {
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#FFFFFF',
    },
    employeeAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.backgroundGray,
    },
    employeeAvatarPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    employeeAvatarText: {
        color: '#FFFFFF',
        fontSize: fontSize.lg,
        fontWeight: '700',
    },
    employeeContent: {
        flex: 1,
        gap: 6,
    },
    employeeHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    employeeName: {
        flex: 1,
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    employeeRatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: '#FEF3C7',
    },
    employeeRatingText: {
        fontSize: fontSize.xs,
        fontWeight: '700',
        color: '#92400E',
    },
    employeeExperience: {
        fontSize: fontSize.sm,
        color: colors.primaryDark,
        fontWeight: '600',
    },
    employeeBio: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    employeeSkills: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    employeeActionsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: 4,
    },
    employeeProfileButton: {
        flex: 1,
        alignSelf: 'flex-start',
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    employeeProfileButtonText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.primary,
    },
    employeeBookButton: {
        flex: 1,
        alignSelf: 'flex-start',
        backgroundColor: colors.backgroundGray,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    employeeBookButtonText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.primary,
    },
    providerModalCard: {
        width: '100%',
        maxHeight: '85%',
        marginTop: 'auto',
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: spacing.lg,
    },
    providerModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    providerModalTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    providerSummaryRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    providerSummaryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.md,
        backgroundColor: '#F3F4F6',
    },
    providerSummaryText: {
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '600',
    },
    providerExperienceText: {
        fontSize: fontSize.sm,
        color: colors.primaryDark,
        marginBottom: spacing.xs,
    },
    providerBioText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing.sm,
    },
    providerSkillsText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    providerReviewsHeading: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    providerReviewsList: {
        maxHeight: 320,
    },
    providerReviewCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    serviceModalDescription: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.sm,
    },
    serviceBookButton: {
        marginTop: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceBookButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
    },
    aboutText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
    },
    listItemText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.xs,
    },
    sectionBlock: {
        marginBottom: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: spacing.lg,
    },
    addressText: {
        fontSize: fontSize.md,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    hoursContainer: {
        marginTop: spacing.sm,
    },
    mapPlaceholder: {
        height: 150,
        backgroundColor: '#F3F4F6',
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.sm,
    },
    mapText: {
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    hoursRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    dayText: {
        fontSize: fontSize.md,
        color: colors.text,
    },
    timeText: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        gap: spacing.md,
    },
    contactText: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '500',
    },
    socialRow: {
        flexDirection: 'row',
        gap: spacing.xl,
        marginTop: spacing.sm,
    },
    socialIcon: {
        padding: spacing.sm,
        backgroundColor: '#F3F4F6',
        borderRadius: borderRadius.full,
    },
    badgeContainer: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: colors.error,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    productGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    productCard: {
        width: (width - spacing.lg * 2 - spacing.md) / 2, // 2 columns with padding and gap
        backgroundColor: 'white',
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    productImage: {
        width: '100%',
        height: 120,
    },
    productInfo: {
        padding: spacing.sm,
    },
    productName: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
        height: 40,
    },
    productPrice: {
        fontSize: fontSize.sm,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: spacing.sm,
    },
    addToCartButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    addToCartText: {
        color: 'white',
        fontSize: fontSize.sm,
        fontWeight: 'bold',
    },
});
