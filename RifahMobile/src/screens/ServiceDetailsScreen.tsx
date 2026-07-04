import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    ScrollView,
    Share,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, getServicePrice, normalizeService, normalizeStaff, Service, ServiceVariant, Staff, Tenant } from '../api/client';
import { colors } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';

type FullService = Service & { employees?: Staff[]; variants?: ServiceVariant[] };

const FAVORITE_SERVICE_IDS_KEY = 'refah_favorite_service_ids_v1';

export function ServiceDetailsScreen({ route, navigation }: any) {
    const { tenant, service, tenantId, bookingSessionId, bookingReference } = route.params;
    const { isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [loading, setLoading] = useState(true);
    const [favorite, setFavorite] = useState(false);
    const [details, setDetails] = useState<FullService | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const id = tenant?.id || tenantId;
                if (!id) throw new Error('Missing tenant id');
                const res = await api.get<{ success: boolean; service: FullService }>(`/public/tenant/${id}/services/${service.id}`);
                if (res.success && res.service) {
                    const normalizedEmployees = Array.isArray(res.service.employees)
                        ? res.service.employees.map((employee) => normalizeStaff(employee))
                        : [];
                    setDetails({
                        ...normalizeService(res.service),
                        employees: normalizedEmployees,
                        variants: res.service.variants || [],
                    });
                } else {
                    setDetails(service);
                }
            } catch {
                setDetails(service);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [service, tenant?.id, tenantId]);

    useEffect(() => {
        let mounted = true;

        const loadFavoriteState = async () => {
            try {
                const raw = await AsyncStorage.getItem(FAVORITE_SERVICE_IDS_KEY);
                const favoriteIds = raw ? JSON.parse(raw) : [];
                if (!mounted) return;
                setFavorite(Array.isArray(favoriteIds) && favoriteIds.includes(service.id));
            } catch {
                if (mounted) {
                    setFavorite(false);
                }
            }
        };

        loadFavoriteState();

        return () => {
            mounted = false;
        };
    }, [service.id]);

    const resolvedService = details || service;
    const serviceName = isRTL ? resolvedService.name_ar : resolvedService.name_en;
    const description = (isRTL ? resolvedService.description_ar : resolvedService.description_en)
        || resolvedService.description_en
        || resolvedService.description_ar
        || '';
    const activeVariants = useMemo<ServiceVariant[]>(
        () => (Array.isArray(resolvedService.variants) ? resolvedService.variants.filter((variant: ServiceVariant) => variant?.isActive !== false) : []),
        [resolvedService.variants]
    );
    const selectedVariant = activeVariants.find((variant: ServiceVariant) => variant.id === selectedVariantId) || null;
    const effectivePrice = getServicePrice(resolvedService, selectedVariant || undefined);
    const effectiveDuration = selectedVariant?.duration || resolvedService.duration;
    const heroUri = useMemo(() => {
        const candidates = [
            (resolvedService as any).image,
            (resolvedService as any).imageUrl,
            (resolvedService as any).thumbnail,
            (resolvedService as any).coverImage,
            ...((resolvedService as any).images && Array.isArray((resolvedService as any).images) ? (resolvedService as any).images : []),
            ...((resolvedService as any).media && Array.isArray((resolvedService as any).media) ? (resolvedService as any).media : []),
            tenant?.coverImage,
            tenant?.logo,
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
            const resolved = getImageUrl(candidate) || candidate;
            if (resolved && `${resolved}`.trim()) return resolved;
        }

        return 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=1800&auto=format&fit=crop';
    }, [resolvedService, tenant?.coverImage, tenant?.logo]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: `${serviceName} - ${tenant?.name || 'Refah'}\n${description}`,
            });
        } catch {}
    };

    const handleToggleFavorite = async () => {
        const nextFavorite = !favorite;
        setFavorite(nextFavorite);

        try {
            const raw = await AsyncStorage.getItem(FAVORITE_SERVICE_IDS_KEY);
            const favoriteIds = Array.isArray(raw ? JSON.parse(raw) : []) ? (raw ? JSON.parse(raw) : []) : [];
            const normalizedIds = new Set<string>(
                favoriteIds.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
            );

            if (nextFavorite) {
                normalizedIds.add(service.id);
            } else {
                normalizedIds.delete(service.id);
            }

            await AsyncStorage.setItem(FAVORITE_SERVICE_IDS_KEY, JSON.stringify(Array.from(normalizedIds)));
        } catch (error) {
            console.warn('Failed to update favorite service state:', error);
        }
    };

    const handleBook = (provider?: Staff | null, variant?: ServiceVariant | null) => {
        navigation.navigate('Booking', {
            service: resolvedService,
            tenant,
            selectedStaff: provider || undefined,
            selectedVariant: variant || selectedVariant || undefined,
            bookingSessionId: bookingSessionId || undefined,
            bookingReference: bookingReference || undefined,
        });
    };

    return (
        <View style={styles.root}>
            <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: Math.max(scrollBottomPadding, 120) }}>
                <ImageBackground source={{ uri: heroUri }} style={styles.hero}>
                    <LinearGradient colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.52)']} style={styles.heroShade}>
                        <View style={[styles.heroTopRow, { marginTop: topInset + 6 }]}>
                            <TouchableOpacity style={styles.glassButton} onPress={() => navigation.goBack()}>
                                <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
                            </TouchableOpacity>
                            <View style={styles.heroActions}>
                                <TouchableOpacity style={styles.glassButton} onPress={handleShare}>
                                    <AppIcon name="share" size={18} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.glassButton} onPress={handleToggleFavorite}>
                                    <AppIcon name="star" size={18} color={favorite ? colors.primary : colors.text} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                <View style={styles.contentCard}>
                    {loading ? (
                        <View style={styles.loaderWrap}>
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : (
                        <>
                            <Text style={styles.title}>{serviceName}</Text>
                            <Text style={styles.subtitle}>{description || (isRTL ? 'تفاصيل الخدمة ستتوفر قريباً.' : 'Service details will appear soon.')}</Text>

                            <View style={styles.chipsRow}>
                                <View style={styles.chip}>
                                    <AppIcon name="clock" size={14} color={colors.primary} />
                                    <Text style={styles.chipText}>{effectiveDuration} {isRTL ? 'دقيقة' : 'min'}</Text>
                                </View>
                                <View style={styles.chip}>
                                    <AppIcon name="cash" size={14} color={colors.primary} />
                                    <Text style={styles.chipText}>{formatRiyal(effectivePrice, isRTL ? 'ar' : 'en')}</Text>
                                </View>
                                <View style={styles.chip}>
                                    <AppIcon name="card" size={14} color={colors.primary} />
                                    <Text style={styles.chipText}>{isRTL ? 'دفع بالمركز' : 'Pay at center'}</Text>
                                </View>
                            </View>

                            {activeVariants.length > 0 ? (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>{isRTL ? 'اختر النسخة' : 'Choose a variant'}</Text>
                                    {activeVariants.map((variant: ServiceVariant) => {
                                        const isSelected = variant.id === selectedVariant?.id;
                                        return (
                                            <TouchableOpacity
                                                key={variant.id}
                                                style={[styles.variantCard, isSelected ? styles.variantCardSelected : null]}
                                                onPress={() => setSelectedVariantId(variant.id)}
                                            >
                                                <View style={styles.variantMain}>
                                                    <Text style={styles.variantName}>{variant.description || (isRTL ? 'نسخة' : 'Variant')}</Text>
                                                    <Text style={styles.variantMeta}>
                                                        {(variant.duration || resolvedService.duration)} {isRTL ? 'دقيقة' : 'min'} • {formatRiyal(getServicePrice(resolvedService, variant), isRTL ? 'ar' : 'en')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity style={styles.variantBtn} onPress={() => handleBook(undefined, variant)}>
                                                    <Text style={styles.variantBtnText}>{isRTL ? 'احجز' : 'Book'}</Text>
                                                </TouchableOpacity>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : null}

                            {(resolvedService.employees || []).length > 0 ? (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>{isRTL ? 'مقدمو الخدمة' : 'Providers'}</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providersRow}>
                                        {(resolvedService.employees || []).map((provider: Staff) => {
                                            const avatar = getImageUrl(provider.avatar || provider.image);
                                            return (
                                                <View key={provider.id} style={styles.providerCard}>
                                                    {avatar ? (
                                                        <Image source={{ uri: avatar }} style={styles.providerAvatar} />
                                                    ) : (
                                                        <View style={styles.providerAvatarFallback}>
                                                            <Text style={styles.providerAvatarText}>{provider.name?.charAt(0) || '?'}</Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
                                                    <Text style={styles.providerRole} numberOfLines={1}>{provider.specialty || provider.role || (isRTL ? 'متخصص' : 'Specialist')}</Text>
                                                    <TouchableOpacity style={styles.providerBtn} onPress={() => navigation.navigate('EmployeeProfile', { provider })}>
                                                        <Text style={styles.providerBtnText}>{isRTL ? 'عرض الملف' : 'View profile'}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.providerBookBtn} onPress={() => handleBook(provider, null)}>
                                                        <Text style={styles.providerBookBtnText}>{isRTL ? 'احجز معه' : 'Book'}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            ) : null}
                        </>
                    )}
                </View>
            </ScrollView>

            <View style={[styles.stickyBar, { paddingBottom: Math.max(scrollBottomPadding, 14) }]}>
                <TouchableOpacity style={styles.cartBtn} onPress={() => handleBook()}>
                    <AppIcon name="bookings" size={16} color={colors.primary} />
                    <Text style={styles.cartBtnText}>{isRTL ? 'ابدأ الحجز' : 'Start booking'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bookBtn} onPress={() => handleBook()}>
                    <Text style={styles.bookBtnText}>{isRTL ? 'احجز الآن' : 'Book now'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F7F6FB' },
    hero: { height: 320, justifyContent: 'space-between' },
    heroShade: { flex: 1, paddingHorizontal: 16 },
    heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroActions: { flexDirection: 'row', gap: 10 },
    glassButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentCard: {
        backgroundColor: '#FFF',
        marginTop: -24,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 18,
        gap: 16,
    },
    loaderWrap: { paddingVertical: 40, alignItems: 'center' },
    title: { fontSize: 32, fontWeight: '800', color: '#131333' },
    subtitle: { fontSize: 18, color: '#667085', lineHeight: 27 },
    chipsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#F3EEFF',
    },
    chipText: { color: '#3F3F65', fontSize: 14, fontWeight: '700' },
    section: { gap: 12 },
    sectionTitle: { fontSize: 28, fontWeight: '800', color: '#19193E' },
    variantCard: {
        borderWidth: 1,
        borderColor: '#E6DFFE',
        borderRadius: 18,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
    },
    variantCardSelected: { borderColor: colors.primary, backgroundColor: '#FAF7FF' },
    variantMain: { flex: 1, gap: 4 },
    variantName: { fontSize: 17, fontWeight: '700', color: '#17173A' },
    variantMeta: { fontSize: 14, color: '#6B6B8C' },
    variantBtn: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#CDB8FF',
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    variantBtnText: { color: colors.primary, fontWeight: '700' },
    providersRow: { gap: 12, paddingRight: 4 },
    providerCard: {
        width: 168,
        borderRadius: 22,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#F0EBFF',
        padding: 12,
        gap: 8,
    },
    providerAvatar: { width: 58, height: 58, borderRadius: 29 },
    providerAvatarFallback: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#EEE8FF', justifyContent: 'center', alignItems: 'center' },
    providerAvatarText: { color: colors.primary, fontSize: 20, fontWeight: '700' },
    providerName: { fontSize: 16, fontWeight: '700', color: '#1A1A3E' },
    providerRole: { fontSize: 13, color: '#757597' },
    providerBtn: { borderRadius: 16, borderWidth: 1, borderColor: '#D7C8FF', paddingVertical: 8, alignItems: 'center' },
    providerBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    providerBookBtn: { borderRadius: 16, backgroundColor: colors.primary, paddingVertical: 9, alignItems: 'center' },
    providerBookBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    stickyBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        gap: 10,
        backgroundColor: '#FFF',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        paddingHorizontal: 14,
        paddingTop: 12,
        shadowColor: '#0F0C28',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 10,
    },
    cartBtn: {
        flex: 1,
        height: 54,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#D8C8FF',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#FFF',
    },
    cartBtnText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
    bookBtn: {
        flex: 1,
        height: 54,
        borderRadius: 18,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    bookBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
