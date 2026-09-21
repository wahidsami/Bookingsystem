import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography } from '../../theme';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';

export interface AppBadgeProps extends ViewProps {
    label: string | number;
    variant?: 'neutral' | 'success' | 'warning' | 'error' | 'brand' | 'lavender';
    showDot?: boolean;
    icon?: React.ComponentProps<typeof AppIcon>['name'];
}

export function AppBadge({
    label,
    variant = 'neutral',
    showDot = false,
    icon,
    style,
    ...props
}: AppBadgeProps) {
    const { isRTL } = useLanguage();

    let backgroundColor = colors.surfaceAlt;
    let textColor = colors.textSecondary;
    let dotColor = colors.textSecondary;
    let borderColor = 'transparent';

    switch (variant) {
        case 'success':
            backgroundColor = '#ECFDF5'; // Emerald 50
            textColor = '#065F46';       // Emerald 800
            dotColor = colors.success;   // Emerald 500
            borderColor = '#A7F3D0';
            break;
        case 'warning':
            backgroundColor = '#FFFBEB'; // Amber 50
            textColor = '#92400E';       // Amber 800
            dotColor = colors.warning;   // Amber 500
            borderColor = '#FDE68A';
            break;
        case 'error':
            backgroundColor = '#FEF2F2'; // Red 50
            textColor = colors.error;
            dotColor = colors.error;
            borderColor = '#FECACA';
            break;
        case 'lavender':
        case 'brand':
            backgroundColor = colors.surfaceLavender;
            textColor = colors.brandPrimaryDark;
            dotColor = colors.brandPrimary;
            borderColor = colors.borderSubtle;
            break;
        case 'neutral':
        default:
            backgroundColor = colors.surfaceAlt;
            textColor = colors.textSecondary;
            dotColor = colors.textSecondary;
            borderColor = colors.borderSubtle;
            break;
    }

    return (
        <View
            style={[
                styles.badge,
                isRTL && styles.badgeRTL,
                { backgroundColor, borderColor },
                style,
            ]}
            {...props}
        >
            {showDot ? (
                <View
                    style={[
                        styles.dot,
                        isRTL ? styles.dotRTL : styles.dotLTR,
                        { backgroundColor: dotColor },
                    ]}
                />
            ) : null}
            {icon ? (
                <AppIcon
                    name={icon}
                    size={13}
                    color={textColor}
                    style={isRTL ? styles.iconRTL : styles.iconLTR}
                />
            ) : null}
            <ThemedText style={[styles.label, { color: textColor }]}>
                {label}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
        borderRadius: layout.radius.pill,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    badgeRTL: {
        flexDirection: 'row-reverse',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dotLTR: {
        marginRight: 5,
    },
    dotRTL: {
        marginLeft: 5,
    },
    iconLTR: {
        marginRight: 4,
    },
    iconRTL: {
        marginLeft: 4,
    },
    label: {
        ...typography.badge,
        fontWeight: '600',
    },
});
