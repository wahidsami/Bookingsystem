import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getMessages, markMessageAsRead, StaffMessage } from '../../src/services/messages';
import { formatDistanceToNowSafe } from '../../src/utils/safeDate';
import { canViewNotifications } from '../../src/utils/capabilities';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [items, setItems] = useState<StaffMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const notificationsAllowed = canViewNotifications(user);

  const isUnread = useCallback((msg: StaffMessage) => {
    if (!user?.id) return false;
    const readArray = Array.isArray(msg.readBy) ? msg.readBy : [];
    return !readArray.includes(user.id);
  }, [user?.id]);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getMessages();
      const systemOnly = data.filter((msg) => {
        const senderType = `${msg.senderType || ''}`.trim().toLowerCase();
        return senderType !== 'admin' && senderType !== 'tenant' && senderType !== 'dashboard_admin';
      });
      setItems(systemOnly);
    } catch (error) {
      console.error('Failed to load notifications', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) loadNotifications();
      else setLoading(false);
    }, [user, loadNotifications])
  );

  React.useEffect(() => {
      if (!user) return;

      const subscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
              loadNotifications();
          }
      });

      const interval = setInterval(() => {
          loadNotifications();
      }, 45000);

      return () => {
          subscription.remove();
          clearInterval(interval);
      };
  }, [user, loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleOpen = async (item: StaffMessage) => {
    router.push({
      pathname: '/message/[id]',
      params: { id: item.id, message: JSON.stringify(item) }
    });

    if (isUnread(item)) {
      try {
        await markMessageAsRead(item.id);
        setItems((prev) => prev.map((msg) => {
          if (msg.id !== item.id || !user?.id) return msg;
          return { ...msg, readBy: [...(Array.isArray(msg.readBy) ? msg.readBy : []), user.id] };
        }));
      } catch (error) {
        console.error('Failed to mark notification as read', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!notificationsAllowed ? (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>{t('notifications.notEnabledTitle')}</Text>
        </View>
      ) : loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8B5ADF" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>{t('notifications.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5ADF" />}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const unread = isUnread(item);
            return (
              <TouchableOpacity style={[styles.card, unread && styles.cardUnread]} onPress={() => handleOpen(item)} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.subject, unread && styles.subjectUnread]} numberOfLines={1}>
                    {item.subject || t('notifications.defaultSubject')}
                  </Text>
                  <Text style={styles.timestamp}>{formatDistanceToNowSafe(item.createdAt)}</Text>
                </View>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { marginTop: 12, fontSize: 16, color: '#6b7280', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  cardUnread: { borderColor: '#8B5ADF', backgroundColor: '#f8f3ff' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  subject: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  subjectUnread: { fontWeight: '700' },
  timestamp: { fontSize: 12, color: '#6b7280' },
  body: { marginTop: 8, fontSize: 14, color: '#4b5563', lineHeight: 20 },
});
