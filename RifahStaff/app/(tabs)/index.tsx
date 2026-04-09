import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getTodayAppointments, updateAppointmentStatus, Appointment } from '../../src/services/appointments';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import api, { getImageUrl } from '../../src/services/api';

export default function TodayScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null); // tracks which appointment is being updated

  // Format time as h:mm A
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const loadAppointments = useCallback(async () => {
    try {
      const data = await getTodayAppointments();
      setAppointments(data);
    } catch (error) {
      console.error('Failed to load appointments', error);
      // Fallback/UI alert could go here
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Wait until auth session is fully restored before making any API calls.
    // Without this guard, the screen fires requests before the JWT is loaded
    // from SecureStore, causing 401 → refresh loop on every cold start.
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadAppointments();
  }, [authLoading, user, loadAppointments]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const handleStatusUpdate = async (id: string, newStatus: 'started' | 'completed' | 'no-show') => {
    if (updatingId) return; // Prevent double-tap
    try {
      setUpdatingId(id);
      await updateAppointmentStatus(id, newStatus);
      loadAppointments();
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const renderAppointmentCard = ({ item }: { item: Appointment }) => {
    const isCompleted = item.status === 'completed' || item.status === 'no_show';
    const isStarted = item.status === 'started';

    return (
      <View style={[styles.card, isCompleted && styles.cardCompleted]}>
        <View style={styles.cardHeader}>
          <View style={styles.timeBox}>
            <Text style={styles.timeText}>{formatTime(item.startTime)}</Text>
            <Text style={styles.durationText}>{item.service?.duration || 0} min</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={[
              styles.statusText,
              item.status === 'started' && { color: '#fbbf24' },
              item.status === 'completed' && { color: '#10b981' },
              item.status === 'cancelled' && { color: '#ef4444' },
            ]}>
              {t(`status.${item.status === 'no_show' ? 'noShow' : item.status}`).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.customerName}>
            {item.user?.firstName} {item.user?.lastName}
          </Text>
          <Text style={styles.serviceName}>
            {item.service?.name_en}
          </Text>

          {user?.permissions?.view_clients && item.customerNotes && (
            <View style={styles.notesContainer}>
              <Ionicons name="document-text-outline" size={14} color="#6b7280" />
              <Text style={styles.notesText} numberOfLines={2}>{item.customerNotes}</Text>
            </View>
          )}
        </View>

        {!isCompleted && item.status !== 'cancelled' && (
          <View style={styles.cardActions}>
            {!isStarted ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.startBtn, updatingId === item.id && { opacity: 0.6 }]}
                onPress={() => handleStatusUpdate(item.id, 'started')}
                disabled={!!updatingId}
              >
                {updatingId === item.id
                  ? <ActivityIndicator size="small" color="#ffffff" style={styles.btnIcon} />
                  : <Ionicons name="play" size={16} color="#ffffff" style={styles.btnIcon} />}
                <Text style={styles.btnTextWhite}>{t('status.start')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.completeBtn, updatingId === item.id && { opacity: 0.6 }]}
                onPress={() => handleStatusUpdate(item.id, 'completed')}
                disabled={!!updatingId}
              >
                {updatingId === item.id
                  ? <ActivityIndicator size="small" color="#ffffff" style={styles.btnIcon} />
                  : <Ionicons name="checkmark-done" size={16} color="#ffffff" style={styles.btnIcon} />}
                <Text style={styles.btnTextWhite}>{t('status.complete')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.noShowBtn, updatingId === item.id && { opacity: 0.4 }]}
              onPress={() => handleStatusUpdate(item.id, 'no-show')}
              disabled={!!updatingId}
            >
              <Text style={styles.btnTextGray}>{t('status.noShow')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B5ADF']} />
        }
      >
        <LinearGradient
          colors={['#8B5ADF', '#683AB7']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>
                {(() => {
                  const hour = new Date().getHours();
                  if (hour < 12) return t('home.goodMorning');
                  if (hour < 17) return t('home.goodAfternoon');
                  return t('home.goodEvening') || 'Good Evening';
                })()}
              </Text>
              <Text style={styles.name}>{user?.name?.split(' ')[0] || 'Staff'} {new Date().getHours() < 17 ? '☀️' : '🌙'}</Text>
            </View>
            <View style={styles.avatarContainer}>
              {user?.photo ? (
                <Image
                  source={{ uri: getImageUrl(user.photo) }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'S'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.statsStrip}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{appointments.length}</Text>
              <Text style={styles.statLabel}>{t('home.today')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {appointments.filter(a => a.status === 'completed').length}
              </Text>
              <Text style={styles.statLabel}>{t('home.done')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>{t('home.todayQueue')}</Text>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#8B5ADF" />
            </View>
          ) : appointments.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="calendar-clear-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>{t('home.noAppointments')}</Text>
              <Text style={styles.emptySubtitle}>{t('home.noAppointmentsSub')}</Text>
            </View>
          ) : (
            <FlatList
              data={appointments}
              keyExtractor={(item) => item.id}
              renderItem={renderAppointmentCard}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false} // Disable nested scrolling since we are inside a ScrollView
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: Platform.OS === 'android' ? 20 : 10,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  avatarContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 28,
    padding: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  listContainer: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardCompleted: {
    opacity: 0.7,
    backgroundColor: '#f9fafb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timeBox: {
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5ADF',
  },
  durationText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  cardBody: {
    marginBottom: 16,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 15,
    color: '#4b5563',
  },
  notesContainer: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'flex-start',
  },
  notesText: {
    fontSize: 13,
    color: '#92400e',
    marginLeft: 6,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  startBtn: {
    backgroundColor: '#8B5ADF',
  },
  completeBtn: {
    backgroundColor: '#10b981',
  },
  noShowBtn: {
    backgroundColor: '#f3f4f6',
  },
  btnIcon: {
    marginRight: 6,
  },
  btnTextWhite: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  btnTextGray: {
    color: '#4b5563',
    fontWeight: '500',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4b5563',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});
