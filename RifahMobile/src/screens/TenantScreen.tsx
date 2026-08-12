import React, { useMemo, useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Platform, Image, TouchableOpacity, ActivityIndicator, ImageBackground, Dimensions, Alert, Share, Linking, Modal, Animated, Easing, TextInput } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useCart } from '../contexts/CartContext';
import { api, Tenant, Service, ServiceVariant, Staff, Product, Booking, getImageUrl, getServicePrice, normalizeProduct, normalizeService, normalizeStaff, normalizeTenant } from '../api/client';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '../components/AppIcon';
import { useScreenSafeArea } from '../utils/safeArea';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';
import { useAppSession } from '../contexts/AppSessionContext';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { ServiceDetailsDrawer } from '../components/ServiceDetailsDrawer';

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

type TenantGiftPackage = {
    id: string;
    title?: string | null;
    description?: string | null;
    title_en: string;
    title_ar: string;
    description_en?: string | null;
    description_ar?: string | null;
    priceAmount: number;
    walletCreditAmount: number;
    bonusAmount: number;
    discountPreset?: string | null;
    discountPercent?: number | string | null;
    expirationPreset?: string | null;
    endsAt?: string | null;
    startsAt?: string | null;
    createdAt?: string | null;
    imageUrl?: string | null;
};

const EXPIRATION_PRESETS: Record<string, { labelEn: string; labelAr: string; days?: number }> = {
    '1_week': { labelEn: '1 week', labelAr: 'أسبوع واحد', days: 7 },
    '2_weeks': { labelEn: '2 weeks', labelAr: 'أسبوعان', days: 14 },
    '3_weeks': { labelEn: '3 weeks', labelAr: '3 أسابيع', days: 21 },
    '1_month': { labelEn: '1 month', labelAr: 'شهر واحد', days: 30 },
    '2_months': { labelEn: '2 months', labelAr: 'شهران', days: 60 },
    '3_months': { labelEn: '3 months', labelAr: '3 أشهر', days: 90 },
    '1_year': { labelEn: '1 year', labelAr: 'سنة واحدة', days: 365 },
    never: { labelEn: 'Never', labelAr: 'بدون انتهاء' }
};

const getGiftPackageTitle = (pkg: TenantGiftPackage) => pkg.title || pkg.title_en || pkg.title_ar || '-';
const getGiftPackageDescription = (pkg: TenantGiftPackage) => pkg.description || pkg.description_en || pkg.description_ar || '';
const getGiftPackageDiscountPercent = (pkg: TenantGiftPackage) => {
    if (pkg.discountPercent !== undefined && pkg.discountPercent !== null && `${pkg.discountPercent}`.trim() !== '') {
        const parsed = Number(pkg.discountPercent);
        if (Number.isFinite(parsed)) return parsed;
    }
    const wallet = Number(pkg.walletCreditAmount || 0);
    const price = Number(pkg.priceAmount || 0);
    if (wallet > 0 && price >= 0 && price <= wallet) {
        return Number((100 - ((price / wallet) * 100)).toFixed(2));
    }
    return 0;
};

