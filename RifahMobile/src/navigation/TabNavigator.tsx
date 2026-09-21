import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/HomeScreen';
import { BookingsScreen } from '../screens/BookingsScreen';
import { PurchasesScreen } from '../screens/PurchasesScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { colors } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { AppIcon } from '../components/AppIcon';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';
import { useCart } from '../contexts/CartContext';

import { TabParamList } from './routes';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
    const { t, language, isRTL } = useLanguage();
    const { itemCount: serviceBookingItemCount } = useServiceBookingCart();
    const { itemCount: productCartItemCount } = useCart();
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 12);

    const homeTab = (
        <Tab.Screen
            key="Home"
            name="Home"
            component={HomeScreen}
            options={{
                tabBarLabel: language === 'ar' ? 'الرئيسية' : 'Home',
                tabBarIcon: ({ color, size }) => (
                    <AppIcon name="home" size={size} color={color} />
                ),
            }}
        />
    );

    const appointmentsTab = (
        <Tab.Screen
            key="Appointments"
            name="Appointments"
            component={BookingsScreen}
            options={{
                tabBarLabel: t('appointments'),
                tabBarBadge: serviceBookingItemCount > 0 ? serviceBookingItemCount : undefined,
                tabBarIcon: ({ color, size }) => (
                    <AppIcon name="bookings" size={size} color={color} />
                ),
            }}
        />
    );

    const purchasesTab = (
        <Tab.Screen
            key="Purchases"
            name="Purchases"
            component={PurchasesScreen}
            options={{
                tabBarLabel: t('purchases'),
                tabBarBadge: productCartItemCount > 0 ? productCartItemCount : undefined,
                tabBarIcon: ({ color, size }) => (
                    <AppIcon name="purchases" size={size} color={color} />
                ),
            }}
        />
    );

    const meTab = (
        <Tab.Screen
            key="Me"
            name="Me"
            component={MoreScreen}
            options={{
                tabBarLabel: t('me'),
                tabBarIcon: ({ color, size }) => (
                    <AppIcon name="profile" size={size} color={color} />
                ),
            }}
        />
    );

    // In Arabic RTL, tabs order from right to left so Home is on far right
    const tabs = isRTL
        ? [meTab, purchasesTab, appointmentsTab, homeTab]
        : [homeTab, appointmentsTab, purchasesTab, meTab];

    return (
        <Tab.Navigator
            initialRouteName="Home"
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#E9DDFD',
                    paddingBottom: bottomPadding,
                    paddingTop: 8,
                    height: 58 + bottomPadding,
                    // Shadow for BarSpa premium feel
                    shadowColor: '#2E1065',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 12,
                    elevation: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                    fontFamily: language === 'ar' ? 'Cairo-Regular' : undefined,
                },
            }}
        >
            {tabs}
        </Tab.Navigator>
    );
}
