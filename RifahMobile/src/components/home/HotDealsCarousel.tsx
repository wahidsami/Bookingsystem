import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRiyal } from '../../utils/currency';
import { api, HotDeal, getImageUrl } from '../../api/client';
import { SkeletonCard } from './SkeletonCard';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - spacing.lg * 2;

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
                    inverted={isRTL}
                    data={[1, 2]}
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
        return null; // Gracefully hide when no deals exist
    }

    const renderDeal = ({ item }: { item: HotDeal }) => {
        const title = isRTL ? item.title_ar : item.title_en;
        const tenantName = isRTL
            ? (item.tenant?.name_ar ?? item.tenant?.name ?? '')
            : (item.tenant?.name_en ?? item.tenant?.name ?? '');
        const savePct = item.originalPrice > 0
            ? Math.round(((item.originalPrice - item.discountedPrice) / item.originalPrice) * 100)
            : item.discountValue;
        const imageUrl = getImageUrl(item.image);

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    isRTL ? styles.cardRTL : styles.cardLTR,
                    { width: deals.length > 1 ? width * 0.85 : CARD_WIDTH }
                ]}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('HotDealDetail', { deal: item })}
            >
                {/* Background Deal Image */}
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                    <View style={[StyleSheet.absoluteFillObject, styles.placeholderBg]} />
                )}

                {/* Dark Vignette Overlay for legible text hierarchy */}
                <LinearGradient
                    colors={['transparent', 'rgba(29, 3, 95, 0.45)', 'rgba(29, 3, 95, 0.92)']}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Top Discount Badge (-25%) */}
                <View style={[styles.saveBadge, isRTL ? { left: spacing.md } : { right: spacing.md }]}>
                    <Text style={styles.saveBadgeText}>-{savePct}%</Text>
                </View>

                {/* Essential Information on the Card */}
                <View style={[styles.cardInfo, isRTL && styles.cardInfoRTL]}>
                    <Text style={styles.dealTag}>
                        {isRTL ? 'عرض خاص' : 'HOT DEAL'}
                    </Text>
                    <Text style={styles.dealTitle} numberOfLines={1}>
                        {tenantName || title}
                    </Text>
                    {tenantName && title && tenantName !== title ? (
                        <Text style={styles.dealSubtitle} numberOfLines={1}>
                            {title}
                        </Text>
                    ) : null}

                    {/* Pricing Row */}
                    <View style={[styles.priceRow, isRTL && styles.priceRowRTL]}>
                        <View style={styles.discountedPriceContainer}>
                            <Text style={styles.discountedPrice}>
                                {formatRiyal(item.discountedPrice, isRTL ? 'ar' : 'en')}
                            </Text>
                        </View>
                        {item.originalPrice > item.discountedPrice ? (
                            <Text style={styles.originalPrice}>
                                {formatRiyal(item.originalPrice, isRTL ? 'ar' : 'en')}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                horizontal
                inverted={isRTL}
                data={deals}
                renderItem={renderDeal}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                snapToInterval={(deals.length > 1 ? width * 0.85 : CARD_WIDTH) + spacing.md}
                decelerationRate="fast"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.xs,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
    },
    card: {
        height: 176,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(231, 221, 252, 0.6)',
        backgroundColor: '#1D035F',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        position: 'relative',
    },
    cardLTR: {
        marginRight: spacing.md,
    },
    cardRTL: {
        marginLeft: spacing.md,
    },
    cardInfoRTL: {
        alignItems: 'flex-end',
    },
    placeholderBg: {
        backgroundColor: '#2D1470',
    },
    saveBadge: {
        position: 'absolute',
        top: spacing.md,
        backgroundColor: '#FF4D4F',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
    },
    saveBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    cardInfo: {
        position: 'absolute',
        bottom: spacing.md,
        left: spacing.md,
        right: spacing.md,
    },
    dealTag: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(231, 221, 252, 0.9)',
        letterSpacing: 0.8,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    dealTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        lineHeight: 22,
    },
    dealSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 2,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.sm,
        marginTop: 6,
    },
    priceRowRTL: {
        flexDirection: 'row-reverse',
    },
    discountedPriceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    discountedPrice: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    originalPrice: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        textDecorationLine: 'line-through',
        fontWeight: '500',
    },
    errorContainer: {
        alignItems: 'center',
        padding: spacing.md,
    },
    retryButton: {
        backgroundColor: '#FAF9FC',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    retryText: {
        color: colors.primary,
        fontWeight: '600',
    },
});
