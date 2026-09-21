import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useScreenSafeArea } from '../../utils/safeArea';
import { ThemedText } from '../ThemedText';
import { BackButton } from './BackButton';
import { colors, layout, spacing, typography } from '../../theme';

export interface PageHeaderProps extends ViewProps {
    title?: string;
    onBack?: () => void;
    rightAction?: React.ReactNode;
    variant?: 'standard' | 'transparent';
    showBack?: boolean;
}

export function PageHeader({
    title,
    onBack,
    rightAction,
    variant = 'standard',
    showBack = true,
    style,
    ...props
}: PageHeaderProps) {
    const { topInset } = useScreenSafeArea();
    const isStandard = variant === 'standard';

    return (
        <View
            style={[
                styles.container,
                { paddingTop: topInset },
                isStandard && styles.standardBackground,
                !isStandard && styles.transparentBackground,
                style
            ]}
            {...props}
        >
            <View style={[styles.content, { height: layout.components.headerHeight }]}>
                <View style={styles.left}>
                    {showBack && onBack && (
                        <BackButton 
                            onPress={onBack} 
                            variant={isStandard ? 'transparent' : 'solid'} 
                        />
                    )}
                </View>

                <View style={styles.center}>
                    {title && (
                        <ThemedText style={[typography.pageTitle, styles.title]} numberOfLines={1}>
                            {title}
                        </ThemedText>
                    )}
                </View>

                <View style={styles.right}>
                    {rightAction}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        zIndex: 10,
    },
    standardBackground: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E9DDFD',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    transparentBackground: {
        backgroundColor: 'transparent',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
    },
    left: {
        flex: 1,
        alignItems: 'flex-start',
    },
    center: {
        flex: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    right: {
        flex: 1,
        alignItems: 'flex-end',
    },
    title: {
        color: colors.textPrimary,
        textAlign: 'center',
    }
});
