import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '../../src/context/AuthContext';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { useTranslation } from 'react-i18next';
import { canViewEarnings, canViewMessages, canViewReviews } from '../../src/utils/capabilities';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const reviewsVisible = canViewReviews(user);
  const earningsVisible = canViewEarnings(user);
  const messagesVisible = canViewMessages(user);

  // Initialize push notification listeners
  usePushNotifications();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#8B5ADF',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#ffffff',
          borderTopWidth: 1,
          borderTopColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('home.today'),
          tabBarIcon: ({ color }) => <Ionicons name="today" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('schedule.title').split(' ')[0],
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: messagesVisible ? undefined : null,
          title: t('messages.title'),
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile.title'),
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
      {/* Conditionally rendered screens based on RBAC */}
      <Tabs.Screen
        name="earnings"
        options={{
          href: earningsVisible ? undefined : null,
          title: t('earnings.title'),
          tabBarIcon: ({ color }) => <Ionicons name="cash-outline" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          href: reviewsVisible ? undefined : null,
          title: t('reviews.title'),
          tabBarIcon: ({ color }) => <Ionicons name="star-outline" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

