import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, PublicAppContent, User } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { CustomerPushDebugState, getCustomerPushDebugState, registerCustomerPushNotifications } from '../lib/notifications';
import { AppIcon } from '../components/AppIcon';

interface MoreScreenProps {
    navigation?: any;
}

export function MoreScreen({ navigation }: MoreScreenProps) {
    const { t, language } = useLanguage();
    const { isAuthenticated, logout, showLogin } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [user, setUser] = useState<User | null>(null);
    const [appContent, setAppContent] = useState<PublicAppContent | null>(null);
    const [pushDebugState, setPushDebugState] = useState<CustomerPushDebugState | null>(null);
    const [pushRefreshing, setPushRefreshing] = useState(false);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

    useEffect(() => {
        api.getUser().then(setUser).catch(() => setUser(null));
    }, [isAuthenticated]);

    const loadPushDebugState = React.useCallback(() => {
        getCustomerPushDebugState()
            .then(setPushDebugState)
            .catch(() => setPushDebugState(null));
    }, []);

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
                    .then((response) => setNotificationUnreadCount(response.unreadCount || 0))
                    .catch(() => setNotificationUnreadCount(0));
            } else {
                setNotificationUnreadCount(0);
            }

            loadPushDebugState();
        }, [loadPushDebugState])
    );

    const menuItems = [
        { id: 'profile', icon: 'profile', label: t('profile'), action: () => navigation?.navigate('Profile') },
        { id: 'myAppointments', icon: 'bookings', label: t('myAppointments'), action: () => navigation?.navigate('Appointments') },
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

    const getPushStatusLabel = () => {
        if (!pushDebugState) {
            return language === 'ar' ? 'لم يتم تسجيل هذا الجهاز للإشعارات بعد.' : 'This device has not registered for push notifications yet.';
        }

        const labels: Record<CustomerPushDebugState['status'], { ar: string; en: string }> = {
            idle: { ar: 'في وضع الانتظار.', en: 'Idle.' },
            started: { ar: 'جاري بدء تسجيل الإشعارات.', en: 'Push registration is starting.' },
            permission_denied: { ar: 'تم رفض إذن الإشعارات على هذا الجهاز.', en: 'Notification permission was denied on this device.' },
            token_received: { ar: 'تم إنشاء رمز Expo على الجهاز وهو بانتظار الحفظ في الخادم.', en: 'Expo token was generated on the device and is waiting to be saved.' },
            registered: { ar: 'تم تسجيل الجهاز للإشعارات بنجاح.', en: 'This device is registered for push notifications.' },
            register_failed: { ar: 'فشل حفظ رمز الإشعارات في الخادم.', en: 'The backend failed to save the push token.' },
            unregistered: { ar: 'تم إلغاء تسجيل الإشعارات لهذا الجهاز.', en: 'Push notifications were removed from this device.' },
            auth_missing: { ar: 'يجب تسجيل الدخول أولاً لتسجيل هذا الجهاز.', en: 'Sign in first so this device can register.' },
        };

        return labels[pushDebugState.status]?.[language] || pushDebugState.message;
    };

    const handleRetryPushRegistration = async () => {
        setPushRefreshing(true);
        try {
            await registerCustomerPushNotifications();
        } catch (error) {
            console.warn('Manual push registration retry failed:', error);
        } finally {
            await loadPushDebugState();
            setPushRefreshing(false);
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
                </View>

                {isAuthenticated && (
                    <>
                        <View style={styles.sectionHeaderWrap}>
                            <Text style={styles.sectionHeaderText}>{t('pushNotifications')}</Text>
                        </View>

                        <View style={styles.pushCard}>
                            <Text style={styles.pushTitle}>{t('pushNotifications')}</Text>
                            <Text style={styles.pushDescription}>{t('pushNotificationsDescription')}</Text>
                            <Text style={styles.pushStatus}>{getPushStatusLabel()}</Text>
                            {pushDebugState?.tokenPreview ? (
                                <Text style={styles.pushMeta}>
                                    {language === 'ar' ? 'معاينة الرمز:' : 'Token preview:'} {pushDebugState.tokenPreview}
                                </Text>
                            ) : null}
                            {pushDebugState?.lastAttemptAt ? (
                                <Text style={styles.pushMeta}>
                                    {language === 'ar' ? 'آخر محاولة:' : 'Last attempt:'} {new Date(pushDebugState.lastAttemptAt).toLocaleString()}
                                </Text>
                            ) : null}
                            {pushDebugState?.error ? (
                                <Text style={styles.pushError}>{pushDebugState.error}</Text>
                            ) : null}
                            <TouchableOpacity
                                style={[styles.pushRetryButton, pushRefreshing && styles.pushRetryButtonDisabled]}
                                onPress={handleRetryPushRegistration}
                                disabled={pushRefreshing}
                            >
                                {pushRefreshing ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={styles.pushRetryText}>{t('retry')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}

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
    pushCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: spacing.lg,
        marginTop: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    pushTitle: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '700',
    },
    pushDescription: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    pushStatus: {
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '600',
        lineHeight: 22,
    },
    pushMeta: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    pushError: {
        fontSize: fontSize.xs,
        color: '#DC2626',
    },
    pushRetryButton: {
        marginTop: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    pushRetryButtonDisabled: {
        opacity: 0.7,
    },
    pushRetryText: {
        fontSize: fontSize.md,
        color: '#FFFFFF',
        fontWeight: '700',
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
