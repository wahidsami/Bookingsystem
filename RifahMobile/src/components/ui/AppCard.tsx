import React from 'react';
import { View, StyleSheet, ViewProps, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { colors, layout, spacing } from '../../theme';

export interface AppCardProps extends ViewProps {
    variant?: 'elevated' | 'outlined' | 'flat' | 'lavender';
    onPress?: TouchableOpacityProps['onPress'];
    padding?: keyof typeof spacing | 'none';
}

export function AppCard({
    variant = 'elevated',
    onPress,
    padding = 'base',
    style,
    children,
    ...props
}: AppCardProps) {
    const cardStyles = [
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        variant === 'flat' && styles.flat,
        variant === 'lavender' && styles.lavender,
        padding !== 'none' && { padding: spacing[padding] },
        style,
    ];

    if (onPress) {
        return (
            <TouchableOpacity style={cardStyles} onPress={onPress} activeOpacity={0.85} {...(props as TouchableOpacityProps)}>
                {children}
            </TouchableOpacity>
        );
    }

    return (
        <View style={cardStyles} {...props}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: colors.surface,
        borderRadius: layout.radius.lg,
        overflow: 'hidden',
    },
    elevated: {
        ...layout.shadows.sm,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    outlined: {
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    flat: {
        backgroundColor: colors.surfaceAlt,
    },
    lavender: {
        backgroundColor: colors.surfaceLavender,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    }
});
