import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { AppIcon } from '../components/AppIcon';
import { BookingsScreen } from '../screens/BookingsScreen';
import type { StaffProfile } from '../api/client';
import { colors, spacing, fontSize } from '../theme/colors';

const Tab = createBottomTabNavigator();

function StaffPlaceholderScreen({ title, subtitle, icon }: { title: string; subtitle: string; icon: any }) {
    const { isRTL } = useLanguage();

    return (
        <View style={styles.placeholderContainer}>
            <View style={styles.placeholderCard}>
                <View style={styles.placeholderIconWrap}>
                    <AppIcon name={icon} size={28} color={colors.primary} />
                </View>
                <Text style={[styles.placeholderTitle, isRTL && styles.rtlText]}>{title}</Text>
                <Text style={[styles.placeholderSubtitle, isRTL && styles.rtlText]}>{subtitle}</Text>
            </View>
        </View>
    );
}

function StaffMoreScreen({ profile }: { profile: StaffProfile | null }) {
    const { isRTL, language } = useLanguage();

    const sections = [
        profile?.permissions?.view_earnings ? (language === 'ar' ? 'الأرباح' : 'Earnings') : null,
        profile?.features?.messages ? (language === 'ar' ? 'الرسائل' : 'Messages') : null,
        profile?.permissions?.view_clients ? (language === 'ar' ? 'العملاء' : 'Clients') : null,
        profile?.features?.timeOff ? (language === 'ar' ? 'الغياب' : 'Time off') : null,
    ].filter(Boolean) as string[];

    return (
        <ScrollView contentContainerStyle={styles.moreContainer}>
            <Text style={[styles.moreTitle, isRTL && styles.rtlText]}>{language === 'ar' ? 'المزيد' : 'More'}</Text>
            <Text style={[styles.moreSubtitle, isRTL && styles.rtlText]}>
                {sections.length > 0
                    ? (isRTL ? 'الأقسام الإضافية المتاحة من المدير تظهر هنا.' : 'Additional admin-enabled sections appear here.')
                    : (isRTL ? 'لا توجد أقسام إضافية مفعّلة لهذا الحساب.' : 'No additional sections are enabled for this account.')}
            </Text>
            <View style={styles.moreGrid}>
                {sections.length > 0 ? sections.map((section) => (
                    <View key={section} style={styles.moreItem}>
                        <Text style={styles.moreItemText}>{section}</Text>
                    </View>
                )) : (
                    <View style={styles.moreItem}>
                        <Text style={styles.moreItemText}>{isRTL ? 'غير متاح' : 'Not enabled'}</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

interface StaffRootNavigatorProps {
    profile: StaffProfile | null;
}

export function StaffRootNavigator({ profile }: StaffRootNavigatorProps) {
    const { language } = useLanguage();
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 14);

    const hasReviews = Boolean(profile?.permissions?.view_reviews);
    const hasClients = Boolean(profile?.permissions?.view_clients);
    const hasEarnings = Boolean(profile?.permissions?.view_earnings);
    const hasMessages = Boolean(profile?.features?.messages);
    const hasSchedule = Boolean(profile?.features?.schedule);

    return (
        <Tab.Navigator
            initialRouteName="Appointments"
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarHideOnKeyboard: true,
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#E5E7EB',
                    paddingTop: 8,
                    paddingBottom: bottomPadding,
                    height: 62 + bottomPadding,
                    backgroundColor: '#FFFFFF',
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
            }}
        >
            <Tab.Screen
                name="Appointments"
                component={BookingsScreen}
                options={{
                    tabBarLabel: language === 'ar' ? 'المواعيد' : 'Appointments',
                    tabBarIcon: ({ color, size }) => <AppIcon name="bookings" size={size} color={color} />,
                }}
            />
            {hasSchedule ? (
                <Tab.Screen
                    name="Schedule"
                    children={() => (
                        <StaffPlaceholderScreen
                            title={language === 'ar' ? 'الجدول' : 'Schedule'}
                            subtitle="Weekly schedule and availability will live here."
                            icon="event"
                        />
                    )}
                    options={{
                        tabBarLabel: language === 'ar' ? 'الجدول' : 'Schedule',
                        tabBarIcon: ({ color, size }) => <AppIcon name="event" size={size} color={color} />,
                    }}
                />
            ) : null}
            {hasReviews ? (
                <Tab.Screen
                    name="Reviews"
                    children={() => (
                        <StaffPlaceholderScreen
                            title={language === 'ar' ? 'المراجعات' : 'Reviews'}
                            subtitle="Customer reviews and replies are shown here."
                            icon="star"
                        />
                    )}
                    options={{
                        tabBarLabel: language === 'ar' ? 'المراجعات' : 'Reviews',
                        tabBarIcon: ({ color, size }) => <AppIcon name="star" size={size} color={color} />,
                    }}
                />
            ) : null}
            {hasClients ? (
                <Tab.Screen
                    name="Clients"
                    children={() => (
                        <StaffPlaceholderScreen
                            title={language === 'ar' ? 'العملاء' : 'Clients'}
                            subtitle="Client summaries and notes will appear here."
                            icon="profile"
                        />
                    )}
                    options={{
                        tabBarLabel: language === 'ar' ? 'العملاء' : 'Clients',
                        tabBarIcon: ({ color, size }) => <AppIcon name="profile" size={size} color={color} />,
                    }}
                />
            ) : null}
            {hasEarnings || hasMessages ? (
                <Tab.Screen
                    name="More"
                    children={() => <StaffMoreScreen profile={profile} />}
                    options={{
                        tabBarLabel: language === 'ar' ? 'المزيد' : 'More',
                        tabBarIcon: ({ color, size }) => <AppIcon name="dashboard" size={size} color={color} />,
                    }}
                />
            ) : null}
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    placeholderContainer: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        justifyContent: 'center',
    },
    placeholderCard: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: spacing.xl,
        alignItems: 'center',
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    placeholderIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
    },
    placeholderSubtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    rtlText: {
        textAlign: 'right',
    },
    moreContainer: {
        padding: spacing.lg,
        gap: spacing.lg,
        backgroundColor: colors.background,
        flexGrow: 1,
    },
    moreTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    moreSubtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    moreGrid: {
        gap: spacing.md,
    },
    moreItem: {
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    moreItemText: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '600',
    },
});
