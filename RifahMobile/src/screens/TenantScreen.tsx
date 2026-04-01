import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Platform, Image, TouchableOpacity, ActivityIndicator, ImageBackground, Dimensions, Alert } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { api, Tenant, Service, Staff, Product, getImageUrl, getServicePrice } from '../api/client';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface TenantDetailsProps {
    route: any;
    navigation: any;
}

const { width } = Dimensions.get('window');

export function TenantScreen({ route, navigation }: TenantDetailsProps) {
    const { tenantId, slug } = route.params; // Expect tenantId or slug from navigation
    const { t, isRTL } = useLanguage();

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'services' | 'products' | 'reviews' | 'about'>('services');
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [showServicesTab, setShowServicesTab] = useState(true);
    const [showProductsTab, setShowProductsTab] = useState(false);
    const [showReviewsTab, setShowReviewsTab] = useState(true);
    const [showAboutTab, setShowAboutTab] = useState(true);
    const { itemCount, addToCart, clearCart } = useCart();

    useEffect(() => {
        loadTenantDetails();
    }, [tenantId, slug]);

    const loadTenantDetails = async () => {
        try {
            setLoading(true);
            let resolvedTenant: Tenant | null = route.params.tenant || null;

            if (resolvedTenant) {
                setTenant(resolvedTenant);
            } else if (slug) {
                const tenantRes = await api.get<{ success: boolean; data: Tenant }>(`/public/tenant/${slug}`);
                if (tenantRes.success && tenantRes.data) {
                    resolvedTenant = tenantRes.data;
                    setTenant(resolvedTenant);
                }
            } else {
                const tenantsRes = await api.get<{ success: boolean; tenants: Tenant[] }>('/public/tenants');
                const matchedTenant = (tenantsRes.tenants || []).find((item) => item.id === tenantId);
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
            let isReviewsEnabled = true;
            let isAboutEnabled = true;

            if (pageDataRes.success && pageDataRes.data?.generalSettings?.sections) {
                const sections = pageDataRes.data.generalSettings.sections;
                isProductsEnabled = sections.products !== false;
                isServicesEnabled = sections.services !== false;
                isReviewsEnabled = sections.reviews !== false;
                isAboutEnabled = sections.about !== false;

                setShowProductsTab(isProductsEnabled);
                setShowServicesTab(isServicesEnabled);
                setShowReviewsTab(isReviewsEnabled);
                setShowAboutTab(isAboutEnabled);
            } else {
                setShowProductsTab(true); // Fallback to true if no settings found
                isProductsEnabled = true;
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
                    if (servicesRes.success) setServices(servicesRes.services || []);
                } catch {
                    setServices([]);
                }
            }

            // 4. Fetch Products (if tab is enabled)
            if (isProductsEnabled) {
                try {
                    const productsRes = await api.get<{ success: boolean; products: Product[] }>(`/public/tenant/${idToFetch}/products`);
                    if (productsRes.success) {
                        setProducts((productsRes.products || []).map((product) => ({
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
                if (staffRes.success) setStaff(staffRes.staff || []);
            } catch {
                setStaff([]);
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
                            <View style={styles.heroHeader}>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="white" />
                                </TouchableOpacity>
                                <View style={styles.heroActions}>
                                    <TouchableOpacity style={styles.iconButton}>
                                        <Ionicons name="heart-outline" size={24} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconButton}>
                                        <Ionicons name="share-outline" size={24} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Cart', { tenant })}>
                                        <Ionicons name="cart-outline" size={24} color="white" />
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
                {services.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No services available yet.</Text>
                    </View>
                ) : (
                    categories.map(category => (
                        <View key={category} style={styles.categorySection}>
                            <Text style={styles.categoryTitle}>{category}</Text>
                            {services.filter(s => (s.category || 'General') === category).map(service => (
                                <TouchableOpacity
                                    key={service.id}
                                    style={styles.serviceCard}
                                    onPress={() => navigation.navigate('Booking', { service, tenant })} // Navigate to BookingFlow
                                >
                                    <View style={styles.serviceInfo}>
                                        <Text style={styles.serviceName}>{isRTL ? service.name_ar : service.name_en}</Text>
                                        <Text style={styles.serviceDuration}>{service.duration} mins</Text>
                                        <Text style={styles.servicePrice}>{getServicePrice(service).toFixed(2)} SAR</Text>
                                    </View>
                                    <View style={styles.addButton}>
                                        <Ionicons name="add" size={24} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>
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
                                        <Text style={styles.productPrice}>{product.price} SAR</Text>
                                    </View>
                                    <TouchableOpacity style={styles.addToCartButton} onPress={() => handleAddProduct(product)}>
                                        <Text style={styles.addToCartText}>{t('addToCart' as any) || 'Add'}</Text>
                                        <Ionicons name="cart-outline" size={18} color="white" />
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
            <Text style={styles.sectionTitle}>Reviews</Text>
            <Text style={styles.emptyText}>No reviews yet.</Text>
            {/* Implementing mockup reviews later based on design */}
        </View>
    );

    const renderAbout = () => (
        <View style={styles.contentSection}>
            <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{t('about')}</Text>
                <Text style={styles.aboutText}>
                    {isRTL ? (tenant?.description_ar || tenant?.descriptionAr || tenant?.description) : (tenant?.description_en || tenant?.description || 'No description available.')}
                </Text>
            </View>

            {/* Mission & Vision - Placeholder if not in DB yet */}
            <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{t('mission')}</Text>
                <Text style={styles.aboutText}>To provide the best beauty and wellness services with top-tier professionals.</Text>
            </View>

            <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{t('vision')}</Text>
                <Text style={styles.aboutText}>To be the leading salon platform in the region.</Text>
            </View>

            <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{t('location')}</Text>
                <Text style={styles.addressText}>{tenant?.address || 'No address provided.'}</Text>
                <TouchableOpacity style={styles.mapPlaceholder}>
                    <Ionicons name="map" size={32} color={colors.textSecondary} />
                    <Text style={styles.mapText}>{t('viewOnMap')}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{t('workingHours')}</Text>
                <View style={styles.hoursContainer}>
                    {tenant?.workingHours ? Object.entries(tenant.workingHours).map(([day, hours]: [string, any]) => (
                        <View key={day} style={styles.hoursRow}>
                            <Text style={styles.dayText}>{t(day as any) || day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                            <Text style={[styles.timeText, !hours.isOpen && { color: colors.error }]}>
                                {hours.isOpen ? `${hours.open} - ${hours.close}` : t('closed')}
                            </Text>
                        </View>
                    )) : (
                        <Text style={styles.aboutText}>Hours not available.</Text>
                    )}
                </View>
            </View>

            <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{t('contact')}</Text>
                <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={20} color={colors.primary} />
                    <Text style={styles.contactText}>{tenant?.phone || tenant?.mobile || 'N/A'}</Text>
                </View>
                <View style={styles.contactRow}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                    <Text style={styles.contactText}>{tenant?.email || 'N/A'}</Text>
                </View>
                {tenant?.website && (
                    <View style={styles.contactRow}>
                        <Ionicons name="globe-outline" size={20} color={colors.primary} />
                        <Text style={styles.contactText}>{tenant.website}</Text>
                    </View>
                )}
            </View>

            {/* Social Media */}
            <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{t('followUs')}</Text>
                <View style={styles.socialRow}>
                    {tenant?.instagramUrl && (
                        <TouchableOpacity style={styles.socialIcon}>
                            <Ionicons name="logo-instagram" size={24} color="#E1306C" />
                        </TouchableOpacity>
                    )}
                    {tenant?.twitterUrl && (
                        <TouchableOpacity style={styles.socialIcon}>
                            <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                        </TouchableOpacity>
                    )}
                    {tenant?.facebookUrl && (
                        <TouchableOpacity style={styles.socialIcon}>
                            <Ionicons name="logo-facebook" size={24} color="#1877F2" />
                        </TouchableOpacity>
                    )}
                    {/* Add empty state if no socials */}
                    {(!tenant?.instagramUrl && !tenant?.twitterUrl && !tenant?.facebookUrl) && (
                        <Text style={styles.aboutText}>No social media links.</Text>
                    )}
                </View>
            </View>
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {renderHero()}
                {renderTabs()}
                {activeTab === 'services' && renderServices()}
                {activeTab === 'products' && renderProducts()}
                {activeTab === 'reviews' && renderReviews()}
                {activeTab === 'about' && renderAbout()}
            </ScrollView>

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
        marginTop: Platform.OS === 'ios' ? 40 : 20,
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
