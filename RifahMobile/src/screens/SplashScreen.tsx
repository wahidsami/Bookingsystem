import React, { useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
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
                color="#FFFFFF"
                style={styles.loader}
            />

            <Text style={styles.version}>Version 1.0.0</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#8B5CF6', // Refah purple
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
        color: '#E0E7FF',
        marginTop: 8,
        letterSpacing: 1,
    },
    loader: {
        marginTop: 20,
    },
    version: {
        position: 'absolute',
        bottom: 40,
        color: '#E0E7FF',
        fontSize: 12,
    },
});
