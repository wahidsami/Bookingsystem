import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, getServicePrice, normalizeService, Service, Tenant } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';

interface ServiceBrowserProps {
  route: any;
  navigation: any;
}

const FALLBACK_HERO = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2400&auto=format&fit=crop';

export function ServiceBrowserScreen({ route, navigation }: ServiceBrowserProps) {
  const { tenantId, slug, tenant: initialTenant, bookingSessionId, bookingReference } = route.params || {};
  const { isRTL } = useLanguage();
  const { topInset, scrollBottomPadding } = useScreenSafeArea();

  const [tenant, setTenant] = useState<Tenant | null>(initialTenant || null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [serviceImageErrors, setServiceImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        let resolvedTenant: Tenant | null = initialTenant || null;

        if (!resolvedTenant && slug) {
          const tenantRes = await api.get<{ success: boolean; data: Tenant }>(`/public/tenant/${slug}`);
          if (tenantRes.success && tenantRes.data) {
            resolvedTenant = tenantRes.data;
            setTenant(tenantRes.data);
          }
        }

        const idToFetch = tenantId || resolvedTenant?.id;
        if (!idToFetch) {
          throw new Error('Tenant information is missing.');
        }

        const servicesRes = await api.get<{ success: boolean; services: Service[] }>(`/public/tenant/${idToFetch}/services`);
        if (servicesRes.success) {
          setServices((servicesRes.services || []).map((service) => normalizeService(service)));
        } else {
          setServices([]);
        }
      } catch (error) {
        console.error('Failed to load service browser:', error);
        setServices([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [initialTenant, slug, tenantId]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    return services
      .map((service: Service) => `${service.category || 'General'}`.trim())
      .filter((category: string) => {
        const key = category.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [services]);

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return services.filter((service: Service) => {
      const category = `${service.category || 'General'}`.trim();
      const name = isRTL ? service.name_ar : service.name_en;
      const description = (isRTL ? service.description_ar : service.description_en)
        || service.description_en
        || service.description_ar
        || '';
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesSearch = !normalizedSearch
        || name?.toLowerCase().includes(normalizedSearch)
        || description.toLowerCase().includes(normalizedSearch)
        || category.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, isRTL, search, services]);

  const openServiceDetails = (service: Service) => {
    navigation.navigate('ServiceDetails', {
      tenant,
      tenantId: tenant?.id || tenantId,
      service,
      bookingSessionId: bookingSessionId || null,
      bookingReference: bookingReference || null,
    });
  };

  const resolveServiceImageUri = (service: Service) => {
    const candidates = [
      service.image,
      service.imageUrl,
      service.thumbnail,
      service.coverImage,
      ...(Array.isArray(service.images) ? service.images : []),
      ...(Array.isArray(service.media) ? service.media : []),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      const resolved = getImageUrl(candidate) || candidate;
      if (resolved && `${resolved}`.trim()) return resolved;
    }

    return null;
  };

  const renderServiceCard = (service: Service) => {
    const serviceName = isRTL ? service.name_ar : service.name_en;
    const serviceDescription = (isRTL ? service.description_ar : service.description_en)
      || service.description_en
      || service.description_ar
      || '';
    const serviceImage = resolveServiceImageUri(service);

    return (
      <TouchableOpacity
        key={service.id}
        style={styles.serviceCard}
        activeOpacity={0.92}
        onPress={() => openServiceDetails(service)}
      >
        <View style={styles.serviceCardMediaWrap}>
          {serviceImage && !serviceImageErrors[service.id] ? (
            <Image
              source={{ uri: serviceImage }}
              style={styles.serviceCardImage}
              onError={() => setServiceImageErrors((prev) => ({ ...prev, [service.id]: true }))}
            />
          ) : (
            <LinearGradient colors={['#8B5CF6', '#A78BFA']} style={styles.serviceCardImageFallback}>
              <Text style={styles.serviceCardImageFallbackText}>
                {(serviceName || 'S').charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </View>

        <View style={styles.serviceCardBody}>
          <View style={styles.serviceCardHeaderRow}>
            <Text style={styles.serviceName} numberOfLines={1}>
              {serviceName}
            </Text>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText} numberOfLines={1}>
                {service.category || (isRTL ? 'عام' : 'General')}
              </Text>
            </View>
          </View>

          {serviceDescription ? (
            <Text style={styles.serviceDescription} numberOfLines={2}>
              {serviceDescription}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <AppIcon name="clock" size={12} color={colors.primary} />
              <Text style={styles.metaText}>
                {service.duration} {isRTL ? 'دقيقة' : 'min'}
              </Text>
            </View>
            <Text style={styles.priceText}>{formatRiyal(getServicePrice(service), isRTL ? 'ar' : 'en')}</Text>
          </View>

          <TouchableOpacity style={styles.bookButton} onPress={() => openServiceDetails(service)}>
            <Text style={styles.bookButtonText}>{isRTL ? 'احجزي الآن' : 'Book'}</Text>
            <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollBottomPadding + 120 }}>
        <ImageBackground source={{ uri: tenant?.coverImage ? getImageUrl(tenant.coverImage) || FALLBACK_HERO : FALLBACK_HERO }} style={styles.hero}>
          <LinearGradient colors={['rgba(17, 24, 39, 0.18)', 'rgba(17, 24, 39, 0.64)']} style={styles.heroOverlay}>
            <View style={[styles.heroTopRow, { marginTop: topInset + 8 }]}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.heroBadge}>
                <AppIcon name="sparkles" size={14} color={colors.primary} />
                <Text style={styles.heroBadgeText}>{isRTL ? 'دليل الخدمات' : 'Service browser'}</Text>
              </View>
            </View>

            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>{isRTL ? 'كل الخدمات في مكان واحد' : 'All services in one place'}</Text>
              <Text style={styles.heroSubtitle}>
                {isRTL
                  ? 'اختاري الخدمة المناسبة لك ثم انتقلي مباشرةً إلى صفحة الحجز.'
                  : 'Choose the right service and jump straight into booking.'}
              </Text>
            </View>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.contentWrap}>
          <View style={styles.searchCard}>
            <AppIcon name="search" size={18} color="#7F86A6" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isRTL ? 'ابحثي عن خدمة...' : 'Search services...'}
              placeholderTextColor="#7F86A6"
              style={[styles.searchInput, isRTL ? styles.searchInputRtl : null]}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            <TouchableOpacity
              style={[styles.categoryChip, activeCategory === 'all' ? styles.categoryChipActive : null]}
              onPress={() => setActiveCategory('all')}
            >
              <Text style={[styles.categoryChipText, activeCategory === 'all' ? styles.categoryChipTextActive : null]}>
                {isRTL ? 'الكل' : 'All'}
              </Text>
            </TouchableOpacity>
            {categories.map((category) => {
              const active = activeCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryChip, active ? styles.categoryChipActive : null]}
                  onPress={() => setActiveCategory(category)}
                >
                  <Text style={[styles.categoryChipText, active ? styles.categoryChipTextActive : null]}>{category}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <AppIcon name="event" size={13} color={colors.primary} />
              <Text style={styles.summaryText}>{filteredServices.length} {isRTL ? 'خدمة' : 'services'}</Text>
            </View>
            <View style={styles.summaryPill}>
              <AppIcon name="sparkles" size={13} color={colors.primary} />
              <Text style={styles.summaryText}>{categories.length} {isRTL ? 'فئة' : 'categories'}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : filteredServices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{isRTL ? 'لا توجد خدمات مطابقة' : 'No matching services'}</Text>
              <Text style={styles.emptySubtitle}>
                {isRTL
                  ? 'جرّبي تغيير الفئة أو البحث لعرض خدمات أخرى.'
                  : 'Try a different category or search term to discover more services.'}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filteredServices.map(renderServiceCard)}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F3FB',
  },
  hero: {
    height: 280,
    width: '100%',
  },
  heroOverlay: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  heroBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.primary,
  },
  heroTextBlock: {
    gap: 10,
    maxWidth: 320,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.92)',
  },
  contentWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  searchCard: {
    minHeight: 52,
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE6F8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: 10,
    textAlign: 'left',
  },
  searchInputRtl: {
    textAlign: 'right',
  },
  categoryRow: {
    gap: 10,
    paddingVertical: 2,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E7DDF8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE5FA',
  },
  summaryText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.primary,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  emptyState: {
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE6F8',
    padding: spacing.lg,
    gap: 8,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  list: {
    gap: 14,
    paddingBottom: spacing.md,
  },
  serviceCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE5F8',
    shadowColor: '#1E1B2E',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  serviceCardMediaWrap: {
    height: 180,
    backgroundColor: '#F1EDF8',
  },
  serviceCardImage: {
    width: '100%',
    height: '100%',
  },
  serviceCardImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCardImageFallbackText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  serviceCardBody: {
    padding: spacing.lg,
    gap: 12,
  },
  serviceCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  serviceName: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '900',
    color: colors.text,
  },
  categoryPill: {
    borderRadius: 999,
    backgroundColor: '#F5EEFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryPillText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.primary,
  },
  serviceDescription: {
    fontSize: fontSize.sm,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F7F1FF',
  },
  metaText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.primary,
  },
  priceText: {
    fontSize: fontSize.md,
    fontWeight: '900',
    color: colors.text,
  },
  bookButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bookButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
