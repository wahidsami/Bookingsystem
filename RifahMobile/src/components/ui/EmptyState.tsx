import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, spacing, typography, layout } from '../../theme';
import { AppIcon } from '../AppIcon';
import { AppButton } from './AppButton';

export interface EmptyStateProps {
    icon?: React.ComponentProps<typeof AppIcon>['name'];
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: ViewStyle;
}

export function EmptyState({
    icon = 'sparkles',
    title,
    description,
    actionLabel,
    onAction,
    style,
}: EmptyStateProps) {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.iconCircle}>
                <AppIcon name={icon} size={32} color={colors.brandPrimary} />
            </View>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {description ? (
                <ThemedText style={styles.description}>{description}</ThemedText>
            ) : null}
            {actionLabel && onAction ? (
                <AppButton
                    variant="compact"
                    label={actionLabel}
                    onPress={onAction}
                    style={styles.button}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.surfaceLavender,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.base,
    },
    title: {
        ...typography.sectionTitle,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    description: {
        ...typography.caption,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
        maxWidth: 280,
    },
    button: {
        marginTop: spacing.base,
    },
});
