import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getApiUrl } from './src/config/env';
import {
  changeStaffPassword,
  fetchApiHealth,
  fetchStaffAppointments,
  fetchStaffMe,
  fetchStaffSchedule,
  loginStaff,
  logoutStaff,
  readStoredSession,
  StaffAppointment,
  StaffAppointmentStatus,
  StaffSchedule,
  StaffSession,
  updateStaffAppointmentStatus,
  writeStoredSession,
} from './src/lib/api';
import {
  initializeStaffNotificationHandling,
  registerStaffPushNotifications,
  unregisterStaffPushNotifications,
} from './src/lib/notifications';

type TabKey = 'overview' | 'appointments' | 'schedule' | 'profile';

const getTodayKey = () => new Date().toISOString().split('T')[0];

const formatTime = (value?: string | null) => {
  if (!value) return '--';

  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMoney = (value?: string | number | null) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 'SAR 0';
  return `SAR ${numeric.toFixed(2)}`;
};

const getCustomerName = (appointment: StaffAppointment) => {
  const first = appointment.user?.firstName || '';
  const last = appointment.user?.lastName || '';
  const name = `${first} ${last}`.trim();
  return name || appointment.user?.email || appointment.user?.phone || 'Guest customer';
};

const getServiceName = (appointment: StaffAppointment) =>
  appointment.service?.name_en || appointment.service?.name_ar || 'Service';

const formatAppointmentStatus = (status: StaffAppointment['status']) => ({
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  in_service: 'In Service',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
}[status] || status);

