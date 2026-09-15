import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { staffIconMap } from '../../src/utils/staffNavigation';
import { canViewEarnings, canViewReviews, canRequestTimeOff } from '../../src/utils/capabilities';

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const sections = [
    {
      route: 'profile',
      href: '/(tabs)/profile',
      labelEn: 'Profile',
      labelAr: 'الملف الشخصي',
      icon: 'profile',
      descriptionEn: 'Account, language, and security settings.',
      descriptionAr: 'الحساب واللغة وأمان البيانات.',
      enabled: user?.features?.profile !== false,
    },
    {
      route: 'earnings',
      href: '/(tabs)/earnings',
      labelEn: 'Earnings',
      labelAr: 'الأرباح',
      icon: 'earnings',
      descriptionEn: 'Revenue visibility and payout summaries.',
      descriptionAr: 'عرض الإيرادات وملخصات الصرف.',
      enabled: canViewEarnings(user),
    },
    {
      route: 'reviews',
      href: '/(tabs)/reviews',
      labelEn: 'Reviews',
      labelAr: 'التقييمات',
      icon: 'reviews',
      descriptionEn: 'Reply to customer reviews.',
      descriptionAr: 'الرد على تقييمات العملاء.',
      enabled: canViewReviews(user),
    },
    {
      route: 'request-time-off',
      href: '/(modals)/request-time-off',
      labelEn: 'Time off',
      labelAr: 'الإجازات',
      icon: 'timeOff',
      descriptionEn: 'Leave requests and availability exceptions.',
      descriptionAr: 'طلبات الإجازة والاستثناءات.',
      enabled: canRequestTimeOff(user),
    },
  ].filter((s) => s.enabled);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* We do not use SafeAreaView edges=['top'] here because the global header occupies the top safe area */}
      <View style={styles.grid}>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.route}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(section.href as never)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={staffIconMap[section.icon as keyof typeof staffIconMap] as any} size={20} color="#8B5ADF" />
            </View>
            <Text style={styles.cardTitle}>{isArabic ? section.labelAr : section.labelEn}</Text>
            <Text style={styles.cardText}>{isArabic ? section.descriptionAr : section.descriptionEn}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>{isArabic ? 'تسجيل الخروج' : 'Logout'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 24, backgroundColor: '#FAF8FC', flexGrow: 1 },
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
