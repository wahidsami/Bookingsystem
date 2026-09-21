import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';
import { AppBadge } from '../ui/AppBadge';
import { AppIcon } from '../AppIcon';

export interface SalonCardProps {
    id: string;
    name: string;
    businessType?: string;
    city?: string;
    logoUrl?: string;
    coverUrl?: string;
    rating?: number;
    reviewCount?: number;
    isOpen?: boolean;
    onPress: () => void;
    style?: ViewStyle;
    variant?: 'vertical' | 'horizontal';
}

export function SalonCard({
    name,
    businessType,
    city,
    logoUrl,
    coverUrl,
    rating = 5.0,
    reviewCount,
    isOpen = true,
    onPress,
    style,
    variant = 'vertical',
}: SalonCardProps) {
    const isHorizontal = variant === 'horizontal';

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isHorizontal ? styles.horizontalCard : styles.verticalCard,
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${businessType || 'Salon'}`}
        >
            {/* Cover Image Area */}
            <View style={isHorizontal ? styles.horizontalCover : styles.verticalCover}>
                {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.image} resizeMode="cover" />
                ) : logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={styles.image} resizeMode="cover" />
                ) : (
                    <View style={styles.placeholderCover}>
                        <AppIcon name="sparkles" size={28} color={colors.brandPrimary} />
                    </View>
                )}

                {/* Rating Badge Overlay */}
                <View style={styles.ratingOverlay}>
                    <AppBadge
                        label={rating ? rating.toFixed(1) : '5.0'}
                        variant="warning"
                        icon="star"
                    />
                </View>
            </View>

            {/* Content Meta */}
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <ThemedText style={styles.name} numberOfLines={1}>
                        {name}
                    </ThemedText>
                    <AppBadge
                        label={isOpen ? 'Open Now' : 'Closed'}
                        variant={isOpen ? 'success' : 'neutral'}
                        showDot
                    />
                </View>

                {businessType ? (
                    <ThemedText style={styles.businessType} numberOfLines={1}>
                        {businessType}
                    </ThemedText>
                ) : null}

                {city ? (
                    <View style={styles.locationRow}>
                        <AppIcon name="map_pin" size={12} color={colors.textSecondary} />
                        <ThemedText style={styles.city} numberOfLines={1}>
                            {city}
                        </ThemedText>
                    </View>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: layout.radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
        ...shadows.sm,
    },
    verticalCard: {
        width: 260,
        marginRight: spacing.md,
    },
    horizontalCard: {
        width: '100%',
        marginBottom: spacing.md,
    },
    verticalCover: {
        height: 130,
        width: '100%',
        backgroundColor: colors.surfaceLavender,
        position: 'relative',
    },
    horizontalCover: {
        height: 160,
        width: '100%',
        backgroundColor: colors.surfaceLavender,
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderCover: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceLavender,
    },
    ratingOverlay: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
    },
    content: {
        padding: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    name: {
        ...typography.cardTitle,
        color: colors.textPrimary,
        flex: 1,
        marginRight: spacing.sm,
    },
    businessType: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
        gap: 4,
    },
    city: {
        ...typography.caption,
        color: colors.textSecondary,
    },
});
