import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';
import { Avatar } from '../ui/Avatar';
import { AppIcon } from '../AppIcon';

export interface StaffCardProps {
    id: string;
    name: string;
    role?: string;
    avatarUrl?: string | null;
    rating?: number;
    isSelected?: boolean;
    isAvailable?: boolean;
    onSelect: () => void;
    style?: ViewStyle;
}

export function StaffCard({
    name,
    role = 'Specialist',
    avatarUrl,
    rating = 5.0,
    isSelected = false,
    isAvailable = true,
    onSelect,
    style,
}: StaffCardProps) {
    return (
        <TouchableOpacity
            style={[
                styles.card,
                isSelected && styles.selectedCard,
                !isAvailable && styles.disabledCard,
                style,
            ]}
            onPress={onSelect}
            disabled={!isAvailable}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled: !isAvailable }}
        >
            <View style={styles.content}>
                {/* Left: Avatar with Ring */}
                <Avatar
                    uri={avatarUrl}
                    name={name}
                    size={48}
                    ringColor={isSelected ? colors.brandPrimary : colors.borderSubtle}
                />

                {/* Center: Name, Role, Rating */}
                <View style={styles.info}>
                    <ThemedText style={styles.name} numberOfLines={1}>
                        {name}
                    </ThemedText>
                    <ThemedText style={styles.role} numberOfLines={1}>
                        {role}
                    </ThemedText>
                    {rating ? (
                        <View style={styles.ratingRow}>
                            <AppIcon name="star" size={12} color="#F59E0B" />
                            <ThemedText style={styles.ratingText}>
                                {rating.toFixed(1)}
                            </ThemedText>
                        </View>
                    ) : null}
                </View>

                {/* Right: Radio Selection Check */}
                <View style={styles.selectionCol}>
                    <View
                        style={[
                            styles.radioCircle,
                            isSelected && styles.radioSelected,
                        ]}
                    >
                        {isSelected ? (
                            <View style={styles.radioInner} />
                        ) : null}
                    </View>
                </View>
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
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.sm,
    },
    selectedCard: {
        borderColor: colors.brandPrimary,
        backgroundColor: colors.surfaceLavender,
    },
    disabledCard: {
        opacity: 0.5,
        backgroundColor: colors.surfaceAlt,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    info: {
        flex: 1,
        marginLeft: spacing.md,
    },
    name: {
        ...typography.cardTitle,
        color: colors.textPrimary,
    },
    role: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    ratingText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    selectionCol: {
        marginLeft: spacing.md,
    },
    radioCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: colors.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    radioSelected: {
        borderColor: colors.brandPrimary,
        backgroundColor: colors.brandPrimary,
    },
    radioInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.textInverse,
    },
});
