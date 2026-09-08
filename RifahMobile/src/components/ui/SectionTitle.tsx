import React from 'react';
import { View, StyleSheet, ViewProps, TouchableOpacity } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, spacing, typography } from '../../theme';
import { useLanguage } from '../../contexts/LanguageContext';
import { AppIcon } from '../AppIcon';

export interface SectionTitleProps extends ViewProps {
    title: string;
    actionLabel?: string;
    onActionPress?: () => void;
}

export function SectionTitle({
    title,
    actionLabel,
    onActionPress,
    style,
    ...props
}: SectionTitleProps) {
    const { isRTL } = useLanguage();

    return (
        <View style={[styles.container, style]} {...props}>
            <ThemedText style={[typography.sectionTitle, { color: colors.textPrimary }]}>
                {title}
            </ThemedText>
            
            {actionLabel && onActionPress && (
                <TouchableOpacity 
                    style={styles.actionContainer} 
                    onPress={onActionPress}
                    activeOpacity={0.7}
                >
                    <ThemedText style={[typography.bodyStrong, { color: colors.brandPrimary }]}>
                        {actionLabel}
                    </ThemedText>
                    <AppIcon 
                        name={isRTL ? "arrow_back" : "arrow_forward"} 
                        size={16} 
                        color={colors.brandPrimary} 
                    />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    actionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    }
});
