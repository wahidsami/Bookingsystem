const fs = require('fs');

const content = `import React, { useEffect, useState } from 'react';
import { Linking, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, PublicAppContent } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import * as Notifications from 'expo-notifications';
import { PageHeader } from '../components/ui/PageHeader';

interface MoreScreenProps {
    navigation?: any;
}

export function MoreScreen({ navigation }: MoreScreenProps) {
    const { t, language } = useLanguage();
    const { isAuthenticated, logout, showLogin, user } = useAppSession();
    const { scrollBottomPadding } = useScreenSafeArea();
    const [appContent, setAppContent] = useState<PublicAppContent | null>(null);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

    useFocusEffect(
        React.useCallback(() => {
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
                ? \`\${t('notifications')} (\${notificationUnreadCount})\`
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
            label: language === 'ar' ? 'عن بارسبا' : 'About BarSpa',
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
            <PageHeader title={language === 'ar' ? 'حسابي' : 'Me'} showBack={false} />

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            >
                {/* Profile Identity Area */}
                <View style={styles.profileHeader}>
                    <TouchableOpacity onPress={() => isAuthenticated ? navigation?.navigate('Profile') : showLogin()} style={styles.avatarWrap}>
                        <UserAvatar
                            firstName={user?.firstName}
                            lastName={user?.lastName}
                            profileImage={user?.profileImage}
                            size={80}
                        />
                    </TouchableOpacity>
                    <Text style={styles.profileName}>
                        {isAuthenticated ? (user ? \`\${user.firstName} \${user.lastName}\` : t('guestTitle')) : t('guestTitle')}
                    </Text>
                    {isAuthenticated && user?.email && (
                        <Text style={styles.profileEmail}>{user.email}</Text>
                    )}
                </View>

                {/* Wallet Preview Card */}
                {isAuthenticated && (
                    <TouchableOpacity style={styles.walletCard} onPress={() => navigation?.navigate('Gifts')}>
                        <View style={styles.walletCardLeft}>
                            <View style={styles.walletIconWrap}>
                                <AppIcon name="account_balance_wallet" size={24} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.walletCardTitle}>{language === 'ar' ? 'المحفظة' : 'Wallet'}</Text>
                                <Text style={styles.walletCardSub}>{language === 'ar' ? 'رصيد المركز الخاص بك' : 'Your center balance'}</Text>
                            </View>
                        </View>
                        <AppIcon name={language === 'ar' ? 'arrow_back' : 'arrow_forward'} size={24} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}

                {/* Menus */}
                <View style={styles.sectionHeaderWrap}>
                    <Text style={styles.sectionHeaderText}>{t('myAppointments')}</Text>
                </View>
                <View style={styles.menuSection}>
                    {menuItems.filter(i => i.id !== 'gifts' && i.id !== 'profile').map((item) => (
                        <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => {
                            if (item.id !== 'browse' && !isAuthenticated) { showLogin(); return; }
                            if (item.action) item.action();
                        }}>
                            <View style={styles.menuItemLeft}>
                                <View style={styles.menuIconWrap}>
                                    <AppIcon name={item.icon as any} size={20} color={colors.primary} />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <AppIcon name={language === 'ar' ? 'arrow_back' : 'arrow_forward'} size={20} color={colors.textTertiary} />
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
                                        key={\`\${item.key}-\${item.iconKey}\`}
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
                        <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => {
                            if (!isAuthenticated) { showLogin(); return; }
                            if (item.action) item.action();
                        }}>
                            <View style={styles.menuItemLeft}>
                                <View style={styles.menuIconWrap}>
                                    <AppIcon name={item.icon as any} size={20} color={colors.primary} />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <AppIcon name={language === 'ar' ? 'arrow_back' : 'arrow_forward'} size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.sectionHeaderWrap}>
                    <Text style={styles.sectionHeaderText}>{t('supportAndLegal')}</Text>
                </View>
                <View style={styles.menuSection}>
                    {supportItems.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.action}>
                            <View style={styles.menuItemLeft}>
                                <View style={styles.menuIconWrap}>
                                    <AppIcon name={item.icon as any} size={20} color={colors.primary} />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <AppIcon name={language === 'ar' ? 'arrow_back' : 'arrow_forward'} size={20} color={colors.textTertiary} />
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
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
    profileHeader: {
        alignItems: 'center',
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
    },
    avatarWrap: {
        marginBottom: spacing.md,
        shadowColor: colors.brandPrimary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 4,
        borderRadius: 40,
    },
    profileName: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    walletCard: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        shadowColor: colors.brandPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: spacing.md,
    },
    walletCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    walletIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.brandPrimaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    walletCardSub: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    sectionHeaderWrap: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.sm,
    },
    sectionHeaderText: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    menuSection: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    menuIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    socialCard: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.lg,
        shadowColor: colors.brandPrimary,
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
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.brandPrimaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.brandPrimary,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginHorizontal: spacing.lg,
        marginTop: spacing.xxl,
        padding: spacing.lg,
        borderRadius: 16,
        backgroundColor: colors.error + '11',
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.error,
    },
    appInfo: {
        alignItems: 'center',
        padding: spacing.xl,
        gap: 4,
    },
    appInfoText: {
        fontSize: 12,
        color: colors.textTertiary,
    },
});
`;
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/MoreScreen.tsx', content);
