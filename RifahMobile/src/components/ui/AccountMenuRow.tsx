import React from 'react';
import { View, StyleSheet, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { ThemedText } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { colors, layout, spacing, typography } from '../../theme';
import { useLanguage } from '../../contexts/LanguageContext';

export interface AccountMenuRowProps extends TouchableOpacityProps {
    title: string;
    subtitle?: string;
    icon: React.ComponentProps<typeof AppIcon>['name'];
    iconColor?: string;
}

export function AccountMenuRow({
    title,
    subtitle,
    icon,
    iconColor = colors.brandPrimary,
    style,
    ...props
}: AccountMenuRowProps) {
    const { isRTL } = useLanguage();

    return (
        <TouchableOpacity
            style={[styles.container, isRTL && styles.containerRTL, style]}
            activeOpacity={0.7}
            {...props}
        >
            <View style={[styles.left, isRTL && styles.leftRTL]}>
                <View style={styles.iconContainer}>
                    <AppIcon name={icon} size={22} color={iconColor} />
                </View>
                <View style={styles.textContainer}>
                    <ThemedText style={[typography.bodyStrong, { color: colors.textPrimary }, isRTL && { textAlign: 'right' }]}>
                        {title}
                    </ThemedText>
                    {subtitle && (
                        <ThemedText style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }, isRTL && { textAlign: 'right' }]}>
                            {subtitle}
                        </ThemedText>
                    )}
                </View>
            </View>
            
            <AppIcon 
                name={isRTL ? "arrow_back" : "arrow_forward"} 
                size={20} 
                color={colors.textTertiary} 
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    containerRTL: {
        flexDirection: 'row-reverse',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
    },
    leftRTL: {
        flexDirection: 'row-reverse',
    },
    iconContainer: {
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
    }
});
