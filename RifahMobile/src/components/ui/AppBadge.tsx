import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography } from '../../theme';

export interface AppBadgeProps extends ViewProps {
    label: string | number;
    variant?: 'neutral' | 'success' | 'warning' | 'error' | 'brand';
}

export function AppBadge({
    label,
    variant = 'neutral',
    style,
    ...props
}: AppBadgeProps) {
    
    let backgroundColor = colors.surfaceAlt;
    let textColor = colors.textSecondary;

    switch (variant) {
        case 'success':
            backgroundColor = '#D1FAE5'; // emerald-100
            textColor = colors.success;
            break;
        case 'warning':
            backgroundColor = '#FEF3C7'; // amber-100
            textColor = colors.warning;
            break;
        case 'error':
            backgroundColor = '#FEE2E2'; // red-100
            textColor = colors.error;
            break;
        case 'brand':
            backgroundColor = colors.brandBackground;
            textColor = colors.brandPrimaryDark;
            break;
        case 'neutral':
        default:
            backgroundColor = colors.backgroundMuted;
            textColor = colors.textSecondary;
            break;
    }

    return (
        <View style={[styles.badge, { backgroundColor }, style]} {...props}>
            <ThemedText style={[typography.badge, { color: textColor }]}>
                {label}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: layout.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
    }
});
