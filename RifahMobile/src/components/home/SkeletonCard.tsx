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
        width: width - spacing.lg * 2,
        height: 176,
        backgroundColor: '#F3EBFD',
        borderRadius: 16,
        marginRight: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(231, 221, 252, 0.6)',
    },
    dealImagePlaceholder: {
        width: '100%',
        height: 110,
        backgroundColor: '#E7DDFC',
    },
    dealTextPlaceholder: {
        width: '55%',
        height: 16,
        backgroundColor: '#E7DDFC',
        borderRadius: 4,
        margin: spacing.sm,
    },
    dealTextSmall: {
        width: '35%',
        height: 12,
        backgroundColor: '#E7DDFC',
        borderRadius: 4,
        marginHorizontal: spacing.sm,
    },

    // Tenant skeleton (Stitch 160px)
    tenantCard: {
        width: 160,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginRight: spacing.md,
        padding: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(231, 221, 252, 0.7)',
    },
    tenantImagePlaceholder: {
        width: '100%',
        height: 96,
        backgroundColor: '#FAF9FC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    tenantTextPlaceholder: {
        width: '80%',
        height: 14,
        backgroundColor: '#E7DDFC',
        borderRadius: 4,
        marginTop: 10,
        marginBottom: 6,
    },
    tenantTextSmall: {
        width: '60%',
        height: 10,
        backgroundColor: '#E7DDFC',
        borderRadius: 4,
    },

    // Category skeleton (Stitch 56x56 square in 4-col)
    categoryCard: {
        alignItems: 'center',
        width: (width - spacing.lg * 2 - spacing.xs * 6) / 4,
        marginBottom: spacing.md,
    },
    categoryCircle: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    categoryTextPlaceholder: {
        width: 48,
        height: 10,
        backgroundColor: '#E7DDFC',
        borderRadius: 4,
        marginTop: spacing.xs,
    },

    // Provider skeleton (Stitch 96px)
    providerCard: {
        width: 96,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(231, 221, 252, 0.7)',
        padding: 10,
        alignItems: 'center',
        marginRight: spacing.md,
    },
    providerCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E7DDFC',
    },
    providerTextPlaceholder: {
        width: 55,
        height: 12,
        backgroundColor: '#E7DDFC',
        borderRadius: 4,
        marginTop: spacing.xs,
    },
    providerTextSmall: {
        width: 36,
        height: 10,
        backgroundColor: '#E7DDFC',
        borderRadius: 4,
        marginTop: 4,
    },
});
