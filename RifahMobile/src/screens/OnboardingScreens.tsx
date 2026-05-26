import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Image, I18nManager, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '../components/ThemedText';
import Swiper from 'react-native-swiper';
import { useLanguage } from '../contexts/LanguageContext';
import { colors } from '../theme/colors';

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
    const textAnim = useRef(new Animated.Value(0)).current;
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

    useEffect(() => {
        textAnim.setValue(0);
        Animated.timing(textAnim, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [activeIndex, textAnim]);

    const textAnimatedStyle = {
        opacity: textAnim,
        transform: [
            {
                translateY: textAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                }),
            },
        ],
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
                activeDotColor={colors.primary}
                dotColor={colors.border}
                paginationStyle={styles.paginationConfig}
                scrollEnabled={true}
                activeDotStyle={styles.activeDot}
                dotStyle={styles.inactiveDot}
            >
                {screens.map((screen) => (
                    <View key={screen.key} style={styles.slide}>

                        {/* 1. Image Container */}
                        <View style={styles.imageContainer}>
                            <View style={styles.imageFrame}>
                                <Image
                                    source={screen.image}
                                    style={styles.image}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>

                        {/* 2. Text Block (Safely below image) */}
                        <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
                            <View style={styles.textCard}>
                            <Text style={styles.title}>
                                {screen.title}
                            </Text>
                            <Text style={styles.subtitle} numberOfLines={3}>
                                {screen.description}
                            </Text>
                            </View>
                        </Animated.View>

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
        backgroundColor: colors.background,
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
        color: colors.textSecondary,
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
        flex: 0,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: clamp(8, SCREEN_HEIGHT * 0.02, 16),
        marginBottom: clamp(12, SCREEN_HEIGHT * 0.018, 20),
        height: clamp(220, SCREEN_HEIGHT * 0.38, 320),
    },
    imageFrame: {
        width: clamp(220, SCREEN_WIDTH * 0.72, 320),
        height: clamp(220, SCREEN_WIDTH * 0.72, 320),
        borderRadius: 999,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },

    textContainer: {
        width: '100%',
        alignItems: 'center',
    },
    textCard: {
        width: '100%',
        backgroundColor: colors.background,
        borderRadius: 20,
        paddingHorizontal: clamp(14, SCREEN_WIDTH * 0.05, 22),
        paddingVertical: clamp(12, SCREEN_HEIGHT * 0.016, 18),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 4,
    },
    title: {
        fontSize: clamp(20, SCREEN_HEIGHT * 0.024, 26),
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: clamp(8, SCREEN_HEIGHT * 0.012, 12),
        lineHeight: clamp(28, SCREEN_HEIGHT * 0.035, 36),
    },
    subtitle: {
        fontSize: clamp(14, SCREEN_HEIGHT * 0.018, 16),
        fontWeight: '400',
        color: colors.textSecondary,
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
        backgroundColor: colors.background,
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
        color: colors.textTertiary,
    },
    navButtonTextPrimary: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    getStartedButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        borderRadius: 999,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    getStartedText: {
        color: colors.textInverse,
    },
});
