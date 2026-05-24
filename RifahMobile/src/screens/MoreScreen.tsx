import React, { useEffect, useState } from 'react';
import { Linking, View, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, PublicAppContent, User } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import { registerCustomerPushNotifications, unregisterCustomerPushNotifications } from '../lib/notifications';

interface MoreScreenProps {
    navigation?: any;
}

export function MoreScreen({ navigation }: MoreScreenProps) {
    const { t, language } = useLanguage();
    const { isAuthenticated, logout, showLogin } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [user, setUser] = useState<User | null>(null);
    const [appContent, setAppContent] = useState<PublicAppContent | null>(null);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
    const [pushEnabled, setPushEnabled] = useState(true);
    const [pushLoading, setPushLoading] = useState(false);

    useEffect(() => {
        api.getUser().then(setUser).catch(() => setUser(null));
    }, [isAuthenticated]);

    useFocusEffect(
        React.useCallback(() => {
            api.getProfile()
                .then(async (profile) => {
                    setUser(profile);
                    setPushEnabled(profile.notificationPreferences?.push !== false);
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
                    .then((response) => setNotificationUnreadCount(response.unreadCount || 0))
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
            action: () => navigation?.navigate('Notifications')
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

    const handlePushToggle = async (value: boolean) => {
        if (pushLoading || !isAuthenticated) return;
        const previous = pushEnabled;
        setPushEnabled(value);
        setPushLoading(true);
        try {
            await api.updateProfile({
                notificationPreferences: {
                    email: user?.notificationPreferences?.email !== false,
                    sms: user?.notificationPreferences?.sms !== false,
                    push: value,
                    whatsapp: user?.notificationPreferences?.whatsapp === true,
                },
            });
            if (value) {
                await registerCustomerPushNotifications();
            } else {
                await unregisterCustomerPushNotifications();
            }
        } catch (error) {
            setPushEnabled(previous);
        } finally {
            setPushLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                <View style={styles.userInfo}>
                    <UserAvatar
                        firstName={user?.firstName}
                        lastName={user?.lastName}
                        profileImage={user?.profileImage}
                        size={60}
                        backgroundColor="#FFFFFF"
                        textColor={colors.primary}
                    />
                    <View>
                        <Text style={styles.userName}>{user ? `${user.firstName} ${user.lastName}` : t('guestTitle')}</Text>
                        <Text style={styles.userEmail}>{user?.email || t('welcome')}</Text>
                    </View>
                </View>
            </View>

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
                                if (!isAuthenticated && item.id !== 'browse') {
                                    showLogin();
                                    return;
                                }

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
                                if (!isAuthenticated) {
                                    showLogin();
                                    return;
                                }

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
                    <View style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <AppIcon name="bell" size={22} color={colors.primary} />
                            <View>
                                <Text style={styles.menuLabel}>{t('pushNotifications')}</Text>
                                <Text style={styles.menuSubLabel}>{t('pushNotificationsDescription')}</Text>
                            </View>
                        </View>
                        {pushLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Switch
                                value={pushEnabled}
                                onValueChange={handlePushToggle}
                                disabled={!isAuthenticated}
                                trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                                thumbColor={pushEnabled ? colors.primary : '#9CA3AF'}
                            />
                        )}
                    </View>
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
                    <AppIcon name={isAuthenticated ? 'logout' : 'lock'} size={20} color="#DC2626" />
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
        backgroundColor: colors.background,
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
        color: '#FFFFFF',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: fontSize.sm,
        color: '#FFFFFF',
        opacity: 0.9,
    },
    content: {
        flex: 1,
    },
    menuSection: {
        backgroundColor: '#FFFFFF',
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    socialCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: spacing.lg,
        marginTop: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
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
        backgroundColor: colors.backgroundGray,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
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
    },
    logoutText: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: '#DC2626',
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
