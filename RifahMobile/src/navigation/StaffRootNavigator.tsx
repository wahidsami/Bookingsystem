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

type StaffOverflowSection = Pick<StaffTabConfig, 'name' | 'labelEn' | 'labelAr' | 'icon'>;

function StaffMoreScreen({ sections, navigation }: { sections: StaffOverflowSection[]; navigation: any }) {
    const { isRTL, language } = useLanguage();

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
                    <TouchableOpacity
                        key={section.name}
                        style={styles.moreItem}
                        activeOpacity={0.86}
                        onPress={() => navigation.navigate(section.name)}
                    >
                        <AppIcon name={section.icon} size={20} color={colors.primary} />
                        <Text style={styles.moreItemText}>{language === 'ar' ? section.labelAr : section.labelEn}</Text>
                    </TouchableOpacity>
                )) : (
                    <View style={styles.moreItem}>
                        <Text style={styles.moreItemText}>{isRTL ? 'غير متاح' : 'Not enabled'}</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

type StaffTabConfig = {
    name: string;
    labelEn: string;
    labelAr: string;
    icon: any;
    enabled: boolean;
    component?: React.ComponentType<any>;
    render?: () => React.ReactNode;
};

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
    const hasTimeOff = Boolean(profile?.features?.timeOff);

    const tabCandidates: StaffTabConfig[] = [
        {
            name: 'Appointments',
            labelEn: 'Appointments',
            labelAr: 'المواعيد',
            icon: 'bookings',
            enabled: true,
            component: BookingsScreen,
        },
        {
            name: 'Schedule',
            labelEn: 'Schedule',
            labelAr: 'الجدول',
            icon: 'event',
            enabled: hasSchedule,
            render: () => (
                <StaffPlaceholderScreen
                    title={language === 'ar' ? 'الجدول' : 'Schedule'}
                    subtitle="Weekly schedule and availability will live here."
                    icon="event"
                />
            ),
        },
        {
            name: 'Clients',
            labelEn: 'Clients',
            labelAr: 'العملاء',
            icon: 'profile',
            enabled: hasClients,
            render: () => (
                <StaffPlaceholderScreen
                    title={language === 'ar' ? 'العملاء' : 'Clients'}
                    subtitle="Client summaries and notes will appear here."
                    icon="profile"
                />
            ),
        },
        {
            name: 'Reviews',
            labelEn: 'Reviews',
            labelAr: 'المراجعات',
            icon: 'star',
            enabled: hasReviews,
            render: () => (
                <StaffPlaceholderScreen
                    title={language === 'ar' ? 'المراجعات' : 'Reviews'}
                    subtitle="Customer reviews and replies are shown here."
                    icon="star"
                />
            ),
        },
        {
            name: 'Earnings',
            labelEn: 'Earnings',
            labelAr: 'الأرباح',
            icon: 'dashboard',
            enabled: hasEarnings,
            render: () => (
                <StaffPlaceholderScreen
                    title={language === 'ar' ? 'الأرباح' : 'Earnings'}
                    subtitle="Earnings and payout summaries will appear here."
                    icon="dashboard"
                />
            ),
        },
        {
            name: 'Messages',
            labelEn: 'Messages',
            labelAr: 'الرسائل',
            icon: 'message',
            enabled: hasMessages,
            render: () => (
                <StaffPlaceholderScreen
                    title={language === 'ar' ? 'الرسائل' : 'Messages'}
                    subtitle="Staff messages and conversations will appear here."
                    icon="message"
                />
            ),
        },
        {
            name: 'TimeOff',
            labelEn: 'Time off',
            labelAr: 'الغياب',
            icon: 'calendar',
            enabled: hasTimeOff,
            render: () => (
                <StaffPlaceholderScreen
                    title={language === 'ar' ? 'الغياب' : 'Time off'}
                    subtitle="Leave requests and schedule exceptions will appear here."
                    icon="calendar"
                />
            ),
        },
    ];

    const enabledTabs = tabCandidates.filter((tab) => tab.enabled);
    const primaryTabs = enabledTabs.slice(0, 4);
    const overflowTabs = enabledTabs.slice(4);

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
            {primaryTabs.map((tab) =>
                tab.component ? (
                    <Tab.Screen
                        key={tab.name}
                        name={tab.name}
                        component={tab.component}
                        options={{
                            tabBarLabel: language === 'ar' ? tab.labelAr : tab.labelEn,
                            tabBarIcon: ({ color, size }) => <AppIcon name={tab.icon} size={size} color={color} />,
                        }}
                    />
                ) : (
                    <Tab.Screen
                        key={tab.name}
                        name={tab.name}
                        children={tab.render as () => React.ReactNode}
                        options={{
                            tabBarLabel: language === 'ar' ? tab.labelAr : tab.labelEn,
                            tabBarIcon: ({ color, size }) => <AppIcon name={tab.icon} size={size} color={color} />,
                        }}
                    />
                )
            )}
            {overflowTabs.length > 0 ? (
                <Tab.Screen
                    name="More"
                    children={(props) => (
                        <StaffMoreScreen
                            navigation={props.navigation}
                            sections={overflowTabs.map((tab) => ({
                                name: tab.name,
                                labelEn: tab.labelEn,
                                labelAr: tab.labelAr,
                                icon: tab.icon,
                            }))}
                        />
                    )}
                    options={{
                        tabBarLabel: language === 'ar' ? 'المزيد' : 'More',
                        tabBarIcon: ({ color, size }) => <AppIcon name="dashboard" size={size} color={color} />,
                    }}
                />
            ) : null}
            {overflowTabs.map((tab) =>
                tab.component ? (
                    <Tab.Screen
                        key={`hidden-${tab.name}`}
                        name={tab.name}
                        component={tab.component}
                        options={{
                            tabBarButton: () => null,
                        }}
                    />
                ) : (
                    <Tab.Screen
                        key={`hidden-${tab.name}`}
                        name={tab.name}
                        children={tab.render as () => React.ReactNode}
                        options={{
                            tabBarButton: () => null,
                        }}
                    />
                )
            )}
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    moreItemText: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '600',
    },
});
