import React, { useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { useScreenSafeArea } from '../utils/safeArea';
import { colors } from '../theme/colors';

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
        <View style={styles.container}>
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

            <Text style={[styles.version, { bottom: bottomInset }]}>Version 1.0.0</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
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
