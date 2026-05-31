import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

const sections = [
  'Employees',
  'Orders',
  'Services',
  'Products',
  'Messages',
  'Marketing',
  'Billing & Finance',
  'Reports',
  'Settings',
];

export default function MoreScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Extended tenant sections will be connected in next phases.</Text>

        <View style={styles.listCard}>
          {sections.map((section) => (
            <View key={section} style={styles.row}>
              <Text style={styles.rowText}>{section}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF8FC' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280' },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ede9fe',
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  logoutButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

