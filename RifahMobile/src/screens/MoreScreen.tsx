import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, User } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';

interface MoreScreenProps {
    navigation?: any;
}

export function MoreScreen({ navigation }: MoreScreenProps) {
    const { t } = useLanguage();
    const { isAuthenticated, logout, showLogin } = useAppSession();
    const [user, setUser] = useState<User | null>(null);

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
        }, [])
    );

    const menuItems = [
        { id: 'profile', icon: '👤', label: t('profile'), action: () => navigation?.navigate('Profile') },
        { id: 'myAppointments', icon: '📅', label: t('myAppointments'), action: () => navigation?.navigate('Appointments') },
        { id: 'browse', icon: '🔍', label: t('browseSalons'), action: () => navigation?.navigate('Browse') },
        { id: 'myPurchases', icon: '🛍️', label: t('myPurchases'), action: () => navigation?.navigate('Purchases') },
    ];

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
            <View style={styles.header}>
                <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user?.firstName?.charAt(0).toUpperCase() || 'U'}</Text>
                    </View>
                    <View>
                        <Text style={styles.userName}>{user ? `${user.firstName} ${user.lastName}` : t('guestTitle')}</Text>
                        <Text style={styles.userEmail}>{user?.email || t('welcome')}</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.content}>
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
                                <Text style={styles.menuIcon}>{item.icon}</Text>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleAuthAction}>
                    <Text style={styles.logoutIcon}>{isAuthenticated ? '🚪' : '🔐'}</Text>
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
        paddingTop: spacing.xl + 20,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: fontSize.xxl,
        fontWeight: '700',
        color: colors.primary,
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
    menuIcon: {
        fontSize: 24,
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
    logoutIcon: {
        fontSize: 20,
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
