import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { BookingsScreen } from '../screens/BookingsScreen';
import { PurchasesScreen } from '../screens/PurchasesScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { colors } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';

const Tab = createBottomTabNavigator();

export function TabNavigator() {
    const { t, language } = useLanguage();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#E5E7EB',
                    paddingBottom: 5,
                    paddingTop: 5,
                    height: 60,
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
                        <Text style={{ fontSize: size, color }}>🏠</Text>
                    ),
                }}
            />
            <Tab.Screen
                name="Appointments"
                component={BookingsScreen}
                options={{
                    tabBarLabel: t('appointments'),
                    tabBarIcon: ({ color, size }) => (
                        <Text style={{ fontSize: size, color }}>📅</Text>
                    ),
                }}
            />
            <Tab.Screen
                name="Purchases"
                component={PurchasesScreen}
                options={{
                    tabBarLabel: t('purchases'),
                    tabBarIcon: ({ color, size }) => (
                        <Text style={{ fontSize: size, color }}>🛍️</Text>
                    ),
                }}
            />
            <Tab.Screen
                name="Me"
                component={MoreScreen}
                options={{
                    tabBarLabel: t('me'),
                    tabBarIcon: ({ color, size }) => (
                        <Text style={{ fontSize: size, color }}>👤</Text>
                    ),
                }}
            />
        </Tab.Navigator>
    );
}
