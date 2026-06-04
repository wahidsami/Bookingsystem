import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

const sections = [
  {
    label: 'Schedule Board',
    description: 'Live provider lanes, time slots, and appointment actions.',
    icon: 'calendar-outline',
    href: '/(tabs)/schedule',
  },
  {
    label: 'Messages',
    description: 'Admin messages, replies, and inbox history.',
    icon: 'mail-outline',
    href: '/(tabs)/messages',
  },
  {
    label: 'Notifications',
    description: 'System and push notifications for staff.',
    icon: 'notifications-outline',
    href: '/(tabs)/notifications',
  },
  {
    label: 'Reviews',
    description: 'Review replies and customer feedback.',
    icon: 'star-outline',
    href: '/(tabs)/reviews',
  },
  {
    label: 'Profile',
    description: 'Account, language, and password actions.',
    icon: 'person-outline',
    href: '/(tabs)/profile',
  },
  {
    label: 'Earnings',
    description: 'Revenue and payout visibility.',
    icon: 'cash-outline',
    href: '/(tabs)/earnings',
  },
];

export default function MoreScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Operational shortcuts for the active Refah Partners workflow.</Text>

        <View style={styles.grid}>
          {sections.map((section) => (
            <TouchableOpacity
              key={section.label}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(section.href as never)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={section.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color="#8B5ADF" />
              </View>
              <Text style={styles.cardTitle}>{section.label}</Text>
              <Text style={styles.cardText}>{section.description}</Text>
            </TouchableOpacity>
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
  content: { padding: 16, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280' },
  grid: {
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ede9fe',
    padding: 14,
    gap: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#faf5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#312e81' },
  cardText: { fontSize: 13, color: '#4b5563', lineHeight: 18 },
  logoutButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
