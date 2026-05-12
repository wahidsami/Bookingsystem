import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, HotDeal, getImageUrl } from '../../api/client';
import { SkeletonCard } from './SkeletonCard';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;

interface HotDealsCarouselProps {
    navigation: any;
}

export function HotDealsCarousel({ navigation }: HotDealsCarouselProps) {
    const { t, isRTL } = useLanguage();
    const [deals, setDeals] = useState<HotDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => { loadDeals(); }, []);

    const loadDeals = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await api.getHotDeals();
            setDeals(data.slice(0, 8));
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <FlatList
                    horizontal
                    data={[1, 2, 3]}
                    renderItem={() => <SkeletonCard variant="deal" />}
                    keyExtractor={(_, i) => `sk-${i}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <TouchableOpacity onPress={loadDeals} style={styles.retryButton}>
                    <Text style={styles.retryText}>{t('retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (deals.length === 0) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.retryText}>{t('noHotDealsAvailable')}</Text>
            </View>
        );
    }

    const renderDeal = ({ item }: { item: HotDeal }) => {
        const title = isRTL ? item.title_ar : item.title_en;
        const tenantName = isRTL
            ? (item.tenant?.name_ar ?? item.tenant?.name ?? '')
            : (item.tenant?.name_en ?? item.tenant?.name ?? '');
        const savePct = item.originalPrice > 0
            ? Math.round(((item.originalPrice - item.discountedPrice) / item.originalPrice) * 100)
            : item.discountValue;
        const logoUrl = getImageUrl(item.tenant?.logo);
        const imageUrl = getImageUrl(item.image);

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('HotDealDetail', { deal: item })}
            >
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : null}
                <View style={[styles.cardContent, imageUrl ? styles.cardOverlay : styles.cardSolidBg]}>
                    {/* Discount badge */}
                    <View style={styles.saveBadge}>
                        <Text style={styles.saveBadgeText}>-{savePct}%</Text>
                    </View>

                    {/* Tenant logo */}
                    {logoUrl ? (
                        <Image source={{ uri: logoUrl }} style={styles.tenantLogo} resizeMode="contain" />
                    ) : (
                        <View style={styles.tenantLogoPlaceholder}>
                            <Text style={styles.tenantLogoLetter}>{(tenantName || '?').charAt(0)}</Text>
                        </View>
                    )}

                    <Text style={styles.dealTitle} numberOfLines={2}>{title}</Text>
                    <Text style={styles.tenantName} numberOfLines={1}>{tenantName}</Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.discountedPrice}>{item.discountedPrice.toFixed(0)} SAR</Text>
                        <Text style={styles.originalPrice}>{item.originalPrice.toFixed(0)} SAR</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                horizontal
                data={deals}
                renderItem={renderDeal}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                snapToInterval={CARD_WIDTH + spacing.md}
                decelerationRate="fast"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.sm,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
    },
    card: {
        width: CARD_WIDTH,
        height: 180,
        borderRadius: borderRadius.xl,
        marginRight: spacing.md,
        overflow: 'hidden',
    },
    cardContent: {
        flex: 1,
        padding: spacing.lg,
        justifyContent: 'flex-end',
    },
    cardSolidBg: {
        backgroundColor: colors.primary,
    },
    cardOverlay: {
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    saveBadge: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        backgroundColor: '#EF4444',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
    },
    saveBadgeText: {
        color: '#FFF',
        fontSize: fontSize.xs,
        fontWeight: '800',
    },
    tenantLogo: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginBottom: spacing.sm,
    },
    tenantLogoPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    tenantLogoLetter: {
        color: '#FFF',
        fontSize: fontSize.lg,
        fontWeight: '700',
    },
    dealTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 2,
    },
    tenantName: {
        fontSize: fontSize.xs,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: spacing.sm,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    discountedPrice: {
        fontSize: fontSize.lg,
        fontWeight: '800',
        color: '#FFF',
    },
    originalPrice: {
        fontSize: fontSize.sm,
        color: 'rgba(255,255,255,0.6)',
        textDecorationLine: 'line-through',
    },
    errorContainer: {
        alignItems: 'center',
        padding: spacing.md,
    },
    retryButton: {
        backgroundColor: colors.backgroundGray,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    retryText: {
        color: colors.primary,
        fontWeight: '600',
    },
});
