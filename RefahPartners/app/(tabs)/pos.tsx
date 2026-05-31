import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PosScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>POS / Collections</Text>
        <Text style={styles.subtitle}>Fast cashier workflow optimized for mobile operations.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Collection Queue</Text>
          <Text style={styles.cardText}>Due items, payment actions, and quick details.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Snapshot</Text>
          <Text style={styles.cardText}>Net, refunds, and transactions at a glance.</Text>
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

