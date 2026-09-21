import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
import { CustomerNotification, api, getImageUrl } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { AppIcon } from '../components/AppIcon';
import * as Notifications from 'expo-notifications';
import { getLocalizedNotification } from '../utils/notificationLocalization';

interface NotificationsScreenProps {
    navigation: any;
}

export function NotificationsScreen({ navigation }: NotificationsScreenProps) {
    const { language, isRTL } = useLanguage();
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
                    prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))
                );
                setUnreadCount(0);
                await Notifications.setBadgeCountAsync(0);
            }
        } catch {
            setNotifications([]);
            setUnreadCount(0);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

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
            return new Date(value).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US');
        } catch {
            return value;
        }
    };

    const renderItem = ({ item }: { item: CustomerNotification }) => {
        const imageUrl = getImageUrl(item.imageUrl);
        const isUnread = !item.readAt;
        const localized = getLocalizedNotification(item, isRTL);

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    isUnread && styles.cardUnread,
                    isUnread && isRTL && styles.cardUnreadRTL,
                ]}
                onPress={() => navigation.navigate('NotificationDetail', { notificationId: item.id })}
                activeOpacity={0.75}
            >
                <View style={[styles.cardHeader, isRTL && styles.rowRTL]}>
                    <View style={styles.iconCircle}>
                        <AppIcon name="bell" size={18} color="#6537C0" />
                    </View>
                    <View style={[styles.cardTitleWrap, isRTL && styles.alignRTL]}>
                        <Text style={[styles.cardTitle, isRTL && styles.textRTL]}>{localized.title}</Text>
                        <Text style={[styles.cardDate, isRTL && styles.textRTL]}>
                            {formatDateTime(item.sentAt || item.createdAt)}
                        </Text>
                    </View>
                    {isUnread && (
                        <View style={styles.unreadDot} />
                    )}
                </View>

                <Text style={[styles.cardBody, isRTL && styles.textRTL]} numberOfLines={3}>
                    {localized.body}
                </Text>

                <View style={[styles.cardFooter, isRTL && styles.rowRTL]}>
                    <View style={[styles.linkBadge, isRTL && styles.rowRTL]}>
                        <AppIcon name="sparkles" size={12} color="#6537C0" />
                        <Text style={styles.linkBadgeText}>
                            {item.linkType === 'service'
                                ? (language === 'ar' ? 'خدمة' : 'Service')
                                : item.linkType === 'tenant'
                                    ? (language === 'ar' ? 'منشأة' : 'Tenant')
                                    : (language === 'ar' ? 'إشعار عام' : 'General')}
                        </Text>
                    </View>
                    {Boolean(imageUrl) && (
                        <View style={[styles.imageBadge, isRTL && styles.rowRTL]}>
                            <AppIcon name="image" size={12} color="#6B7280" />
                            <Text style={styles.imageBadgeText}>{language === 'ar' ? 'صورة' : 'Image'}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={language === 'ar' ? 'الإشعارات' : 'Notifications'}
                subtitle={
                    unreadCount > 0
                        ? (language === 'ar' ? `${unreadCount} غير مقروء` : `${unreadCount} unread`)
                        : undefined
                }
                onBack={() => navigation.goBack()}
            />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color="#6537C0" size="large" />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: scrollBottomPadding + 24 }
                    ]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6537C0" />
                    }
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyIconWrap}>
                                <AppIcon name="bell" size={36} color="#A379E2" />
                            </View>
                            <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
                                {language === 'ar' ? 'لا توجد إشعارات بعد' : 'No notifications yet'}
                            </Text>
                            <Text style={[styles.emptyBody, isRTL && styles.textRTL]}>
                                {language === 'ar'
                                    ? 'ستظهر هنا تحديثات المواعيد، والعروض الخاصة بالصالونات التي تتابعها.'
                                    : 'Booking updates and special offers from your salons will appear here.'}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    cardUnread: {
        backgroundColor: '#FDFCFF',
        borderColor: '#C4B5FD',
        borderLeftWidth: 4,
        borderLeftColor: '#6537C0',
    },
    cardUnreadRTL: {
        borderLeftWidth: 1,
        borderLeftColor: '#C4B5FD',
        borderRightWidth: 4,
        borderRightColor: '#6537C0',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitleWrap: {
        flex: 1,
        marginHorizontal: 10,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    cardDate: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        marginTop: 2,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6537C0',
    },
    cardBody: {
        fontSize: 13,
        color: '#4B5563',
        fontFamily: 'Cairo-Regular',
        lineHeight: 19,
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    linkBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F1ECFD',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    linkBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    imageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    imageBadgeText: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 6,
        textAlign: 'center',
    },
    emptyBody: {
        fontSize: 13,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        textAlign: 'center',
        lineHeight: 20,
    },
});
