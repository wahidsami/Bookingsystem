import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '../../src/context/AuthContext';
import {
  getOverflowStaffSections,
  getVisibleStaffTabSections,
  staffIconMap,
} from '../../src/utils/staffNavigation';
import { useLanguage } from '../../src/context/LanguageContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { bottom } = useSafeAreaInsets();
  const { user } = useAuth();
  const { language } = useLanguage();
  const visibleSections = getVisibleStaffTabSections(user, language);
  const overflowSections = getOverflowStaffSections(user, language);
  const hasMoreTab = overflowSections.some((section) => section.kind === 'tab');
  const isArabic = language === 'ar';

  return (
    <Tabs
      initialRouteName="appointments"
      screenOptions={{
        tabBarActiveTintColor: '#8B5ADF',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#ffffff',
          borderTopWidth: 1,
          borderTopColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
          height: 76 + bottom,
          paddingBottom: Math.max(20, bottom + 16),
          paddingTop: 8,
          paddingHorizontal: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          href: null,
        }}
      />

      {['appointments', 'schedule', 'customers', 'reviews', 'messages', 'notifications', 'earnings', 'profile', 'more', 'pos', 'explore'].map((routeName) => {
        if (routeName === 'more') {
          if (!hasMoreTab) {
            return <Tabs.Screen key={routeName} name={routeName} options={{ href: null }} />;
          }

          return (
            <Tabs.Screen
              key={routeName}
              name={routeName}
              options={{
                title: isArabic ? 'المزيد' : 'More',
                tabBarIcon: ({ color }) => <Ionicons name="menu-outline" size={22} color={color} />,
              }}
            />
          );
        }

        const section = visibleSections.find((item) => item.route === routeName);
        if (section) {
          return (
            <Tabs.Screen
              key={routeName}
              name={routeName}
              options={{
                title: language === 'ar' ? section.labelAr : section.labelEn,
                tabBarIcon: ({ color }) => (
                  <Ionicons name={staffIconMap[section.icon] as React.ComponentProps<typeof Ionicons>['name']} size={22} color={color} />
                ),
              }}
            />
          );
        }

        return <Tabs.Screen key={routeName} name={routeName} options={{ href: null }} />;
      })}
    </Tabs>
  );
}

