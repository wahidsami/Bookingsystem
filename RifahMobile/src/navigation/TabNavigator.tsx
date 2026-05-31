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

const Tab = createBottomTabNavigator();

export function TabNavigator() {
    const { t, language } = useLanguage();
    const { itemCount: serviceBookingItemCount } = useServiceBookingCart();
    const { itemCount: productCartItemCount } = useCart();
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 12);

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#E5E7EB',
                    paddingBottom: bottomPadding,
                    paddingTop: 8,
                    height: 58 + bottomPadding,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                    fontFamily: language === 'ar' ? 'Cairo-Regular' : undefined,
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarLabel: language === 'ar' ? 'الرئيسية' : 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <AppIcon name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
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
            <Tab.Screen
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
            <Tab.Screen
                name="Me"
                component={MoreScreen}
                options={{
                    tabBarLabel: t('me'),
                    tabBarIcon: ({ color, size }) => (
                        <AppIcon name="profile" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}
