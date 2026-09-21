import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, spacing, typography } from '../../theme';
import { AppIcon } from '../AppIcon';
import { AppButton } from './AppButton';

export interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    retryLabel?: string;
    style?: ViewStyle;
}

export function ErrorState({
    title = 'Something went wrong',
    message,
    onRetry,
    retryLabel = 'Try Again',
    style,
}: ErrorStateProps) {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.iconCircle}>
                <AppIcon name="alert_circle" size={32} color={colors.error} />
            </View>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {message ? (
                <ThemedText style={styles.message}>{message}</ThemedText>
            ) : null}
            {onRetry ? (
                <AppButton
                    variant="compact"
                    label={retryLabel}
                    onPress={onRetry}
                    style={styles.button}
                />
            ) : null}
        </View>
    );
}

export function RetryButton({
    onPress,
    label = 'Retry',
    style,
}: {
    onPress: () => void;
    label?: string;
    style?: ViewStyle;
}) {
    return (
        <AppButton
            variant="compact"
            label={label}
            icon="refresh"
            onPress={onPress}
            style={style}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    iconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FEF2F2', // Red-50
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    title: {
        ...typography.cardTitle,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    message: {
        ...typography.caption,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.base,
        maxWidth: 260,
    },
    button: {
        marginTop: spacing.xs,
    },
});
