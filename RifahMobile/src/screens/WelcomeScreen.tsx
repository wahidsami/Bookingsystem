import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, Easing, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText as Text } from '../components/ThemedText';
import { useLanguage } from '../contexts/LanguageContext';
import { colors } from '../theme/colors';

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
    const ctaAnim = useRef(new Animated.Value(0)).current;

    const paddingHorizontal = Math.max(20, SCREEN_WIDTH * 0.07);

    useEffect(() => {
        Animated.timing(ctaAnim, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [ctaAnim]);

    const ctaAnimatedStyle = {
        opacity: ctaAnim,
        transform: [
            {
                translateY: ctaAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                }),
            },
        ],
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal }]}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <View style={styles.contentWrapper}>
                    {/* 1. Brand Logo */}
                    <View style={styles.logoContainer}>
                        <Image
                            source={require('../../assets/barspa_logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Typography Hero Card */}
                    <View style={styles.heroCard}>
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
                    </View>

                    {/* 4 & 5 CTA Action Section */}
                    <Animated.View style={[styles.buttonsContainer, ctaAnimatedStyle]}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={onLogin}
                            activeOpacity={0.85}
                            accessibilityLabel={t('loginButton')}
                        >
                            <Text style={styles.primaryButtonText}>{t('loginButton')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={onRegister}
                            activeOpacity={0.8}
                            accessibilityLabel={t('registerButton')}
                        >
                            <Text style={styles.secondaryButtonText}>{t('registerButton')}</Text>
                        </TouchableOpacity>

                        {/* 6. Divider */}
                        <View style={styles.dividerContainer}>
                            <View style={styles.line} />
                            <Text style={styles.orText}>{t('or')}</Text>
                            <View style={styles.line} />
                        </View>

                        {/* 7. Continue as Guest - Integrated naturally below the divider */}
                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={onGuest}
                            activeOpacity={0.7}
                            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                            accessibilityLabel={t('continueAsGuest')}
                        >
                            <Text style={styles.guestButtonText}>
                                {t('continueAsGuest')}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: clamp(16, SCREEN_HEIGHT * 0.03, 32),
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 440,
        alignItems: 'center',
    },

    // Logo Struct
    logoContainer: {
        width: '100%',
        alignItems: 'center',
        paddingTop: clamp(8, SCREEN_HEIGHT * 0.02, 24),
        marginBottom: clamp(12, SCREEN_HEIGHT * 0.02, 20),
    },
    logo: {
        width: clamp(140, SCREEN_WIDTH * 0.45, 190),
        height: clamp(65, SCREEN_WIDTH * 0.22, 95),
    },

    // Text Stack
    textContainer: {
        width: '100%',
        alignItems: 'center',
    },
    heroCard: {
        width: '100%',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        backgroundColor: '#FFFFFF',
        paddingVertical: clamp(14, SCREEN_HEIGHT * 0.02, 22),
        paddingHorizontal: clamp(14, SCREEN_WIDTH * 0.04, 24),
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 3,
        marginBottom: clamp(20, SCREEN_HEIGHT * 0.035, 28),
    },
    title: {
        fontSize: clamp(18, SCREEN_HEIGHT * 0.026, 22),
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: clamp(26, SCREEN_HEIGHT * 0.034, 32),
    },
    subtitle: {
        fontSize: clamp(13, SCREEN_HEIGHT * 0.018, 15),
        fontWeight: '400',
        color: '#716B88',
        textAlign: 'center',
        lineHeight: clamp(20, SCREEN_HEIGHT * 0.024, 24),
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
        width: '100%',
        height: clamp(48, SCREEN_HEIGHT * 0.065, 54),
        borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        width: '100%',
        height: clamp(48, SCREEN_HEIGHT * 0.065, 54),
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    secondaryButtonText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '700',
    },

    // Divider Elements
    dividerContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginVertical: 10,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#E7DDFC',
    },
    orText: {
        marginHorizontal: 16,
        color: '#716B88',
        fontSize: 13,
        fontWeight: '600',
    },

    // Guest Action (natural flow beneath divider)
    guestButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    guestButtonText: {
        color: '#6537C0',
        fontSize: 15,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
