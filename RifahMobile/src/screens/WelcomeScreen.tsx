import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '../components/ThemedText';
import { useLanguage } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive Clamp Helper
const clamp = (min: number, preferred: number, max: number) => {
    return Math.max(min, Math.min(preferred, max));
};

interface WelcomeScreenProps {
    onLogin: () => void;
    onRegister: () => void;
    onGuest: () => void;
}

export function WelcomeScreen({ onLogin, onRegister, onGuest }: WelcomeScreenProps) {
    const { t, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();

    const paddingHorizontal = Math.max(16, SCREEN_WIDTH * 0.07); // ~7% of screen width

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={[styles.contentWrapper, { paddingHorizontal }]}>

                {/* 1. Brand Logo */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>

                {/* Typography Block */}
                <View style={styles.textContainer}>
                    {/* 2. Title */}
                    <Text style={[styles.title, isRTL && styles.rtlText]}>
                        {t('welcomeTitle')}
                    </Text>
                    {/* 3. Subtitle */}
                    <Text style={[styles.subtitle, isRTL && styles.rtlText]} numberOfLines={2}>
                        {t('welcomeSubtitle')}
                    </Text>
                </View>

                {/* 4 & 5 Button Section */}
                <View style={styles.buttonsContainer}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={onLogin}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.primaryButtonText}>{t('loginButton')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={onRegister}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.secondaryButtonText}>{t('registerButton')}</Text>
                    </TouchableOpacity>
                </View>

                {/* 6. Divider */}
                <View style={styles.dividerContainer}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>{t('or')}</Text>
                    <View style={styles.line} />
                </View>

            </View>

            {/* 7. Guest Text Link (Anchored to Bottom) */}
            <View style={[styles.guestContainer, { paddingBottom: Math.max(16, insets.bottom) }]}>
                <TouchableOpacity
                    style={styles.guestButton}
                    onPress={onGuest}
                    activeOpacity={0.6}
                    hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                >
                    <Text style={styles.guestButtonText}>
                        {t('continueAsGuest')}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF', // Clean premium white
        alignItems: 'center',
    },
    contentWrapper: {
        flex: 1,
        width: '100%',
        maxWidth: 480, // Max content width
        alignItems: 'center',
    },

    // Logo Struct
    logoContainer: {
        width: '100%',
        alignItems: 'center',
        paddingTop: clamp(24, SCREEN_HEIGHT * 0.12, 96),
    },
    logo: {
        width: clamp(110, SCREEN_WIDTH * 0.36, 180),
        // Height resolves via aspect ratio automatically via `contain` behavior mapped to intrinsic bounds, 
        // but given RN image behavior we lock a relative scaling height bounding box.
        height: clamp(80, SCREEN_WIDTH * 0.25, 120),
    },

    // Text Stack
    textContainer: {
        width: '100%',
        alignItems: 'center',
        marginTop: clamp(12, SCREEN_HEIGHT * 0.05, 28),
        marginBottom: clamp(18, SCREEN_HEIGHT * 0.08, 48),
    },
    title: {
        fontSize: clamp(18, SCREEN_HEIGHT * 0.026, 24),
        fontWeight: '700', // Bold/SemiBold
        color: '#111111',
        textAlign: 'center',
        marginBottom: clamp(8, SCREEN_HEIGHT * 0.015, 12),
        lineHeight: clamp(28, SCREEN_HEIGHT * 0.035, 36),
    },
    subtitle: {
        fontSize: clamp(13, SCREEN_HEIGHT * 0.020, 16),
        fontWeight: '400',
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: clamp(20, SCREEN_HEIGHT * 0.026, 26),
    },
    rtlText: {
        textAlign: 'center',
        writingDirection: 'rtl',
    },

    // Buttons Container
    buttonsContainer: {
        width: '100%',
        alignItems: 'center',
    },
    primaryButton: {
        width: Math.min(SCREEN_WIDTH * 0.86, 480),
        height: clamp(48, SCREEN_HEIGHT * 0.07, 56),
        borderRadius: 999, // Pill shape
        backgroundColor: '#8B5CF6', // Rifah Purple Fill
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: clamp(12, SCREEN_HEIGHT * 0.02, 16),

        // Shadow Elevation
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    secondaryButton: {
        width: Math.min(SCREEN_WIDTH * 0.86, 480),
        height: clamp(48, SCREEN_HEIGHT * 0.07, 56),
        borderRadius: 999, // Pill shape
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: '#8B5CF6', // Rifah Purple Stroke
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    secondaryButtonText: {
        color: '#8B5CF6',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    // Divider Elements
    dividerContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB', // Thin border
    },
    orText: {
        marginHorizontal: 16,
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '500',
    },

    // Bottom Actions
    guestContainer: {
        width: '100%',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        backgroundColor: '#FFFFFF', // Prevent bleed
        paddingTop: 16,
    },
    guestButton: {
        height: 44, // Minimum tap target
        justifyContent: 'center',
    },
    guestButtonText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});

