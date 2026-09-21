import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, spacing, typography, layout } from '../../theme';
import { useLanguage } from '../../contexts/LanguageContext';
import { AppIconButton } from './AppIconButton';

export interface AppHeaderProps {
    title?: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    rightAction?: React.ReactNode;
    style?: ViewStyle;
    transparent?: boolean;
}

export function AppHeader({
    title,
    subtitle,
    showBack = true,
    onBack,
    rightAction,
    style,
    transparent = false,
}: AppHeaderProps) {
    const { isRTL } = useLanguage();

    return (
        <View
            style={[
                styles.container,
                transparent ? styles.transparent : styles.solid,
                style,
            ]}
        >
            <View style={styles.leftContainer}>
                {showBack && onBack ? (
                    <AppIconButton
                        icon={isRTL ? 'arrow_forward' : 'arrow_back'}
                        onPress={onBack}
                        variant="surface"
                        accessibilityLabel="Go back"
                    />
                ) : null}
            </View>

            <View style={styles.titleContainer}>
                {title ? (
                    <ThemedText style={styles.title} numberOfLines={1}>
                        {title}
                    </ThemedText>
                ) : null}
                {subtitle ? (
                    <ThemedText style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                    </ThemedText>
                ) : null}
            </View>

            <View style={styles.rightContainer}>
                {rightAction || null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: layout.components.headerHeight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
    },
    solid: {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.brand.borderLight,
    },
    transparent: {
        backgroundColor: 'transparent',
    },
    leftContainer: {
        width: 44,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
    },
    title: {
        ...typography.pageTitle,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.caption,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 2,
    },
    rightContainer: {
        width: 44,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
});
