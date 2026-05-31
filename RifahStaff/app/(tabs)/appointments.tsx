import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AppointmentsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Appointments</Text>
        <Text style={styles.subtitle}>Board view and list parity are planned in the next phase.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Board View</Text>
          <Text style={styles.cardText}>Provider lanes, time slots, and status filters.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>
          <Text style={styles.cardText}>Confirm, check-in, complete, reschedule, and cancel flows.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF8FC' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280' },
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

