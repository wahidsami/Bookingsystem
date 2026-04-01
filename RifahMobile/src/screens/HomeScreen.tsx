import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { HomeHeader } from '../components/home/HomeHeader';
import { SectionHeader } from '../components/home/SectionHeader';
import { HotDealsCarousel } from '../components/home/HotDealsCarousel';
import { TenantHorizontalList } from '../components/home/TenantHorizontalList';
import { CategoriesGrid } from '../components/home/CategoriesGrid';
import { TopProvidersSection } from '../components/home/TopProvidersSection';

interface HomeScreenProps {
    navigation?: any;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
    const { t } = useLanguage();
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
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
            >
                {/* Section 1: Hot Deals */}
                <SectionHeader title={`🔥 ${t('hotDeals')}`} onSeeAll={() => console.log('See all deals')} />
                <HotDealsCarousel navigation={navigation} />

                {/* Section 2: New to Refah */}
                <SectionHeader title={t('newToRefah')} onSeeAll={() => console.log('See all new')} />
                <TenantHorizontalList variant="new" navigation={navigation} />

                {/* Section 3: Categories */}
                <SectionHeader title={t('categories')} onSeeAll={() => console.log('See all categories')} />
                <CategoriesGrid navigation={navigation} />

                {/* Section 4: Trending now */}
                <SectionHeader title={t('trendingNow')} onSeeAll={() => console.log('See all trending')} />
                <TenantHorizontalList variant="trending" navigation={navigation} />

                {/* Section 5: Top service providers */}
                <SectionHeader title={t('topProviders')} onSeeAll={() => console.log('See all providers')} />
                <TopProvidersSection />

                {/* Bottom padding */}
                <View style={{ height: spacing.xl }} />
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
});
