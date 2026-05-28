import React, { useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { useScreenSafeArea } from '../utils/safeArea';
import { colors } from '../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
    const { bottomInset } = useScreenSafeArea();

    useEffect(() => {
        // Auto-finish after 2 seconds
        const timer = setTimeout(() => {
            onFinish();
        }, 2000);

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <LinearGradient colors={[colors.primaryDark, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />
            {/* Refah Logo */}
            <View style={styles.logoContainer}>
                <Image
                    source={require('../../assets/logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                />
                <Text style={styles.tagline}>Beauty & Wellness</Text>
            </View>

            <ActivityIndicator
                size="large"
                color={colors.textInverse}
                style={styles.loader}
            />

            <Text style={[styles.version, { bottom: Math.max(bottomInset, 14) }]}>Version 1.0.0</Text>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowTop: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: `${colors.textInverse}1A`,
    },
    glowBottom: {
        position: 'absolute',
        bottom: -90,
        left: -70,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: `${colors.textInverse}14`,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
        backgroundColor: '#FFFFFF22',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    logoImage: {
        width: 200,
        height: 100,
    },
    tagline: {
        fontSize: 16,
        color: `${colors.textInverse}DD`,
        marginTop: 8,
        letterSpacing: 1,
    },
    loader: {
        marginTop: 20,
    },
    version: {
        position: 'absolute',
        color: `${colors.textInverse}DD`,
        fontSize: 12,
    },
});
