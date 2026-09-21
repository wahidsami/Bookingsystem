import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';
import { AppIcon } from '../AppIcon';
import { AppButton } from '../ui/AppButton';

export interface ProductCardProps {
    id: string;
    name: string;
    brand?: string;
    price: number | string;
    imageUrl?: string;
    rating?: number;
    onPress?: () => void;
    onAddToCart?: () => void;
    style?: ViewStyle;
    currency?: string;
}

export function ProductCard({
    name,
    brand,
    price,
    imageUrl,
    rating = 5.0,
    onPress,
    onAddToCart,
    style,
    currency = 'SAR',
}: ProductCardProps) {
    return (
        <TouchableOpacity
            style={[styles.card, style]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            {/* Product Image */}
            <View style={styles.imageContainer}>
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
                ) : (
                    <View style={styles.placeholderImage}>
                        <AppIcon name="shopping_bag" size={28} color={colors.brandPrimary} />
                    </View>
                )}

                {rating ? (
                    <View style={styles.ratingBadge}>
                        <AppIcon name="star" size={11} color="#F59E0B" />
                        <ThemedText style={styles.ratingText}>{rating.toFixed(1)}</ThemedText>
                    </View>
                ) : null}
            </View>

            {/* Info & Cart Action */}
            <View style={styles.content}>
                {brand ? (
                    <ThemedText style={styles.brand} numberOfLines={1}>
                        {brand}
                    </ThemedText>
                ) : null}

                <ThemedText style={styles.name} numberOfLines={2}>
                    {name}
                </ThemedText>

                <View style={styles.bottomRow}>
                    <ThemedText style={styles.price}>
                        {price} <ThemedText style={styles.currency}>{currency}</ThemedText>
                    </ThemedText>

                    {onAddToCart ? (
                        <AppButton
                            variant="compact"
                            label="+ Cart"
                            onPress={onAddToCart}
                            style={styles.cartButton}
                        />
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: 170,
        backgroundColor: colors.surface,
        borderRadius: layout.radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
        marginBottom: spacing.md,
        marginRight: spacing.md,
        ...shadows.sm,
    },
    imageContainer: {
        width: '100%',
        height: 120,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    image: {
        width: '85%',
        height: '85%',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceLavender,
    },
    ratingBadge: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: colors.surface,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: layout.radius.pill,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    ratingText: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    content: {
        padding: spacing.sm + 2,
    },
    brand: {
        ...typography.caption,
        color: colors.textSecondary,
        fontSize: 11,
        marginBottom: 2,
    },
    name: {
        ...typography.captionStrong,
        color: colors.textPrimary,
        height: 36,
        lineHeight: 18,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
    price: {
        ...typography.cardTitle,
        color: colors.brandPrimary,
    },
    currency: {
        ...typography.currency,
        color: colors.textSecondary,
        fontSize: 11,
    },
    cartButton: {
        height: 28,
        paddingHorizontal: spacing.sm,
    },
});
