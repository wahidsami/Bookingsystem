import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Image, I18nManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '../components/ThemedText';
import Swiper from 'react-native-swiper';
import { useLanguage } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive Clamp Helper
const clamp = (min: number, preferred: number, max: number) => {
    return Math.max(min, Math.min(preferred, max));
};

const PADDING_HORIZONTAL = Math.max(16, SCREEN_WIDTH * 0.06);

interface OnboardingScreensProps {
    onComplete: () => void;
    onBackToLanguage?: () => void;
}

export function OnboardingScreens({ onComplete, onBackToLanguage }: OnboardingScreensProps) {
    const { t, language } = useLanguage();
    const swiperRef = useRef<Swiper>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const insets = useSafeAreaInsets();

    const screens = [
        {
            key: 'discover',
            title: t('onboarding1Title'),
            description: t('onboarding1Description'),
            image: require('../../assets/images/Onboarding1.png'),
        },
        {
            key: 'book',
            title: t('onboarding2Title'),
            description: t('onboarding2Description'),
            image: require('../../assets/images/Onboarding2.png'),
        },
        {
            key: 'track',
            title: t('onboarding3Title'),
            description: t('onboarding3Description'),
            image: require('../../assets/images/Onboarding3.png'),
        },
        {
            key: 'rewards',
            title: t('onboarding4Title'),
            description: t('onboarding4Description'),
            image: require('../../assets/images/Onboarding4.png'),
        },
    ];

    const handleNext = () => {
        if (activeIndex < screens.length - 1) {
            swiperRef.current?.scrollBy(1);
        } else {
            onComplete();
        }
    };

    const handlePrevious = () => {
        if (activeIndex > 0) {
            swiperRef.current?.scrollBy(-1);
        } else if (onBackToLanguage) {
            onBackToLanguage();
        }
    };

    // Construct bottom navigation based on strict Arabic specific layout (from design image)
    const renderNav = () => {
        const prevButton = (
            <TouchableOpacity
                key="prev"
                style={[styles.navButton, activeIndex === 0 && styles.navButtonHidden]}
                onPress={handlePrevious}
                disabled={activeIndex === 0}
                activeOpacity={0.7}
            >
                <Text style={styles.navButtonTextSecondary}>
                    {activeIndex === 0 ? '' : t('previous')}
                </Text>
            </TouchableOpacity>
        );

        const nextButton = (
            <TouchableOpacity
                key="next"
                style={[styles.navButton, activeIndex === screens.length - 1 && styles.getStartedButton]}
                onPress={handleNext}
                activeOpacity={0.8}
            >
                <Text style={[styles.navButtonTextPrimary, activeIndex === screens.length - 1 && styles.getStartedText]}>
                    {activeIndex === screens.length - 1 ? t('getStarted') : t('next')}
                </Text>
            </TouchableOpacity>
        );

        const spacer = <View key="spacer" style={{ flex: 1 }} />;

        // In Arabic layout picture: 
        // "Next" (التالي) is on the physical LEFT.
        // "Previous" (السابق) is on the physical RIGHT.
        const physicalLeftButton = language === 'ar' ? nextButton : prevButton;
        const physicalRightButton = language === 'ar' ? prevButton : nextButton;

        // If I18nManager.isRTL is TRUE, react-native natively flips 'row' to be Right-to-Left.
        // Therefore, if we want physicalLeftButton to actually appear on the left, we must
        // put it at the END of the array so Native RTL puts it on the physical left.
        if (I18nManager.isRTL) {
            return [physicalRightButton, spacer, physicalLeftButton];
        }

        // If not natively RTL, standard Left-to-Right layout applies
        return [physicalLeftButton, spacer, physicalRightButton];
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

            {/* Top Navigation - Skip */}
            <View style={styles.topNav}>
                <TouchableOpacity
                    onPress={onComplete}
                    style={styles.skipButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text style={styles.skipText}>{t('skip')}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
            </View>

            {/* Main Swiper Content */}
            <Swiper
                ref={swiperRef}
                loop={false}
                showsButtons={false}
                onIndexChanged={setActiveIndex}
                activeDotColor={'#8B5CF6'} // Brand Purple
                dotColor={'#E5E7EB'}      // Subtle Gray
                paginationStyle={styles.paginationConfig}
                scrollEnabled={true}
                activeDotStyle={styles.activeDot}
                dotStyle={styles.inactiveDot}
            >
                {screens.map((screen) => (
                    <View key={screen.key} style={styles.slide}>

                        {/* 1. Image Container */}
                        <View style={styles.imageContainer}>
                            <Image
                                source={screen.image}
                                style={styles.image}
                                resizeMode="contain"
                            />
                        </View>

                        {/* 2. Text Block (Safely below image) */}
                        <View style={styles.textContainer}>
                            <Text style={styles.title}>
                                {screen.title}
                            </Text>
                            <Text style={styles.subtitle} numberOfLines={2}>
                                {screen.description}
                            </Text>
                        </View>

                        {/* Ensure pagination space doesn't clash with subtitle */}
                        <View style={styles.spacerBelowText} />
                    </View>
                ))}
            </Swiper>

            {/* Bottom Navigation */}
            <View style={[styles.bottomNav, { paddingBottom: Math.max(16, insets.bottom) }]}>
                {renderNav()}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    topNav: {
        width: '100%',
        // In Arabic, Skip is on the physical Left. So if Native RTL is true, 'row-reverse' puts it on the left.
        flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
        paddingHorizontal: PADDING_HORIZONTAL,
        paddingTop: 8,
        height: 44,
    },
    skipButton: {
        justifyContent: 'center',
    },
    skipText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: PADDING_HORIZONTAL,
        paddingBottom: clamp(70, SCREEN_HEIGHT * 0.1, 100),
    },

    // Image Layout mapping to the dashed box
    imageContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: clamp(8, SCREEN_HEIGHT * 0.02, 16),
        marginBottom: clamp(16, SCREEN_HEIGHT * 0.02, 24),
    },
    image: {
        width: '100%',
        height: '100%',
        transform: [{ scale: 1.3 }], // Safely enlarge image using visual transform strictly inside boundaries
    },

    textContainer: {
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: clamp(20, SCREEN_HEIGHT * 0.024, 26),
        fontWeight: '700',
        color: '#111111',
        textAlign: 'center',
        marginBottom: clamp(8, SCREEN_HEIGHT * 0.012, 12),
        lineHeight: clamp(28, SCREEN_HEIGHT * 0.035, 36),
    },
    subtitle: {
        fontSize: clamp(14, SCREEN_HEIGHT * 0.018, 16),
        fontWeight: '400',
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: clamp(22, SCREEN_HEIGHT * 0.025, 26),
    },
    spacerBelowText: {
        height: 32,
    },

    paginationConfig: {
        bottom: clamp(70, SCREEN_HEIGHT * 0.1, 100),
    },
    inactiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginHorizontal: 4,
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },

    bottomNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: PADDING_HORIZONTAL,
        paddingTop: 16,
        width: '100%',
        position: 'absolute',
        bottom: 0,
        backgroundColor: '#FFFFFF',
    },
    navButton: {
        height: 44,
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    navButtonHidden: {
        opacity: 0,
    },
    navButtonTextSecondary: {
        fontSize: 16,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    navButtonTextPrimary: {
        fontSize: 16,
        fontWeight: '700',
        color: '#8B5CF6',
    },
    getStartedButton: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 24,
        borderRadius: 999,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    getStartedText: {
        color: '#FFFFFF',
    },
});
