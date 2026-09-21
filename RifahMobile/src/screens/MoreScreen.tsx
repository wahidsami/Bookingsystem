import React, { useEffect, useState, useCallback } from 'react';
import { Linking, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
import { UserAvatar } from '../components/UserAvatar';
import { useLanguage } from '../contexts/LanguageContext';
import { api, PublicAppContent } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import * as Notifications from 'expo-notifications';

interface MoreScreenProps {
    navigation?: any;
}

export function MoreScreen({ navigation }: MoreScreenProps) {
    const { t, language, isRTL } = useLanguage();
    const { isAuthenticated, logout, showLogin, user } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [appContent, setAppContent] = useState<PublicAppContent | null>(null);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

    useFocusEffect(
        useCallback(() => {
            api.getCustomerAppContent()
                .then(setAppContent)
                .catch(() => setAppContent(null));

            if (isAuthenticated) {
                api.getNotifications(1, 1)
                    .then((response) => {
                        const unread = response.unreadCount || 0;
                        setNotificationUnreadCount(unread);
                        Notifications.setBadgeCountAsync(unread);
                    })
                    .catch(() => setNotificationUnreadCount(0));
            } else {
                setNotificationUnreadCount(0);
            }
        }, [isAuthenticated])
    );

    const accountItems = [
        {
            id: 'profile',
            icon: 'profile' as const,
            label: t('profile'),
            subtitle: isRTL ? 'معلوماتك الشخصية وتفاصيل الحساب' : 'Personal information & account details',
            action: () => navigation?.navigate('Profile'),
            requiresAuth: true,
        },
        {
            id: 'myAppointments',
            icon: 'bookings' as const,
            label: t('myAppointments'),
            subtitle: isRTL ? 'مواعيدك القادمة والسابقة' : 'Upcoming and past bookings',
            action: () => navigation?.navigate('Appointments'),
            requiresAuth: true,
        },
        {
            id: 'gifts',
            icon: 'sparkles' as const,
            label: isRTL ? 'الهدايا والمحفظة' : 'Gifts & Wallet',
            subtitle: isRTL ? 'رصيد المحفظة وبطاقات الهدايا' : 'Wallet balance and gift cards',
            action: () => navigation?.navigate('Gifts'),
            requiresAuth: true,
        },
        {
            id: 'myPurchases',
            icon: 'purchases' as const,
            label: t('myPurchases'),
            subtitle: isRTL ? 'طلبات المنتجات ومشترياتك' : 'Product orders and purchases',
            action: () => navigation?.navigate('Purchases'),
            requiresAuth: true,
        },
        {
            id: 'notifications',
            icon: 'bell' as const,
            label: t('notifications'),
            subtitle: notificationUnreadCount > 0
                ? (isRTL ? `${notificationUnreadCount} إشعارات جديدة` : `${notificationUnreadCount} new notifications`)
                : (isRTL ? 'تحديثات المواعيد والعروض' : 'Booking updates and offers'),
            badge: notificationUnreadCount > 0 ? notificationUnreadCount : undefined,
            action: () => {
                setNotificationUnreadCount(0);
                navigation?.navigate('Notifications');
            },
            requiresAuth: true,
        },
        {
            id: 'savedAddresses',
            icon: 'location' as const,
            label: t('savedAddresses'),
            subtitle: isRTL ? 'عناوين التوصيل والاستلام' : 'Delivery addresses',
            action: () => navigation?.navigate('SavedAddresses'),
            requiresAuth: true,
        },
    ];

    const preferencesItems = [
        {
            id: 'settings',
            icon: 'settings' as const,
            label: t('settings'),
            subtitle: isRTL ? 'اللغة وإدارة الحساب' : 'Language & account settings',
            action: () => navigation?.navigate('Settings'),
            requiresAuth: false,
        },
        {
            id: 'browse',
            icon: 'search' as const,
            label: t('browseSalons'),
            subtitle: isRTL ? 'استكشف الصالونات والخدمات' : 'Explore salons and services',
            action: () => navigation?.navigate('Browse'),
            requiresAuth: false,
        },
    ];

    const supportItems = [
        {
            id: 'helpSupport',
            icon: 'message' as const,
            label: appContent?.support?.help_support?.[
                language === 'ar' ? 'titleAr' : 'titleEn'
            ] || t('helpSupport'),
            subtitle: isRTL ? 'تواصل معنا للحصول على المساعدة' : 'Get in touch for assistance',
            action: () => navigation?.navigate('InfoPage', { pageType: 'support' }),
        },
        {
            id: 'aboutBarSpa',
            icon: 'sparkles' as const,
            label: (() => {
                const rawTitle = appContent?.legal?.about_refah?.[language === 'ar' ? 'titleAr' : 'titleEn'];
                if (rawTitle && !rawTitle.toLowerCase().includes('vanilla') && !rawTitle.includes('فانيلا')) {
                    return rawTitle;
                }
                return t('aboutBarSpa');
            })(),
            subtitle: isRTL ? 'تعرف على منصة BarSpa وخدماتها' : 'Learn more about BarSpa platform',
            action: () => navigation?.navigate('InfoPage', { pageType: 'about' }),
        },
        {
            id: 'privacyTerms',
            icon: 'file' as const,
            label: appContent?.legal?.privacy_terms?.[
                language === 'ar' ? 'titleAr' : 'titleEn'
            ] || t('privacyTerms'),
            subtitle: isRTL ? 'الشروط والأحكام وسياسة الخصوصية' : 'Terms of service & privacy notice',
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

    const handleItemPress = (item: { id: string; action?: () => void; requiresAuth?: boolean }) => {
        if (item.requiresAuth && !isAuthenticated) {
            showLogin();
            return;
        }
        if (item.action) {
            item.action();
        }
    };

    const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.content}
                contentContainerStyle={{
                    paddingTop: topInset + 16,
                    paddingBottom: scrollBottomPadding + 24,
                    paddingHorizontal: 16,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Profile Hero Card */}
                {isAuthenticated && user ? (
                    <TouchableOpacity
                        style={styles.heroCard}
                        onPress={() => navigation?.navigate('Profile')}
                        activeOpacity={0.88}
                        accessibilityLabel={isRTL ? 'الملف الشخصي' : 'Profile'}
                    >
                        <View style={[styles.heroRow, isRTL && styles.rowRTL]}>
                            <View style={styles.avatarContainer}>
                                <UserAvatar
                                    firstName={user.firstName}
                                    lastName={user.lastName}
                                    profileImage={user.profileImage}
                                    size={64}
                                    backgroundColor="#F1ECFD"
                                    textColor="#6537C0"
                                />
                                <View style={styles.avatarBadge}>
                                    <AppIcon name="check" size={12} color="#FFFFFF" />
                                </View>
                            </View>

                            <View style={[styles.heroMeta, isRTL && styles.alignRTL]}>
                                <Text style={[styles.heroName, isRTL && styles.textRTL]}>
                                    {fullName || t('profile')}
                                </Text>
                                <Text style={[styles.heroEmail, isRTL && styles.textRTL]} numberOfLines={1}>
                                    {user.email || user.phone || ''}
                                </Text>
                                <View style={[styles.editBadge, isRTL && styles.rowRTL]}>
                                    <AppIcon name="user" size={12} color="#6537C0" />
                                    <Text style={styles.editBadgeText}>
                                        {isRTL ? 'عرض الملف الشخصي' : 'View Profile'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.heroArrowWrap}>
                                <AppIcon
                                    name={isRTL ? 'arrow_back' : 'arrow_forward'}
                                    size={18}
                                    color="#A379E2"
                                />
                            </View>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.guestHeroCard}>
                        <View style={styles.guestIconWrap}>
                            <AppIcon name="profile" size={32} color="#6537C0" />
                        </View>
                        <Text style={[styles.guestHeroTitle, isRTL && styles.textRTL]}>
                            {isRTL ? 'مرحباً بك في BarSpa' : 'Welcome to BarSpa'}
                        </Text>
                        <Text style={[styles.guestHeroSubtitle, isRTL && styles.textRTL]}>
                            {isRTL
                                ? 'سجّل الدخول للوصول إلى مواعيدك، المحفظة وتفاصيل الحساب'
                                : 'Sign in to manage your appointments, wallet and saved addresses'}
                        </Text>
                        <TouchableOpacity
                            style={styles.guestLoginBtn}
                            onPress={showLogin}
                            activeOpacity={0.85}
                        >
                            <AppIcon name="lock" size={18} color="#FFFFFF" />
                            <Text style={styles.guestLoginBtnText}>
                                {isRTL ? 'تسجيل الدخول / حساب جديد' : 'Sign In / Register'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 2. Account & Activity Section */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'حسابي ونشاطي' : 'Account & Activity'}
                    </Text>
                </View>
                <View style={styles.groupCard}>
                    {accountItems.map((item, index) => {
                        const isLast = index === accountItems.length - 1;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.itemRow, !isLast && styles.itemDivider, isRTL && styles.rowRTL]}
                                onPress={() => handleItemPress(item)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.iconCircle}>
                                    <AppIcon name={item.icon} size={20} color="#6537C0" />
                                </View>
                                <View style={[styles.itemTextContainer, isRTL && styles.alignRTL]}>
                                    <Text style={[styles.itemTitle, isRTL && styles.textRTL]}>
                                        {item.label}
                                    </Text>
                                    <Text style={[styles.itemSubtitle, isRTL && styles.textRTL]} numberOfLines={1}>
                                        {item.subtitle}
                                    </Text>
                                </View>
                                {item.badge !== undefined ? (
                                    <View style={styles.badgeContainer}>
                                        <Text style={styles.badgeText}>{item.badge}</Text>
                                    </View>
                                ) : (
                                    <AppIcon
                                        name={isRTL ? 'arrow_back' : 'arrow_forward'}
                                        size={18}
                                        color="#C4B5FD"
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 3. Preferences & Settings */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'التفضيلات' : 'Preferences'}
                    </Text>
                </View>
                <View style={styles.groupCard}>
                    {preferencesItems.map((item, index) => {
                        const isLast = index === preferencesItems.length - 1;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.itemRow, !isLast && styles.itemDivider, isRTL && styles.rowRTL]}
                                onPress={() => handleItemPress(item)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.iconCircle}>
                                    <AppIcon name={item.icon} size={20} color="#6537C0" />
                                </View>
                                <View style={[styles.itemTextContainer, isRTL && styles.alignRTL]}>
                                    <Text style={[styles.itemTitle, isRTL && styles.textRTL]}>
                                        {item.label}
                                    </Text>
                                    <Text style={[styles.itemSubtitle, isRTL && styles.textRTL]} numberOfLines={1}>
                                        {item.subtitle}
                                    </Text>
                                </View>
                                <AppIcon
                                    name={isRTL ? 'arrow_back' : 'arrow_forward'}
                                    size={18}
                                    color="#C4B5FD"
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 4. Support & Legal */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'الدعم والمعلومات' : 'Support & Legal'}
                    </Text>
                </View>
                <View style={styles.groupCard}>
                    {supportItems.map((item, index) => {
                        const isLast = index === supportItems.length - 1;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.itemRow, !isLast && styles.itemDivider, isRTL && styles.rowRTL]}
                                onPress={item.action}
                                activeOpacity={0.7}
                            >
                                <View style={styles.iconCircle}>
                                    <AppIcon name={item.icon} size={20} color="#6537C0" />
                                </View>
                                <View style={[styles.itemTextContainer, isRTL && styles.alignRTL]}>
                                    <Text style={[styles.itemTitle, isRTL && styles.textRTL]}>
                                        {item.label}
                                    </Text>
                                    <Text style={[styles.itemSubtitle, isRTL && styles.textRTL]} numberOfLines={1}>
                                        {item.subtitle}
                                    </Text>
                                </View>
                                <AppIcon
                                    name={isRTL ? 'arrow_back' : 'arrow_forward'}
                                    size={18}
                                    color="#C4B5FD"
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 5. Social Links */}
                {socialLinks.length > 0 && (
                    <>
                        <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                                {t('followBarSpa')}
                            </Text>
                        </View>
                        <View style={styles.socialCard}>
                            <View style={[styles.socialRow, isRTL && styles.rowRTL]}>
                                {socialLinks.map((item) => (
                                    <TouchableOpacity
                                        key={`${item.key}-${item.iconKey}`}
                                        style={styles.socialBtn}
                                        onPress={() => Linking.openURL(item.url)}
                                        activeOpacity={0.7}
                                        accessibilityLabel={item.key}
                                    >
                                        <AppIcon name={getSocialIcon(item.iconKey)} size={20} color="#6537C0" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </>
                )}

                {/* 6. Auth CTA Button */}
                <TouchableOpacity
                    style={[styles.authBtn, isAuthenticated ? styles.logoutBtn : styles.loginBtn, isRTL && styles.rowRTL]}
                    onPress={handleAuthAction}
                    activeOpacity={0.8}
                >
                    <AppIcon
                        name={isAuthenticated ? 'logout' : 'lock'}
                        size={18}
                        color={isAuthenticated ? '#DC2626' : '#6537C0'}
                    />
                    <Text style={[styles.authBtnText, isAuthenticated ? styles.logoutText : styles.loginText]}>
                        {isAuthenticated ? t('logout') : t('loginNow')}
                    </Text>
                </TouchableOpacity>

                {/* 7. App Info Footer */}
                <View style={styles.appFooter}>
                    <Text style={styles.appFooterVersion}>BarSpa v2.0.0</Text>
                    <Text style={styles.appFooterCopyright}>
                        {isRTL ? '© ٢٠٢٤ منصة BarSpa. جميع الحقوق محفوظة.' : '© 2024 BarSpa Platform. All rights reserved.'}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    content: {
        flex: 1,
    },
    // Hero Profile Card
    heroCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 16,
        marginBottom: 20,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    alignRTL: {
        alignItems: 'flex-end',
    },
    textRTL: {
        textAlign: 'right',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    heroMeta: {
        flex: 1,
        marginHorizontal: 14,
    },
    heroName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 2,
    },
    heroEmail: {
        fontSize: 13,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        marginBottom: 6,
    },
    editBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#F1ECFD',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
        gap: 4,
    },
    editBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    heroArrowWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FAF8FE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Guest Hero Card
    guestHeroCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 20,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    guestIconWrap: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    guestHeroTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 4,
        textAlign: 'center',
    },
    guestHeroSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16,
        paddingHorizontal: 12,
    },
    guestLoginBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#6537C0',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 24,
        gap: 8,
        width: '100%',
    },
    guestLoginBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
    },
    // Section Header
    sectionHeaderRow: {
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7C3AED',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontFamily: 'Cairo-Bold',
    },
    // Group Card
    groupCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 20,
        overflow: 'hidden',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    itemDivider: {
        borderBottomWidth: 1,
        borderBottomColor: '#F5F0FF',
    },
    iconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemTextContainer: {
        flex: 1,
        marginHorizontal: 12,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
        fontFamily: 'Cairo-Regular',
    },
    badgeContainer: {
        backgroundColor: '#6537C0',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        minWidth: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Social Card
    socialCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 16,
        marginBottom: 20,
    },
    socialRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    socialBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    // Auth Button
    authBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16,
        marginBottom: 24,
    },
    logoutBtn: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    loginBtn: {
        backgroundColor: '#F1ECFD',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    authBtnText: {
        fontSize: 15,
        fontWeight: '700',
        fontFamily: 'Cairo-Bold',
    },
    logoutText: {
        color: '#DC2626',
    },
    loginText: {
        color: '#6537C0',
    },
    // App Footer
    appFooter: {
        alignItems: 'center',
        paddingBottom: 16,
        gap: 4,
    },
    appFooterVersion: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: 'Cairo-Bold',
    },
    appFooterCopyright: {
        fontSize: 11,
        color: '#9CA3AF',
        fontFamily: 'Cairo-Regular',
    },
});
