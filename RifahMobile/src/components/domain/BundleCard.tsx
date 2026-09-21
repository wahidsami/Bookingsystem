import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';
import { AppBadge } from '../ui/AppBadge';
import { AppButton } from '../ui/AppButton';
import { AppIcon } from '../AppIcon';

export interface BundleCardProps {
    id: string;
    title: string;
    description?: string;
    price: number | string;
    originalPrice?: number | string;
    durationMinutes?: number;
    serviceCount?: number;
    isParallel?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    onPress?: () => void;
    style?: ViewStyle;
    currency?: string;
}

export function BundleCard({
    title,
    description,
    price,
    originalPrice,
    durationMinutes,
    serviceCount,
    isParallel = false,
    isSelected = false,
    onSelect,
    onPress,
    style,
    currency = 'SAR',
}: BundleCardProps) {
    const hasDiscount = originalPrice && Number(originalPrice) > Number(price);

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isSelected && styles.selectedCard,
                style,
            ]}
            onPress={onPress || onSelect}
            activeOpacity={0.85}
        >
            {/* Top Badges Row */}
            <View style={styles.topRow}>
                <View style={styles.badgeGroup}>
                    <AppBadge
                        label={isParallel ? 'Parallel Bundle' : 'Package Deal'}
                        variant="brand"
                        icon="sparkles"
                    />
                    {hasDiscount ? (
                        <AppBadge
                            label="Discounted"
                            variant="success"
                        />
                    ) : null}
                </View>

                {durationMinutes ? (
                    <View style={styles.durationBadge}>
                        <AppIcon name="clock" size={12} color={colors.brandPrimary} />
                        <ThemedText style={styles.durationText}>
                            {durationMinutes} min
                        </ThemedText>
                    </View>
                ) : null}
            </View>

            {/* Title & Description */}
            <ThemedText style={styles.title} numberOfLines={2}>
                {title}
            </ThemedText>

            {description ? (
                <ThemedText style={styles.description} numberOfLines={2}>
                    {description}
                </ThemedText>
            ) : null}

            {/* Bottom Row: Service Count & Pricing + CTA */}
            <View style={styles.bottomRow}>
                <View style={styles.priceContainer}>
                    <View style={styles.priceRow}>
                        <ThemedText style={styles.price}>
                            {price} <ThemedText style={styles.currency}>{currency}</ThemedText>
                        </ThemedText>

                        {hasDiscount ? (
                            <ThemedText style={styles.originalPrice}>
                                {originalPrice} {currency}
                            </ThemedText>
                        ) : null}
                    </View>

                    {serviceCount ? (
                        <ThemedText style={styles.serviceCount}>
                            Includes {serviceCount} services
                        </ThemedText>
                    ) : null}
                </View>

                {onSelect ? (
                    <AppButton
                        variant={isSelected ? 'primary' : 'secondary'}
                        label={isSelected ? 'Selected' : 'Book Package'}
                        onPress={onSelect}
                        style={styles.actionButton}
                    />
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: layout.radius.lg,
        borderWidth: 1.5,
        borderColor: colors.borderSubtle,
        padding: spacing.base,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    selectedCard: {
        borderColor: colors.brandPrimary,
        backgroundColor: colors.surfaceLavender,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    badgeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    durationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: layout.radius.pill,
        backgroundColor: colors.surfaceLavender,
    },
    durationText: {
        ...typography.caption,
        color: colors.brandPrimary,
        fontSize: 11,
        fontWeight: '600',
    },
    title: {
        ...typography.cardTitle,
        color: colors.textPrimary,
        marginBottom: 4,
    },
    description: {
        ...typography.caption,
        color: colors.textSecondary,
        marginBottom: spacing.md,
        lineHeight: 18,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: colors.brand.borderLight,
        paddingTop: spacing.sm,
    },
    priceContainer: {
        flex: 1,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.sm,
    },
    price: {
        ...typography.price,
        fontSize: 18,
        color: colors.brandPrimary,
    },
    currency: {
        ...typography.currency,
        color: colors.textSecondary,
    },
    originalPrice: {
        ...typography.caption,
        color: colors.textTertiary,
        textDecorationLine: 'line-through',
    },
    serviceCount: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
    actionButton: {
        height: 36,
        paddingHorizontal: spacing.base,
    },
});
