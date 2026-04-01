import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface SkeletonCardProps {
    variant: 'deal' | 'tenant' | 'category' | 'provider';
}

export function SkeletonCard({ variant }: SkeletonCardProps) {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    if (variant === 'deal') {
        return (
            <Animated.View style={[styles.dealCard, { opacity }]}>
                <View style={styles.dealImagePlaceholder} />
                <View style={styles.dealTextPlaceholder} />
                <View style={styles.dealTextSmall} />
            </Animated.View>
        );
    }

    if (variant === 'tenant') {
        return (
            <Animated.View style={[styles.tenantCard, { opacity }]}>
                <View style={styles.tenantImagePlaceholder} />
                <View style={styles.tenantTextPlaceholder} />
                <View style={styles.tenantTextSmall} />
            </Animated.View>
        );
    }

    if (variant === 'category') {
        return (
            <Animated.View style={[styles.categoryCard, { opacity }]}>
                <View style={styles.categoryCircle} />
                <View style={styles.categoryTextPlaceholder} />
            </Animated.View>
        );
    }

    // provider
    return (
        <Animated.View style={[styles.providerCard, { opacity }]}>
            <View style={styles.providerCircle} />
            <View style={styles.providerTextPlaceholder} />
            <View style={styles.providerTextSmall} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    // Deal skeleton
    dealCard: {
        width: width * 0.75,
        height: 180,
        backgroundColor: '#E5E7EB',
        borderRadius: borderRadius.xl,
        marginRight: spacing.md,
    },
    dealImagePlaceholder: {
        width: '100%',
        height: 120,
        backgroundColor: '#D1D5DB',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
    },
    dealTextPlaceholder: {
        width: '60%',
        height: 14,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        margin: spacing.sm,
    },
    dealTextSmall: {
        width: '40%',
        height: 10,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        marginHorizontal: spacing.sm,
    },

    // Tenant skeleton
    tenantCard: {
        width: 200,
        backgroundColor: '#E5E7EB',
        borderRadius: borderRadius.xl,
        marginRight: spacing.md,
        overflow: 'hidden',
    },
    tenantImagePlaceholder: {
        width: '100%',
        height: 120,
        backgroundColor: '#D1D5DB',
    },
    tenantTextPlaceholder: {
        width: '70%',
        height: 14,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        margin: spacing.sm,
    },
    tenantTextSmall: {
        width: '50%',
        height: 10,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        marginHorizontal: spacing.sm,
        marginBottom: spacing.sm,
    },

    // Category skeleton
    categoryCard: {
        alignItems: 'center',
        width: (width - spacing.lg * 2 - spacing.md * 2) / 3,
        marginBottom: spacing.md,
    },
    categoryCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#D1D5DB',
    },
    categoryTextPlaceholder: {
        width: 50,
        height: 10,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        marginTop: spacing.xs,
    },

    // Provider skeleton
    providerCard: {
        width: 100,
        alignItems: 'center',
        marginRight: spacing.md,
    },
    providerCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#D1D5DB',
    },
    providerTextPlaceholder: {
        width: 60,
        height: 12,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        marginTop: spacing.xs,
    },
    providerTextSmall: {
        width: 40,
        height: 10,
        backgroundColor: '#D1D5DB',
        borderRadius: 4,
        marginTop: 4,
    },
});
