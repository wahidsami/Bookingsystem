import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';

interface MoreScreenProps {
    navigation?: any;
}

export function MoreScreen({ navigation }: MoreScreenProps) {
    const { t } = useLanguage();

    const menuItems = [
        { id: 'profile', icon: '👤', label: t('profile'), route: 'Profile' },
        { id: 'myAppointments', icon: '📅', label: t('myAppointments'), route: 'Bookings' },
        { id: 'myPurchases', icon: '🛍️', label: t('myPurchases'), route: 'MyPurchases' },
        { id: 'payments', icon: '💳', label: t('payments'), route: 'Payments' },
        { id: 'settings', icon: '⚙️', label: t('settings'), route: 'Settings' },
        { id: 'about', icon: '💜', label: t('aboutRefah'), route: 'About' },
    ];

    const handleLogout = () => {
        // TODO: Implement logout logic
        console.log('Logout clicked');
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>U</Text>
                    </View>
                    <View>
                        <Text style={styles.userName}>Guest</Text>
                        <Text style={styles.userEmail}>Welcome to Refah</Text>
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
                                if (['Profile', 'Bookings', 'MyPurchases'].includes(item.route)) {
                                    navigation?.navigate(item.route);
                                } else {
                                    console.log(`Navigate to ${item.route}`);
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
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutIcon}>🚪</Text>
                    <Text style={styles.logoutText}>{t('logout')}</Text>
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
