import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, spacing, layout, typography } from '../../theme';
import { AppIcon } from '../AppIcon';

export interface AppChipProps {
    label: string;
    active?: boolean;
    onPress?: () => void;
    icon?: React.ComponentProps<typeof AppIcon>['name'];
    style?: ViewStyle;
    variant?: 'filled' | 'tinted';
}

export function AppChip({
    label,
    active = false,
    onPress,
    icon,
    style,
    variant = 'filled',
}: AppChipProps) {
    let backgroundColor = colors.background;
    let borderColor = colors.borderSubtle;
    let textColor = colors.textSecondary;

    if (active) {
        if (variant === 'filled') {
            backgroundColor = colors.brandPrimary;
            borderColor = colors.brandPrimary;
            textColor = colors.textInverse;
        } else {
            backgroundColor = colors.surfaceLavender;
            borderColor = colors.brandPrimary;
            textColor = colors.brandPrimaryDark;
        }
    }

    return (
        <TouchableOpacity
            style={[
                styles.chip,
                { backgroundColor, borderColor },
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
        >
            {icon ? (
                <AppIcon
                    name={icon}
                    size={16}
                    color={textColor}
                    style={styles.icon}
                />
            ) : null}
            <ThemedText
                style={[
                    styles.label,
                    { color: textColor },
                    active && styles.activeLabel,
                ]}
            >
                {label}
            </ThemedText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: layout.radius.pill,
        borderWidth: 1,
        marginRight: spacing.sm,
    },
    icon: {
        marginRight: spacing.xs,
    },
    label: {
        ...typography.caption,
        textAlign: 'center',
    },
    activeLabel: {
        fontFamily: typography.fontFamilies.bold,
        fontWeight: '700',
    },
});
