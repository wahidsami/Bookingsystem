import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const tenantName = user?.tenant?.businessName || user?.tenant?.name_en || 'Refah Partner';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Refah Partners</Text>
        <Text style={styles.subtitle}>{tenantName}</Text>

        <View style={styles.card}>
            <Text style={styles.cardTitle}>Operational Snapshot</Text>
            <Text style={styles.cardText}>Quick access to the live operational screens while the shell expands.</Text>
        </View>

        <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
                <ActionButton
                    icon="calendar-outline"
                    label="Appointments"
                    onPress={() => router.push('/appointments' as never)}
                />
                <ActionButton
                    icon="mail-outline"
                    label="Messages"
                    onPress={() => router.push('/messages' as never)}
                />
                <ActionButton
                    icon="notifications-outline"
                    label="Notifications"
                    onPress={() => router.push('/notifications' as never)}
                />
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={20} color="#8B5ADF" />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF8FC' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#312e81', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#4b5563', lineHeight: 18 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    width: '48%',
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    backgroundColor: '#faf5ff',
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#312e81',
  },
});
