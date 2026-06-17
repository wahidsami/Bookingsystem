import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { getOverflowStaffSections, staffIconMap } from '../../src/utils/staffNavigation';

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const { language } = useLanguage();
  const overflowSections = getOverflowStaffSections(user, language);
  const isArabic = language === 'ar';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{isArabic ? 'المزيد' : 'More'}</Text>
            <Text style={styles.subtitle}>
              {isArabic
                ? 'الأقسام الإضافية المعتمدة لهذا الحساب تظهر هنا.'
                : 'Additional sections approved for this staff account appear here.'}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {overflowSections.map((section) => (
            <TouchableOpacity
              key={section.route}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(section.href as never)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={staffIconMap[section.icon] as React.ComponentProps<typeof Ionicons>['name']} size={20} color="#8B5ADF" />
              </View>
              <Text style={styles.cardTitle}>{language === 'ar' ? section.labelAr : section.labelEn}</Text>
              <Text style={styles.cardText}>{language === 'ar' ? section.descriptionAr : section.descriptionEn}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {overflowSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{isArabic ? 'لا توجد أقسام إضافية' : 'No additional sections'}</Text>
            <Text style={styles.emptyText}>
              {isArabic
                ? 'كل الأقسام المسموح بها تظهر مباشرة في شريط التنقل السفلي.'
                : 'All allowed sections are already shown in the bottom tab bar.'}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>{isArabic ? 'تسجيل الخروج' : 'Logout'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF8FC' },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, lineHeight: 20 },
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
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ede9fe',
    padding: 16,
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  emptyText: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
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
