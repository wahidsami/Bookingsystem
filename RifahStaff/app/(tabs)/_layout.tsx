import { Tabs } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '../../src/context/AuthContext';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { useTranslation } from 'react-i18next';
import { getMessages, StaffMessage } from '../../src/services/messages';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize push notification listeners
  const { notification } = usePushNotifications();

  // Count unread messages
  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const messages = await getMessages();
      const count = messages.filter((m: StaffMessage) => {
        const readArray = Array.isArray(m.readBy) ? m.readBy : [];
        return !readArray.includes(user.id!);
      }).length;
      setUnreadCount(count);
    } catch (e) {
      // silently fail — badge is cosmetic
    }
  }, [user?.id]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // Re-check when a new notification arrives (real-time badge update)
  useEffect(() => {
    if (notification) {
      refreshUnreadCount();
    }
  }, [notification, refreshUnreadCount]);

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
          title: t('schedule.title').split(' ')[0], // keep it short for tab bar
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages.title'),
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble-ellipses" size={24} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', fontSize: 11 },
        }}
        listeners={{
          tabPress: () => {
            // Refresh badge when switching to messages tab
            setTimeout(refreshUnreadCount, 1500);
          }
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
          href: user?.permissions?.view_earnings ? "/earnings" : null,
          title: t('earnings.title'),
          tabBarIcon: ({ color }) => <Ionicons name="cash-outline" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          href: user?.permissions?.view_reviews ? "/reviews" : null,
          title: t('reviews.title'),
          tabBarIcon: ({ color }) => <Ionicons name="star-outline" size={24} color={color} />
        }}
      />
    </Tabs>
  );
}

