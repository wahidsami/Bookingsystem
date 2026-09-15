import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '../../src/context/AuthContext';
import {
  getVisibleStaffTabSections,
  staffIconMap,
} from '../../src/utils/staffNavigation';
import { useLanguage } from '../../src/context/LanguageContext';
import { StaffHeader } from '../../src/components/StaffHeader';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { bottom } = useSafeAreaInsets();
  const { user } = useAuth();
  const { language } = useLanguage();
  const visibleSections = getVisibleStaffTabSections(user, language);

  return (
    <Tabs
      initialRouteName="schedule"
      screenOptions={{
        tabBarActiveTintColor: '#8B5ADF',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
        headerShown: true,
        header: () => <StaffHeader />,
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
      {/* Hide all these auxiliary screens from the tab bar */}
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="home" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="appointments" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="more" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="earnings" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="profile" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="reviews" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="notifications" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="pos" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="explore" options={{ href: null, headerShown: false }} />

      {/* Primary strict tabs (conditionally rendered) */}
      {['schedule', 'customers', 'messages', 'account'].map((routeName) => {
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

