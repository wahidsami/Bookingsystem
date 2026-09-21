import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../ThemedText';
import { colors, spacing, typography, layout } from '../../theme';
import { AppButton } from './AppButton';

export interface BottomActionBarProps {
    title?: string;
    subtitle?: string;
    actionLabel: string;
    onAction: () => void;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    leftSlot?: React.ReactNode;
}

export function BottomActionBar({
    title,
    subtitle,
    actionLabel,
    onAction,
    loading = false,
    disabled = false,
    style,
    leftSlot,
}: BottomActionBarProps) {
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 12);

    return (
        <View style={[styles.container, { paddingBottom: bottomPadding }, style]}>
            {leftSlot ? (
                leftSlot
            ) : title ? (
                <View style={styles.summaryContainer}>
                    {subtitle ? (
                        <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
                    ) : null}
                    <ThemedText style={styles.title}>{title}</ThemedText>
                </View>
            ) : null}

            <View style={styles.actionContainer}>
                <AppButton
                    variant="primary"
                    label={actionLabel}
                    onPress={onAction}
                    loading={loading}
                    disabled={disabled}
                    style={styles.actionButton}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
        paddingTop: spacing.md,
        paddingHorizontal: spacing.lg,
        ...layout.shadows.lg,
    },
    summaryContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: spacing.md,
    },
    subtitle: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    title: {
        ...typography.price,
        color: colors.brandPrimary,
        marginTop: 2,
    },
    actionContainer: {
        flexShrink: 0,
        minWidth: 140,
    },
    actionButton: {
        minWidth: 140,
    },
});