const getGiftPackageExpirationPreset = (pkg: TenantGiftPackage) => {
    if (pkg.expirationPreset && EXPIRATION_PRESETS[pkg.expirationPreset]) return pkg.expirationPreset;
    if (!pkg.endsAt) return 'never';
    const startSource = pkg.createdAt || pkg.endsAt;
    const start = new Date(startSource);
    const end = new Date(pkg.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'never';
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const matched = Object.entries(EXPIRATION_PRESETS).find(([key, value]) => key !== 'never' && value.days && Math.abs(value.days - diffDays) <= 2);
    return matched?.[0] || 'never';
};

const { width } = Dimensions.get('window');
const TENANT_PAGE_UI = {
    minBottomSafePadding: 120,
    fallbackCoverImage: 'https://images.unsplash.com/photo-1560066984-12186d305d4d?q=80&w=2574&auto=format&fit=crop',
};

export function TenantScreen({ route, navigation }: TenantDetailsProps) {
    const { tenantId, slug, selectedServiceId, initialTab } = route.params; // Expect tenantId or slug from navigation
    const { t, isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const effectiveBottomPadding = useMemo(
        () => Math.max(scrollBottomPadding, TENANT_PAGE_UI.minBottomSafePadding),
        [scrollBottomPadding]
    );

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [pageData, setPageData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'services' | 'products' | 'gifts' | 'reviews' | 'about'>('services');
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [allTenantProducts, setAllTenantProducts] = useState<Product[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [showServicesTab, setShowServicesTab] = useState(true);
    const [showProductsTab, setShowProductsTab] = useState(false);
    const [showReviewsTab, setShowReviewsTab] = useState(true);
    const [showAboutTab, setShowAboutTab] = useState(true);
    const [showGiftsTab, setShowGiftsTab] = useState(false);
    const [giftPackages, setGiftPackages] = useState<TenantGiftPackage[]>([]);
    const [giftImageErrors, setGiftImageErrors] = useState<Record<string, boolean>>({});
    const [serviceImageErrors, setServiceImageErrors] = useState<Record<string, boolean>>({});
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [productCategoryFilter, setProductCategoryFilter] = useState('all');
    const [productSearchLoading, setProductSearchLoading] = useState(false);
    const [reviews, setReviews] = useState<TenantReview[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsSummary, setReviewsSummary] = useState<{ total: number; avgRating: number | null }>({ total: 0, avgRating: null });
    const [galleryPreviewImage, setGalleryPreviewImage] = useState<string | null>(null);
    const [reviewTargetBooking, setReviewTargetBooking] = useState<Booking | null>(null);
    const [reviewEligibleBookings, setReviewEligibleBookings] = useState<Booking[]>([]);
    const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());
    const [serviceFilterCategory, setServiceFilterCategory] = useState<string>('all');
    const [selectedDrawerService, setSelectedDrawerService] = useState<{service: Service, variant: ServiceVariant | null} | null>(null);
    const [aboutExpanded, setAboutExpanded] = useState(false);
    const pageEnterAnim = useMemo(() => new Animated.Value(0), []);
    const { itemCount, cartItems, addToCart, removeFromCart, clearCart, cartTotal } = useCart();
    const { itemCount: serviceBookingItemCount, items: serviceBookingItems, totalPrice: serviceBookingTotalPrice, addItem: addServiceBookingItem, removeItem: removeServiceBookingItem } = useServiceBookingCart();
    const { isAuthenticated } = useAppSession();

    useEffect(() => {
        loadTenantDetails();
    }, [tenantId, slug]);

    useEffect(() => {
        Animated.timing(pageEnterAnim, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [pageEnterAnim]);

    useEffect(() => {
        loadReviewEligibility();
    }, []);

    useEffect(() => {
        if (!selectedServiceId || services.length === 0) {
            return;
        }

        const matchedService = services.find((service) => service.id === selectedServiceId);
        if (matchedService) {
            setActiveTab('services');
            openServiceDetails(matchedService, null);
        }
    }, [selectedServiceId, services]);

    useEffect(() => {
        if (!tenant?.id || !showProductsTab) {
            return;
        }

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
            } catch (error) {
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
    }, [allTenantProducts, productCategoryFilter, productSearchQuery, showProductsTab, tenant?.id]);

    useEffect(() => {
        const availableTabs: Array<'services' | 'products' | 'gifts' | 'reviews' | 'about'> = [];
        if (showServicesTab) availableTabs.push('services');
        if (showProductsTab) availableTabs.push('products');
        if (showGiftsTab) availableTabs.push('gifts');
        if (showReviewsTab) availableTabs.push('reviews');
        if (showAboutTab) availableTabs.push('about');
        if (!availableTabs.length) return;
        if (!availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0]);
        }
    }, [activeTab, showServicesTab, showProductsTab, showGiftsTab, showReviewsTab, showAboutTab]);

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

            const normalizedInitialTab = typeof initialTab === 'string' ? initialTab.trim() : '';
            const availableTabs: Array<'services' | 'products' | 'gifts' | 'reviews' | 'about'> = [];
            if (isServicesEnabled) availableTabs.push('services');
            if (isProductsEnabled) availableTabs.push('products');
            if (showGiftsTab) availableTabs.push('gifts');
            if (isReviewsEnabled) availableTabs.push('reviews');
            if (isAboutEnabled) availableTabs.push('about');

            if (normalizedInitialTab && availableTabs.includes(normalizedInitialTab as any)) {
                setActiveTab(normalizedInitialTab as any);
            }

            // Fallback for activeTab if the default 'services' is hidden
            if ((!normalizedInitialTab || !availableTabs.includes(normalizedInitialTab as any)) && !isServicesEnabled) {
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
                        const normalizedProducts = (productsRes.products || []).map((product) => normalizeProduct({
                            ...product,
                            tenantId: idToFetch,
                        }));
                        setAllTenantProducts(normalizedProducts);
                        setProducts(normalizedProducts);
                    }
                } catch {
                    setAllTenantProducts([]);
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

            // 6. Fetch tenant gift cards (isolated tenant scope)
            try {
                const giftsRes = await api.get<{ success: boolean; packages: TenantGiftPackage[] }>(`/public/tenant/${idToFetch}/gift-cards`);
                const packages = giftsRes.success ? (giftsRes.packages || []) : [];
                setGiftPackages(packages);
                setShowGiftsTab(packages.length > 0);
            } catch {
                setGiftPackages([]);
                setShowGiftsTab(false);
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

    const resolveServiceImageUri = (service: Service) => {
        const unpack = (candidate: any): string[] => {
            if (!candidate) return [];
            if (typeof candidate === 'string') return [candidate];
            if (Array.isArray(candidate)) return candidate.flatMap((item) => unpack(item));
            if (typeof candidate === 'object') {
                return [
                    candidate.url,
                    candidate.path,
                    candidate.src,
                    candidate.image,
                    candidate.imageUrl,
                    candidate.thumbnail,
                    candidate.secure_url,
                ].filter(Boolean) as string[];
            }
            return [];
        };

        const mediaCandidates = [
            ...unpack(service.image),
            ...unpack(service.imageUrl),
            ...unpack(service.thumbnail),
            ...unpack(service.coverImage),
            ...unpack((service as any).images),
            ...unpack((service as any).media),
            ...unpack((service as any).photo),
            ...unpack((service as any).avatar),
        ];

        for (const candidate of mediaCandidates) {
            const resolved = getImageUrl(candidate) || candidate;
            if (resolved && `${resolved}`.trim()) return resolved;
        }
        return null;
    };

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

    const getTenantCoverUri = () =>
        getImageUrl(tenant?.coverImage || tenant?.logo) || TENANT_PAGE_UI.fallbackCoverImage;
    const getTenantLogoUri = () =>
        getImageUrl(tenant?.logo || tenant?.coverImage) || TENANT_PAGE_UI.fallbackCoverImage;

    const renderEmptyState = (message: string) => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{message}</Text>
        </View>
    );

    const renderLoadingBlock = (message?: string) => (
        <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
            {message ? <Text style={styles.emptyText}>{message}</Text> : null}
        </View>
    );

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
    const facilitiesImages = Array.isArray(pageData?.aboutUs?.facilitiesImages)
        ? pageData.aboutUs.facilitiesImages.map((image: string) => getImageUrl(image))
        : [];
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
    const mapUrl = pageSetup?.googleMapLink || tenant?.googleMapLink || null;

    const handleAddProduct = (product: Product, options?: { navigateToCart?: boolean }) => {
        const result = addToCart(product);
        if (result.success) {
            Alert.alert(
                isRTL ? 'تمت الإضافة إلى السلة' : 'Added to Cart',
                isRTL
                    ? `تمت إضافة "${product.name_ar || product.name_en}" إلى سلة المنتجات.`
                    : `"${product.name_en || product.name_ar}" was added to your product cart.`,
                [
                    {
                        text: isRTL ? 'متابعة التسوق' : 'Continue Shopping',
                        style: 'cancel',
                    },
                    ...(options?.navigateToCart
                        ? [{
                            text: isRTL ? 'فتح السلة' : 'Open Cart',
                            onPress: () => navigation.navigate('Cart', { tenant }),
                        }]
                        : []),
                ]
            );
            if (options?.navigateToCart) {
                navigation.navigate('Cart', { tenant });
            }
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
                            const replaceResult = addToCart(product);
                            if (replaceResult.success) {
                                Alert.alert(
                                    isRTL ? 'تمت الإضافة إلى السلة' : 'Added to Cart',
                                    isRTL
                                        ? `تمت إضافة "${product.name_ar || product.name_en}" إلى سلة المنتجات.`
                                        : `"${product.name_en || product.name_ar}" was added to your product cart.`,
                                    [
                                        { text: isRTL ? 'متابعة التسوق' : 'Continue Shopping', style: 'cancel' },
                                        ...(options?.navigateToCart
                                            ? [{
                                                text: isRTL ? 'فتح السلة' : 'Open Cart',
                                                onPress: () => navigation.navigate('Cart', { tenant }),
                                            }]
                                            : []),
                                    ]
                                );
                                if (options?.navigateToCart) {
                                    navigation.navigate('Cart', { tenant });
                                }
                            }
                        },
                    },
                ]
            );
        }
    };

    const loadReviewEligibility = async () => {
        try {
            if (!isAuthenticated) {
                setReviewEligibleBookings([]);
                setReviewedAppointmentIds(new Set());
                return;
            }

            const [completedBookings, myReviews] = await Promise.all([
                api.getBookings('completed'),
                api.getMyReviews(200).catch(() => []),
            ]);

            const reviewedIds = new Set<string>(
                (myReviews || [])
                    .map((review: any) => review?.appointmentId)
                    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
            );

            setReviewedAppointmentIds(reviewedIds);
            setReviewEligibleBookings(completedBookings || []);
        } catch (error) {
            console.warn('Failed to load review eligibility:', error);
            setReviewEligibleBookings([]);
        }
    };

    const openTenantReviewPrompt = () => {
        const tenantBooking = reviewEligibleBookings.find((booking) =>
            booking.tenantId === tenant?.id
            && booking.status === 'completed'
            && !reviewedAppointmentIds.has(booking.id)
        );

        if (!tenantBooking) {
            Alert.alert(
                isRTL ? 'لا يوجد موعد مؤهل' : 'No eligible appointment',
                isRTL ? 'أكمل موعدًا في هذا المركز أولًا لإضافة تقييم.' : 'Complete an appointment with this center first to add a review.'
            );
            return;
        }

        setReviewTargetBooking(tenantBooking);
    };

    const getServiceDescription = (service: Service) =>
        (isRTL ? service.description_ar : service.description_en)
        || service.description_en
        || service.description_ar
        || '';

    const openServiceDetails = (service: Service, variant: ServiceVariant | null = null) => {
        setSelectedDrawerService({ service, variant });
    };

    const openServiceBrowser = () => {
        navigation.navigate('ServiceBrowser', {
            tenant,
            tenantId: tenant?.id || tenantId,
            slug: tenant?.slug || slug,
            bookingSessionId: route.params?.bookingSessionId || null,
            bookingReference: route.params?.bookingReference || null,
        });
    };

    const openProviderProfile = (provider: Staff) => {
        navigation.navigate('EmployeeProfile', { provider, tenant });
    };


    const renderHero = () => {
        if (!tenant) return null;

        const coverImage = getTenantCoverUri();
        const logoImage = getTenantLogoUri();
        const locationLabel = [tenant.city, tenant.country].filter(Boolean).join(', ');
        const ratingValue = reviewsSummary.avgRating ? reviewsSummary.avgRating.toFixed(1) : null;
        const businessLabel = getBusinessTypeLabel();

        // Calculate hours format like "Opens at 09:30 AM" or "Open" / "Closed"
        const currentDay = new Date().toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
        const todayHours = tenant.workingHours?.[currentDay];
        let hoursStatus = isRTL ? 'مغلق' : 'Closed';
        if (todayHours?.isOpen) {
            hoursStatus = `${isRTL ? 'يفتح' : 'Opens at'} ${todayHours.open}`;
        }

        return (
            <View style={styles.heroContainer}>
                {/* Shallow Cover Area */}
                <ImageBackground source={{ uri: coverImage }} style={styles.heroImageShallow} resizeMode="cover">
                    <LinearGradient
                        colors={['rgba(17, 24, 39, 0.4)', 'rgba(17, 24, 39, 0.1)']}
                        style={styles.heroGradient}
                    >
                        <View style={[styles.heroHeaderRow, { marginTop: topInset }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circularHeaderButton}>
                                <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.textInverse} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.circularHeaderButton}
                                onPress={() => navigation.navigate('ServiceBookingCart')}
                            >
                                <AppIcon name="cart" size={20} color={colors.textInverse} />
                                {serviceBookingItemCount > 0 && (
                                    <View style={styles.badgeContainer}>
                                        <Text style={styles.badgeText}>{serviceBookingItemCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                {/* Overlapping Identity Area */}
                <View style={styles.heroIdentityWrap}>
                    <View style={styles.tenantLogoOverlappingWrap}>
                        <Image source={{ uri: logoImage }} style={styles.tenantLogoImageLarge} />
                    </View>
                    
                    <Text style={styles.heroIdentityTitle} numberOfLines={1}>{tenant.name}</Text>
                    {businessLabel ? (
                        <View style={styles.heroIdentityPill}>
                            <Text style={styles.heroIdentityPillText}>{businessLabel}</Text>
                        </View>
                    ) : null}

                    <View style={styles.heroIdentityMetaRow}>
                        {/* Open/Close Pill */}
                        <View style={styles.heroStatusPill}>
                            <Text style={styles.heroStatusPillTextBold}>
                                {tenant.isAvailable ? (isRTL ? 'مفتوح' : 'Open') : (isRTL ? 'مغلق' : 'Closed')}
                            </Text>
                            <Text style={styles.heroStatusPillTextSeparator}> • </Text>
                            <Text style={styles.heroStatusPillTextLight}>{hoursStatus}</Text>
                        </View>
                        {/* Rating Pill */}
                        {ratingValue ? (
                            <View style={styles.heroStatusPill}>
                                <Text style={styles.heroStatusPillTextBold}>{ratingValue}</Text>
                                <Text style={styles.heroStatusPillTextLight}> {isRTL ? 'تقييم' : 'Rank'}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
        );
    };

    const renderTabs = () => {
        const availableTabs: string[] = [];
        if (showAboutTab) availableTabs.push('about');
        if (showServicesTab) availableTabs.push('services');
        if (showProductsTab) availableTabs.push('products');
        if (showReviewsTab) availableTabs.push('reviews');

        if (availableTabs.length === 0) return null;

        return (
            <View style={styles.tabContainerCompact}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabScrollContentCompact}
                >
                    {availableTabs.map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={styles.tabCompact}
                            onPress={() => setActiveTab(tab as any)}
                        >
                            <Text style={[styles.tabTextCompact, activeTab === tab && styles.activeTabTextCompact]}>
                                {t(tab as any) || tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                            {activeTab === tab ? <View style={styles.activeTabIndicatorCompact} /> : null}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <View style={styles.tabDividerCompact} />
            </View>
        );
    };

    const renderGifts = () => (
        <View style={styles.contentSection}>
            <View style={styles.giftsHeaderBlock}>
                <Text style={styles.giftsHeaderTitle}>{isRTL ? 'بطاقات الهدايا' : 'Gift Cards'}</Text>
                <Text style={styles.giftsHeaderSubtitle}>
                    {isRTL ? 'قدّم هدية العناية والرفاهية لمن تحب.' : 'Give the gift of wellness and self-care.'}
                </Text>
            </View>

            {giftPackages.length === 0 ? (
                renderEmptyState(isRTL ? 'لا تتوفر تجارب هدايا حالياً.' : 'No gift experiences are available right now.')
            ) : (
                giftPackages.map((pkg, index) => {
                    const totalCredit = Number(pkg.walletCreditAmount || 0) + Number(pkg.bonusAmount || 0);
                    const bonusAmount = Number(pkg.bonusAmount || 0);
                    const hasImage = !!pkg.imageUrl && !giftImageErrors[pkg.id];
                    const localizedTitle = getGiftPackageTitle(pkg);
                    const localizedDescription = getGiftPackageDescription(pkg);
                    const discountPercent = getGiftPackageDiscountPercent(pkg);
                    const expirationPreset = getGiftPackageExpirationPreset(pkg);
                    const expirationLabel = EXPIRATION_PRESETS[expirationPreset]?.[isRTL ? 'labelAr' : 'labelEn'] || (isRTL ? 'غير محدد' : 'Unspecified');
                    const badgeLabel = index === 0
                        ? (isRTL ? 'الأكثر طلباً' : 'Most Popular')
                        : bonusAmount > 0
                            ? (isRTL ? 'قيمة إضافية' : 'Best Value')
                            : null;

                    return (
                        <TouchableOpacity
                            key={pkg.id}
                            style={styles.giftCard}
                            activeOpacity={0.92}
                            onPress={() => navigation.navigate('Gifts', {
                                tenantId: tenant?.id,
                                tenantName: tenant?.name,
                                previewOnly: true,
                            })}
                        >
                            <View style={[styles.giftCardRow, isRTL ? styles.giftCardRowRtl : null]}>
                                <View style={styles.giftCardMediaWrap}>
                                    {hasImage ? (
                                        <Image
                                            source={{ uri: getImageUrl(pkg.imageUrl) }}
                                            style={styles.giftCardImage}
                                            onError={() => setGiftImageErrors((prev) => ({ ...prev, [pkg.id]: true }))}
                                        />
                                    ) : (
                                        <LinearGradient
                                            colors={['#221146', '#6D3BC8', '#A18AF5']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.giftCardImageFallback}
                                        >
                                            <AppIcon name="sparkles" size={22} color="#F8F2FF" />
                                            <Text style={styles.giftCardImageFallbackTitle} numberOfLines={2}>
                                                {localizedTitle}
                                            </Text>
                                            <Text style={styles.giftCardImageFallbackSub}>
                                                {isRTL ? 'هدية رفاهية' : 'Wellness Gift'}
                                            </Text>
                                        </LinearGradient>
                                    )}
                                    {badgeLabel ? (
                                        <View style={[styles.giftBadge, isRTL ? styles.giftBadgeRtl : null]}>
                                            <Text style={styles.giftBadgeText}>{badgeLabel}</Text>
                                        </View>
                                    ) : null}
                                </View>

                                <View style={[styles.giftCardContent, isRTL ? styles.giftCardContentRtl : null]}>
                                    <Text style={[styles.giftCardTitle, isRTL ? styles.giftCardTitleRtl : null]} numberOfLines={1}>{localizedTitle}</Text>
                                    {localizedDescription ? (
                                        <Text style={[styles.giftCardDesc, isRTL ? styles.giftCardDescRtl : null]} numberOfLines={2}>
                                            {localizedDescription}
                                        </Text>
                                    ) : null}
                                    <View style={styles.giftMetaRow}>
                                        <View style={styles.giftMetaChip}><Text style={styles.giftMetaChipText}>{isRTL ? 'القيمة' : 'Value'} {formatRiyal(Number(pkg.walletCreditAmount || 0), isRTL ? 'ar' : 'en')}</Text></View>
                                        <View style={styles.giftMetaChip}><Text style={styles.giftMetaChipText}>{isRTL ? 'الخصم' : 'Discount'} {discountPercent.toFixed(2)}%</Text></View>
                                        <View style={styles.giftMetaChip}><Text style={styles.giftMetaChipText}>{expirationLabel}</Text></View>
                                    </View>

                                    <View style={[styles.giftValueBlock, isRTL ? styles.giftValueBlockRtl : null]}>
                                        <View style={[styles.giftValueColumn, isRTL ? styles.giftValueColumnRtl : null]}>
                                            <Text style={[styles.giftValueLabel, isRTL ? styles.giftValueLabelRtl : null]}>{isRTL ? 'أنت تدفع' : 'You Pay'}</Text>
                                            <Text style={[styles.giftValueAmount, isRTL ? styles.giftValueAmountRtl : null]}>{formatRiyal(Number(pkg.priceAmount), isRTL ? 'ar' : 'en')}</Text>
                                        </View>
                                        <Text style={styles.giftValueArrow}>{isRTL ? '←' : '→'}</Text>
                                        <View style={[styles.giftValueColumn, { alignItems: 'flex-end' }, isRTL ? styles.giftValueColumnGetRtl : null]}>
                                            <Text style={[styles.giftValueLabel, styles.giftValueGetLabel, isRTL ? styles.giftValueLabelRtl : null]}>{isRTL ? 'يحصل على' : 'They Get'}</Text>
                                            <Text style={styles.giftValueGetAmount}>{formatRiyal(totalCredit, isRTL ? 'ar' : 'en')}</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.giftCardFooterRow, isRTL ? styles.giftCardFooterRowRtl : null]}>
                                        {bonusAmount > 0 ? (
                                            <View style={styles.giftBonusPill}>
                                                <Text style={styles.giftBonusText}>
                                                    + {formatRiyal(bonusAmount, isRTL ? 'ar' : 'en')} {isRTL ? 'هدية إضافية' : 'Bonus'}
                                                </Text>
                                            </View>
                                        ) : <View />}
                                        <View style={styles.giftValidityPill}>
                                            <Text style={styles.giftValidityText}>{expirationLabel}</Text>
                                        </View>
                                        <View style={styles.giftArrowButton}>
                                            <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={18} color={colors.primary} />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })
            )}

            {giftPackages.length > 0 ? (
                <View style={[styles.giftInfoBanner, isRTL ? styles.giftInfoBannerRtl : null]}>
                    <View style={styles.giftInfoIconWrap}>
                        <AppIcon name="card" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.giftInfoText}>
                            {isRTL
                                ? 'تختلف صلاحية كل بطاقة حسب نوعها المحدد من المركز.'
                                : 'Each gift card follows the expiration selected by the center.'}
                        </Text>
                        <Text style={styles.giftInfoSubText}>
                            {isRTL ? 'تُطبق الشروط والأحكام.' : 'Terms & conditions apply.'}
                        </Text>
                    </View>
                </View>
            ) : null}
        </View>
    );

    const renderServices = () => {
        const categories = Array.from(new Set(services.map((s) => s.category || 'General')));
        const filteredServices = serviceFilterCategory === 'all'
            ? services
            : services.filter((s) => (s.category || 'General') === serviceFilterCategory);

        const flattenedItems: any[] = filteredServices.flatMap((service): any[] => {
            const parentItem = {
                isVariant: false,
                service: service,
                variant: null,
                key: service.id,
                name_en: service.name_en,
                name_ar: service.name_ar,
                duration: service.duration,
                price: getServicePrice(service),
            };

            const variantItems = (service.variants || [])
                .filter(v => v.isActive)
                .map(v => ({
                    isVariant: true,
                    service: service,
                    variant: v,
                    key: `${service.id}-${v.id}`,
                    name_en: `${service.name_en} — ${v.description}`,
                    name_ar: `${service.name_ar} — ${v.description}`,
                    duration: v.duration,
                    price: getServicePrice(service, v),
                }));

            if (variantItems.length > 0) {
                return variantItems;
            }

            return [parentItem];
        });

        return (
            <View style={styles.contentSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
                    <TouchableOpacity
                        style={[styles.filterChip, serviceFilterCategory === 'all' ? styles.filterChipActive : null]}
                        onPress={() => setServiceFilterCategory('all')}
                    >
                        <Text style={[styles.filterChipText, serviceFilterCategory === 'all' ? styles.filterChipTextActive : null]}>
                            {isRTL ? 'الكل' : 'All'}
                        </Text>
                    </TouchableOpacity>
                    {categories.map((category) => {
                        const active = serviceFilterCategory === category;
                        return (
                            <TouchableOpacity
                                key={category}
                                style={[styles.filterChip, active ? styles.filterChipActive : null]}
                                onPress={() => setServiceFilterCategory(category)}
                            >
                                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{category}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {services.length === 0 ? (
                    renderEmptyState(isRTL ? 'لا توجد خدمات متاحة حالياً.' : 'No services available yet.')
                ) : (
                    <View style={styles.featuredServicesBlock}>
                        {flattenedItems.map((item) => {
                            const { isVariant, service, variant, key, name_en, name_ar, duration, price } = item;
                            const serviceName = isRTL ? name_ar : name_en;
                            const serviceImage = resolveServiceImageUri(service);
                            
                            const isInCart = serviceBookingItems.some(cartItem => 
                                cartItem.service.id === service.id && 
                                (variant ? cartItem.variant?.id === variant.id : !cartItem.variant)
                            );
                            
                            const handleToggleService = () => {
                                if (isInCart) {
                                    const cartItem = serviceBookingItems.find(cartItem => 
                                        cartItem.service.id === service.id && 
                                        (variant ? cartItem.variant?.id === variant.id : !cartItem.variant)
                                    );
                                    if (cartItem) {
                                        removeServiceBookingItem(cartItem.id);
                                    }
                                } else {
                                    const result = addServiceBookingItem({
                                        id: Math.random().toString(36).substring(7),
                                        tenantId: tenant?.id || tenantId || '',
                                        tenant: tenant ? { id: tenant.id, name: tenant.name, name_en: tenant.name_en, name_ar: tenant.name_ar, slug: tenant.slug, logo: tenant.logo } : undefined,
                                        service: service,
                                        variant: variant,
                                        staff: null,
                                        requestedStaffId: null,
                                        staffId: null,
                                        startTime: '',
                                        paymentMethod: 'at-center',
                                        totalPrice: price,
                                        payableNowAmount: 0
                                    });
                                    if (!result.success && result.reason === 'different_tenant') {
                                        Alert.alert(
                                            isRTL ? 'تنبيه' : 'Cannot Add Service',
                                            isRTL ? 'لا يمكنك إضافة خدمات من مراكز مختلفة في نفس الحجز. يرجى إفراغ السلة أولاً.' : 'You cannot add services from different centers to the same booking. Please clear your basket first.'
                                        );
                                    }
                                }
                            };

                            return (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.compactServiceCard, isInCart ? styles.compactServiceCardSelected : null]}
                                    onPress={() => setSelectedDrawerService({ service, variant })}
                                    activeOpacity={0.92}
                                >
                                    <View style={[styles.compactServiceMediaRow, isRTL ? styles.compactServiceMediaRowRtl : null]}>
                                        {serviceImage && !serviceImageErrors[service.id] ? (
                                            <Image
                                                source={{ uri: serviceImage }}
                                                style={styles.compactServiceImage}
                                                onError={() => setServiceImageErrors((prev) => ({ ...prev, [service.id]: true }))}
                                            />
                                        ) : (
                                            <LinearGradient
                                                colors={['#F3EDFF', '#E9D5FF']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.compactServiceImageFallback}
                                            >
                                                <Text style={styles.compactServiceImageFallbackText}>
                                                    {(serviceName || 'S').charAt(0).toUpperCase()}
                                                </Text>
                                            </LinearGradient>
                                        )}

                                        <View style={[styles.compactServiceInfo, isRTL ? styles.compactServiceInfoRtl : null]}>
                                            <Text style={[styles.compactServiceName, isRTL ? styles.compactServiceNameRtl : null]} numberOfLines={2}>
                                                {serviceName}
                                            </Text>
                                            <Text style={[styles.compactServiceDuration, isRTL ? styles.compactServiceDurationRtl : null]}>
                                                {duration} {isRTL ? 'دقيقة' : 'min'}
                                            </Text>
                                            <Text style={[styles.compactServicePrice, isRTL ? styles.compactServicePriceRtl : null]}>
                                                {formatRiyal(price, isRTL ? 'ar' : 'en')}
                                            </Text>
                                        </View>
                                        
                                        <TouchableOpacity 
                                            style={[styles.circularToggleBtn, isInCart ? styles.circularToggleBtnActive : null]}
                                            onPress={handleToggleService}
                                        >
                                            <AppIcon name={isInCart ? 'check' : 'plus'} size={20} color={isInCart ? '#FFFFFF' : '#1A1B43'} />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        <TouchableOpacity style={styles.loadMoreServicesButton}>
                            <Text style={styles.loadMoreServicesText}>
                                {isRTL ? 'تحميل المزيد' : 'Load more'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
                {products.length > 0 ? (
                    <View style={styles.productsTeaserCard}>
                        <View style={styles.productsTeaserHeader}>
                            <View>
                                <Text style={styles.productsTeaserTitle}>{isRTL ? 'المنتجات' : 'Products'}</Text>
                                <Text style={styles.productsTeaserSubtitle}>
                                    {isRTL
                                        ? 'المنتجات متاحة كمسار ثانوي للعناية المنزلية.'
                                        : 'Products remain available as a secondary shopping path.'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setActiveTab('products')} style={styles.productsTeaserLink}>
                                <Text style={styles.productsTeaserLinkText}>
                                    {isRTL ? 'عرض المنتجات' : 'Browse Products'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productPreviewRow}>
                            {products.slice(0, 3).map((product) => {
                                const productName = isRTL ? product.name_ar : product.name_en;
                                const productImage = product.images && product.images.length > 0
                                    ? getImageUrl(product.images[0])
                                    : null;
                                const productPrice = Number((product as any).price || (product as any).salePrice || (product as any).finalPrice || 0);
                                return (
                                    <TouchableOpacity
                                        key={product.id}
                                        style={styles.productPreviewCard}
                                        onPress={() => setActiveTab('products')}
                                    >
                                        {productImage ? (
                                            <Image source={{ uri: productImage }} style={styles.productPreviewImage} />
                                        ) : (
                                            <LinearGradient
                                                colors={['#111827', '#4B5563']}
                                                style={styles.productPreviewImageFallback}
                                            >
                                                <AppIcon name="cart" size={16} color="#FFFFFF" />
                                            </LinearGradient>
                                        )}
                                        <Text style={styles.productPreviewName} numberOfLines={2}>
                                            {productName}
                                        </Text>
                                        <Text style={styles.productPreviewPrice}>
                                            {formatRiyal(productPrice, isRTL ? 'ar' : 'en')}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                ) : null}
            </View>
        );
    };

    const renderProducts = () => {
        const productCategories = Array.from(new Set((allTenantProducts.length > 0 ? allTenantProducts : products).map((product) => product.category || 'General')));
        const hasProductFilters = productSearchQuery.trim().length > 0 || productCategoryFilter !== 'all';
        return (
            <View style={styles.contentSection}>
                <View style={styles.productsHeaderBlock}>
                    <Text style={styles.productsHeaderTitle}>{isRTL ? 'المنتجات' : 'Products'}</Text>
                    <Text style={styles.productsHeaderSubtitle}>
                        {isRTL ? 'منتجات مختارة للعناية اليومية والجمال.' : 'Curated beauty and wellness products for your routine.'}
                    </Text>
                </View>

                <View style={styles.productFiltersContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productCategoryRow}>
                        <TouchableOpacity
                            style={[styles.productCategoryChip, productCategoryFilter === 'all' ? styles.productCategoryChipActive : null]}
                            onPress={() => setProductCategoryFilter('all')}
                        >
                            <Text style={[styles.productCategoryChipText, productCategoryFilter === 'all' ? styles.productCategoryChipTextActive : null]}>
                                {isRTL ? 'الكل' : 'All'}
                            </Text>
                        </TouchableOpacity>
                        {productCategories.map((category) => {
                            const active = productCategoryFilter === category;
                            return (
                                <TouchableOpacity
                                    key={category}
                                    style={[styles.productCategoryChip, active ? styles.productCategoryChipActive : null]}
                                    onPress={() => setProductCategoryFilter(category)}
                                >
                                    <Text style={[styles.productCategoryChipText, active ? styles.productCategoryChipTextActive : null]} numberOfLines={1}>
                                        {category}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {products.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            {productSearchLoading
                                ? (isRTL ? 'جارٍ البحث في المنتجات...' : 'Searching products...')
                                : hasProductFilters
                                    ? (isRTL ? 'لا توجد نتائج مطابقة.' : 'No matching products found.')
                                    : (isRTL ? 'لا توجد منتجات متاحة حالياً.' : 'No products available yet.')}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.productGrid}>
                        {products.map(product => {
                            const imageUri = product.images && product.images.length > 0
                                ? getImageUrl(product.images[0])
                                : 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600&auto=format&fit=crop';
                            const productName = isRTL ? product.name_ar : product.name_en;
                            const isSelected = cartItems.some(i => i.product.id === product.id);
                            const outOfStock = product.stock <= 0;

                            return (
                                <TouchableOpacity
                                    key={product.id}
                                    style={[styles.productCardCompact, isSelected && styles.productCardSelected]}
                                    activeOpacity={0.95}
                                    onPress={() => navigation.navigate('ProductDetails', { product, tenant })}
                                >
                                    <View style={styles.productImageContainerCompact}>
                                        <Image
                                            source={{ uri: imageUri }}
                                            style={styles.productImageCompact}
                                        />
                                        <TouchableOpacity
                                            style={[
                                                styles.productSelectButton,
                                                isSelected ? styles.productSelectButtonActive : null,
                                                outOfStock ? styles.productSelectButtonDisabled : null
                                            ]}
                                            onPress={() => {
                                                if (outOfStock) return;
                                                if (isSelected) {
                                                    removeFromCart(product.id);
                                                } else {
                                                    handleAddProduct(product);
                                                }
                                            }}
                                            disabled={outOfStock}
                                        >
                                            {isSelected ? (
                                                <AppIcon name="check" size={16} color="#FFFFFF" />
                                            ) : (
                                                <AppIcon name="plus" size={16} color={outOfStock ? colors.textSecondary : colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.productInfoCompact}>
                                        <Text style={styles.productNameCompact} numberOfLines={1}>{productName}</Text>
                                        <View style={styles.productMetaRowCompact}>
                                            <Text style={styles.productPriceCompact}>{formatRiyal(product.price, isRTL ? 'ar' : 'en')}</Text>
                                            <Text style={[styles.productStockTextCompact, outOfStock && { color: colors.error }]}>
                                                {outOfStock ? (isRTL ? 'غير متوفر' : 'Out of stock') : (isRTL ? 'متوفر' : 'In stock')}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
                
                {/* Load More Visual Fallback */}
                {products.length > 0 && (
                    <TouchableOpacity style={styles.loadMoreButton} activeOpacity={0.8}>
                        <Text style={styles.loadMoreButtonText}>{isRTL ? 'عرض المزيد' : 'Load more'}</Text>
                    </TouchableOpacity>
                )}
                
                {/* Bottom spacer to prevent content hiding behind fixed basket */}
                {itemCount > 0 && <View style={{ height: 100 }} />}
            </View>
        );
    };

    const renderReviews = () => (
        <View style={styles.contentSection}>
            <View style={styles.reviewsHero}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.reviewsHeroTitle}>{isRTL ? 'التقييمات' : 'Reviews'}</Text>
                    <Text style={styles.reviewsHeroSubtitle}>
                        {isRTL ? 'آراء العملاء وتجاربهم مع خدمات المركز.' : 'See what customers are saying about this center.'}
                    </Text>
                </View>
                <TouchableOpacity style={styles.writeReviewButton} onPress={openTenantReviewPrompt}>
                    <AppIcon name="star" size={16} color={colors.textInverse} />
                    <Text style={styles.writeReviewButtonText}>{isRTL ? 'أضف تقييمك' : 'Write a Review'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.reviewSummaryPremiumCard}>
                <View style={styles.reviewSummaryScoreBlock}>
                    <Text style={styles.reviewSummaryScoreValue}>{reviewsSummary.avgRating ? reviewsSummary.avgRating.toFixed(1) : '-'}</Text>
                    <View style={styles.reviewSummaryStarsRow}>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Text key={`summary-star-${index}`} style={[styles.reviewStar, index < Math.round(Number(reviewsSummary.avgRating || 0)) ? styles.reviewStarActive : null]}>
                                ★
                            </Text>
                        ))}
                    </View>
                    <Text style={styles.reviewSummaryScoreLabel}>{isRTL ? 'متوسط التقييم' : 'Average rating'}</Text>
                </View>
                <View style={styles.reviewSummaryVerticalDivider} />
                <View style={styles.reviewSummaryStatsBlock}>
                    <Text style={styles.reviewSummaryStatNumber}>{reviewsSummary.total}</Text>
                    <Text style={styles.reviewSummaryStatLabel}>{isRTL ? 'إجمالي التقييمات' : 'Total reviews'}</Text>
                    <Text style={styles.reviewSummaryStatHint}>{isRTL ? 'آراء موثقة من العملاء' : 'Verified customer feedback'}</Text>
                </View>
            </View>

            {reviewsLoading ? (
                renderLoadingBlock()
            ) : reviews.length === 0 ? (
                renderEmptyState(isRTL ? 'لا توجد تقييمات منشورة بعد.' : 'No published reviews yet.')
            ) : (
                reviews.map((review) => {
                    const reviewDate = review.createdAt ? new Date(review.createdAt) : null;
                    const dateLabel = reviewDate && !Number.isNaN(reviewDate.getTime())
                        ? reviewDate.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')
                        : '';

                    return (
                        <View key={review.id} style={styles.reviewCardPremium}>
                            <View style={styles.reviewHeader}>
                                <View style={styles.reviewAuthorBlock}>
                                    <Text style={styles.reviewAuthor}>
                                        {review.customerName && review.customerName.toLowerCase() !== 'valued customer'
                                            ? review.customerName
                                            : (isRTL ? 'عميل موثّق' : 'Verified Customer')}
                                    </Text>
                                    {dateLabel ? <Text style={styles.reviewDateText}>{dateLabel}</Text> : null}
                                </View>
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
                                    <Text style={styles.reviewReplyLabel}>
                                        {isRTL
                                            ? `رد ${tenant?.name_ar || tenant?.name || 'المركز'}`
                                            : `${tenant?.name_en || tenant?.name || 'Center'} reply`}
                                    </Text>
                                    <Text style={styles.reviewReplyText}>{review.staffReply}</Text>
                                </View>
                            ) : null}
                        </View>
                    );
                })
            )}
        </View>
    );

    const renderAbout = () => {
        const ratingValue = reviewsSummary.avgRating ? reviewsSummary.avgRating.toFixed(1) : null;
        return (
        <View style={styles.contentSection}>
            {/* Section 1: About */}
            {aboutStory ? (
                <View style={styles.aboutCardCompact}>
                    <Text style={styles.aboutCardTitleCompact}>{t('about')}</Text>
                    <Text
                        style={styles.aboutTextCompact}
                        numberOfLines={aboutExpanded ? undefined : 4}
                    >
                        {aboutStory}
                    </Text>
                    {aboutStory.length > 150 && (
                        <TouchableOpacity onPress={() => setAboutExpanded(!aboutExpanded)} style={styles.aboutMoreToggle}>
                            <Text style={styles.aboutMoreText}>
                                {aboutExpanded ? (isRTL ? 'عرض أقل' : 'Less') : (isRTL ? 'المزيد' : 'More')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : null}

            {/* Section 2: Team */}
            {staff && staff.length > 0 ? (
                <View style={styles.aboutCardCompact}>
                    <Text style={styles.aboutCardTitleCompact}>{isRTL ? 'فريق العمل' : 'Team'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamRow}>
                        {staff.map((member) => (
                            <View key={member.id} style={styles.teamMemberCard}>
                                {member.avatar || member.image ? (
                                    <Image source={{ uri: getImageUrl(member.avatar || member.image || '') }} style={styles.teamMemberAvatar} />
                                ) : (
                                    <View style={styles.teamMemberAvatarFallback}>
                                        <Text style={styles.teamMemberAvatarFallbackText}>
                                            {(isRTL ? member.name_ar || member.name_en : member.name_en || member.name_ar || member.name)?.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <Text style={styles.teamMemberName} numberOfLines={1}>
                                    {isRTL ? member.name_ar || member.name_en : member.name_en || member.name_ar || member.name}
                                </Text>
                                <View style={styles.teamMemberRatingRow}>
                                    <AppIcon name="star" size={12} color="#F59E0B" />
                                    <Text style={styles.teamMemberRatingText}>{(member as any).rating || '5.0'}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            ) : null}

            {/* Section 3: Reviews Preview */}
            <View style={styles.aboutCardCompact}>
                <Text style={styles.aboutCardTitleCompact}>{isRTL ? 'التقييمات' : 'Reviews'}</Text>
                
                {reviewsSummary.avgRating ? (
                    <View style={styles.reviewsPreviewSummaryBlock}>
                        <View style={styles.reviewsPreviewStarsRow}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Text key={`preview-star-${i}`} style={[styles.reviewStarPreview, i < Math.round(Number(reviewsSummary.avgRating || 0)) ? styles.reviewStarActivePreview : null]}>
                                    ★
                                </Text>
                            ))}
                        </View>
                        <Text style={styles.reviewsPreviewScoreText}>
                            {reviewsSummary.avgRating.toFixed(1)} <Text style={styles.reviewsPreviewTotalText}>({reviewsSummary.total})</Text>
                        </Text>
                    </View>
                ) : null}

                {reviews.slice(0, 3).map((review) => {
                    const reviewDate = review.createdAt ? new Date(review.createdAt) : null;
                    const dateLabel = reviewDate && !Number.isNaN(reviewDate.getTime())
                        ? reviewDate.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')
                        : '';
                    return (
                        <View key={review.id} style={styles.reviewPreviewItem}>
                            <View style={styles.reviewPreviewHeader}>
                                <View style={styles.reviewPreviewAvatar}>
                                    <Text style={styles.reviewPreviewAvatarText}>
                                        {(review.customerName || 'V').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.reviewPreviewAuthorInfo}>
                                    <Text style={styles.reviewPreviewAuthorName}>
                                        {review.customerName && review.customerName.toLowerCase() !== 'valued customer'
                                            ? review.customerName
                                            : (isRTL ? 'عميل موثّق' : 'Verified Customer')}
                                    </Text>
                                    {dateLabel ? <Text style={styles.reviewPreviewDate}>{dateLabel}</Text> : null}
                                </View>
                            </View>
                            <View style={styles.reviewPreviewStarsMini}>
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <Text key={`${review.id}-mini-star-${index}`} style={[styles.reviewStarMini, index < Number(review.rating || 0) ? styles.reviewStarActiveMini : null]}>
                                        ★
                                    </Text>
                                ))}
                            </View>
                            {review.comment ? <Text style={styles.reviewPreviewComment} numberOfLines={2}>{review.comment}</Text> : null}
                        </View>
                    );
                })}

                {reviews.length > 0 && (
                    <TouchableOpacity style={styles.reviewsPreviewSeeAllButton} onPress={() => setActiveTab('reviews')}>
                        <Text style={styles.reviewsPreviewSeeAllText}>
                            {isRTL ? `عرض جميع التقييمات (${reviewsSummary.total})` : `See all ${reviewsSummary.total} reviews`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Section 4: Opening Times + Location */}
            {(() => {
                const parsedHours = typeof tenant?.workingHours === 'string' ? (() => { try { return JSON.parse(tenant.workingHours) } catch { return null } })() : tenant?.workingHours;
                const daysList = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                const hasValidHours = parsedHours && Object.keys(parsedHours).length > 0 && daysList.some(day => parsedHours[day] || parsedHours[day.charAt(0).toUpperCase() + day.slice(1)] || parsedHours[day.toUpperCase()]);
                
                if (!hasValidHours && !locationLine && !mapUrl) return null;
                return (
                <View style={styles.aboutCardCompact}>
                    {hasValidHours ? (
                        <>
                            <Text style={styles.aboutCardTitleCompact}>{isRTL ? 'أوقات العمل' : 'Opening times'}</Text>
                            <View style={styles.hoursContainerCompact}>
                                {daysList.map((day) => {
                                    const hours = parsedHours[day] || parsedHours[day.charAt(0).toUpperCase() + day.slice(1)] || parsedHours[day.toUpperCase()];
                                    if (!hours) return null;
                                    return (
                                        <View key={day} style={styles.hoursRowCompact}>
                                            <View style={styles.hoursRowLeft}>
                                                <View style={[styles.hoursStatusDot, hours.isOpen ? styles.hoursStatusDotOpen : styles.hoursStatusDotClosed]} />
                                                <Text style={styles.dayTextCompact}>{t(day as any) || day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                                            </View>
                                            <Text style={[styles.timeTextCompact, !hours.isOpen && { color: colors.textSecondary }]}>
                                                {hours.isOpen ? `${hours.open} - ${hours.close}` : t('closed')}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </>
                    ) : null}

                    {/* Location */}
                    {(locationLine || tenant?.coordinates || mapUrl) ? (
                        <>
                            {hasValidHours ? <View style={styles.aboutCardDivider} /> : null}
                            {tenant?.coordinates ? (
                                <View style={styles.mapPreviewCard}>
                                    <MapView
                                        style={styles.mapPreviewImageCompact}
                                        initialRegion={{
                                            latitude: tenant.coordinates.lat,
                                            longitude: tenant.coordinates.lng,
                                            latitudeDelta: 0.01,
                                            longitudeDelta: 0.01,
                                        }}
                                        scrollEnabled={false}
                                        zoomEnabled={false}
                                        pitchEnabled={false}
                                        rotateEnabled={false}
                                        onPress={() => openExternalUrl(mapUrl)}
                                    >
                                        <Marker
                                            coordinate={{
                                                latitude: tenant.coordinates.lat,
                                                longitude: tenant.coordinates.lng,
                                            }}
                                            title={tenant.name}
                                        />
                                    </MapView>
                                    {ratingValue && (
                                        <View style={styles.mapPreviewOverlayBadge}>
                                            <AppIcon name="star" size={10} color="#FFFFFF" />
                                            <Text style={styles.mapPreviewOverlayBadgeText}>{ratingValue}</Text>
                                        </View>
                                    )}
                                </View>
                            ) : mapUrl ? (
                                <TouchableOpacity style={styles.mapPreviewCard} onPress={() => openExternalUrl(mapUrl)}>
                                    <View style={styles.mapFallbackCompact}>
                                        <AppIcon name="location" size={24} color={colors.textSecondary} />
                                    </View>
                                    {ratingValue && (
                                        <View style={styles.mapPreviewOverlayBadge}>
                                            <AppIcon name="star" size={10} color="#FFFFFF" />
                                            <Text style={styles.mapPreviewOverlayBadgeText}>{ratingValue}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ) : null}
                            {locationLine ? <Text style={styles.addressTextCompact}>{locationLine}</Text> : null}
                            {mapUrl ? (
                                <TouchableOpacity style={styles.getDirectionsButton} onPress={() => openExternalUrl(mapUrl)}>
                                    <Text style={styles.getDirectionsText}>{isRTL ? 'احصل على الاتجاهات' : 'Get directions'}</Text>
                                </TouchableOpacity>
                            ) : null}
                        </>
                    ) : null}
                </View>
                );
            })()}

            {/* Hidden fallback content to satisfy logic elsewhere if needed, although user told us to not remove data. We kept it all in the UI. */}
        </View>
    );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const hasVisibleTabs = showServicesTab || showGiftsTab || showReviewsTab || showAboutTab;

    return (
        <View style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: effectiveBottomPadding }}
                stickyHeaderIndices={hasVisibleTabs ? [1] : undefined}
            >
                {renderHero()}
                {renderTabs()}
                <Animated.View
                    style={[
                        styles.tabContentAnimated,
                        {
                            opacity: pageEnterAnim,
                            transform: [
                                {
                                    translateY: pageEnterAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [12, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    {activeTab === 'about' && renderAbout()}
                    {activeTab === 'services' && renderServices()}
                    {activeTab === 'products' && renderProducts()}
                    {activeTab === 'reviews' && renderReviews()}
                </Animated.View>
            </ScrollView>

            {activeTab === 'services' && serviceBookingItems.length > 0 && (
                <View style={styles.bottomBasketContainer}>
                    <View style={styles.bottomBasketLeft}>
                        <Text style={styles.bottomBasketPrice}>
                            {isRTL ? 'من ' : 'from '}{formatRiyal(serviceBookingTotalPrice, isRTL ? 'ar' : 'en')}
                        </Text>
                        <Text style={styles.bottomBasketDetails}>
                            🛒 {serviceBookingItems.length} {isRTL ? 'خدمة' : 'item(s)'} • {serviceBookingItems.reduce((acc, item) => acc + (item.service.duration || 0), 0)} {isRTL ? 'دقيقة' : 'min'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.bottomBasketButton}
                        onPress={() => navigation.navigate('BookingStaffSelection', { tenantId: tenant?.id })}
                    >
                        <Text style={styles.bottomBasketButtonText}>{isRTL ? 'متابعة' : 'Continue'}</Text>
                        <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            )}

            {activeTab === 'products' && itemCount > 0 && (
                <View style={[styles.bottomBasketContainer, { paddingBottom: Math.max(scrollBottomPadding, spacing.md) }]}>
                    <View style={styles.bottomBasketLeft}>
                        <Text style={styles.bottomBasketPrice}>
                            {itemCount} {isRTL ? (itemCount === 1 ? 'منتج' : 'منتجات') : (itemCount === 1 ? 'item' : 'items')}
                        </Text>
                        <Text style={styles.bottomBasketPrice}>
                            {formatRiyal(cartTotal, isRTL ? 'ar' : 'en')}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.bottomBasketButton} 
                        onPress={() => navigation.navigate('Cart', { tenant })}
                    >
                        <Text style={styles.bottomBasketButtonText}>{isRTL ? 'متابعة' : 'Continue'} ➔</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Modal
                visible={!!galleryPreviewImage}
                transparent
                animationType="fade"
                onRequestClose={() => setGalleryPreviewImage(null)}
            >
                <View style={styles.galleryPreviewBackdrop}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setGalleryPreviewImage(null)} />
                    {galleryPreviewImage ? (
                        <View style={styles.galleryPreviewCard}>
                            <Image source={{ uri: galleryPreviewImage }} style={styles.galleryPreviewImage} resizeMode="contain" />
                            <TouchableOpacity style={styles.galleryPreviewCloseButton} onPress={() => setGalleryPreviewImage(null)}>
                                <AppIcon name="close" size={24} color={colors.textInverse} />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </Modal>
            
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
                    if (showReviewsTab) {
                        loadTenantDetails();
                    }
                }}
            />
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
        marginBottom: spacing.lg,
    },
    heroImage: {
        width: '100%',
        height: 260,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
    },
    heroGradient: {
        flex: 1,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    heroHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backButton: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
    },
    heroActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    iconButton: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
    },
    heroInfoCardWrap: {
        marginTop: -44,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        zIndex: 2,
    },
    tenantLogoWrap: {
        width: 96,
        height: 96,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: colors.surface,
        backgroundColor: colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
        elevation: 8,
    },
    tenantLogoImage: {
        width: '100%',
        height: '100%',
    },
    heroInfoCard: {
        width: '100%',
        marginTop: -12,
        borderRadius: 28,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        paddingTop: 20,
        paddingBottom: spacing.md,
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 5,
    },
    heroTitle: {
        color: colors.text,
        fontSize: fontSize.xxxl,
        fontWeight: '700',
        marginBottom: 6,
        textAlign: 'center',
    },
    heroSubtitle: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        textAlign: 'center',
        marginBottom: spacing.sm,
        lineHeight: 20,
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    heroMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: '90%',
    },
    heroMetaText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: '600',
    },
    heroChipsRow: {
        gap: spacing.sm,
        paddingHorizontal: 2,
    },
    heroChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        gap: 6,
    },
    heroChipDefault: {
        backgroundColor: '#F3E8FF',
    },
    heroChipStatus: {
        backgroundColor: '#E8F8EE',
    },
    heroChipText: {
        fontSize: fontSize.xs,
        fontWeight: '700',
    },
    heroChipDefaultText: {
        color: colors.primary,
    },
    heroChipStatusText: {
        color: colors.success,
    },
    tabContainer: {
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    tabScrollContent: {
        gap: spacing.md,
        paddingRight: spacing.sm,
    },
    tab: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: '700',
    },
    activeTabIndicator: {
        marginTop: 8,
        height: 3,
        width: '100%',
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
    },
    tabContentAnimated: {
        width: '100%',
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
    writeReviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        marginBottom: spacing.md,
    },
    writeReviewButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.sm,
        fontWeight: '700',
    },
    reviewsHero: {
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    reviewsHeroTitle: {
        fontSize: 36,
        color: '#12133A',
        fontWeight: '800',
    },
    reviewsHeroSubtitle: {
        marginTop: 4,
        fontSize: 17,
        color: '#626A89',
        lineHeight: 25,
    },
    reviewSummaryPremiumCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#EDE7FC',
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    reviewSummaryScoreBlock: {
        width: 140,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reviewSummaryScoreValue: {
        fontSize: 38,
        fontWeight: '800',
        color: '#2A2166',
    },
    reviewSummaryStarsRow: {
        flexDirection: 'row',
        marginTop: 4,
        gap: 1,
    },
    reviewSummaryScoreLabel: {
        marginTop: 5,
        fontSize: 12,
        color: '#7A80A2',
        fontWeight: '600',
    },
    reviewSummaryVerticalDivider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: '#E7E1F6',
        marginHorizontal: 12,
    },
    reviewSummaryStatsBlock: {
        flex: 1,
    },
    reviewSummaryStatNumber: {
        fontSize: 30,
        fontWeight: '800',
        color: '#1A1B43',
    },
    reviewSummaryStatLabel: {
        marginTop: 2,
        fontSize: 14,
        fontWeight: '700',
        color: '#535C82',
    },
    reviewSummaryStatHint: {
        marginTop: 4,
        fontSize: 12,
        color: '#8A91AC',
    },
    reviewAuthorBlock: {
        flex: 1,
    },
    reviewDateText: {
        marginTop: 2,
        fontSize: 12,
        color: '#8A91AC',
        fontWeight: '600',
    },
    reviewCardPremium: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EDE9FA',
        borderRadius: 18,
        padding: spacing.md,
        marginBottom: spacing.sm,
        shadowColor: '#1B1540',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    reviewSummaryCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 24,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
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
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 24,
        padding: spacing.md,
        marginBottom: spacing.sm,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
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
        color: colors.borderStrong,
    },
    reviewStarActive: {
        color: colors.warning,
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
        backgroundColor: colors.backgroundGray,
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
    storefrontIntroCard: {
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EDE4FB',
        padding: spacing.lg,
        marginBottom: spacing.md,
        shadowColor: '#28174B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
        elevation: 2,
        gap: spacing.sm,
    },
    storefrontIntroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    storefrontIntroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F7F0FF',
    },
    storefrontIntroBadgeText: {
        fontSize: fontSize.xs,
        fontWeight: '800',
        color: colors.primary,
    },
    storefrontIntroMetaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F8F5FF',
    },
    storefrontIntroMetaText: {
        fontSize: fontSize.xs,
        fontWeight: '800',
        color: colors.primary,
    },
    storefrontIntroTitle: {
        fontSize: fontSize.xxl,
        fontWeight: '900',
        color: colors.text,
    },
    storefrontIntroSubtitle: {
        fontSize: fontSize.sm,
        lineHeight: 22,
        color: colors.textSecondary,
    },
    storefrontIntroActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    primaryStorefrontButton: {
        minHeight: 44,
        borderRadius: 16,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    primaryStorefrontButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.sm,
        fontWeight: '800',
    },
    secondaryStorefrontButton: {
        minHeight: 44,
        borderRadius: 16,
        backgroundColor: '#F7F1FF',
        borderWidth: 1,
        borderColor: '#E8D8FF',
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    secondaryStorefrontButtonText: {
        color: colors.primary,
        fontSize: fontSize.sm,
        fontWeight: '800',
    },
    featuredServicesBlock: {
        gap: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
    },
    featuredServicesHeader: {
        gap: 4,
    },
    featuredServicesTitle: {
        fontSize: fontSize.xl,
        fontWeight: '900',
        color: colors.text,
    },
    featuredServicesSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    featuredServiceCard: {
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#ECE5F8',
        shadowColor: '#23133E',
        shadowOpacity: 0.05,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 2,
    },
    featuredServiceMediaRow: {
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        alignItems: 'stretch',
    },
    featuredServiceMediaRowRtl: {
        flexDirection: 'row-reverse',
    },
    featuredServiceImage: {
        width: 108,
        height: 108,
        borderRadius: 22,
        backgroundColor: '#F3F0FA',
    },
    featuredServiceImageFallback: {
        width: 108,
        height: 108,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featuredServiceImageFallbackText: {
        color: '#FFFFFF',
        fontSize: fontSize.xxl,
        fontWeight: '900',
    },
    featuredServiceInfo: {
        flex: 1,
        gap: 8,
    },
    featuredServiceInfoRtl: {
        alignItems: 'flex-end',
    },
    featuredServiceTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
    },
    featuredServiceName: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: '900',
        color: colors.text,
    },
    featuredServiceNameRtl: {
        textAlign: 'right',
    },
    featuredServiceCategoryPill: {
        borderRadius: 999,
        backgroundColor: '#F5EDFF',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    featuredServiceCategoryText: {
        fontSize: fontSize.xs,
        color: colors.primary,
        fontWeight: '800',
    },
    featuredServiceDescription: {
        fontSize: fontSize.sm,
        lineHeight: 20,
        color: colors.textSecondary,
    },
    featuredServiceDescriptionRtl: {
        textAlign: 'right',
    },
    featuredServiceMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    featuredServiceMetaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F8F5FF',
    },
    featuredServiceMetaText: {
        fontSize: fontSize.xs,
        color: colors.primary,
        fontWeight: '800',
    },
    featuredServicePrice: {
        fontSize: fontSize.md,
        fontWeight: '900',
        color: colors.text,
    },
    featuredServicePriceRtl: {
        textAlign: 'right',
    },
    featuredServiceBookButton: {
        minHeight: 44,
        borderRadius: 16,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    featuredServiceBookButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.sm,
        fontWeight: '800',
    },
    viewAllServicesButton: {
        minHeight: 48,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E8D8FF',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    viewAllServicesText: {
        color: colors.primary,
        fontSize: fontSize.sm,
        fontWeight: '900',
    },
    productsTeaserCard: {
        borderRadius: 26,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#ECE5F8',
        padding: spacing.lg,
        gap: spacing.md,
    },
    productsTeaserHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    productsTeaserTitle: {
        fontSize: fontSize.lg,
        fontWeight: '900',
        color: colors.text,
    },
    productsTeaserSubtitle: {
        fontSize: fontSize.xs,
        lineHeight: 18,
        color: colors.textSecondary,
        marginTop: 3,
        maxWidth: 240,
    },
    productsTeaserLink: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F7F1FF',
    },
    productsTeaserLinkText: {
        color: colors.primary,
        fontSize: fontSize.xs,
        fontWeight: '800',
    },
    productPreviewRow: {
        gap: 12,
    },
    productPreviewCard: {
        width: 138,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#EDE4FB',
        backgroundColor: '#FFFFFF',
        padding: 10,
        gap: 8,
    },
    productPreviewImage: {
        width: '100%',
        height: 96,
        borderRadius: 16,
        backgroundColor: '#F1EDF8',
    },
    productPreviewImageFallback: {
        width: '100%',
        height: 96,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    productPreviewName: {
        fontSize: fontSize.sm,
        fontWeight: '800',
        color: colors.text,
        minHeight: 38,
    },
    productPreviewPrice: {
        fontSize: fontSize.xs,
        fontWeight: '900',
        color: colors.primary,
    },
    categorySection: {
        marginBottom: spacing.lg,
    },
    servicesHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    servicesHeaderCopy: {
        flex: 1,
        gap: 4,
    },
    servicesHeaderTitle: {
        fontSize: fontSize.xxl,
        fontWeight: '700',
        color: colors.text,
    },
    servicesHeaderSubtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
    },
    filterChipRow: {
        gap: spacing.sm,
        paddingBottom: spacing.sm,
        marginBottom: spacing.sm,
    },
    filterChip: {
        borderWidth: 1,
        borderColor: '#E6DBFF',
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    filterChipTextActive: {
        color: colors.textInverse,
    },
    servicesFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#D8B4FE',
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
    },
    servicesFilterButtonText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: fontSize.sm,
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
        backgroundColor: colors.surface,
        padding: 12,
        borderRadius: 24,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
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
    serviceContentRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: spacing.md,
    },
    serviceContentRowRtl: {
        flexDirection: 'row-reverse',
    },
    serviceThumbnail: {
        width: 120,
        height: 120,
        borderRadius: 20,
        backgroundColor: colors.backgroundGray,
    },
    serviceThumbnailFallback: {
        width: 120,
        height: 120,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceThumbnailFallbackText: {
        color: colors.textInverse,
        fontSize: fontSize.lg,
        fontWeight: '700',
    },
    serviceInfo: {
        flex: 1,
    },
    serviceInfoRtl: {
        alignItems: 'flex-end',
    },
    serviceName: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 6,
    },
    serviceNameRtl: {
        textAlign: 'right',
        alignSelf: 'stretch',
    },
    serviceDescription: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
    },
    serviceDescriptionRtl: {
        textAlign: 'right',
        alignSelf: 'stretch',
    },
    serviceDuration: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    serviceCardMetaRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    serviceCardMetaRowRtl: {
        flexDirection: 'row-reverse',
    },
    serviceCardMetaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.backgroundGray,
        borderRadius: borderRadius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    servicePrice: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.primary,
    },
    servicePriceRtl: {
        textAlign: 'right',
    },
    serviceArrowButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3E8FF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E9D5FF',
        marginLeft: spacing.md,
    },
    serviceBookingBanner: {
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        borderColor: 'rgba(139, 92, 246, 0.18)',
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
        backgroundColor: 'rgba(139, 92, 246, 0.12)',
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
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },
    serviceModalCard: {
        backgroundColor: colors.background,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        gap: spacing.md,
        maxHeight: '92%',
        minHeight: '78%',
    },
    serviceModalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: spacing.md,
    },
    serviceBackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: '#F3E8FF',
    },
    serviceBackText: {
        color: colors.primary,
        fontSize: fontSize.sm,
        fontWeight: '700',
    },
    serviceDetailScroll: {
        flex: 1,
    },
    serviceDetailScrollContent: {
        gap: spacing.md,
        paddingBottom: spacing.xl,
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
        backgroundColor: '#F5EDFF',
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
        backgroundColor: colors.surface,
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
        color: colors.textInverse,
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
        backgroundColor: colors.surface,
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
        color: colors.textInverse,
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
        backgroundColor: '#FFF1D4',
    },
    employeeRatingText: {
        fontSize: fontSize.xs,
        fontWeight: '700',
        color: '#9A3412',
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
        color: colors.textInverse,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    giftsHeaderBlock: {
        marginBottom: spacing.md,
    },
    giftsHeaderTitle: {
        fontSize: 38,
        fontWeight: '800',
        color: '#111236',
    },
    giftsHeaderSubtitle: {
        marginTop: 6,
        fontSize: 18,
        lineHeight: 26,
        color: '#61698A',
    },
    giftCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#EEE9FA',
        padding: 12,
        marginBottom: 16,
        shadowColor: '#221146',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
    },
    giftCardRow: {
        flexDirection: 'row',
        gap: 12,
    },
    giftCardRowRtl: {
        flexDirection: 'row-reverse',
    },
    giftCardMediaWrap: {
        width: 142,
        height: 142,
        borderRadius: 22,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#EDE7FF',
    },
    giftCardImage: {
        width: '100%',
        height: '100%',
    },
    giftCardImageFallback: {
        width: '100%',
        height: '100%',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        justifyContent: 'space-between',
    },
    giftCardImageFallbackTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    giftCardImageFallbackSub: {
        marginTop: 2,
        color: 'rgba(255,255,255,0.95)',
        fontSize: fontSize.xs,
        fontWeight: '600',
    },
    giftBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#7A3CE0',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    giftBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    giftBadgeRtl: {
        left: undefined,
        right: 8,
    },
    giftCardContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    giftCardContentRtl: {
        alignItems: 'flex-end',
    },
    giftCardTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#12123B',
    },
    giftCardTitleRtl: {
        textAlign: 'right',
        alignSelf: 'stretch',
    },
    giftCardDesc: {
        marginTop: 4,
        fontSize: 16,
        lineHeight: 24,
        color: '#5F6786',
    },
    giftCardDescRtl: {
        textAlign: 'right',
        alignSelf: 'stretch',
    },
    giftMetaRow: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    giftMetaChip: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 7,
        backgroundColor: '#F4F0FF',
        borderWidth: 1,
        borderColor: '#E3D7FF',
    },
    giftMetaChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#5D36B0',
    },
    giftValueBlock: {
        marginTop: 10,
        borderRadius: 16,
        backgroundColor: '#F7F4FF',
        borderWidth: 1,
        borderColor: '#ECE6FF',
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    giftValueBlockRtl: {
        flexDirection: 'row-reverse',
    },
    giftValueColumn: {
        flex: 1,
    },
    giftValueColumnRtl: {
        alignItems: 'flex-end',
    },
    giftValueColumnGetRtl: {
        alignItems: 'flex-start',
    },
    giftValueLabel: {
        fontSize: 12,
        color: '#6A7191',
        fontWeight: '600',
    },
    giftValueLabelRtl: {
        textAlign: 'right',
    },
    giftValueGetLabel: {
        color: '#168A45',
    },
    giftValueAmount: {
        marginTop: 4,
        fontSize: 18,
        color: '#191A44',
        fontWeight: '800',
    },
    giftValueAmountRtl: {
        textAlign: 'right',
    },
    giftValueGetAmount: {
        marginTop: 4,
        fontSize: 18,
        color: '#169947',
        fontWeight: '800',
    },

    compactServiceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    compactServiceCardSelected: {
        borderColor: colors.primary,
        borderWidth: 2,
    },
    compactServiceMediaRow: {
        flexDirection: 'row',
        padding: spacing.md,
        alignItems: 'center',
    },
    compactServiceMediaRowRtl: {
        flexDirection: 'row-reverse',
    },
    compactServiceImage: {
        width: 72,
        height: 72,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    compactServiceImageFallback: {
        width: 72,
        height: 72,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactServiceImageFallbackText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
    },
    compactServiceInfo: {
        flex: 1,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
    },
    compactServiceInfoRtl: {
        paddingLeft: spacing.sm,
        paddingRight: spacing.md,
    },
    compactServiceName: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
        textAlign: 'left',
    },
    compactServiceNameRtl: {
        textAlign: 'right',
    },
    compactServiceDuration: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: 4,
        textAlign: 'left',
    },
    compactServiceDurationRtl: {
        textAlign: 'right',
    },
    compactServicePrice: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'left',
    },
    compactServicePriceRtl: {
        textAlign: 'right',
    },
    circularToggleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 'auto',
    },
    circularToggleBtnActive: {
        backgroundColor: colors.primary,
    },
    loadMoreServicesButton: {
        backgroundColor: '#1A1B43',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
    },
    loadMoreServicesText: {
        color: '#FFFFFF',
        fontSize: fontSize.md,
        fontWeight: '600',
    },
    giftValueArrow: {
        fontSize: 21,
        color: '#2E315D',
        fontWeight: '700',
        paddingHorizontal: 8,
    },
    giftCardFooterRow: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    giftCardFooterRowRtl: {
        flexDirection: 'row-reverse',
    },
    giftBonusPill: {
        backgroundColor: '#E6F9EC',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    giftBonusText: {
        color: '#19854A',
        fontSize: 14,
        fontWeight: '700',
    },
    giftValidityPill: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 7,
        backgroundColor: '#EEF2FF',
    },
    giftValidityText: {
        color: '#4F5B92',
        fontSize: 12,
        fontWeight: '700',
    },
    giftArrowButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3EEFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    giftInfoBanner: {
        marginTop: 4,
        borderRadius: 20,
        backgroundColor: '#F3EEFF',
        borderWidth: 1,
        borderColor: '#E8DEFF',
        padding: 14,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
    },
    giftInfoBannerRtl: {
        flexDirection: 'row-reverse',
    },
    giftInfoIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E9DEFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    giftInfoText: {
        color: '#36385C',
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 20,
    },
    giftInfoSubText: {
        marginTop: 2,
        color: '#5F6786',
        fontSize: 13,
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
    aboutHeroBlock: {
        marginBottom: spacing.md,
    },
    aboutHeroTitle: {
        fontSize: 36,
        color: '#12133A',
        fontWeight: '800',
    },
    aboutHeroSubtitle: {
        marginTop: 4,
        fontSize: 17,
        color: '#626A89',
        lineHeight: 25,
    },
    aboutCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#EEE8FB',
        padding: spacing.md,
        marginBottom: spacing.md,
        shadowColor: '#211547',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    aboutCardTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#15163D',
        marginBottom: spacing.sm,
    },
    aboutListItem: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.xs,
    },
    listItemText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.xs,
    },
    sectionBlock: {
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 24,
        backgroundColor: colors.surface,
        padding: spacing.md,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
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
        backgroundColor: colors.backgroundGray,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        marginTop: spacing.sm,
    },
    mapPreviewImage: {
        width: '100%',
        height: '100%',
    },
    mapFallback: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapOverlayPill: {
        position: 'absolute',
        bottom: spacing.sm,
        alignSelf: 'center',
        backgroundColor: 'rgba(17, 24, 39, 0.82)',
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
    },
    mapOverlayPillText: {
        color: colors.textInverse,
        fontSize: fontSize.xs,
        fontWeight: '700',
    },
    mapText: {
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    galleryRow: {
        gap: spacing.sm,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
    },
    galleryImage: {
        width: 180,
        height: 120,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.backgroundGray,
    },
    galleryPreviewBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(18, 13, 33, 0.82)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    galleryPreviewCard: {
        width: '100%',
        height: '78%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    galleryPreviewImage: {
        width: '100%',
        height: '100%',
    },
    galleryPreviewCloseButton: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(233,221,253,0.75)',
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
        backgroundColor: colors.backgroundGray,
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
    productsHeaderBlock: {
        marginBottom: spacing.md,
    },
    productsHeaderTitle: {
        fontSize: 36,
        color: '#12133A',
        fontWeight: '800',
    },
    productsHeaderSubtitle: {
        marginTop: 4,
        fontSize: 17,
        color: '#626A89',
        lineHeight: 25,
    },
    productSearchCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#EDE9FA',
        padding: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    productSearchTitle: {
        fontSize: fontSize.lg,
        color: '#171843',
        fontWeight: '800',
    },
    productSearchSubtitle: {
        fontSize: fontSize.sm,
        color: '#626A89',
        lineHeight: 20,
    },
    productSearchInput: {
        borderWidth: 1,
        borderColor: '#D8DDF1',
        borderRadius: 16,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: fontSize.md,
        color: colors.text,
        backgroundColor: '#FAFBFF',
    },
    productCategoryRow: {
        gap: spacing.sm,
        paddingTop: spacing.xs,
    },
    productCategoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F3F6FF',
        borderWidth: 1,
        borderColor: '#DDE5FF',
    },
    productCategoryChipActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    productCategoryChipText: {
        fontSize: fontSize.sm,
        color: '#34416A',
        fontWeight: '600',
    },
    productCategoryChipTextActive: {
        color: '#FFFFFF',
    },
    productGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.sm,
    },
    productCardCompact: {
        width: '48%',
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    productCardSelected: {
        borderColor: colors.primary,
        borderWidth: 2,
    },
    productImageContainerCompact: {
        position: 'relative',
        width: '100%',
        aspectRatio: 1,
    },
    productImageCompact: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    productSelectButton: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.border,
    },
    productSelectButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    productSelectButtonDisabled: {
        opacity: 0.5,
    },
    productInfoCompact: {
        padding: spacing.sm,
    },
    productNameCompact: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    productMetaRowCompact: {
        flexDirection: 'column',
    },
    productPriceCompact: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 2,
    },
    productStockTextCompact: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    loadMoreButton: {
        backgroundColor: colors.backgroundGray,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: 8,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    loadMoreButtonText: {
        color: colors.textSecondary,
        fontWeight: '600',
        fontSize: 14,
    },
    productFiltersContainer: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.lg,
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#EDE9FA',
        overflow: 'hidden',
        shadowColor: '#1B1540',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    productImage: {
        width: '100%',
        height: 120,
    },
    productInfo: {
        padding: spacing.md,
    },
    productName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#171843',
    },
    productDescription: {
        marginTop: 5,
        fontSize: 15,
        color: '#5D6585',
        lineHeight: 22,
    },
    productBrandPill: {
        alignSelf: 'flex-start',
        backgroundColor: '#EEF2FF',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginTop: spacing.sm,
    },
    productBrandPillText: {
        fontSize: 11,
        color: '#4338CA',
        fontWeight: '700',
    },
    productMetaRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    productPrice: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
    },
    productStockPill: {
        backgroundColor: '#EFF8F2',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    productStockText: {
        color: '#1A8B4A',
        fontSize: 12,
        fontWeight: '700',
    },
    productActionsRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.sm,
    },
    productActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: spacing.xs,
    },
    productActionButtonPrimary: {
        backgroundColor: '#6D31D9',
    },
    productActionButtonSecondary: {
        backgroundColor: '#F3EDFF',
        borderWidth: 1,
        borderColor: '#CDBBF9',
    },
    productActionText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
    },
    productActionTextPrimary: {
        color: 'white',
    },
    productActionTextSecondary: {
        color: colors.primary,
    },
    addToCartButtonDisabled: {
        backgroundColor: '#B9A8DF',
    },
    bottomBasketContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#EDE7FC',
        shadowColor: '#1B1540',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 10,
        paddingBottom: spacing.xl,
    },
    bottomBasketLeft: {
        flex: 1,
    },
    bottomBasketPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1B43',
    },
    bottomBasketDetails: {
        fontSize: 13,
        color: '#7A80A2',
        marginTop: 2,
    },
    bottomBasketButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    bottomBasketButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    heroImageShallow: {
        width: '100%',
        height: 120,
    },
    circularHeaderButton: {
        width: 36,
        height: 36,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroIdentityWrap: {
        marginTop: -32,
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    tenantLogoOverlappingWrap: {
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginBottom: spacing.xs,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    tenantLogoImageLarge: {
        width: '100%',
        height: '100%',
    },
    heroIdentityTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
    },
    heroIdentityPill: {
        backgroundColor: colors.text,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginTop: 4,
    },
    heroIdentityPillText: {
        color: colors.surface,
        fontSize: 11,
        fontWeight: '600',
    },
    heroIdentityMetaRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    heroStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.text,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    heroStatusPillTextBold: {
        color: colors.surface,
        fontSize: 12,
        fontWeight: '700',
    },
    heroStatusPillTextLight: {
        color: colors.surface,
        fontSize: 12,
        opacity: 0.8,
    },
    heroStatusPillTextSeparator: {
        color: colors.surface,
        fontSize: 12,
        marginHorizontal: 4,
    },
    tabContainerCompact: {
        backgroundColor: colors.surface,
        paddingTop: spacing.xs,
    },
    tabScrollContentCompact: {
        paddingHorizontal: spacing.md,
        gap: spacing.md,
    },
    tabCompact: {
        paddingVertical: spacing.sm,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    tabTextCompact: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    activeTabTextCompact: {
        color: colors.text,
        fontWeight: '700',
    },
    activeTabIndicatorCompact: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: colors.text,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    },
    tabDividerCompact: {
        height: 1,
        backgroundColor: colors.border,
        width: '100%',
    },
    aboutCardCompact: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    aboutCardTitleCompact: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    aboutTextCompact: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    aboutMoreToggle: {
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    aboutMoreText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    teamRow: {
        gap: spacing.md,
    },
    teamMemberCard: {
        width: 80,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        borderRadius: 12,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    teamMemberAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginBottom: 8,
    },
    teamMemberAvatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    teamMemberAvatarFallbackText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    teamMemberName: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
        textAlign: 'center',
    },
    teamMemberRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    teamMemberRatingText: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    reviewsPreviewSummaryBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    reviewsPreviewStarsRow: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewStarPreview: {
        fontSize: 20,
        color: '#E5E7EB',
    },
    reviewStarActivePreview: {
        color: '#F59E0B',
    },
    reviewsPreviewScoreText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
    },
    reviewsPreviewTotalText: {
        color: colors.textSecondary,
        fontWeight: '400',
    },
    reviewPreviewItem: {
        marginBottom: spacing.md,
    },
    reviewPreviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    reviewPreviewAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EBF5FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    reviewPreviewAvatarText: {
        color: '#1D4ED8',
        fontWeight: '700',
        fontSize: 14,
    },
    reviewPreviewAuthorInfo: {
        flex: 1,
    },
    reviewPreviewAuthorName: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    reviewPreviewDate: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
    },
    reviewPreviewStarsMini: {
        flexDirection: 'row',
        marginBottom: 6,
        gap: 1,
    },
    reviewStarMini: {
        fontSize: 14,
        color: '#E5E7EB',
    },
    reviewStarActiveMini: {
        color: '#F59E0B',
    },
    reviewPreviewComment: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    reviewsPreviewSeeAllButton: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        paddingVertical: 10,
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    reviewsPreviewSeeAllText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    hoursContainerCompact: {
        gap: 6,
    },
    hoursRowCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    hoursRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    hoursStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    hoursStatusDotOpen: {
        backgroundColor: colors.success,
    },
    hoursStatusDotClosed: {
        backgroundColor: '#E5E7EB',
    },
    dayTextCompact: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    timeTextCompact: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    aboutCardDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.md,
    },
    mapPreviewCard: {
        width: '100%',
        height: 120,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: spacing.sm,
        backgroundColor: colors.background,
    },
    mapPreviewImageCompact: {
        width: '100%',
        height: '100%',
    },
    mapFallbackCompact: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    mapPreviewOverlayBadge: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -24 }, { translateY: -12 }],
        backgroundColor: '#111827',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    mapPreviewOverlayBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    addressTextCompact: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    getDirectionsButton: {
        alignItems: 'center',
    },
    getDirectionsText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
});
