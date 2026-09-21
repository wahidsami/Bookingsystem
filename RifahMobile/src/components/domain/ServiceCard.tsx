import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';
import { AppButton } from '../ui/AppButton';
import { AppIcon } from '../AppIcon';

export interface ServiceCardProps {
    id: string;
    title: string;
    description?: string;
    price: number | string;
    durationMinutes?: number;
    imageUrl?: string;
    isSelected?: boolean;
    onSelect?: () => void;
    onPress?: () => void;
    style?: ViewStyle;
    currency?: string;
}

export function ServiceCard({
    title,
    description,
    price,
    durationMinutes,
    imageUrl,
    isSelected = false,
    onSelect,
    onPress,
    style,
    currency = 'SAR',
}: ServiceCardProps) {
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
            <View style={styles.content}>
                {/* Left/Main Column: Title, Description, Duration, Price */}
                <View style={styles.infoCol}>
                    <ThemedText style={styles.title} numberOfLines={2}>
                        {title}
                    </ThemedText>

                    {description ? (
                        <ThemedText style={styles.description} numberOfLines={2}>
                            {description}
                        </ThemedText>
                    ) : null}

                    <View style={styles.metaRow}>
                        {durationMinutes ? (
                            <View style={styles.durationBadge}>
                                <AppIcon name="clock" size={12} color={colors.textSecondary} />
                                <ThemedText style={styles.durationText}>
                                    {durationMinutes} min
                                </ThemedText>
                            </View>
                        ) : null}

                        <ThemedText style={styles.price}>
                            {price} <ThemedText style={styles.currency}>{currency}</ThemedText>
                        </ThemedText>
                    </View>
                </View>

                {/* Right Column: Image & Select Button */}
                <View style={styles.actionCol}>
                    {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />
                    ) : (
                        <View style={styles.placeholderThumb}>
                            <AppIcon name="sparkles" size={20} color={colors.brandPrimary} />
                        </View>
                    )}

                    {onSelect ? (
                        <AppButton
                            variant={isSelected ? 'primary' : 'secondary'}
                            label={isSelected ? 'Selected' : 'Select'}
                            onPress={onSelect}
                            style={styles.selectButton}
                        />
                    ) : null}
                </View>
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
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    selectedCard: {
        borderColor: colors.brandPrimary,
        backgroundColor: colors.surfaceLavender,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    infoCol: {
        flex: 1,
    },
    title: {
        ...typography.cardTitle,
        color: colors.textPrimary,
        marginBottom: 4,
    },
    description: {
        ...typography.caption,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        lineHeight: 18,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: 2,
    },
    durationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: layout.radius.pill,
        backgroundColor: colors.surfaceAlt,
    },
    durationText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontSize: 11,
    },
    price: {
        ...typography.price,
        color: colors.brandPrimary,
    },
    currency: {
        ...typography.currency,
        color: colors.textSecondary,
    },
    actionCol: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    thumbnail: {
        width: 72,
        height: 72,
        borderRadius: layout.radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    placeholderThumb: {
        width: 72,
        height: 72,
        borderRadius: layout.radius.md,
        backgroundColor: colors.surfaceLavender,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    selectButton: {
        height: 32,
        paddingHorizontal: spacing.md,
    },
});
