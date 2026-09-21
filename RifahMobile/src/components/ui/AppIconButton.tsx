import React from 'react';
import {
    TouchableOpacity,
    StyleSheet,
    ViewStyle,
    TouchableOpacityProps,
} from 'react-native';
import { colors, layout, shadows } from '../../theme';
import { AppIcon } from '../AppIcon';

export interface AppIconButtonProps extends TouchableOpacityProps {
    icon: React.ComponentProps<typeof AppIcon>['name'];
    size?: number;
    iconSize?: number;
    iconColor?: string;
    variant?: 'surface' | 'lavender' | 'transparent' | 'primary';
    style?: ViewStyle;
    badgeCount?: number;
    flipInRTL?: boolean;
}

export function AppIconButton({
    icon,
    size = layout.components.iconButtonSize,
    iconSize = 20,
    iconColor,
    variant = 'surface',
    style,
    badgeCount,
    flipInRTL = false,
    ...props
}: AppIconButtonProps) {
    let backgroundColor = colors.surface;
    let defaultColor = colors.textPrimary;
    let borderColor = colors.borderSubtle;
    let shadowStyle = shadows.sm;

    switch (variant) {
        case 'lavender':
            backgroundColor = colors.surfaceLavender;
            defaultColor = colors.brandPrimaryDark;
            borderColor = colors.borderSubtle;
            break;
        case 'transparent':
            backgroundColor = 'transparent';
            defaultColor = colors.textPrimary;
            borderColor = 'transparent';
            shadowStyle = { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 };
            break;
        case 'primary':
            backgroundColor = colors.brandPrimary;
            defaultColor = colors.textInverse;
            borderColor = colors.brandPrimary;
            break;
        default:
            backgroundColor = colors.surface;
            defaultColor = colors.textPrimary;
            borderColor = colors.borderSubtle;
            break;
    }

    const resolvedColor = iconColor || defaultColor;

    return (
        <TouchableOpacity
            style={[
                styles.button,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor,
                    borderColor,
                },
                shadowStyle,
                style,
            ]}
            activeOpacity={0.8}
            {...props}
        >
            <AppIcon name={icon} size={iconSize} color={resolvedColor} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
});
