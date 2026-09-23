import React, { useMemo, useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking, Modal, Image, TouchableOpacity, Animated, Easing } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { useCart } from '../contexts/CartContext';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';
import { useAppSession } from '../contexts/AppSessionContext';
import {
    api,
    Tenant,
    Service,
    ServiceVariant,
    ServiceCategoryFull,
    ServiceBundle,
    Staff,
    Product,
    Booking,
    getImageUrl,
    getServicePrice,
    normalizeProduct,
    normalizeService,
    normalizeServiceCategory,
    normalizeServiceBundle,
    normalizeStaff,
    normalizeTenant,
} from '../api/client';
import { ServiceDetailsDrawer } from '../components/ServiceDetailsDrawer';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { AppIcon } from '../components/AppIcon';
import {
    TenantHeader,
    TenantTabs,
    TenantTabType,
    TenantOverviewTab,
    TenantServicesTab,
    TenantProductsTab,
    TenantGiftCardsTab,
    TenantGiftPackage,
    TenantReviewsTab,
    TenantBookingBar,
} from '../components/tenant';
import { usePopup } from '../contexts/PopupContext';

interface TenantDetailsProps {
    route: any;
    navigation: any;
}

export type TenantReview = {
    id: string;
    rating: number;
    comment?: string | null;
    customerName?: string | null;
    authorName?: string | null;
    serviceName?: string | null;
    staffReply?: string | null;
    createdAt: string;
    platformUser?: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
    } | null;
    user?: {
        id?: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
    } | null;
    staff?: {
        id: string;
        name?: string | null;
    } | null;
};

const CANONICAL_TABS: TenantTabType[] = ['about', 'services', 'products', 'gifts', 'reviews'];

