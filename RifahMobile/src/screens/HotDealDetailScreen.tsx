import React from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { HotDeal, getImageUrl } from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useScreenSafeArea } from '../utils/safeArea';

type HotDealDetailRouteProp = RouteProp<{ HotDealDetail: { deal: HotDeal } }, 'HotDealDetail'>;

export function HotDealDetailScreen() {
    const route = useRoute<HotDealDetailRouteProp>();
    const navigation = useNavigation<any>();
    const { deal } = route.params;
    const { isRTL, t } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();

    const title = isRTL ? deal.title_ar : deal.title_en;
    const description = isRTL ? deal.description_ar : deal.description_en;
    const serviceName = deal.service
        ? (isRTL ? deal.service.name_ar : deal.service.name_en)
        : null;
    const tenantName = deal.tenant?.name_ar && isRTL
        ? deal.tenant.name_ar
        : deal.tenant?.name_en ?? deal.tenant?.name ?? '';
    const logoUrl = getImageUrl(deal.tenant?.logo);

    const validUntil = deal.validUntil
        ? new Date(deal.validUntil).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
        : null;

    const savingsPercent = deal.originalPrice > 0
        ? Math.round(((deal.originalPrice - deal.discountedPrice) / deal.originalPrice) * 100)
        : deal.discountValue;

    const spotsLeft = deal.maxRedemptions !== -1
        ? deal.maxRedemptions - deal.currentRedemptions
        : null;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: spacing.lg + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('hotDeals')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Image */}
                {deal.image ? (
                    <Image source={{ uri: getImageUrl(deal.image) }} style={styles.heroImage} resizeMode="cover" />
                ) : null}

                {/* Discount Banner */}
                <View style={styles.banner}>
                    <Text style={styles.bannerSave}>{t('saveDiscount')} {savingsPercent}%</Text>
                    <Text style={styles.bannerTitle}>{title}</Text>
                    {serviceName && <Text style={styles.bannerService}>{serviceName}</Text>}
                </View>

                {/* Tenant Card */}
                {deal.tenant && (
                    <View style={styles.tenantCard}>
                        {logoUrl ? (
                            <Image source={{ uri: logoUrl }} style={styles.tenantLogo} resizeMode="contain" />
                        ) : (
                            <View style={styles.tenantLogoPlaceholder}>
                                <Text style={styles.tenantLogoLetter}>{tenantName.charAt(0)}</Text>
                            </View>
                        )}
                        <Text style={styles.tenantName}>{tenantName}</Text>
                    </View>
                )}

                {/* Pricing */}
                <View style={styles.pricingCard}>
                    <View style={styles.priceRow}>
                        <View>
                            <Text style={styles.priceLabel}>{t('discountedPriceLabel')}</Text>
                            <Text style={styles.discountedPrice}>{deal.discountedPrice.toFixed(2)} SAR</Text>
                        </View>
                        <View style={styles.savingsBadge}>
                            <Text style={styles.savingsText}>
                                {deal.discountType === 'percentage'
                                    ? `-${deal.discountValue}%`
                                    : `-${deal.discountValue} SAR`}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.originalPrice}>
                        {t('originalPriceLabel')} {deal.originalPrice.toFixed(2)} SAR
                    </Text>
                </View>

                {/* Details */}
                <View style={styles.detailsCard}>
                    {validUntil && (
                        <View style={styles.detailRow}>
                            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                            <Text style={styles.detailText}>{t('validUntilLabel')} {validUntil}</Text>
                        </View>
                    )}
                    {spotsLeft !== null && (
                        <View style={styles.detailRow}>
                            <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
                            <Text style={styles.detailText}>{spotsLeft} {t('spotsRemainingLabel')}</Text>
                        </View>
                    )}
                    {deal.service?.duration && (
                        <View style={styles.detailRow}>
                            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                            <Text style={styles.detailText}>{deal.service.duration} {t('minSessionLabel')}</Text>
                        </View>
                    )}
                </View>

                {/* Description */}
                {description ? (
                    <View style={styles.descCard}>
                        <Text style={styles.descTitle}>{t('aboutThisDealLabel')}</Text>
                        <Text style={styles.descText}>{description}</Text>
                    </View>
                ) : null}

                {/* CTA */}
                {deal.tenant && (
                    <TouchableOpacity
                        style={styles.ctaButton}
                        activeOpacity={0.85}
                        onPress={() =>
                            navigation.navigate('Tenant', {
                                tenantId: deal.tenant!.id,
                                slug: deal.tenant!.slug,
                                tenant: deal.tenant,
                                selectedServiceId: deal.service?.id,
                            })
                        }
                    >
                        <Text style={styles.ctaText}>{t('bookAtLabel')} {tenantName}</Text>
                        <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#fff" />
                    </TouchableOpacity>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { padding: spacing.sm },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
    },
    content: { padding: spacing.lg },
    heroImage: {
        width: '100%',
        height: 220,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
    },
    banner: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    bannerSave: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.85)',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        overflow: 'hidden',
    },
    bannerTitle: {
        fontSize: fontSize.xxl,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    bannerService: {
        fontSize: fontSize.md,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
    },
    tenantCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tenantLogo: { width: 48, height: 48, borderRadius: 8 },
    tenantLogoPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tenantLogoLetter: { fontSize: 22, fontWeight: 'bold', color: colors.primary },
    tenantName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
    pricingCard: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    priceLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 2 },
    discountedPrice: { fontSize: 28, fontWeight: '800', color: '#10B981' },
    savingsBadge: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    savingsText: { fontSize: fontSize.md, fontWeight: '700', color: '#DC2626' },
    originalPrice: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        textDecorationLine: 'line-through',
    },
    detailsCard: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.md,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    detailText: { fontSize: fontSize.md, color: colors.text },
    descCard: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    descTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    descText: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22 },
    ctaButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.lg,
        gap: spacing.md,
        marginTop: spacing.md,
        ...Platform.select({
            ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
            android: { elevation: 6 },
        }),
    },
    ctaText: { fontSize: fontSize.lg, fontWeight: '700', color: '#fff' },
});
