import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { HomeHeader } from '../components/home/HomeHeader';
import { SectionHeader } from '../components/home/SectionHeader';
import { HotDealsCarousel } from '../components/home/HotDealsCarousel';
import { TenantHorizontalList } from '../components/home/TenantHorizontalList';
import { CategoriesGrid } from '../components/home/CategoriesGrid';
import { TopProvidersSection } from '../components/home/TopProvidersSection';
import { useScreenSafeArea } from '../utils/safeArea';
import { LinearGradient } from 'expo-linear-gradient';

interface HomeScreenProps {
    navigation?: any;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
    const { t, isRTL } = useLanguage();
    const { scrollBottomPadding } = useScreenSafeArea();
    const [refreshing, setRefreshing] = useState(false);
    const [key, setKey] = useState(0);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // Force re-mount of all sections by changing key
        setKey(prev => prev + 1);
        setTimeout(() => setRefreshing(false), 500);
    }, []);

    return (
        <View style={styles.container}>
            <HomeHeader navigation={navigation} />

            <ScrollView
                key={key}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
            >
                <LinearGradient
                    colors={['#F8F4FF', colors.background]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.heroWash}
                />
                <View style={styles.heroCard}>
                    <Text style={styles.heroTitle}>
                        {isRTL ? 'اكتشفي أفضل تجارب الجمال والعناية' : 'Discover premium beauty & wellness experiences'}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                        {isRTL
                            ? 'احجزي بسهولة، اختاري مقدم الخدمة المناسب، واستمتعي بتجربة رفاهية متكاملة.'
                            : 'Book effortlessly, choose the right provider, and enjoy a complete luxury journey.'}
                    </Text>
                </View>
                {/* Section 1: Hot Deals */}
                <SectionHeader title={t('hotDeals')} />
                <HotDealsCarousel navigation={navigation} />

                {/* Section 2: New to Refah */}
                <SectionHeader title={t('newToRefah')} onSeeAll={() => navigation?.navigate('Browse', { title: t('newToRefah') })} />
                <TenantHorizontalList variant="new" navigation={navigation} />

                {/* Section 3: Categories */}
                <SectionHeader title={t('categories')} onSeeAll={() => navigation?.navigate('Browse', { title: t('browseSalons') })} />
                <CategoriesGrid navigation={navigation} />

                {/* Section 4: Trending now */}
                <SectionHeader title={t('trendingNow')} onSeeAll={() => navigation?.navigate('Browse', { title: t('trendingNow') })} />
                <TenantHorizontalList variant="trending" navigation={navigation} />

                {/* Section 5: Top service providers */}
                <SectionHeader title={t('topProviders')} />
                <TopProvidersSection />

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingBottom: spacing.lg,
    },
    heroWash: {
        height: 12,
        width: '100%',
    },
    heroCard: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.sm,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EEE8FB',
        shadowColor: '#1B1540',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 2,
    },
    heroTitle: {
        fontSize: 28,
        lineHeight: 34,
        color: '#13133A',
        fontWeight: '800',
    },
    heroSubtitle: {
        marginTop: 8,
        fontSize: 15,
        lineHeight: 23,
        color: '#626A89',
        fontWeight: '500',
    },
});
