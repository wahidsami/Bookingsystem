import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
          <Text style={styles.cardText}>Compact KPI cards and alerts will appear here in Phase 1.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <Text style={styles.cardText}>Appointments, POS, and Inbox shortcuts will be added next.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
});

