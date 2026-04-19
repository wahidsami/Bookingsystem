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
  Image,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getTodayAppointments, updateAppointmentStatus, Appointment } from '../../src/services/appointments';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import api, { getImageUrl } from '../../src/services/api';
import { canViewBookingNotes, canViewClients } from '../../src/utils/capabilities';
import { router } from 'expo-router';
import { RIYADH_TIME_ZONE } from '../../src/utils/riyadhDate';

export default function TodayScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null); // tracks which appointment is being updated
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'in_progress' | 'done'>('all');
  const canViewClientContext = canViewClients(user);
  const canSeeBookingNotes = canViewBookingNotes(user);

  // Format time as h:mm A
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: RIYADH_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
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

  const getUrgencyInfo = (item: Appointment): { label: string; color: string; background: string; priority: number } => {
    if (item.status === 'started') {
      return { label: 'In Service', color: '#92400e', background: '#fef3c7', priority: 0 };
    }

    if (['completed', 'no_show', 'cancelled'].includes(item.status)) {
      return { label: 'Closed', color: '#4b5563', background: '#f3f4f6', priority: 4 };
    }

    const minutesToStart = Math.round((new Date(item.startTime).getTime() - Date.now()) / 60000);
    if (minutesToStart < -10) {
      return { label: 'Late', color: '#b91c1c', background: '#fee2e2', priority: 1 };
    }
    if (minutesToStart <= 30) {
      return { label: 'Starting Soon', color: '#9a3412', background: '#ffedd5', priority: 2 };
    }

    return { label: 'Upcoming', color: '#1d4ed8', background: '#dbeafe', priority: 3 };
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredAppointments = appointments.filter((item) => {
    const matchesStatus =
      statusFilter === 'all' ? true :
        statusFilter === 'upcoming' ? ['pending', 'confirmed'].includes(item.status) :
          statusFilter === 'in_progress' ? item.status === 'started' :
            ['completed', 'no_show'].includes(item.status);

    if (!matchesStatus) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const searchFields = [
      item.user?.firstName,
      item.user?.lastName,
      item.user?.phone,
      item.user?.email,
      item.service?.name_en,
      item.service?.name_ar,
      item.bookingNumber,
      item.id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchFields.includes(normalizedSearch);
  });

  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const urgencyDiff = getUrgencyInfo(a).priority - getUrgencyInfo(b).priority;
    if (urgencyDiff !== 0) {
      return urgencyDiff;
    }
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const filterOptions: Array<{ key: 'all' | 'upcoming' | 'in_progress' | 'done'; label: string; count: number }> = [
    { key: 'all', label: 'All', count: appointments.length },
    { key: 'upcoming', label: 'Upcoming', count: appointments.filter((item) => ['pending', 'confirmed'].includes(item.status)).length },
    { key: 'in_progress', label: 'In Progress', count: appointments.filter((item) => item.status === 'started').length },
    { key: 'done', label: 'Done', count: appointments.filter((item) => ['completed', 'no_show'].includes(item.status)).length },
  ];
  const todaySignals = [
    { label: 'Late', value: appointments.filter((item) => getUrgencyInfo(item).label === 'Late').length },
    { label: 'Starting Soon', value: appointments.filter((item) => getUrgencyInfo(item).label === 'Starting Soon').length },
    { label: 'In Service', value: appointments.filter((item) => item.status === 'started').length },
    { label: 'Revenue', value: `SAR ${appointments.reduce((sum, item) => sum + Number(item.service?.finalPrice || item.service?.basePrice || 0), 0).toFixed(0)}` },
  ];

  const renderAppointmentCard = ({ item }: { item: Appointment }) => {
    const isCompleted = item.status === 'completed' || item.status === 'no_show';
    const isStarted = item.status === 'started';
    const customerInitial = item.user?.firstName?.charAt(0)?.toUpperCase() || item.user?.lastName?.charAt(0)?.toUpperCase() || 'C';
    const amount = Number(item.service?.finalPrice || item.service?.basePrice || 0);
    const urgency = getUrgencyInfo(item);

    return (
      <View style={[styles.card, isCompleted && styles.cardCompleted]}>
        <View style={styles.cardHeader}>
          <View style={styles.timeBox}>
            <Text style={styles.timeText}>{formatTime(item.startTime)}</Text>
            <Text style={styles.durationText}>{item.service?.duration || 0} min</Text>
          </View>
          <View style={styles.cardHeaderBadges}>
            <View style={[styles.urgencyBadge, { backgroundColor: urgency.background }]}>
              <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
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
        </View>

        <View style={styles.cardBody}>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              {item.user?.profileImage ? (
                <Image
                  source={{ uri: getImageUrl(item.user.profileImage) }}
                  style={styles.customerAvatarImage}
                />
              ) : (
                <Text style={styles.customerAvatarInitial}>{customerInitial}</Text>
              )}
            </View>
            <View style={styles.customerMeta}>
              <Text style={styles.customerName}>
                {item.user?.firstName} {item.user?.lastName}
              </Text>
              <Text style={styles.bookingMeta}>
                Booking #{item.bookingNumber?.slice(0, 8) || item.id.slice(0, 8)}
              </Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountText}>SAR {amount.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={styles.serviceName}>
            {item.service?.name_en}
          </Text>
          {item.paymentStatus ? (
            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Ionicons name="card-outline" size={13} color="#6b7280" />
                <Text style={styles.metaBadgeText}>{item.paymentStatus.replace(/_/g, ' ')}</Text>
              </View>
              {item.paymentMethod ? (
                <View style={styles.metaBadge}>
                  <Ionicons name="wallet-outline" size={13} color="#6b7280" />
                  <Text style={styles.metaBadgeText}>{item.paymentMethod.replace(/_/g, ' ')}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {canSeeBookingNotes && item.notes && (
            <View style={styles.notesContainer}>
              <Ionicons name="document-text-outline" size={14} color="#6b7280" />
              <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>
            </View>
          )}

          {canViewClientContext && item.user?.id ? (
            <TouchableOpacity
              style={styles.clientButton}
              onPress={() => router.push((`/client/${item.user?.id}` as any))}
            >
              <Ionicons name="person-circle-outline" size={16} color="#6d28d9" style={styles.clientButtonIcon} />
              <Text style={styles.clientButtonText}>View Client</Text>
            </TouchableOpacity>
          ) : null}
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
                  const hour = Number(new Intl.DateTimeFormat('en-US', {
                    timeZone: RIYADH_TIME_ZONE,
                    hour: '2-digit',
                    hour12: false,
                  }).format(new Date()));
                  if (hour < 12) return t('home.goodMorning');
                  if (hour < 17) return t('home.goodAfternoon');
                  return t('home.goodEvening') || 'Good Evening';
                })()}
              </Text>
              <Text style={styles.name}>{user?.name?.split(' ')[0] || 'Staff'} {Number(new Intl.DateTimeFormat('en-US', {
                timeZone: RIYADH_TIME_ZONE,
                hour: '2-digit',
                hour12: false,
              }).format(new Date())) < 17 ? '☀️' : '🌙'}</Text>
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

          {!loading && appointments.length > 0 ? (
            <>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#6b7280" style={styles.searchIcon} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search client, service, phone, booking..."
                  placeholderTextColor="#9ca3af"
                  style={styles.searchInput}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {filterOptions.map((option) => {
                  const active = statusFilter === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setStatusFilter(option.key)}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        {option.label} ({option.count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.resultsLabel}>
                Showing {filteredAppointments.length} of {appointments.length} appointments
              </Text>

              <View style={styles.signalRow}>
                {todaySignals.map((signal) => (
                  <View key={signal.label} style={styles.signalCard}>
                    <Text style={styles.signalValue}>{signal.value}</Text>
                    <Text style={styles.signalLabel}>{signal.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

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
          ) : filteredAppointments.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="search-outline" size={56} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No matching appointments</Text>
              <Text style={styles.emptySubtitle}>Try a different search or change the selected filter.</Text>
            </View>
          ) : (
            <FlatList
              data={sortedAppointments}
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    paddingVertical: 10,
  },
  filterRow: {
    paddingBottom: 10,
    gap: 10,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#ede9fe',
    borderColor: '#8B5ADF',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  filterChipTextActive: {
    color: '#6d28d9',
  },
  resultsLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  signalCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  signalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6d28d9',
    marginBottom: 4,
  },
  signalLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
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
  cardHeaderBadges: {
    alignItems: 'flex-end',
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
    marginTop: 6,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
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
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  customerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  customerAvatarInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6d28d9',
  },
  customerMeta: {
    flex: 1,
  },
  bookingMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  amountBox: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  serviceName: {
    fontSize: 15,
    color: '#4b5563',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  metaBadgeText: {
    fontSize: 12,
    color: '#4b5563',
    marginLeft: 6,
    textTransform: 'capitalize',
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
  clientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f3ff',
    borderRadius: 999,
  },
  clientButtonIcon: {
    marginRight: 6,
  },
  clientButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6d28d9',
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
