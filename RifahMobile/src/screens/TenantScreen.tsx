import React, { useMemo, useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Platform, Image, TouchableOpacity, ActivityIndicator, ImageBackground, Dimensions, Alert, Share, Linking, Modal, Animated, Easing } from 'react-native';
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
import { ReviewPromptModal } from '../components/ReviewPromptModal';

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
    title_en: string;
    title_ar: string;
    description_en?: string | null;
    description_ar?: string | null;
    priceAmount: number;
    walletCreditAmount: number;
    bonusAmount: number;
    imageUrl?: string | null;
};

const { width } = Dimensions.get('window');
const TENANT_PAGE_UI = {
    minBottomSafePadding: 120,
    fallbackCoverImage: 'https://images.unsplash.com/photo-1560066984-12186d305d4d?q=80&w=2574&auto=format&fit=crop',
};

export function TenantScreen({ route, navigation }: TenantDetailsProps) {
    const { tenantId, slug, selectedServiceId } = route.params; // Expect tenantId or slug from navigation
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
    const [staff, setStaff] = useState<Staff[]>([]);
    const [showServicesTab, setShowServicesTab] = useState(true);
    const [showProductsTab, setShowProductsTab] = useState(false);
    const [showReviewsTab, setShowReviewsTab] = useState(true);
    const [showAboutTab, setShowAboutTab] = useState(true);
    const [showGiftsTab, setShowGiftsTab] = useState(false);
    const [giftPackages, setGiftPackages] = useState<TenantGiftPackage[]>([]);
    const [giftImageErrors, setGiftImageErrors] = useState<Record<string, boolean>>({});
    const [serviceImageErrors, setServiceImageErrors] = useState<Record<string, boolean>>({});
    const [reviews, setReviews] = useState<TenantReview[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsSummary, setReviewsSummary] = useState<{ total: number; avgRating: number | null }>({ total: 0, avgRating: null });
    const [galleryPreviewImage, setGalleryPreviewImage] = useState<string | null>(null);
    const [reviewTargetBooking, setReviewTargetBooking] = useState<Booking | null>(null);
    const [reviewEligibleBookings, setReviewEligibleBookings] = useState<Booking[]>([]);
    const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());
    const [serviceFilterCategory, setServiceFilterCategory] = useState<string>('all');
    const pageEnterAnim = useMemo(() => new Animated.Value(0), []);
    const { itemCount, addToCart, clearCart } = useCart();
    const { itemCount: serviceBookingItemCount } = useServiceBookingCart();

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
            openServiceDetails(matchedService);
        }
    }, [selectedServiceId, services]);

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
            const user = await api.getUser();
            if (!user) {
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

    const openServiceDetails = (service: Service) => {
        navigation.navigate('ServiceDetails', {
            tenant,
            tenantId: tenant?.id || tenantId,
            service,
        });
    };

    const openProviderProfile = (provider: Staff) => {
        navigation.navigate('EmployeeProfile', { provider, tenant });
    };

    const extractMapCoordinates = (mapUrl?: string | null): { lat: number; lng: number } | null => {
        if (!mapUrl) return null;
        const decodedUrl = decodeURIComponent(mapUrl);
        const atMatch = decodedUrl.match(/@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/);
        if (atMatch) {
            return { lat: Number(atMatch[1]), lng: Number(atMatch[3]) };
        }
        const qMatch = decodedUrl.match(/[?&]q=(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/i);
        if (qMatch) {
            return { lat: Number(qMatch[1]), lng: Number(qMatch[3]) };
        }
        const llMatch = decodedUrl.match(/[?&]ll=(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/i);
        if (llMatch) {
            return { lat: Number(llMatch[1]), lng: Number(llMatch[3]) };
        }
        return null;
    };

    const buildMapPreviewImage = (mapUrl?: string | null): string | null => {
        const coords = extractMapCoordinates(mapUrl);
        if (!coords) return null;
        const center = `${coords.lat},${coords.lng}`;
        return `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(center)}&zoom=15&size=800x360&markers=${encodeURIComponent(center + ',red-pushpin')}`;
    };
    const mapPreviewImage = buildMapPreviewImage(mapUrl);


    const renderHero = () => {
        if (!tenant) return null;

        const coverImage = getTenantCoverUri();
        const logoImage = getTenantLogoUri();
        const locationLabel = [tenant.city, tenant.country].filter(Boolean).join(', ');
        const ratingValue = reviewsSummary.avgRating ? reviewsSummary.avgRating.toFixed(1) : null;
        const businessLabel = getBusinessTypeLabel();
        const heroChips = [
            {
                key: 'status',
                icon: tenant.isAvailable ? 'clock' : 'close',
                label: tenant.isAvailable
                    ? (isRTL ? 'مفتوح الآن' : 'Open now')
                    : (isRTL ? 'مغلق الآن' : 'Closed now'),
                isStatus: true
            },
            businessLabel ? { key: 'business', icon: 'sparkles', label: businessLabel, isStatus: false } : null,
            { key: 'care', icon: 'star', label: isRTL ? 'عناية مميزة' : 'Premium care', isStatus: false },
        ].filter(Boolean).slice(0, 3) as Array<{ key: string; icon: any; label: string; isStatus: boolean }>;

        return (
            <View style={styles.heroContainer}>
                <ImageBackground source={{ uri: coverImage }} style={styles.heroImage} resizeMode="cover">
                    <LinearGradient
                        colors={['rgba(17, 24, 39, 0.12)', 'rgba(17, 24, 39, 0.48)']}
                        style={styles.heroGradient}
                    >
                        <View style={[styles.heroHeaderRow, { marginTop: topInset }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={22} color={colors.text} />
                            </TouchableOpacity>
                            <View style={styles.heroActions}>
                                <TouchableOpacity style={styles.iconButton} onPress={handleShareTenant}>
                                    <AppIcon name="share" size={20} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Cart', { tenant })}>
                                    <AppIcon name="cart" size={20} color={colors.text} />
                                    {itemCount > 0 && (
                                        <View style={styles.badgeContainer}>
                                            <Text style={styles.badgeText}>{itemCount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => navigation.navigate('ServiceBookingCart')}
                                >
                                    <AppIcon name="bookings" size={20} color={colors.text} />
                                    {serviceBookingItemCount > 0 && (
                                        <View style={styles.badgeContainer}>
                                            <Text style={styles.badgeText}>{serviceBookingItemCount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                <View style={styles.heroInfoCardWrap}>
                    <View style={styles.tenantLogoWrap}>
                        <Image source={{ uri: logoImage }} style={styles.tenantLogoImage} />
                    </View>
                    <View style={styles.heroInfoCard}>
                        <Text style={styles.heroTitle} numberOfLines={1}>{tenant.name}</Text>
                        <Text style={styles.heroSubtitle} numberOfLines={2}>
                            {getLocalizedText(tenant.description_en || null, tenant.description_ar || tenant.descriptionAr || null, '')}
                        </Text>

                        <View style={styles.heroMetaRow}>
                            {ratingValue ? (
                                <View style={styles.heroMetaItem}>
                                    <AppIcon name="star" size={14} color="#F59E0B" />
                                    <Text style={styles.heroMetaText}>
                                        {ratingValue} {reviewsSummary.total > 0 ? `(${reviewsSummary.total})` : ''}
                                    </Text>
                                </View>
                            ) : null}
                            {locationLabel ? (
                                <View style={styles.heroMetaItem}>
                                    <AppIcon name="location" size={14} color={colors.primary} />
                                    <Text style={styles.heroMetaText} numberOfLines={1}>{locationLabel}</Text>
                                </View>
                            ) : null}
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.heroChipsRow}
                        >
                            {heroChips.map((chip) => (
                                <View
                                    key={chip.key}
                                    style={[
                                        styles.heroChip,
                                        chip.isStatus ? styles.heroChipStatus : styles.heroChipDefault,
                                    ]}
                                >
                                    <AppIcon
                                        name={chip.icon}
                                        size={13}
                                        color={chip.isStatus ? colors.success : colors.primary}
                                    />
                                    <Text style={[
                                        styles.heroChipText,
                                        chip.isStatus ? styles.heroChipStatusText : styles.heroChipDefaultText,
                                    ]}>
                                        {chip.label}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </View>
        );
    };

    const renderTabs = () => {
        const availableTabs: string[] = [];
        if (showServicesTab) availableTabs.push('services');
        if (showProductsTab) availableTabs.push('products');
        if (showGiftsTab) availableTabs.push('gifts');
        if (showReviewsTab) availableTabs.push('reviews');
        if (showAboutTab) availableTabs.push('about');

        if (availableTabs.length === 0) return null;

        return (
            <View style={styles.tabContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabScrollContent}
                >
                    {availableTabs.map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={styles.tab}
                            onPress={() => setActiveTab(tab as any)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                {t(tab as any) || tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                            {activeTab === tab ? <View style={styles.activeTabIndicator} /> : null}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
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
                renderEmptyState(isRTL ? 'تجارب الهدايا قريباً ✨' : 'Gift experiences coming soon ✨')
            ) : (
                giftPackages.map((pkg, index) => {
                    const totalCredit = Number(pkg.walletCreditAmount || 0) + Number(pkg.bonusAmount || 0);
                    const bonusAmount = Number(pkg.bonusAmount || 0);
                    const hasImage = !!pkg.imageUrl && !giftImageErrors[pkg.id];
                    const localizedTitle = isRTL ? pkg.title_ar : pkg.title_en;
                    const localizedDescription = (isRTL ? pkg.description_ar : pkg.description_en) || (isRTL ? pkg.description_en : pkg.description_ar) || '';
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
                                ? 'جميع بطاقات الهدايا صالحة لمدة 12 شهرًا من تاريخ الشراء.'
                                : 'All gift cards are valid for 12 months from the date of purchase.'}
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
        const categories = Array.from(new Set(services.map(s => s.category || 'General')));
        const filteredServices = serviceFilterCategory === 'all'
            ? services
            : services.filter((s) => (s.category || 'General') === serviceFilterCategory);
        const groupedCategories = Array.from(new Set(filteredServices.map((s) => s.category || 'General')));

        return (
            <View style={styles.contentSection}>
                <View style={styles.servicesHeaderRow}>
                    <View style={styles.servicesHeaderCopy}>
                        <Text style={styles.servicesHeaderTitle}>{isRTL ? 'خدماتنا' : 'Our Services'}</Text>
                        <Text style={styles.servicesHeaderSubtitle}>
                            {isRTL ? 'اختر من خدماتنا المميزة' : 'Choose from our premium services'}
                        </Text>
                    </View>
                </View>
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
                    renderEmptyState(isRTL ? 'لا توجد خدمات متاحة حالياً.' : 'No services available yet.')
                ) : (
                    groupedCategories.map(category => (
                        <View key={category} style={styles.categorySection}>
                            <Text style={styles.categoryTitle}>{category}</Text>
                            {filteredServices.filter(s => (s.category || 'General') === category).map(service => {
                                const serviceName = isRTL ? service.name_ar : service.name_en;
                                const serviceDesc = getServiceDescription(service);
                                return (
                                    <TouchableOpacity
                                        key={service.id}
                                        style={styles.serviceCard}
                                        onPress={() => openServiceDetails(service)}
                                        activeOpacity={0.92}
                                    >
                                        <View style={[styles.serviceContentRow, isRTL ? styles.serviceContentRowRtl : null]}>
                                            {resolveServiceImageUri(service) && !serviceImageErrors[service.id] ? (
                                                <Image
                                                    source={{ uri: resolveServiceImageUri(service)! }}
                                                    style={styles.serviceThumbnail}
                                                    onError={() => setServiceImageErrors((prev) => ({ ...prev, [service.id]: true }))}
                                                />
                                            ) : (
                                                <LinearGradient
                                                    colors={['#8B5CF6', '#A78BFA']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={styles.serviceThumbnailFallback}
                                                >
                                                    <Text style={styles.serviceThumbnailFallbackText}>
                                                        {(serviceName || 'S').charAt(0).toUpperCase()}
                                                    </Text>
                                                </LinearGradient>
                                            )}
                                            <View style={[styles.serviceInfo, isRTL ? styles.serviceInfoRtl : null]}>
                                                <Text style={[styles.serviceName, isRTL ? styles.serviceNameRtl : null]} numberOfLines={1}>
                                                    {serviceName}
                                                </Text>
                                                {serviceDesc ? (
                                                    <Text style={[styles.serviceDescription, isRTL ? styles.serviceDescriptionRtl : null]} numberOfLines={2}>
                                                        {serviceDesc}
                                                    </Text>
                                                ) : null}
                                                <View style={[styles.serviceCardMetaRow, isRTL ? styles.serviceCardMetaRowRtl : null]}>
                                                    <View style={styles.serviceCardMetaPill}>
                                                        <AppIcon name="clock" size={12} color={colors.textSecondary} />
                                                        <Text style={styles.serviceDuration}>{service.duration} {isRTL ? 'دقيقة' : 'min'}</Text>
                                                    </View>
                                                    <Text style={[styles.servicePrice, isRTL ? styles.servicePriceRtl : null]}>{formatRiyal(getServicePrice(service), isRTL ? 'ar' : 'en')}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.serviceArrowButton}>
                                                <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={18} color={colors.primary} />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))
                )}
            </View>
        );
    };

    const renderProducts = () => {
        return (
            <View style={styles.contentSection}>
                <View style={styles.productsHeaderBlock}>
                    <Text style={styles.productsHeaderTitle}>{isRTL ? 'المنتجات' : 'Products'}</Text>
                    <Text style={styles.productsHeaderSubtitle}>
                        {isRTL ? 'منتجات مختارة للعناية اليومية والجمال.' : 'Curated beauty and wellness products for your routine.'}
                    </Text>
                </View>
                {products.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>{isRTL ? 'لا توجد منتجات متاحة حالياً.' : 'No products available yet.'}</Text>
                    </View>
                ) : (
                    <View style={styles.productGrid}>
                        {products.map(product => {
                            const imageUri = product.images && product.images.length > 0
                                ? getImageUrl(product.images[0])
                                : 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600&auto=format&fit=crop';
                            const productName = isRTL ? product.name_ar : product.name_en;
                            const productDescription = (isRTL ? product.description_ar : product.description_en) || (isRTL ? product.description_en : product.description_ar) || '';

                            return (
                                <TouchableOpacity
                                    key={product.id}
                                    style={styles.productCard}
                                    activeOpacity={0.95}
                                    onPress={() => navigation.navigate('ProductDetails', { product, tenant })}
                                >
                                    <Image
                                        source={{ uri: imageUri }}
                                        style={styles.productImage}
                                    />
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
                                        {productDescription ? (
                                            <Text style={styles.productDescription} numberOfLines={2}>{productDescription}</Text>
                                        ) : null}
                                        <View style={styles.productMetaRow}>
                                            <Text style={styles.productPrice}>{formatRiyal(product.price, isRTL ? 'ar' : 'en')}</Text>
                                            <View style={styles.productStockPill}>
                                                <Text style={styles.productStockText}>
                                                    {product.stock > 0
                                                        ? (isRTL ? `متوفر (${product.stock})` : `In stock (${product.stock})`)
                                                        : (isRTL ? 'غير متوفر' : 'Out of stock')}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.productActionsRow}>
                                        <TouchableOpacity
                                            style={[styles.productActionButton, styles.productActionButtonSecondary, product.stock <= 0 ? styles.addToCartButtonDisabled : null]}
                                            onPress={() => handleAddProduct(product)}
                                            disabled={product.stock <= 0}
                                        >
                                            <Text style={[styles.productActionText, styles.productActionTextSecondary]}>
                                                {t('addToCart' as any) || (isRTL ? 'أضف للسلة' : 'Add to Cart')}
                                            </Text>
                                            <AppIcon name="cart" size={16} color={colors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.productActionButton, styles.productActionButtonPrimary, product.stock <= 0 ? styles.addToCartButtonDisabled : null]}
                                            onPress={() => handleAddProduct(product, { navigateToCart: true })}
                                            disabled={product.stock <= 0}
                                        >
                                            <Text style={[styles.productActionText, styles.productActionTextPrimary]}>
                                                {isRTL ? 'اشترِ الآن' : 'Buy Now'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
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

    const renderAbout = () => (
        <View style={styles.contentSection}>
            <View style={styles.aboutHeroBlock}>
                <Text style={styles.aboutHeroTitle}>{isRTL ? 'عن المركز' : 'About'}</Text>
                <Text style={styles.aboutHeroSubtitle}>
                    {isRTL ? 'تعرّف على قصة المركز، رسالته، ومعلومات التواصل.' : 'Discover the center story, mission, and key details.'}
                </Text>
            </View>

            {aboutStory ? (
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>{t('about')}</Text>
                    <Text style={styles.aboutText}>{aboutStory}</Text>
                </View>
            ) : null}

            {missions.length > 0 ? (
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>{t('mission')}</Text>
                    {missions.map((item, index) => (
                        <Text key={`mission-${index}`} style={styles.aboutListItem}>• {item}</Text>
                    ))}
                </View>
            ) : null}

            {visions.length > 0 ? (
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>{t('vision')}</Text>
                    {visions.map((item, index) => (
                        <Text key={`vision-${index}`} style={styles.aboutListItem}>• {item}</Text>
                    ))}
                </View>
            ) : null}

            {facilitiesImages.length > 0 ? (
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>{isRTL ? 'صور المركز' : 'Center Gallery'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                        {facilitiesImages.map((imageUri: string, index: number) => (
                            <TouchableOpacity key={`gallery-${index}`} activeOpacity={0.9} onPress={() => setGalleryPreviewImage(imageUri)}>
                                <Image
                                    source={{ uri: imageUri }}
                                    style={styles.galleryImage}
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            ) : null}

            {locationLine || mapUrl ? (
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>{t('location')}</Text>
                    {locationLine ? <Text style={styles.addressText}>{locationLine}</Text> : null}
                    {mapUrl ? (
                        <TouchableOpacity style={styles.mapPlaceholder} onPress={() => openExternalUrl(mapUrl)}>
                            {mapPreviewImage ? (
                                <Image source={{ uri: mapPreviewImage }} style={styles.mapPreviewImage} />
                            ) : (
                                <View style={styles.mapFallback}>
                                    <AppIcon name="location" size={32} color={colors.textSecondary} />
                                    <Text style={styles.mapText}>{t('viewOnMap')}</Text>
                                </View>
                            )}
                            <View style={styles.mapOverlayPill}>
                                <Text style={styles.mapOverlayPillText}>{t('viewOnMap')}</Text>
                            </View>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {tenant?.workingHours ? (
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>{t('workingHours')}</Text>
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
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>{t('contact')}</Text>
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
                <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>{t('followUs')}</Text>
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
                    {activeTab === 'services' && renderServices()}
                    {activeTab === 'products' && renderProducts()}
                    {activeTab === 'gifts' && renderGifts()}
                    {activeTab === 'reviews' && renderReviews()}
                    {activeTab === 'about' && renderAbout()}
                </Animated.View>
            </ScrollView>

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

            {/* Bottom Action Bar (if needed, e.g. View Cart or Quick Book) */}
            {/* For now, individual service booking is sufficient */}
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
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
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
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
    productGrid: {
        gap: spacing.md,
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
});
