const fs = require('fs');

const content = `import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppIcon } from '../components/AppIcon';
import { PageHeader } from '../components/ui/PageHeader';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
import { CustomerNotification, api, getImageUrl } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';

interface NotificationsScreenProps {
    navigation: any;
}

export function NotificationsScreen({ navigation }: NotificationsScreenProps) {
    const { language } = useLanguage();
    const { scrollBottomPadding } = useScreenSafeArea();
    const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const loadNotifications = useCallback(async () => {
        try {
            const response = await api.getNotifications(1, 50);
            setNotifications(response.notifications || []);
            setUnreadCount(response.unreadCount || 0);
            const unreadItems = (response.notifications || []).filter((item) => !item.readAt);
            if (unreadItems.length > 0) {
                await Promise.allSettled(unreadItems.map((item) => api.markNotificationRead(item.id)));
                setNotifications((prev) =>
                    prev.map((item) => (item.readAt ? item : { ...item, readAt: new Date().toISOString() }))
                );
                setUnreadCount(0);
            }
        } catch (error) {
            console.warn('Failed to load notifications:', error);
            setNotifications([]);
            setUnreadCount(0);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    useFocusEffect(
        useCallback(() => {
            loadNotifications();
        }, [loadNotifications])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadNotifications();
    };

    const formatDateTime = (value?: string | null) => {
        if (!value) {
            return language === 'ar' ? 'الآن' : 'Just now';
        }

        try {
            return new Date(value).toLocaleString(language === 'ar' ? 'ar' : 'en');
        } catch {
            return value;
        }
    };

    const renderItem = ({ item }: { item: CustomerNotification }) => {
        const imageUrl = getImageUrl(item.imageUrl);
        return (
            <TouchableOpacity
                style={[styles.card, !item.readAt && styles.cardUnread]}
                onPress={() => navigation.navigate('NotificationDetail', { notificationId: item.id })}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.cardTitleWrap}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardDate}>{formatDateTime(item.sentAt || item.createdAt)}</Text>
                    </View>
                    {!item.readAt ? (
                        <View style={styles.unreadWrap}>
                            <View style={styles.unreadDot} />
                            <Text style={styles.unreadLabel}>{language === 'ar' ? 'غير مقروء' : 'Unread'}</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={styles.cardBody} numberOfLines={3}>{item.body}</Text>
                <View style={styles.cardFooter}>
                    <View style={styles.linkBadge}>
                        <AppIcon name="bell" size={14} color={colors.primary} />
                        <Text style={styles.linkBadgeText}>
                            {item.linkType === 'service'
                                ? (language === 'ar' ? 'خدمة' : 'Service')
                                : item.linkType === 'tenant'
                                    ? (language === 'ar' ? 'منشأة' : 'Tenant')
                                    : (language === 'ar' ? 'إشعار' : 'Notification')}
                        </Text>
                    </View>
                    {imageUrl ? (
                        <View style={styles.imageBadge}>
                            <AppIcon name="image" size={14} color={colors.textSecondary} />
                            <Text style={styles.imageBadgeText}>{language === 'ar' ? 'صورة' : 'Image'}</Text>
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <PageHeader
                title={language === 'ar' ? 'الإشعارات' : 'Notifications'}
                showBack
                onBack={() => navigation.goBack()}
                variant="standard"
            />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPadding }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    renderItem={renderItem}
                    ListEmptyComponent={(
                        <View style={styles.emptyWrap}>
                            <AppIcon name="notifications_off" size={40} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>{language === 'ar' ? 'لا توجد إشعارات بعد' : 'No notifications yet'}</Text>
                            <Text style={styles.emptyBody}>
                                {language === 'ar'
                                    ? 'ستظهر هنا العروض والإشعارات التي ترسلها المنشآت التي تتابعها.'
                                    : 'Offers and announcements from your salons will appear here.'}
                            </Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.lg,
        shadowColor: colors.brandPrimary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
    },
    cardUnread: {
        borderColor: colors.primary,
        backgroundColor: colors.brandPrimaryLight + '33',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    cardTitleWrap: {
        flex: 1,
        gap: 4,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    cardDate: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
        marginTop: 4,
    },
    unreadWrap: {
        alignItems: 'flex-end',
        gap: 4,
    },
    unreadLabel: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '700',
    },
    cardBody: {
        marginTop: spacing.md,
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    cardFooter: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    linkBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: colors.brandPrimaryLight,
    },
    linkBadgeText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    imageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    imageBadgeText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
    },
    emptyTitle: {
        marginTop: spacing.md,
        fontSize: 20,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    emptyBody: {
        marginTop: spacing.sm,
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
});
`;
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/NotificationsScreen.tsx', content);
