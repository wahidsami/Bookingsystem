import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, TouchableOpacityProps, View } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography } from '../../theme';
import { AppIcon } from '../AppIcon';

export interface AppButtonProps extends TouchableOpacityProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'destructive' | 'compact';
    label: string;
    icon?: React.ComponentProps<typeof AppIcon>['name'];
    iconPosition?: 'left' | 'right';
    loading?: boolean;
}

export function AppButton({
    variant = 'primary',
    label,
    icon,
    iconPosition = 'left',
    loading = false,
    disabled,
    style,
    ...props
}: AppButtonProps) {
    const isCompact = variant === 'compact';
    const height = isCompact ? layout.components.buttonCompactHeight : layout.components.buttonHeight;
    const paddingHorizontal = isCompact ? spacing.md : spacing.xl;
    
    let backgroundColor = colors.brandPrimary;
    let textColor = colors.textInverse;
    let borderColor = 'transparent';
    let borderWidth = 0;

    switch (variant) {
        case 'secondary':
            backgroundColor = colors.brandPrimaryLight;
            textColor = colors.brandPrimaryDark;
            break;
        case 'outline':
            backgroundColor = 'transparent';
            textColor = colors.brandPrimary;
            borderColor = colors.brandPrimary;
            borderWidth = 1;
            break;
        case 'text':
            backgroundColor = 'transparent';
            textColor = colors.brandPrimary;
            break;
        case 'destructive':
            backgroundColor = colors.error;
            textColor = colors.textInverse;
            break;
        case 'compact':
            backgroundColor = colors.brandPrimaryLight;
            textColor = colors.brandPrimary;
            break;
        default: // primary
            break;
    }

    if (disabled) {
        backgroundColor = variant === 'outline' || variant === 'text' ? 'transparent' : colors.borderSubtle;
        textColor = colors.textTertiary;
        if (variant === 'outline') {
            borderColor = colors.borderSubtle;
        }
    }

    return (
        <TouchableOpacity
            style={[
                styles.button,
                { height, paddingHorizontal, backgroundColor, borderColor, borderWidth },
                style,
            ]}
            disabled={disabled || loading}
            activeOpacity={0.7}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={textColor} size="small" />
            ) : (
                <View style={styles.content}>
                    {icon && iconPosition === 'left' && (
                        <AppIcon name={icon} size={isCompact ? 16 : 20} color={textColor} />
                    )}
                    <ThemedText
                        style={[
                            styles.label,
                            { color: textColor, ...(isCompact ? typography.captionStrong : typography.button) }
                        ]}
                    >
                        {label}
                    </ThemedText>
                    {icon && iconPosition === 'right' && (
                        <AppIcon name={icon} size={isCompact ? 16 : 20} color={textColor} />
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: layout.radius.pill, // BarSpa defaults to pills/full radii for actions
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    label: {
        textAlign: 'center',
    }
});
