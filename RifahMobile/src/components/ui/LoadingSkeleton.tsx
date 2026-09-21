import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { colors, layout, spacing } from '../../theme';

export interface LoadingSkeletonProps {
    width?: number | `${number}%` | 'auto';
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
    variant?: 'text' | 'rect' | 'circle' | 'card';
}

export function LoadingSkeleton({
    width = '100%',
    height = 20,
    borderRadius = layout.radius.sm,
    style,
    variant = 'rect',
}: LoadingSkeletonProps) {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [opacity]);

    if (variant === 'circle') {
        const circleSize = typeof height === 'number' ? height : 44;
        return (
            <Animated.View
                style={[
                    styles.skeleton,
                    {
                        width: circleSize,
                        height: circleSize,
                        borderRadius: circleSize / 2,
                        opacity,
                    },
                    style,
                ]}
            />
        );
    }

    if (variant === 'card') {
        return (
            <View style={[styles.cardContainer, style]}>
                <Animated.View style={[styles.skeleton, { height: 120, borderRadius: layout.radius.md, opacity }]} />
                <View style={styles.cardMeta}>
                    <Animated.View style={[styles.skeleton, { width: '70%', height: 16, opacity }]} />
                    <Animated.View style={[styles.skeleton, { width: '40%', height: 12, marginTop: spacing.xs, opacity }]} />
                </View>
            </View>
        );
    }

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius,
                    opacity,
                },
                style,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: colors.borderSubtle,
    },
    cardContainer: {
        backgroundColor: colors.surface,
        borderRadius: layout.radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.base,
        marginBottom: spacing.base,
    },
    cardMeta: {
        marginTop: spacing.md,
    },
});
