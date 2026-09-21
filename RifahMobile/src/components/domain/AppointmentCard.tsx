import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';
import { AppBadge } from '../ui/AppBadge';
import { AppButton } from '../ui/AppButton';
import { AppIcon } from '../AppIcon';

export interface AppointmentCardProps {
    id: string;
    salonName: string;
    serviceNames: string[];
    date: string;
    time: string;
    durationMinutes?: number;
    status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled';
    price?: number | string;
    currency?: string;
    onPress?: () => void;
    onAction?: () => void;
    actionLabel?: string;
    style?: ViewStyle;
}

export function AppointmentCard({
    salonName,
    serviceNames = [],
    date,
    time,
    durationMinutes,
    status,
    price,
    currency = 'SAR',
    onPress,
    onAction,
    actionLabel,
    style,
}: AppointmentCardProps) {
    const isCancelled = status === 'cancelled';
    const isCompleted = status === 'completed';

    let badgeVariant: 'success' | 'brand' | 'error' | 'neutral' = 'neutral';
    let badgeText = status.toUpperCase();

    switch (status) {
        case 'confirmed':
        case 'checked_in':
            badgeVariant = 'success';
            badgeText = 'Confirmed';
            break;
        case 'completed':
            badgeVariant = 'neutral';
            badgeText = 'Completed';
            break;
        case 'cancelled':
            badgeVariant = 'error';
            badgeText = 'Cancelled';
            break;
        case 'pending':
        default:
            badgeVariant = 'brand';
            badgeText = 'Pending';
            break;
    }

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isCancelled && styles.cancelledCard,
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            {/* Header: Salon & Status */}
            <View style={styles.header}>
                <View style={styles.salonRow}>
                    <View style={styles.salonIcon}>
                        <AppIcon name="storefront" size={16} color={colors.brandPrimary} />
                    </View>
                    <ThemedText style={styles.salonName} numberOfLines={1}>
                        {salonName}
                    </ThemedText>
                </View>
                <AppBadge label={badgeText} variant={badgeVariant} showDot={status === 'confirmed'} />
            </View>

            {/* Time Banner */}
            <View style={styles.timeBanner}>
                <AppIcon name="calendar_today" size={16} color={colors.brandPrimary} />
                <ThemedText style={styles.timeText}>
                    {date} • {time}
                </ThemedText>
                {durationMinutes ? (
                    <ThemedText style={styles.durationText}>
                        ({durationMinutes} min)
                    </ThemedText>
                ) : null}
            </View>

            {/* Services List */}
            <View style={styles.servicesContainer}>
                {serviceNames.map((svc, index) => (
                    <ThemedText key={index} style={styles.serviceItem} numberOfLines={1}>
                        • {svc}
                    </ThemedText>
                ))}
            </View>

            {/* Footer: Price & Optional Action */}
            <View style={styles.footer}>
                {price ? (
                    <ThemedText style={styles.price}>
                        {price} <ThemedText style={styles.currency}>{currency}</ThemedText>
                    </ThemedText>
                ) : <View />}

                {onAction && actionLabel ? (
                    <AppButton
                        variant={isCompleted ? 'secondary' : 'primary'}
                        label={actionLabel}
                        onPress={onAction}
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
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.base,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    cancelledCard: {
        opacity: 0.6,
        backgroundColor: colors.surfaceAlt,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    salonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.sm,
        gap: spacing.xs,
    },
    salonIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceLavender,
        alignItems: 'center',
        justifyContent: 'center',
    },
    salonName: {
        ...typography.cardTitle,
        color: colors.textPrimary,
        flex: 1,
    },
    timeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLavender,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xs + 2,
        borderRadius: layout.radius.md,
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    timeText: {
        ...typography.caption,
        color: colors.brandPrimaryDark,
        fontWeight: '600',
    },
    durationText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontSize: 11,
    },
    servicesContainer: {
        marginBottom: spacing.md,
    },
    serviceItem: {
        ...typography.caption,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: colors.brand.borderLight,
        paddingTop: spacing.sm,
    },
    price: {
        ...typography.price,
        color: colors.brandPrimary,
    },
    currency: {
        ...typography.currency,
        color: colors.textSecondary,
    },
    actionButton: {
        height: 34,
        paddingHorizontal: spacing.base,
    },
});
