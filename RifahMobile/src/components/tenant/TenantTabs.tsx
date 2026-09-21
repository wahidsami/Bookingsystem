import React from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { useLanguage } from '../../contexts/LanguageContext';

export type TenantTabType = 'about' | 'services' | 'products' | 'gifts' | 'reviews';

export interface TenantTabsProps {
    activeTab: TenantTabType;
    onTabChange: (tab: TenantTabType) => void;
    availableTabs?: TenantTabType[];
}

const DEFAULT_TABS: TenantTabType[] = ['about', 'services', 'products', 'gifts', 'reviews'];

export function TenantTabs({
    activeTab,
    onTabChange,
    availableTabs = DEFAULT_TABS,
}: TenantTabsProps) {
    const { isRTL } = useLanguage();

    const getTabLabel = (tab: TenantTabType): string => {
        switch (tab) {
            case 'about':
                return isRTL ? 'عن الصالون' : 'About';
            case 'services':
                return isRTL ? 'الخدمات' : 'Services';
            case 'products':
                return isRTL ? 'المنتجات' : 'Products';
            case 'gifts':
                return isRTL ? 'بطاقات الهدايا' : 'Gift Cards';
            case 'reviews':
                return isRTL ? 'التقييمات' : 'Reviews';
        }
    };

    const renderTab = ({ item: tab }: { item: TenantTabType }) => {
        const isActive = activeTab === tab;
        return (
            <TouchableOpacity
                key={tab}
                onPress={() => onTabChange(tab)}
                style={[
                    styles.tabButton,
                    isActive && styles.tabButtonActive,
                ]}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
            >
                <Text
                    style={[
                        styles.tabLabel,
                        isActive && styles.tabLabelActive,
                        isRTL && styles.tabLabelRTL,
                    ]}
                >
                    {getTabLabel(tab)}
                </Text>
                {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={availableTabs}
                renderItem={renderTab}
                keyExtractor={(item) => item}
                horizontal
                inverted={isRTL}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: 'rgba(231, 221, 252, 0.8)',
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
    },
    scrollContent: {
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    tabButton: {
        paddingHorizontal: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    tabButtonActive: {},
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#716B88',
    },
    tabLabelActive: {
        color: '#1D035F',
        fontWeight: '700',
    },
    tabLabelRTL: {
        fontFamily: 'Cairo-Bold',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 14,
        right: 14,
        height: 2.5,
        backgroundColor: '#6537C0',
        borderRadius: 2,
    },
});
