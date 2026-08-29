import React, { useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getMessages, StaffMessage } from '../services/messages';
import { useLanguage } from '../context/LanguageContext';
import { canViewNotifications } from '../utils/capabilities';

export function StaffHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsAllowed = canViewNotifications(user);
  const isArabic = language === 'ar';

  const loadUnreadCount = useCallback(async () => {
    if (!user || !notificationsAllowed) {
      setUnreadCount(0);
      return;
    }

    try {
      const data = await getMessages();
      const systemOnly = data.filter((msg) => {
        const senderType = `${msg.senderType || ''}`.trim().toLowerCase();
        return senderType !== 'admin' && senderType !== 'tenant' && senderType !== 'dashboard_admin';
      });

      const unread = systemOnly.filter((msg) => {
        const readArray = Array.isArray(msg.readBy) ? msg.readBy : [];
        return !readArray.includes(user.id);
      }).length;

      setUnreadCount(unread);
    } catch (error) {
      console.warn('Failed to load notification count:', error);
      setUnreadCount(0);
    }
  }, [user, notificationsAllowed]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadCount();
      
      const interval = setInterval(loadUnreadCount, 30000); // 30 seconds
      return () => clearInterval(interval);
    }, [loadUnreadCount])
  );

  const displayName = user ? `${user.name}` : 'Staff';

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 12, 54) }]}>
      {/* Left: Welcome text */}
      <View style={styles.textContainer}>
        <Text style={styles.welcomeLabel}>{isArabic ? 'مرحباً' : 'Welcome'}</Text>
        <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
      </View>

      {/* Right: Notification Bell */}
      {notificationsAllowed && (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/(tabs)/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#161741" />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FAF8FC', // light theme background
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  textContainer: {
    flex: 1,
  },
  welcomeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444', // Red badge
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FAF8FC',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