export function TenantScreen({ route, navigation }: TenantDetailsProps) {
    const { tenantId, slug, selectedServiceId, initialTab } = route.params || {};
    const { isRTL } = useLanguage();
    const { scrollBottomPadding } = useScreenSafeArea();
    const { confirm, showToast } = usePopup();

    // 1. Core State
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TenantTabType>(() => {
        const normalized = typeof initialTab === 'string' ? initialTab.trim().toLowerCase() : '';
        if (normalized && CANONICAL_TABS.includes(normalized as TenantTabType)) {
            return normalized as TenantTabType;
        }
        return 'about';
    });

    // 2. Tab Data
    const [services, setServices] = useState<Service[]>([]);
    const [tenantCategories, setTenantCategories] = useState<ServiceCategoryFull[]>([]);
    const [isCategoriesLoaded, setIsCategoriesLoaded] = useState(false);
    const [bundles, setBundles] = useState<ServiceBundle[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [allTenantProducts, setAllTenantProducts] = useState<Product[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [giftPackages, setGiftPackages] = useState<TenantGiftPackage[]>([]);
    const [reviews, setReviews] = useState<TenantReview[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsSummary, setReviewsSummary] = useState<{ total: number; avgRating: number | null }>({
        total: 0,
        avgRating: null,
    });

    // 3. Filters & Search State
    const [selectedServiceCategory, setSelectedServiceCategory] = useState('all');
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [productCategoryFilter, setProductCategoryFilter] = useState('all');
    const [productSearchLoading, setProductSearchLoading] = useState(false);

    // 4. Modals and Drawers
    const [selectedDrawerService, setSelectedDrawerService] = useState<{
        service: Service;
        variant: ServiceVariant | null;
    } | null>(null);
    const [reviewTargetBooking, setReviewTargetBooking] = useState<Booking | null>(null);
    const [reviewEligibleBookings, setReviewEligibleBookings] = useState<Booking[]>([]);
    const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());
    const [galleryPreviewImage, setGalleryPreviewImage] = useState<string | null>(null);

    // 5. Context Integrations
    const { itemCount, cartItems, addToCart, clearCart, cartTotal } = useCart();
    const {
        itemCount: serviceBookingItemCount,
        items: serviceBookingItems,
        totalPrice: serviceBookingTotalPrice,
        addItem: addServiceBookingItem,
        removeItem: removeServiceBookingItem,
    } = useServiceBookingCart();
    const { isAuthenticated } = useAppSession();

    const pageEnterAnim = useMemo(() => new Animated.Value(0), []);

    // Service categories: Use authoritative tenant categories from backend if available.
    // Fallback: derive categories from existing service.category when backend category endpoint returns 0 categories or fails.
    const serviceCategories = useMemo(() => {
        if (tenantCategories.length > 0) {
            return tenantCategories;
        }
        // Fallback: derive unique categories from service records
        const uniqueDerived = Array.from(
            new Set(
                services
                    .map((s) => s.category?.trim())
                    .filter((c): c is string => Boolean(c && c.toLowerCase() !== 'all'))
            )
        );
        if (uniqueDerived.length === 0) {
            return ['all'];
        }
        return ['all', ...uniqueDerived];
    }, [tenantCategories, services]);

    useEffect(() => {
        Animated.timing(pageEnterAnim, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [pageEnterAnim]);

    // Initial Load
    useEffect(() => {
        loadTenantDetails();
    }, [tenantId, slug]);

    useEffect(() => {
        loadReviewEligibility();
    }, [tenantId, tenant?.id]);

    // Handle deep linked service
    useEffect(() => {
        if (!selectedServiceId || services.length === 0) return;
        const matched = services.find((s) => s.id === selectedServiceId);
        if (matched) {
            setActiveTab('services');
            setSelectedDrawerService({ service: matched, variant: null });
        }
    }, [selectedServiceId, services]);

    // Handle remote product search / filter
    useEffect(() => {
        if (!tenant?.id) return;
        const search = productSearchQuery.trim();
        const hasRemoteFilters = search.length > 0 || productCategoryFilter !== 'all';

        if (!hasRemoteFilters) {
            setProducts(allTenantProducts);
            setProductSearchLoading(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                setProductSearchLoading(true);
                const responseProducts = await api.getPublicTenantProducts(tenant.id, {
                    search,
                    category: productCategoryFilter,
                });
                if (!cancelled) {
                    setProducts(responseProducts);
                }
            } catch {
                if (!cancelled) {
                    setProducts([]);
                }
            } finally {
                if (!cancelled) {
                    setProductSearchLoading(false);
                }
            }
        }, 280);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [allTenantProducts, productCategoryFilter, productSearchQuery, tenant?.id]);

    const loadTenantDetails = async () => {
        try {
            setLoading(true);
            let resolvedTenant: Tenant | null = route.params?.tenant || null;

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

            // 1. Fetch Services, Categories, and Bundles
            try {
                const [servicesRes, categoriesRes, bundlesRes] = await Promise.all([
                    api.get<{ success: boolean; services: Service[] }>(`/public/tenant/${idToFetch}/services`),
                    api.get<{ success: boolean; categories: ServiceCategoryFull[] }>(`/public/tenant/${idToFetch}/service-categories`).catch(() => ({ success: false, categories: [] as ServiceCategoryFull[] })),
                    api.get<{ success: boolean; bundles: any[] }>(`/public/tenant/${idToFetch}/bundles`).catch(() => ({ success: false, bundles: [] })),
                ]);

                if (servicesRes.success) {
                    setServices((servicesRes.services || []).map((s) => normalizeService(s)));
                } else {
                    setServices([]);
                }

                if (categoriesRes.success && Array.isArray(categoriesRes.categories)) {
                    setTenantCategories(categoriesRes.categories.map((c) => normalizeServiceCategory(c)).filter(Boolean) as ServiceCategoryFull[]);
                    setIsCategoriesLoaded(true);
                } else {
                    setTenantCategories([]);
                    setIsCategoriesLoaded(false);
                }

                if (bundlesRes.success && Array.isArray(bundlesRes.bundles)) {
                    setBundles(bundlesRes.bundles.map((b) => normalizeServiceBundle(b)).filter(Boolean) as ServiceBundle[]);
                } else {
                    setBundles([]);
                }
            } catch {
                setServices([]);
                setTenantCategories([]);
                setIsCategoriesLoaded(false);
                setBundles([]);
            }

            // 2. Fetch Products
            try {
                const productsRes = await api.get<{ success: boolean; products: Product[] }>(
                    `/public/tenant/${idToFetch}/products`
                );
                if (productsRes.success) {
                    const normalizedProducts = (productsRes.products || []).map((p) =>
                        normalizeProduct({ ...p, tenantId: idToFetch })
                    );
                    setAllTenantProducts(normalizedProducts);
                    setProducts(normalizedProducts);
                }
            } catch {
                setAllTenantProducts([]);
                setProducts([]);
            }

            // 3. Fetch Staff
            try {
                const staffRes = await api.get<{ success: boolean; staff: Staff[] }>(
                    `/public/tenant/${idToFetch}/staff`
                );
                if (staffRes.success) {
                    setStaff((staffRes.staff || []).map((m) => normalizeStaff(m)));
                }
            } catch {
                setStaff([]);
            }

            // 4. Fetch Gift Cards
            try {
                const giftsRes = await api.get<{ success: boolean; packages: TenantGiftPackage[] }>(
                    `/public/tenant/${idToFetch}/gift-cards`
                );
                const packages = giftsRes.success ? giftsRes.packages || [] : [];
                setGiftPackages(packages);
            } catch {
                setGiftPackages([]);
            }

            // 5. Fetch Reviews
            try {
                setReviewsLoading(true);
                const reviewsRes = await api.get<{
                    success: boolean;
                    reviews: TenantReview[];
                    summary?: { total: number; avgRating: number | null };
                }>(`/public/tenant/${idToFetch}/reviews?limit=30`);
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
        } catch (error) {
            console.error('Failed to load tenant details:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadReviewEligibility = async () => {
        if (!isAuthenticated) {
            setReviewEligibleBookings([]);
            return;
        }
        try {
            const [appointmentsRes, myReviewsRes] = await Promise.all([
                api.get<{ success: boolean; appointments: Booking[] }>('/appointments/my-appointments'),
                api.get<{ success: boolean; reviews: Array<{ appointmentId?: string | null }> }>('/reviews/my-reviews').catch(() => null),
            ]);

            if (myReviewsRes?.success && Array.isArray(myReviewsRes.reviews)) {
                setReviewedAppointmentIds(
                    new Set(
                        myReviewsRes.reviews
                            .map((item) => item.appointmentId)
                            .filter((id): id is string => Boolean(id))
                    )
                );
            }

            if (appointmentsRes.success && Array.isArray(appointmentsRes.appointments)) {
                setReviewEligibleBookings(appointmentsRes.appointments);
            } else {
                setReviewEligibleBookings([]);
            }
        } catch {
            setReviewEligibleBookings([]);
        }
    };

    const openTenantReviewPrompt = () => {
        const tenantBooking = reviewEligibleBookings.find(
            (booking) =>
                booking.tenantId === tenant?.id &&
                booking.status === 'completed' &&
                !reviewedAppointmentIds.has(booking.id)
        );

        if (!tenantBooking) {
            Alert.alert(
                isRTL ? 'لا يوجد موعد مؤهل' : 'No eligible appointment',
                isRTL
                    ? 'أكمل موعدًا في هذا المركز أولًا لإضافة تقييم.'
                    : 'Complete an appointment with this center first to add a review.'
            );
            return;
        }

        setReviewTargetBooking(tenantBooking);
    };

    const resolveServiceImageUri = (service: Service): string | null => {
        const candidate = service.image || service.imageUrl || (service.images && service.images[0]);
        if (!candidate) return null;
        if (typeof candidate === 'string') return getImageUrl(candidate) || null;
        if (typeof candidate === 'object' && 'url' in candidate) return getImageUrl((candidate as any).url) || null;
        return null;
    };

    const handleToggleService = (service: Service, variant: ServiceVariant | null = null) => {
        const isInCart = serviceBookingItems.some(
            (cartItem) =>
                cartItem.service.id === service.id &&
                (variant ? cartItem.variant?.id === variant.id : !cartItem.variant)
        );

        if (isInCart) {
            const cartItem = serviceBookingItems.find(
                (item) =>
                    item.service.id === service.id &&
                    (variant ? item.variant?.id === variant.id : !item.variant)
            );
            if (cartItem) {
                removeServiceBookingItem(cartItem.id);
            }
        } else {
            const price = getServicePrice(service, variant);
            const result = addServiceBookingItem({
                id: Math.random().toString(36).substring(7),
                tenantId: tenant?.id || tenantId || '',
                tenant: tenant
                    ? {
                          id: tenant.id,
                          name: tenant.name,
                          name_en: tenant.name_en,
                          name_ar: tenant.name_ar,
                          slug: tenant.slug,
                          logo: tenant.logo,
                      }
                    : undefined,
                service,
                variant,
                staff: null,
                requestedStaffId: null,
                staffId: null,
                startTime: '',
                paymentMethod: 'at-center',
                totalPrice: price,
                payableNowAmount: 0,
            });

            if (!result.success && result.reason === 'different_tenant') {
                Alert.alert(
                    isRTL ? 'تنبيه' : 'Cannot Add Service',
                    isRTL
                        ? 'لا يمكنك إضافة خدمات من مراكز مختلفة في نفس الحجز. يرجى إفراغ السلة أولاً.'
                        : 'You cannot add services from different centers to the same booking. Please clear your basket first.'
                );
            }
        }
    };

    const isBundleInCart = (bundle: ServiceBundle): boolean => {
        return serviceBookingItems.some(
            (item) => item.itemType === 'package' && item.packageId === bundle.id
        );
    };

    const handleToggleBundle = (bundle: ServiceBundle) => {
        const inCart = isBundleInCart(bundle);
        if (inCart) {
            const existing = serviceBookingItems.find(
                (item) => item.itemType === 'package' && item.packageId === bundle.id
            );
            if (existing) {
                removeServiceBookingItem(existing.id);
            }
        } else {
            const result = addServiceBookingItem({
                id: `pkg-${bundle.id}-${Date.now().toString(36)}`,
                itemType: 'package',
                packageId: bundle.id,
                bundle: bundle,
                packageItems: (bundle.items || []).map((it, idx) => ({
                    serviceId: it.serviceId,
                    variantId: it.variantId || null,
                    packageItemId: it.id,
                    sequenceOrder: it.sequenceOrder ?? idx,
                    defaultStaffId: it.defaultStaffId || null,
                    service: it.service,
                    duration: it.service?.duration || 30,
                })),
                scheduleType: bundle.scheduleType === 'parallel' ? 'parallel' : 'sequential',
                totalDuration: bundle.totalDuration || 60,
                tenantId: tenant?.id || tenantId || '',
                tenant: tenant
                    ? {
                          id: tenant.id,
                          name: tenant.name,
                          name_en: tenant.name_en,
                          name_ar: tenant.name_ar,
                          slug: tenant.slug,
                          logo: tenant.logo,
                      }
                    : undefined,
                service: {
                    id: bundle.id,
                    tenantId: tenant?.id || tenantId || '',
                    name_en: bundle.name_en,
                    name_ar: bundle.name_ar,
                    description_en: bundle.description_en || '',
                    description_ar: bundle.description_ar || '',
                    price: bundle.totalPrice,
                    rawPrice: bundle.totalPrice,
                    duration: bundle.totalDuration || 60,
                    category: bundle.tenantCategory?.name_en || 'Bundle',
                    isActive: true,
                    allowOnlineBooking: bundle.allowOnlineBooking ?? true,
                } as Service,
                staff: null,
                requestedStaffId: null,
                staffId: null,
                startTime: '',
                paymentMethod: 'at-center',
                totalPrice: Number(bundle.totalPrice || 0),
                payableNowAmount: 0,
            });

            if (!result.success && result.reason === 'different_tenant') {
                Alert.alert(
                    isRTL ? 'تنبيه' : 'Cannot Add Package',
                    isRTL
                        ? 'لا يمكنك إضافة باقات من مراكز مختلفة في نفس الحجز. يرجى إفراغ السلة أولاً.'
                        : 'You cannot add packages from different centers to the same booking. Please clear your basket first.'
                );
            }
        }
    };

    const handleAddProduct = async (product: Product, options?: { navigateToCart?: boolean }) => {
        const result = addToCart(product);

        if (result.success) {
            showToast({
                title: isRTL ? 'تمت الإضافة إلى السلة' : 'Added to Cart',
                message: isRTL
                    ? `تمت إضافة "${product.name_ar || product.name_en}" إلى سلة المنتجات.`
                    : `"${product.name_en || product.name_ar}" was added to your product cart.`,
                type: 'success',
            });
            if (options?.navigateToCart) {
                navigation.navigate('Cart', { tenant });
            }
            return;
        }

        if (result.reason === 'different_tenant') {
            const confirmed = await confirm({
                title: isRTL ? 'استبدال السلة؟' : 'Replace cart?',
                message: isRTL
                    ? 'تحتوي سلتك بالفعل على منتجات من صالون آخر. هل ترغب في إفراغها وإضافة هذا المنتج؟'
                    : 'Your cart already contains products from another tenant. Clear it and add this product instead?',
                confirmText: isRTL ? 'استبدال السلة' : 'Replace Cart',
                cancelText: isRTL ? 'إلغاء' : 'Cancel',
                variant: 'destructive',
            });

            if (!confirmed) return;

            clearCart();
            const replaceResult = addToCart(product);
            if (replaceResult.success) {
                showToast({
                    title: isRTL ? 'تمت الإضافة إلى السلة' : 'Added to Cart',
                    message: isRTL
                        ? `تمت إضافة "${product.name_ar || product.name_en}" إلى سلة المنتجات.`
                        : `"${product.name_en || product.name_ar}" was added to your product cart.`,
                    type: 'success',
                });
                if (options?.navigateToCart) {
                    navigation.navigate('Cart', { tenant });
                }
            }
        }
    };

    if (loading || !tenant) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6537C0" />
            </View>
        );
    }

    // Resolve cover, logo, rating
    const coverUri = (tenant.coverImage && getImageUrl(tenant.coverImage))
        || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80';

    const logoUri = (tenant.logo && getImageUrl(tenant.logo)) || '';

    const rating = reviewsSummary.avgRating !== null
        ? reviewsSummary.avgRating.toFixed(1)
        : '4.9';

    const rawBusinessType = Array.isArray(tenant.businessType)
        ? tenant.businessType[0]
        : tenant.businessType;
    const businessLabel = rawBusinessType
        ? rawBusinessType.replace(/_/g, ' ')
        : (isRTL ? 'صالون وسبا فاخر' : 'Luxury Spa & Beauty Salon');


    const selectedBundleIds = bundles.filter(isBundleInCart).map((b) => b.id);

    // Product categories
    const productCategories = [
        'all',
        ...Array.from(new Set(allTenantProducts.map((p) => p.category).filter(Boolean))),
    ];

    const bottomPaddingWithBar =
        (activeTab === 'services' && serviceBookingItems.length > 0) ||
        (activeTab === 'products' && itemCount > 0)
            ? Math.max(scrollBottomPadding + 76, 96)
            : Math.max(scrollBottomPadding, 24);

    return (
        <View style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottomPaddingWithBar }}
                stickyHeaderIndices={[1]}
            >
                {/* 1. Modern Stitch Header */}
                <TenantHeader
                    tenant={tenant}
                    coverUri={coverUri}
                    logoUri={logoUri}
                    rating={rating}
                    hoursStatus={isRTL ? 'مفتوح الآن' : 'Open Now'}
                    isOpen={true}
                    businessLabel={businessLabel}
                    cartItemCount={
                        activeTab === 'products'
                            ? itemCount
                            : activeTab === 'services'
                                ? serviceBookingItemCount
                                : (serviceBookingItemCount > 0 ? serviceBookingItemCount : itemCount)
                    }
                    serviceCartItemCount={serviceBookingItemCount}
                    onBack={() => navigation.goBack()}
                    onCartPress={() => {
                        if (activeTab === 'products') {
                            navigation.navigate('Cart', { tenant });
                        } else if (activeTab === 'services') {
                            navigation.navigate('ServiceBookingCart');
                        } else {
                            if (serviceBookingItemCount > 0) {
                                navigation.navigate('ServiceBookingCart');
                            } else if (itemCount > 0) {
                                navigation.navigate('Cart', { tenant });
                            } else {
                                navigation.navigate('ServiceBookingCart');
                            }
                        }
                    }}
                />

                {/* 2. Modern 5-Tab Navigation Bar */}
                <TenantTabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    availableTabs={CANONICAL_TABS}
                />

                {/* 3. Modern Stitch Tab Panels */}
                <Animated.View
                    style={[
                        styles.tabContentAnimated,
                        {
                            opacity: pageEnterAnim,
                            transform: [
                                {
                                    translateY: pageEnterAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    {activeTab === 'about' && (
                        <TenantOverviewTab
                            tenant={tenant}
                            staff={staff}
                            reviews={reviews}
                            avgRating={reviewsSummary.avgRating !== null ? reviewsSummary.avgRating.toFixed(1) : null}
                            totalReviews={reviewsSummary.total || reviews.length}
                            onViewAllReviews={() => setActiveTab('reviews')}
                        />
                    )}

                    {activeTab === 'services' && (
                        <TenantServicesTab
                            services={services}
                            categories={serviceCategories}
                            selectedCategory={selectedServiceCategory}
                            onSelectCategory={setSelectedServiceCategory}
                            onSelectService={(service) => handleToggleService(service)}
                            onOpenServiceDetails={(service) =>
                                setSelectedDrawerService({ service, variant: null })
                            }
                            selectedServiceIds={serviceBookingItems.map((item) => item.service.id)}
                            getServiceImageUri={resolveServiceImageUri}
                            bundles={bundles}
                            onAddBundle={handleToggleBundle}
                            selectedBundleIds={selectedBundleIds}
                        />
                    )}

                    {activeTab === 'products' && (
                        <TenantProductsTab
                            products={products}
                            categories={productCategories}
                            selectedCategory={productCategoryFilter}
                            onSelectCategory={setProductCategoryFilter}
                            searchQuery={productSearchQuery}
                            onSearchChange={setProductSearchQuery}
                            onAddProduct={handleAddProduct}
                            onOpenProductDetails={(product) =>
                                navigation.navigate('ProductDetails', { product, tenant })
                            }
                            cartProductIds={cartItems.map((i) => i.product.id)}
                            isLoading={productSearchLoading}
                        />
                    )}

                    {activeTab === 'gifts' && (
                        <TenantGiftCardsTab
                            giftPackages={giftPackages}
                            onSelectGiftPackage={(pkg) =>
                                navigation.navigate('Gifts', {
                                    tenantId: tenant?.id,
                                    tenantName: tenant?.name,
                                    previewOnly: true,
                                })
                            }
                            getImageUrl={(url) => (url ? getImageUrl(url) || url : '')}
                        />
                    )}

                    {activeTab === 'reviews' && (
                        <TenantReviewsTab
                            reviews={reviews}
                            avgRating={reviewsSummary.avgRating !== null ? reviewsSummary.avgRating.toFixed(1) : null}
                            totalReviews={reviewsSummary.total || reviews.length}
                            onWriteReview={openTenantReviewPrompt}
                            isLoading={reviewsLoading}
                        />
                    )}
                </Animated.View>
            </ScrollView>

            {/* 4. Modern Bottom Action Area (Preserving Separate Models) */}
            {activeTab === 'services' && serviceBookingItems.length > 0 && (
                <TenantBookingBar
                    mode="service"
                    itemCount={serviceBookingItemCount}
                    totalPrice={serviceBookingTotalPrice}
                    totalDuration={serviceBookingItems.reduce(
                        (acc, item) => acc + (item.totalDuration || item.service.duration || 0),
                        0
                    )}
                    onContinue={() =>
                        navigation.navigate('Booking', { tenantId: tenant?.id })
                    }
                    bottomInset={scrollBottomPadding}
                />
            )}

            {activeTab === 'products' && itemCount > 0 && (
                <TenantBookingBar
                    mode="product"
                    itemCount={itemCount}
                    totalPrice={cartTotal}
                    onContinue={() => navigation.navigate('Cart', { tenant })}
                    bottomInset={scrollBottomPadding}
                />
            )}

            {/* 5. Drawers and Modals */}
            <ServiceDetailsDrawer
                visible={!!selectedDrawerService}
                onClose={() => setSelectedDrawerService(null)}
                service={selectedDrawerService?.service || null}
                variant={selectedDrawerService?.variant || null}
                tenant={tenant}
                tenantId={tenant?.id || tenantId}
            />

            <ReviewPromptModal
                visible={!!reviewTargetBooking}
                appointment={reviewTargetBooking}
                onClose={() => setReviewTargetBooking(null)}
                onSuccess={() => {
                    setReviewTargetBooking(null);
                    loadReviewEligibility();
                    loadTenantDetails();
                }}
            />

            <Modal
                visible={!!galleryPreviewImage}
                transparent
                animationType="fade"
                onRequestClose={() => setGalleryPreviewImage(null)}
            >
                <View style={styles.galleryPreviewBackdrop}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        onPress={() => setGalleryPreviewImage(null)}
                    />
                    {galleryPreviewImage ? (
                        <View style={styles.galleryPreviewCard}>
                            <Image
                                source={{ uri: galleryPreviewImage }}
                                style={styles.galleryPreviewImage}
                                resizeMode="contain"
                            />
                            <TouchableOpacity
                                style={styles.galleryPreviewCloseButton}
                                onPress={() => setGalleryPreviewImage(null)}
                            >
                                <AppIcon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAF9FC',
    },
    tabContentAnimated: {
        flex: 1,
    },
    galleryPreviewBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    galleryPreviewCard: {
        width: '100%',
        height: '80%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    galleryPreviewImage: {
        width: '100%',
        height: '100%',
    },
    galleryPreviewCloseButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
