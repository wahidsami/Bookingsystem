import React, { useEffect, useState } from 'react';
import { Linking, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, PublicAppContent, User } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';

interface MoreScreenProps {
    navigation?: any;
}

export function MoreScreen({ navigation }: MoreScreenProps) {
    const { t, language } = useLanguage();
    const { isAuthenticated, logout, showLogin, ensureAuthenticated } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [user, setUser] = useState<User | null>(null);
    const [appContent, setAppContent] = useState<PublicAppContent | null>(null);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

    useEffect(() => {
        api.getUser().then(setUser).catch(() => setUser(null));
    }, [isAuthenticated]);

    useFocusEffect(
        React.useCallback(() => {
            api.getProfile()
                .then(async (profile) => {
                    setUser(profile);
                    await api.setUser(profile);
                })
                .catch(() => {
                    api.getUser().then(setUser).catch(() => setUser(null));
                });

            api.getCustomerAppContent()
                .then(setAppContent)
                .catch(() => setAppContent(null));

            if (isAuthenticated) {
                api.getNotifications(1, 1)
                    .then((response) => { setNotificationUnreadCount(response.unreadCount || 0); Notifications.setBadgeCountAsync(response.unreadCount || 0); })
                    .catch(() => setNotificationUnreadCount(0));
            } else {
                setNotificationUnreadCount(0);
            }

        }, [isAuthenticated])
    );

    const menuItems = [
        { id: 'profile', icon: 'profile', label: t('profile'), action: () => navigation?.navigate('Profile') },
        { id: 'myAppointments', icon: 'bookings', label: t('myAppointments'), action: () => navigation?.navigate('Appointments') },
        { id: 'gifts', icon: 'sparkles', label: language === 'ar' ? 'الهدايا والمحفظة' : 'Gifts & Wallet', action: () => navigation?.navigate('Gifts') },
        { id: 'browse', icon: 'search', label: t('browseSalons'), action: () => navigation?.navigate('Browse') },
        { id: 'myPurchases', icon: 'purchases', label: t('myPurchases'), action: () => navigation?.navigate('Purchases') },
        {
            id: 'notifications',
            icon: 'bell',
            label: notificationUnreadCount > 0
                ? `${t('notifications')} (${notificationUnreadCount})`
                : t('notifications'),
            action: () => {
                setNotificationUnreadCount(0);
                navigation?.navigate('Notifications');
            }
        },
    ];

    const settingsItems = [
        { id: 'settings', icon: 'settings', label: t('settings'), action: () => navigation?.navigate('Settings') },
        {
            id: 'savedAddresses',
            icon: 'location',
            label: t('savedAddresses'),
            action: () => navigation?.navigate('EditProfile'),
        },
    ];

    const supportItems = [
        {
            id: 'helpSupport',
            icon: 'message',
            label: appContent?.support?.help_support?.[
                language === 'ar' ? 'titleAr' : 'titleEn'
            ] || t('helpSupport'),
            action: () => navigation?.navigate('InfoPage', { pageType: 'support' }),
        },
        {
            id: 'aboutRefah',
            icon: 'sparkles',
            label: appContent?.legal?.about_refah?.[
                language === 'ar' ? 'titleAr' : 'titleEn'
            ] || t('aboutRefah'),
            action: () => navigation?.navigate('InfoPage', { pageType: 'about' }),
        },
        {
            id: 'privacyTerms',
            icon: 'file',
            label: appContent?.legal?.privacy_terms?.[
                language === 'ar' ? 'titleAr' : 'titleEn'
            ] || t('privacyTerms'),
            action: () => navigation?.navigate('InfoPage', { pageType: 'privacy' }),
        },
    ];

    const socialLinks = (appContent?.social || []).filter((item) => item.url);

    const getSocialIcon = (iconKey: string) => {
        const socialIconMap: Record<string, React.ComponentProps<typeof AppIcon>['name']> = {
            instagram: 'instagram',
            x_twitter: 'twitter',
            twitter: 'twitter',
            snapchat: 'snapchat',
            tiktok: 'tiktok',
            youtube: 'youtube',
            linkedin: 'linkedin',
            website: 'website',
        };
        return socialIconMap[iconKey] || 'link';
    };

    const handleAuthAction = async () => {
        if (isAuthenticated) {
            await logout();
            return;
        }

        showLogin();
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: spacing.xl + topInset }]}
            >
                <View style={styles.userInfo}>
                    <UserAvatar
                        firstName={user?.firstName}
                        lastName={user?.lastName}
                        profileImage={user?.profileImage}
                        size={60}
                        backgroundColor={colors.textInverse}
                        textColor={colors.primary}
                    />
                    <View>
                        <Text style={styles.userName}>{user ? `${user.firstName} ${user.lastName}` : t('guestTitle')}</Text>
                        <Text style={styles.userEmail}>{user?.email || t('welcome')}</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            >
                {/* Menu Items */}
                <View style={styles.menuSection}>
                    {menuItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.menuItem}
                            onPress={() => {
                                if (item.id !== 'browse' && !ensureAuthenticated()) return;

                                if (item.action) {
                                    item.action();
                                }
                            }}
                        >
                            <View style={styles.menuItemLeft}>
                                <AppIcon name={item.icon as any} size={22} color={colors.primary} />
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {socialLinks.length > 0 && (
                    <>
                        <View style={styles.sectionHeaderWrap}>
                            <Text style={styles.sectionHeaderText}>{t('followRefah')}</Text>
                        </View>

                        <View style={styles.socialCard}>
                            <View style={styles.socialRow}>
                                {socialLinks.map((item) => (
                                    <TouchableOpacity
                                        key={`${item.key}-${item.iconKey}`}
                                        style={styles.socialIconButton}
                                        onPress={() => Linking.openURL(item.url)}
                                    >
                                        <AppIcon name={getSocialIcon(item.iconKey)} size={24} color={colors.primary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </>
                )}

                <View style={styles.sectionHeaderWrap}>
                    <Text style={styles.sectionHeaderText}>{t('settings')}</Text>
                </View>

                <View style={styles.menuSection}>
                    {settingsItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.menuItem}
                            onPress={() => {
                                if (!ensureAuthenticated()) return;

                                void item.action();
                            }}
                        >
                            <View style={styles.menuItemLeft}>
                                <AppIcon name={item.icon as any} size={22} color={colors.primary} />
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.sectionHeaderWrap}>
                    <Text style={styles.sectionHeaderText}>{t('supportAndLegal')}</Text>
                </View>

                <View style={styles.menuSection}>
                    {supportItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.menuItem}
                            onPress={item.action}
                        >
                            <View style={styles.menuItemLeft}>
                                <AppIcon name={item.icon as any} size={22} color={colors.primary} />
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleAuthAction}>
                    <AppIcon name={isAuthenticated ? 'logout' : 'lock'} size={20} color={colors.error} />
                    <Text style={styles.logoutText}>{isAuthenticated ? t('logout') : t('loginNow')}</Text>
                </TouchableOpacity>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={styles.appInfoText}>Refah v1.0.0</Text>
                    <Text style={styles.appInfoText}>© 2024 Refah Platform</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F4FF',
    },
    header: {
        backgroundColor: colors.primary,
        padding: spacing.xl,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    userName: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textInverse,
        marginBottom: 4,
    },
    userEmail: {
        fontSize: fontSize.sm,
        color: colors.textInverse,
        opacity: 0.9,
    },
    content: {
        flex: 1,
    },
    menuSection: {
        backgroundColor: '#FFFFFF',
        marginTop: spacing.md,
        marginHorizontal: spacing.md,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        overflow: 'hidden',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: '#F3E8FF',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    menuLabel: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '500',
    },
    menuSubLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    menuArrow: {
        fontSize: 24,
        color: colors.textSecondary,
    },
    sectionHeaderWrap: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.sm,
    },
    sectionHeaderText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    socialCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: spacing.lg,
        marginTop: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        padding: spacing.lg,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 1,
    },
    socialRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    socialIconButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#FEE2E2',
        marginHorizontal: spacing.lg,
        marginTop: spacing.xl,
        padding: spacing.lg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    logoutText: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.error,
    },
    appInfo: {
        alignItems: 'center',
        padding: spacing.xl,
        gap: 4,
    },
    appInfoText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
});

