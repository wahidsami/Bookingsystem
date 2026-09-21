import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { useScreenSafeArea } from '../utils/safeArea';
import { colors } from '../theme/colors';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
    const { bottomInset } = useScreenSafeArea();
    const onFinishRef = useRef(onFinish);
    onFinishRef.current = onFinish;

    useEffect(() => {
        // Auto-finish after 1.5 seconds
        const timer = setTimeout(() => {
            onFinishRef.current();
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            {/* BarSpa Logo */}
            <View style={styles.logoContainer}>
                <Image
                    source={require('../../assets/barspa_logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                />
                <Text style={styles.tagline}>Beauty & Wellness</Text>
            </View>

            <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.loader}
            />

            <Text style={[styles.version, { bottom: Math.max(bottomInset, 14) }]}>Version 2.0.0 (Build 2)</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoImage: {
        width: 220,
        height: 120,
    },
    tagline: {
        fontSize: 16,
        color: '#6537C0',
        fontWeight: '600',
        marginTop: 8,
        letterSpacing: 0.5,
    },
    loader: {
        marginTop: 20,
    },
    version: {
        position: 'absolute',
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '500',
    },
});
