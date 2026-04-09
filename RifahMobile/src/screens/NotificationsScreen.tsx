import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const loadNotifications = useCallback(async () => {
        try {
            const response = await api.getNotifications(1, 50);
            setNotifications(response.notifications || []);
            setUnreadCount(response.unreadCount || 0);
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
                        <Ionicons name="notifications-outline" size={14} color={colors.primary} />
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
                            <Ionicons name="image-outline" size={14} color="#6b7280" />
                            <Text style={styles.imageBadgeText}>{language === 'ar' ? 'صورة' : 'Image'}</Text>
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.lg + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{language === 'ar' ? 'الإشعارات' : 'Notifications'}</Text>
                    <Text style={styles.headerSubtitle}>
                        {language === 'ar'
                            ? `غير المقروءة: ${unreadCount}`
                            : `Unread: ${unreadCount}`}
                    </Text>
                </View>
                <View style={styles.headerButtonSpacer} />
            </View>

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
                            <Ionicons name="notifications-off-outline" size={40} color={colors.textTertiary} />
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
        backgroundColor: colors.backgroundGray,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtonSpacer: {
        width: 40,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    headerSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: 4,
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
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    cardUnread: {
        borderColor: '#d8b4fe',
        backgroundColor: '#faf5ff',
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
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    cardDate: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
        marginTop: 4,
    },
    unreadWrap: {
        alignItems: 'flex-end',
        gap: 4,
    },
    unreadLabel: {
        fontSize: fontSize.xs,
        color: colors.error,
        fontWeight: '700',
    },
    cardBody: {
        marginTop: spacing.sm,
        fontSize: fontSize.md,
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
        borderRadius: borderRadius.full,
        backgroundColor: '#f3e8ff',
    },
    linkBadgeText: {
        fontSize: fontSize.xs,
        color: colors.primaryDark,
        fontWeight: '600',
    },
    imageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: '#f3f4f6',
    },
    imageBadgeText: {
        fontSize: fontSize.xs,
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
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    emptyBody: {
        marginTop: spacing.sm,
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
});