export default function App() {
  const apiUrl = getApiUrl();
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [schedule, setSchedule] = useState<StaffSchedule | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabKey>('overview');
  const [selectedDate] = useState(getTodayKey());
  const [dataError, setDataError] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const cleanup = initializeStaffNotificationHandling();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    registerStaffPushNotifications(session).catch((error) => {
      console.warn('Staff push registration warning:', error?.message || error);
    });
  }, [session?.accessToken, session?.staff.id]);

  const loadDashboard = async (activeSession: StaffSession, showSpinner = true) => {
    if (showSpinner) {
      setRefreshing(true);
    }
    setDataError(null);

    try {
      const [staff, staffAppointments, staffSchedule] = await Promise.all([
        fetchStaffMe(activeSession),
        fetchStaffAppointments(activeSession, selectedDate),
        fetchStaffSchedule(activeSession, selectedDate),
      ]);

      const nextSession = {
        ...activeSession,
        staff,
      };

      await writeStoredSession(nextSession);
      setSession(nextSession);
      setAppointments(staffAppointments);
      setSchedule(staffSchedule);
      if (selectedAppointmentId && !staffAppointments.some((item) => item.id === selectedAppointmentId)) {
        setSelectedAppointmentId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load staff data';
      setDataError(message);
    } finally {
      if (showSpinner) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedSession = await readStoredSession();
        if (!storedSession) return;

        const staff = await fetchStaffMe(storedSession);
        const nextSession = { ...storedSession, staff };
        await writeStoredSession(nextSession);
        setSession(nextSession);
        await loadDashboard(nextSession, false);
      } catch {
        await logoutStaff(null);
        setSession(null);
      } finally {
        setBooting(false);
      }
    };

    bootstrap();
  }, []);

  const pingApi = async () => {
    setLoading(true);
    setHealthMessage(null);
    try {
      const r = await fetchApiHealth();
      if (r.ok && r.data?.message) setHealthMessage(String(r.data.message));
      else if (r.data?.message) setHealthMessage(String(r.data.message));
      else if (r.error) setHealthMessage(`Error: ${r.error}`);
      else setHealthMessage('Connected (unexpected response)');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Email and password are required.');
      return;
    }

    setLoading(true);
    setLoginError(null);

    try {
      const nextSession = await loginStaff(loginEmail.trim(), loginPassword);
      await writeStoredSession(nextSession);
      setSession(nextSession);
      setSelectedTab('overview');
      setLoginPassword('');
      await loadDashboard(nextSession, false);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
      setBooting(false);
    }
  };

  const handleLogout = async () => {
    await unregisterStaffPushNotifications(session);
    await logoutStaff(session);
    setSession(null);
    setAppointments([]);
    setSchedule(null);
    setSelectedTab('overview');
    setLoginPassword('');
    setDataError(null);
    setActionMessage(null);
    setCurrentPassword('');
    setNewPassword('');
  };

  const handleAppointmentAction = async (
    appointment: StaffAppointment,
    status: StaffAppointmentStatus
  ) => {
    if (!session) return;

    setActionLoading(appointment.id);
    setActionMessage(null);
    setDataError(null);

    try {
      const updatedAppointment = await updateStaffAppointmentStatus(session, appointment.id, { status });
      setAppointments((current) =>
        current.map((item) => (item.id === appointment.id ? { ...item, ...updatedAppointment } : item))
      );

      const messageMap = {
        checked_in: 'Customer checked in successfully.',
        in_service: 'Service started successfully.',
        confirmed: 'Appointment confirmed successfully.',
        completed: 'Appointment marked as completed.',
        no_show: 'Appointment marked as no-show.',
        cancelled: 'Appointment cancelled successfully.',
        pending: 'Appointment updated successfully.',
      };

      setActionMessage(messageMap[status]);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to update appointment');
    } finally {
      setActionLoading(null);
    }
  };

  const selectedAppointment =
    appointments.find((appointment) => appointment.id === selectedAppointmentId) || null;

  const getAvailableActions = (appointment: StaffAppointment) => {
    switch (appointment.status) {
      case 'pending':
      case 'confirmed':
        return [
          { label: 'Check In', status: 'checked_in' as const },
          { label: 'No Show', status: 'no_show' as const },
          { label: 'Cancel', status: 'cancelled' as const },
        ];
      case 'checked_in':
        return [
          { label: 'Start Service', status: 'in_service' as const },
          { label: 'No Show', status: 'no_show' as const },
          { label: 'Cancel', status: 'cancelled' as const },
        ];
      case 'in_service':
        return [
          { label: 'Complete', status: 'completed' as const },
          { label: 'Cancel', status: 'cancelled' as const },
        ];
      default:
        return [];
    }
  };

  const handlePasswordChange = async () => {
    if (!session) return;

    if (!currentPassword.trim() || !newPassword.trim()) {
      setDataError('Current password and new password are required.');
      return;
    }

    if (newPassword.trim().length < 8) {
      setDataError('New password must be at least 8 characters long.');
      return;
    }

    setPasswordLoading(true);
    setDataError(null);
    setActionMessage(null);

    try {
      const result = await changeStaffPassword(session, {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      setCurrentPassword('');
      setNewPassword('');
      setActionMessage(result.message || 'Password updated successfully.');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.bootText}>Loading staff workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.authShell}>
          <View style={styles.authHeader}>
            <Text style={styles.brandEyebrow}>Rifah Staff</Text>
            <Text style={styles.authTitle}>Sign in to your staff account</Text>
            <Text style={styles.authSubtitle}>
              Use the employee email and password created from the tenant dashboard.
            </Text>
          </View>

          <View style={styles.authCard}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="employee@rifah.sa"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={loginEmail}
              onChangeText={setLoginEmail}
            />

            <Text style={[styles.label, styles.fieldSpacing]}>Password</Text>
            <TextInput
              secureTextEntry
              placeholder="Your staff password"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={loginPassword}
              onChangeText={setLoginPassword}
            />

            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </Pressable>

            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>API base</Text>
              <Text style={styles.metaValue}>{apiUrl}</Text>
            </View>

            <Pressable style={styles.secondaryButton} onPress={pingApi} disabled={loading}>
              <Text style={styles.secondaryButtonText}>Ping API</Text>
            </Pressable>

            {healthMessage ? <Text style={styles.healthText}>{healthMessage}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const completedCount = appointments.filter((appointment) => appointment.status === 'completed').length;
  const confirmedCount = appointments.filter((appointment) =>
    ['pending', 'confirmed', 'checked_in', 'in_service'].includes(appointment.status)
  ).length;
  const nextAppointment =
    appointments.find((appointment) => new Date(appointment.startTime).getTime() >= Date.now()) || appointments[0] || null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.brandEyebrow}>{session.staff.tenant?.businessName || 'Rifah'}</Text>
          <Text style={styles.dashboardTitle}>Welcome, {session.staff.name}</Text>
          <Text style={styles.dashboardSubtitle}>Today: {selectedDate}</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={() => loadDashboard(session)} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color="#0f766e" /> : <Text style={styles.refreshButtonText}>Refresh</Text>}
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {(['overview', 'appointments', 'schedule', 'profile'] as TabKey[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setSelectedTab(tab)}
            style={[styles.tabButton, selectedTab === tab ? styles.tabButtonActive : null]}
          >
            <Text style={[styles.tabText, selectedTab === tab ? styles.tabTextActive : null]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {dataError ? <Text style={styles.errorText}>{dataError}</Text> : null}
        {actionMessage ? <Text style={styles.successText}>{actionMessage}</Text> : null}

        {selectedTab === 'overview' ? (
          <>
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{appointments.length}</Text>
                <Text style={styles.metricLabel}>Appointments</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{confirmedCount}</Text>
                <Text style={styles.metricLabel}>Active</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{completedCount}</Text>
                <Text style={styles.metricLabel}>Completed</Text>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Next appointment</Text>
              {nextAppointment ? (
                <>
                  <Text style={styles.panelPrimary}>{getCustomerName(nextAppointment)}</Text>
                  <Text style={styles.panelSecondary}>{getServiceName(nextAppointment)}</Text>
                  <Text style={styles.panelMeta}>
                    {formatTime(nextAppointment.startTime)} - {formatTime(nextAppointment.endTime)} • {formatAppointmentStatus(nextAppointment.status)}
                  </Text>
                </>
              ) : (
                <Text style={styles.emptyText}>No appointments are scheduled for today.</Text>
              )}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Today at a glance</Text>
              <Text style={styles.panelSecondary}>
                {schedule?.hasTimeOff
                  ? 'This staff member has approved time off on this date.'
                  : schedule?.workingWindow?.length
                    ? `Working windows: ${schedule.workingWindow
                        .map((window) => `${formatTime(window.startTime)}-${formatTime(window.endTime)}`)
                        .join(', ')}`
                    : 'No active shift is configured for this date.'}
              </Text>
            </View>
          </>
        ) : null}

        {selectedTab === 'appointments' ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Today&apos;s appointments</Text>
              {appointments.length === 0 ? (
                <Text style={styles.emptyText}>No appointments assigned for this date.</Text>
              ) : (
                appointments.map((appointment) => {
                  const isSelected = selectedAppointmentId === appointment.id;

                  return (
                    <Pressable
                      key={appointment.id}
                      style={[styles.listItem, isSelected ? styles.listItemSelected : null]}
                      onPress={() => setSelectedAppointmentId(appointment.id)}
                    >
                      <View style={styles.listItemHeader}>
                        <Text style={styles.listItemTitle}>{getCustomerName(appointment)}</Text>
                        <Text style={styles.listItemBadge}>
                          {formatAppointmentStatus(appointment.status)}
                        </Text>
                      </View>
                      <Text style={styles.listItemText}>{getServiceName(appointment)}</Text>
                      <Text style={styles.listItemText}>
                        {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                      </Text>
                      <Text style={styles.listItemText}>
                        {appointment.paymentStatus || 'pending payment'} •{' '}
                        {formatMoney(appointment.price || appointment.service?.finalPrice || appointment.service?.rawPrice)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            {selectedAppointment ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Appointment detail</Text>
                <Text style={styles.profileLine}>Customer: {getCustomerName(selectedAppointment)}</Text>
                <Text style={styles.profileLine}>Service: {getServiceName(selectedAppointment)}</Text>
                <Text style={styles.profileLine}>
                  Time: {formatTime(selectedAppointment.startTime)} - {formatTime(selectedAppointment.endTime)}
                </Text>
                <Text style={styles.profileLine}>
                  Status: {formatAppointmentStatus(selectedAppointment.status)}
                </Text>
                <Text style={styles.profileLine}>
                  Payment: {selectedAppointment.paymentStatus || 'pending'} ({formatMoney(selectedAppointment.price || selectedAppointment.service?.finalPrice || selectedAppointment.service?.rawPrice)})
                </Text>
                <Text style={styles.profileLine}>Phone: {selectedAppointment.user?.phone || 'Not provided'}</Text>
                <Text style={styles.profileLine}>Email: {selectedAppointment.user?.email || 'Not provided'}</Text>
                <Text style={styles.profileLine}>Notes: {selectedAppointment.notes || 'No notes'}</Text>

                <View style={styles.actionRow}>
                  {getAvailableActions(selectedAppointment).length ? (
                    getAvailableActions(selectedAppointment).map((action) => (
                      <Pressable
                        key={action.status}
                        style={styles.actionButton}
                        onPress={() => handleAppointmentAction(selectedAppointment, action.status)}
                        disabled={actionLoading === selectedAppointment.id}
                      >
                        {actionLoading === selectedAppointment.id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.actionButtonText}>{action.label}</Text>
                        )}
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No further actions are available for this appointment.</Text>
                  )}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {selectedTab === 'schedule' ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Shifts</Text>
              {schedule?.shifts?.length ? (
                schedule.shifts.map((shift) => (
                  <View key={shift.id} style={styles.listItem}>
                    <Text style={styles.listItemTitle}>
                      {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    </Text>
                    <Text style={styles.listItemText}>{shift.label || 'Working shift'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No shifts were found for this date.</Text>
              )}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Breaks</Text>
              {schedule?.breaks?.length ? (
                schedule.breaks.map((item) => (
                  <View key={item.id} style={styles.listItem}>
                    <Text style={styles.listItemTitle}>
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                    </Text>
                    <Text style={styles.listItemText}>{item.label || item.type || 'Break'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No breaks are configured for this date.</Text>
              )}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Time off</Text>
              {schedule?.timeOff?.length ? (
                schedule.timeOff.map((item) => (
                  <View key={item.id} style={styles.listItem}>
                    <Text style={styles.listItemTitle}>
                      {item.startDate} to {item.endDate}
                    </Text>
                    <Text style={styles.listItemText}>{item.reason || item.type || 'Time off'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No time off is recorded for this date.</Text>
              )}
            </View>
          </>
        ) : null}

        {selectedTab === 'profile' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Profile</Text>
            <Text style={styles.profileLine}>Name: {session.staff.name}</Text>
            <Text style={styles.profileLine}>Email: {session.staff.email || 'Not set'}</Text>
            <Text style={styles.profileLine}>Phone: {session.staff.phone || 'Not set'}</Text>
            <Text style={styles.profileLine}>Tenant: {session.staff.tenant?.businessName || 'Not set'}</Text>
            <Text style={styles.profileLine}>City: {session.staff.tenant?.city || 'Not set'}</Text>
            <Text style={styles.profileLine}>Commission: {session.staff.commissionRate ?? 0}%</Text>
            <Text style={styles.profileLine}>Rating: {session.staff.rating ?? 'N/A'}</Text>

            <View style={styles.passwordPanel}>
              <Text style={styles.passwordTitle}>Change password</Text>
              <TextInput
                secureTextEntry
                placeholder="Current password"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TextInput
                secureTextEntry
                placeholder="New password"
                placeholderTextColor="#94a3b8"
                style={[styles.input, styles.passwordInputSpacing]}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Pressable style={styles.actionButton} onPress={handlePasswordChange} disabled={passwordLoading}>
                {passwordLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Update Password</Text>
                )}
              </Pressable>
            </View>

            <Pressable style={[styles.secondaryButton, styles.logoutButton]} onPress={handleLogout}>
              <Text style={styles.secondaryButtonText}>Logout</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f4',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  bootText: {
    fontSize: 15,
    color: '#475569',
  },
  authShell: {
    padding: 24,
    gap: 20,
  },
  authHeader: {
    paddingTop: 12,
    gap: 8,
  },
  brandEyebrow: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#0f766e',
    fontWeight: '700',
  },
  authTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
  },
  authSubtitle: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#d6d3d1',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fieldSpacing: {
    marginTop: 16,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#0f766e',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 15,
  },
  metaCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  metaValue: {
    marginTop: 6,
    fontSize: 13,
    color: '#0f172a',
  },
  healthText: {
    marginTop: 14,
    color: '#0f766e',
    fontSize: 14,
    lineHeight: 20,
  },
  successText: {
    color: '#0f766e',
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: '#ccfbf1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    marginTop: 12,
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  appHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  dashboardSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
  },
  refreshButton: {
    backgroundColor: '#ccfbf1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 88,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#0f766e',
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    backgroundColor: '#e7e5e4',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#0f766e',
  },
  tabText: {
    color: '#334155',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  metricLabel: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  panelPrimary: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  panelSecondary: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
  },
  panelMeta: {
    marginTop: 10,
    fontSize: 13,
    color: '#0f766e',
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
    lineHeight: 20,
  },
  listItem: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
    marginTop: 14,
  },
  listItemSelected: {
    backgroundColor: '#f0fdfa',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  listItemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  listItemBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
    textTransform: 'uppercase',
  },
  listItemText: {
    marginTop: 6,
    fontSize: 14,
    color: '#475569',
  },
  profileLine: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 10,
  },
  logoutButton: {
    marginTop: 20,
  },
  passwordPanel: {
    marginTop: 12,
    paddingTop: 8,
    gap: 0,
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  passwordInputSpacing: {
    marginTop: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: '#0f766e',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 92,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
