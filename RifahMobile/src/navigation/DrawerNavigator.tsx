import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { HomeScreen } from '../screens/HomeScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AppIcon } from '../components/AppIcon';

const Drawer = createDrawerNavigator();

// Custom Drawer Content matching web app
function CustomDrawerContent(props: DrawerContentComponentProps) {
    const { t, language } = useLanguage();
    const isRTL = language === 'ar';

    const menuItems = [
        { name: 'Dashboard', icon: 'dashboard', label: t('dashboard'), active: true },
        { name: 'Profile', icon: 'profile', label: t('profile') },
        { name: 'Bookings', icon: 'bookings', label: t('bookings') },
        { name: 'MyPurchases', icon: 'purchases', label: t('myPurchases') },
        { name: 'Payments', icon: 'card', label: t('payments') },
        { name: 'PaymentMethods', icon: 'card', label: t('paymentMethods') },
        { name: 'Wallet', icon: 'sparkles', label: t('walletLoyalty') },
        { name: 'Settings', icon: 'settings', label: t('settings') },
        { name: 'Home', icon: 'browse', label: t('browseSalons') },
    ];

    const handleLogout = () => {
        // TODO: Implement logout
        console.log('Logout');
    };

    return (
        <DrawerContentScrollView {...props} style={styles.drawerContainer}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.closeButton}>
                    <TouchableOpacity onPress={() => props.navigation.closeDrawer()}>
                        <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.logoContainer}>
                    <AppIcon name="sparkles" size={24} color={colors.primary} />
                    <Text style={styles.logoText}>Rifah</Text>
                </View>

                <Text style={styles.userName}>waheed sami</Text>

                <View style={styles.languageToggle}>
                    <TouchableOpacity style={[styles.langButton, language === 'en' && styles.langButtonActive]}>
                        <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>US</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.langButton, language === 'ar' && styles.langButtonActive]}>
                        <Text style={[styles.langText, language === 'ar' && styles.langTextActive]}>SA</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.browseSalonsButton}>
                        <Text style={styles.browseSalonsText}>{t('browseSalons')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Menu Items */}
            <View style={styles.menuContainer}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={item.name}
                        style={[
                            styles.menuItem,
                            item.active && styles.menuItemActive
                        ]}
                        onPress={() => props.navigation.navigate(item.name)}
                    >
                        <AppIcon name={item.icon as any} size={20} color={item.active ? '#FFFFFF' : colors.primary} />
                        <Text style={[
                            styles.menuLabel,
                            item.active && styles.menuLabelActive
                        ]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                ))}

                {/* Logout */}
                <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
                    <AppIcon name="logout" size={20} color="#EF4444" />
                    <Text style={styles.logoutLabel}>{t('logout')}</Text>
                </TouchableOpacity>
            </View>

            {/* Stats Footer */}
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{t('totalBookings')}</Text>
                    <View style={styles.statValueContainer}>
                        <Text style={styles.statValue}>5</Text>
                        <AppIcon name="bookings" size={20} color={colors.primary} />
                    </View>
                </View>

                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{t('upcomingBookings')}</Text>
                    <View style={styles.statValueContainer}>
                        <Text style={styles.statValue}>2</Text>
                        <AppIcon name="dashboard" size={20} color={colors.primary} />
                    </View>
                </View>
            </View>
        </DrawerContentScrollView>
    );
}

export function AppNavigator() {
    return (
        <NavigationContainer>
            <Drawer.Navigator
                drawerContent={(props) => <CustomDrawerContent {...props} />}
                screenOptions={{
                    headerShown: false,
                    drawerType: 'front',
                    drawerStyle: {
                        width: 300,
                    },
                }}
            >
                <Drawer.Screen name="Dashboard" component={DashboardScreen} />
                <Drawer.Screen name="Home" component={HomeScreen} />
                {/* TODO: Add other screens */}
            </Drawer.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    drawerContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    closeButton: {
        alignSelf: 'flex-start',
        marginBottom: spacing.md,
    },
    closeIcon: {
        fontSize: 24,
        color: colors.text,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    logoText: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    userName: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    languageToggle: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    langButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#FFFFFF',
    },
    langButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    langText: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text,
    },
    langTextActive: {
        color: '#FFFFFF',
    },
    browseSalonsButton: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    browseSalonsText: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    menuContainer: {
        paddingVertical: spacing.md,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    menuItemActive: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        marginHorizontal: spacing.sm,
    },
    menuLabel: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '500',
    },
    menuLabelActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    logoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    logoutLabel: {
        fontSize: fontSize.md,
        color: '#EF4444',
        fontWeight: '500',
    },
    statsContainer: {
        padding: spacing.lg,
        gap: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginTop: 'auto',
    },
    statBox: {
        backgroundColor: '#F9FAFB',
        padding: spacing.md,
        borderRadius: 12,
    },
    statLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    statValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statValue: {
        fontSize: fontSize.xxl,
        fontWeight: '700',
        color: colors.text,
    },
});
