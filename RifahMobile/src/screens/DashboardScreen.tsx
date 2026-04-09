import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, RefreshControl, Dimensions } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, User, Booking, getImageUrl } from '../api/client';
import { useNavigation } from '@react-navigation/native';
import { useScreenSafeArea } from '../utils/safeArea';

const { width } = Dimensions.get('window');

export function DashboardScreen() {
    const { t, isRTL } = useLanguage();
    const navigation = useNavigation<any>();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState({ upcomingCount: 0, pendingPayment: 0 });
    const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const userData = await api.getUser();
            setUser(userData);

            // api.getBookings() already returns Booking[] (unwrapped)
            const bookings = await api.getBookings();
            const upcoming = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
            const pendingPayment = bookings.filter(b => b.paymentStatus === 'pending');

            setStats({
                upcomingCount: upcoming.length,
                pendingPayment: pendingPayment.length
            });

            // Show the next 3 bookings on the dashboard
            setRecentBookings(bookings.slice(0, 3));

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('goodMorning');
        if (hour < 18) return t('goodAfternoon');
        return t('goodEvening');
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                <View>
                    <Text style={styles.greeting}>{getGreeting()},</Text>
                    <Text style={styles.username}>
                        {user ? `${user.firstName} ${user.lastName}` : 'Guest'}
                    </Text>
                </View>
                {/* Profile Image or Placeholder */}
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                    {user?.profileImage ? (
                        <Image
                            source={{ uri: getImageUrl(user.profileImage) }}
                            style={styles.headerAvatar}
                        />
                    ) : (
                        <View style={styles.headerAvatarPlaceholder}>
                            <Text style={styles.headerAvatarText}>
                                {user?.firstName?.charAt(0).toUpperCase() || 'U'}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>{t('upcomingBookings')}</Text>
                        <Text style={styles.statValue}>{stats.upcomingCount}</Text>
                        <Text style={styles.statIcon}>📅</Text>
                    </View>
                    <View style={[styles.statCard, styles.statCardSecondary]}>
                        <Text style={styles.statLabel}>{t('payments')}</Text>
                        <Text style={styles.statValue}>{stats.pendingPayment}</Text>
                        <Text style={styles.statIcon}>💳</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('quickActions')}</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('Browse')}
                    >
                        <View style={styles.actionIconContainer}>
                            <Text style={styles.actionIcon}>🔍</Text>
                        </View>
                        <Text style={styles.actionText}>{t('findSalon')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('Bookings')}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#E0F2FE' }]}>
                            <Text style={styles.actionIcon}>📅</Text>
                        </View>
                        <Text style={styles.actionText}>{t('bookings')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('MyPurchases')}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#FCE7F3' }]}>
                            <Text style={styles.actionIcon}>🛍️</Text>
                        </View>
                        <Text style={styles.actionText}>{t('myPurchases')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent/Upcoming Bookings Preview */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('upcomingBookings')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
                        <Text style={styles.viewAll}>{t('viewAll')}</Text>
                    </TouchableOpacity>
                </View>

                {recentBookings.length > 0 ? (
                    recentBookings.map((booking) => (
                        <TouchableOpacity
                            key={booking.id}
                            style={styles.bookingCard}
                            onPress={() => navigation.navigate('Bookings')}
                        >
                            <View style={styles.bookingHeader}>
                                <Text style={styles.bookingService}>
                                    {booking.Service
                                        ? (isRTL ? booking.Service.name_ar : booking.Service.name_en)
                                        : `Booking #${booking.id.slice(0, 8)}`}
                                </Text>
                                <Text style={[
                                    styles.bookingStatus,
                                    booking.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending
                                ]}>
                                    {booking.status}
                                </Text>
                            </View>
                            <Text style={styles.bookingDate}>
                                {new Date(booking.startTime).toLocaleDateString()} • {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>{t('noUpcomingBookingsDashboard')}</Text>
                        <TouchableOpacity
                            style={styles.bookNowButton}
                            onPress={() => navigation.navigate('Browse')}
                        >
                            <Text style={styles.bookNowText}>{t('bookNow')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,
        backgroundColor: '#FFFFFF',
    },
    greeting: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
    },
    username: {
        fontSize: fontSize.xxl,
        fontWeight: 'bold',
        color: colors.text,
    },
    headerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    headerAvatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAvatarText: {
        color: '#FFF',
        fontSize: fontSize.lg,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: spacing.lg,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        position: 'relative',
        overflow: 'hidden',
    },
    statCardSecondary: {
        backgroundColor: '#10B981', // Emerald 500
    },
    statLabel: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: fontSize.xs,
        marginBottom: spacing.xs,
        fontWeight: '600',
    },
    statValue: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: 'bold',
    },
    statIcon: {
        position: 'absolute',
        right: -10,
        bottom: -10,
        fontSize: 60,
        opacity: 0.2,
    },
    sectionTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        marginTop: spacing.lg,
    },
    viewAll: {
        color: colors.primary,
        fontSize: fontSize.sm,
        fontWeight: '600',
    },
    rtlText: {
        textAlign: 'right',
    },
    actionsGrid: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    actionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    actionIcon: {
        fontSize: 24,
    },
    actionText: {
        fontSize: fontSize.xs,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
    },
    bookingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    bookingService: {
        fontWeight: '600',
        color: colors.text,
    },
    bookingStatus: {
        fontSize: fontSize.xs,
        fontWeight: '600',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    statusConfirmed: {
        backgroundColor: '#D1FAE5',
        color: '#065F46',
    },
    statusPending: {
        backgroundColor: '#FEF3C7',
        color: '#92400E',
    },
    bookingDate: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.lg,
        backgroundColor: '#F9FAFB',
        borderRadius: borderRadius.lg,
    },
    emptyStateText: {
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    bookNowButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    bookNowText: {
        color: '#FFF',
        fontWeight: '600',
    },
});
