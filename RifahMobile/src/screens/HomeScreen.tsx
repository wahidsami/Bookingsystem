import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { HomeHeader } from '../components/home/HomeHeader';
import { SectionTitle } from '../components/ui/SectionTitle';
import { HotDealsCarousel } from '../components/home/HotDealsCarousel';
import { TenantHorizontalList } from '../components/home/TenantHorizontalList';
import { CategoriesGrid } from '../components/home/CategoriesGrid';
import { TopProvidersSection } from '../components/home/TopProvidersSection';
import { useScreenSafeArea } from '../utils/safeArea';
import { spacing } from '../theme/colors';

interface HomeScreenProps {
    navigation?: any;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
    const { t } = useLanguage();
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
                contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding + spacing.xl }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#6537C0']}
                        tintColor="#6537C0"
                    />
                }
            >
                {/* Section 1: Hot Deals (Stitch Section 2) */}
                <SectionTitle 
                    title={t('hotDeals')} 
                    style={styles.sectionHeader}
                />
                <HotDealsCarousel navigation={navigation} />

                {/* Section 2: Trending now (Stitch Section 3) */}
                <SectionTitle 
                    title={t('trendingNow')} 
                    actionLabel={t('seeAll')}
                    onActionPress={() => navigation?.navigate('Browse', { filter: 'trending', title: t('trendingNow') })}
                    style={styles.sectionHeader}
                />
                <TenantHorizontalList variant="trending" navigation={navigation} />

                {/* Section 3: New to Refah (Stitch Section 4) */}
                <SectionTitle 
                    title={t('newToBarSpa')} 
                    actionLabel={t('seeAll')}
                    onActionPress={() => navigation?.navigate('Browse', { filter: 'new', title: t('newToBarSpa') })}
                    style={styles.sectionHeader}
                />
                <TenantHorizontalList variant="new" navigation={navigation} />

                {/* Section 4: Categories (Stitch Section 5) */}
                <SectionTitle 
                    title={t('categories')} 
                    actionLabel={t('seeAll')}
                    onActionPress={() => navigation?.navigate('Browse', { title: t('categories') })}
                    style={styles.sectionHeader}
                />
                <CategoriesGrid navigation={navigation} />

                {/* Section 5: Top service providers (Stitch Section 6) */}
                <SectionTitle 
                    title={t('topProviders')} 
                    style={styles.sectionHeader}
                />
                <TopProvidersSection navigation={navigation} />

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC', // Stitch canvas background
    },
    scrollContent: {
        paddingTop: spacing.xs,
    },
    sectionHeader: {
        paddingHorizontal: spacing.lg,
        marginTop: 18,
        marginBottom: 10,
    },
});
