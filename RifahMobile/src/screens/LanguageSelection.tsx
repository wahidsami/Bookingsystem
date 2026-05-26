import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useScreenSafeArea } from '../utils/safeArea';
import { colors } from '../theme/colors';

interface LanguageSelectionProps {
    onLanguageSelect: (language: 'ar' | 'en') => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive Clamp Helper
const clamp = (min: number, preferred: number, max: number) => {
    return Math.max(min, Math.min(preferred, max));
};

export function LanguageSelection({ onLanguageSelect }: LanguageSelectionProps) {
    const [isSelecting, setIsSelecting] = useState(false);
    const { bottomInset } = useScreenSafeArea();

    const handleSelect = (lang: 'ar' | 'en') => {
        if (isSelecting) return;

        setIsSelecting(true);
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        onLanguageSelect(lang);
    };

    return (
        <View style={styles.container}>

            {/* Top Half: Logo Area */}
            <View style={styles.topHalf}>
                <Image
                    source={require('../../assets/splash-icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            {/* Bottom Half: Interactions */}
            <View style={[styles.bottomHalf, { paddingBottom: bottomInset }]}>
                <View style={styles.bottomContent}>

                    {/* Text Instructions */}
                    <View style={styles.textContainer}>
                        <Text style={styles.englishText}>Please select your language</Text>
                        <Text style={styles.arabicText}>برجاء إختيار اللغة</Text>
                    </View>

                    {/* Primary Actions (Pill Buttons) */}
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            style={[styles.pillButton, styles.englishButtonWrapper]}
                            onPress={() => handleSelect('en')}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[colors.primary, colors.primaryDark]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientFill}
                            >
                                <Text style={styles.buttonText}>English</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.pillButton, styles.arabicButtonWrapper]}
                            onPress={() => handleSelect('ar')}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[colors.secondary, colors.secondaryDark]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientFill}
                            >
                                <Text style={styles.buttonText}>العربية</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    topHalf: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    logo: {
        width: clamp(140, SCREEN_WIDTH * 0.45, 240),
        height: clamp(140, SCREEN_WIDTH * 0.45, 240),
    },
    bottomHalf: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomContent: {
        width: '100%',
        maxWidth: 480, // Max width for content capping
        paddingHorizontal: clamp(16, SCREEN_WIDTH * 0.06, 40),
        alignItems: 'center',
    },
    textContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: clamp(24, SCREEN_HEIGHT * 0.04, 48),
    },
    englishText: {
        fontSize: 18,
        fontWeight: '500', // Medium
        color: colors.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    arabicText: {
        fontSize: 18,
        fontWeight: '700', // Bold/Semi-bold
        color: colors.textPrimary,
        textAlign: 'center',
        writingDirection: 'rtl',
    },
    actionsContainer: {
        width: '100%',
        alignItems: 'center',
    },
    pillButton: {
        width: Math.min(SCREEN_WIDTH * 0.76, 420),
        height: clamp(48, SCREEN_HEIGHT * 0.07, 60),
        borderRadius: 999, // Pill shape
        overflow: 'hidden',
        marginBottom: 16,

        // Shadow/Elevation
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    englishButtonWrapper: {
        shadowColor: colors.primary,
    },
    arabicButtonWrapper: {
        shadowColor: colors.secondary,
    },
    gradientFill: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    buttonText: {
        color: colors.textInverse,
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

