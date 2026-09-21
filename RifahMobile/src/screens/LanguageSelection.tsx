import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useScreenSafeArea } from '../utils/safeArea';
import { colors } from '../theme/colors';

interface LanguageSelectionProps {
    onLanguageSelect: (language: 'ar' | 'en') => Promise<void> | void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive Clamp Helper
const clamp = (min: number, preferred: number, max: number) => {
    return Math.max(min, Math.min(preferred, max));
};

export function LanguageSelection({ onLanguageSelect }: LanguageSelectionProps) {
    const [isSelecting, setIsSelecting] = useState(false);
    const { bottomInset } = useScreenSafeArea();

    const handleSelect = async (lang: 'ar' | 'en') => {
        if (isSelecting) return;

        setIsSelecting(true);
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        try {
            await onLanguageSelect(lang);
        } finally {
            setIsSelecting(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Top Section: Brand Logo */}
            <View style={styles.logoSection}>
                <Image
                    source={require('../../assets/barspa_logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            {/* Bottom Section: Instructions & Language Buttons */}
            <View style={[styles.bottomSection, { paddingBottom: Math.max(bottomInset, 32) }]}>
                <View style={styles.contentCard}>
                    {/* Header Instructions */}
                    <View style={styles.textContainer}>
                        <Text style={styles.titleEnglish}>Choose Your Language</Text>
                        <Text style={styles.titleArabic}>اختر لغتك المفضلة</Text>
                        <Text style={styles.subtitleEnglish}>Select a language to get started with BarSpa</Text>
                        <Text style={styles.subtitleArabic}>يرجى تحديد لغة التطبيق للمتابعة</Text>
                    </View>

                    {/* Language Option Buttons */}
                    <View style={styles.actionsContainer}>
                        {/* English Button */}
                        <TouchableOpacity
                            style={[styles.languageButton, styles.primaryButton]}
                            onPress={() => handleSelect('en')}
                            activeOpacity={0.85}
                            disabled={isSelecting}
                        >
                            <LinearGradient
                                colors={['#6537C0', '#5028A4']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientFill}
                            >
                                <Text style={styles.primaryButtonText}>English</Text>
                                <Text style={styles.primarySubText}>Continue in English</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Arabic Button */}
                        <TouchableOpacity
                            style={[styles.languageButton, styles.secondaryButton]}
                            onPress={() => handleSelect('ar')}
                            activeOpacity={0.85}
                            disabled={isSelecting}
                        >
                            <View style={styles.secondaryButtonFill}>
                                <Text style={styles.secondaryButtonText}>العربية</Text>
                                <Text style={styles.secondarySubText}>المتابعة باللغة العربية</Text>
                            </View>
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
        backgroundColor: '#FAF9FC',
    },
    logoSection: {
        flex: 1.1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: clamp(32, SCREEN_HEIGHT * 0.08, 64),
    },
    logo: {
        width: clamp(180, SCREEN_WIDTH * 0.55, 260),
        height: clamp(100, SCREEN_WIDTH * 0.32, 150),
    },
    bottomSection: {
        flex: 1.2,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: clamp(20, SCREEN_WIDTH * 0.06, 32),
    },
    contentCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: clamp(20, SCREEN_WIDTH * 0.06, 28),
        paddingVertical: clamp(24, SCREEN_HEIGHT * 0.035, 36),
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
        alignItems: 'center',
    },
    textContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: clamp(20, SCREEN_HEIGHT * 0.03, 28),
    },
    titleEnglish: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    titleArabic: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
        marginTop: 4,
        writingDirection: 'rtl',
    },
    subtitleEnglish: {
        fontSize: 13,
        fontWeight: '400',
        color: '#716B88',
        textAlign: 'center',
        marginTop: 8,
    },
    subtitleArabic: {
        fontSize: 13,
        fontWeight: '400',
        color: '#716B88',
        textAlign: 'center',
        marginTop: 2,
        writingDirection: 'rtl',
    },
    actionsContainer: {
        width: '100%',
        gap: 14,
    },
    languageButton: {
        width: '100%',
        minHeight: 58,
        borderRadius: 16,
        overflow: 'hidden',
    },
    primaryButton: {
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
    },
    gradientFill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 22,
        paddingVertical: 14,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    primarySubText: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 12,
        fontWeight: '500',
    },
    secondaryButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    secondaryButtonFill: {
        flex: 1,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 22,
        paddingVertical: 14,
    },
    secondaryButtonText: {
        color: '#6537C0',
        fontSize: 17,
        fontWeight: '700',
        writingDirection: 'rtl',
    },
    secondarySubText: {
        color: '#716B88',
        fontSize: 12,
        fontWeight: '500',
        writingDirection: 'rtl',
    },
});

