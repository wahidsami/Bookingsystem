import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppIcon } from '../components/AppIcon';
import { ThemedText as Text } from '../components/ThemedText';
import { CustomerNotification, api, getImageUrl } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';

interface NotificationDetailScreenProps {
    navigation: any;
    route: {
        params?: {
            notificationId?: string;
            campaignId?: string;
        };
    };
}

export function NotificationDetailScreen({ navigation, route }: NotificationDetailScreenProps) {
    const { language } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [notification, setNotification] = useState<CustomerNotification | null>(null);
    const [loading, setLoading] = useState(true);

    const notificationId = route.params?.notificationId;
    const campaignId = route.params?.campaignId;

    useEffect(() => {
        const load = async () => {
            try {
                const response = notificationId
                    ? await api.getNotificationDetail(notificationId)
                    : campaignId
                        ? await api.getNotificationByCampaign(campaignId)
                        : null;

                const item = response?.notification || null;
                setNotification(item);

                if (item?.id && !item.readAt) {
                    await api.markNotificationRead(item.id);
                    setNotification({ ...item, readAt: new Date().toISOString() });
                }
            } catch (error) {
                console.warn('Failed to load notification detail:', error);
                setNotification(null);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [campaignId, notificationId]);

    const imageUrl = useMemo(() => getImageUrl(notification?.imageUrl), [notification?.imageUrl]);

    const formatDateTime = (value?: string | null) => {
        if (!value) {
            return '-';
        }
        try {
            return new Date(value).toLocaleString(language === 'ar' ? 'ar' : 'en');
        } catch {
            return value;
        }
    };

    const openLinkedDestination = () => {
        if (!notification?.tenantId) {
            return;
        }

        navigation.navigate('Tenant', {
            tenantId: notification.tenantId,
            selectedServiceId: notification.serviceId || undefined,
        });
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.lg + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <AppIcon name={language === 'ar' ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{language === 'ar' ? 'تفاصيل الإشعار' : 'Notification Detail'}</Text>
                <View style={styles.headerButtonSpacer} />
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : !notification ? (
                <View style={styles.emptyWrap}>
                    <AppIcon name="warning" size={40} color={colors.textTertiary} />
                    <Text style={styles.emptyTitle}>{language === 'ar' ? 'تعذر تحميل الإشعار' : 'Could not load notification'}</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}>
                    {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
                    ) : null}

                    <View style={styles.card}>
                        <Text style={styles.title}>{notification.title}</Text>
                        <Text style={styles.date}>{formatDateTime(notification.sentAt || notification.createdAt)}</Text>
                        <Text style={styles.body}>{notification.body}</Text>

                        <View style={styles.metaCard}>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>{language === 'ar' ? 'المرسل' : 'Source'}</Text>
                                <Text style={styles.metaValue}>{notification.tenantName || (language === 'ar' ? 'منشأة' : 'Tenant')}</Text>
                            </View>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>{language === 'ar' ? 'نوع الرابط' : 'Link Type'}</Text>
                                <Text style={styles.metaValue}>{notification.linkType || '-'}</Text>
                            </View>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>{language === 'ar' ? 'الحالة' : 'Status'}</Text>
                                <Text style={styles.metaValue}>{notification.readAt ? (language === 'ar' ? 'تمت القراءة' : 'Read') : (language === 'ar' ? 'غير مقروء' : 'Unread')}</Text>
                            </View>
                        </View>

                        {notification.tenantId ? (
                            <TouchableOpacity style={styles.primaryButton} onPress={openLinkedDestination}>
                                <Text style={styles.primaryButtonText}>
                                    {notification.linkType === 'service'
                                        ? (language === 'ar' ? 'فتح صفحة المنشأة والخدمة' : 'Open Tenant & Service')
                                        : (language === 'ar' ? 'فتح صفحة المنشأة' : 'Open Tenant')}
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        {notification.imageUrl ? (
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => {
                                    const url = getImageUrl(notification.imageUrl);
                                    if (url) {
                                        Linking.openURL(url);
                                    }
                                }}
                            >
                                <Text style={styles.secondaryButtonText}>{language === 'ar' ? 'فتح الصورة' : 'Open Image'}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </ScrollView>
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
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyTitle: {
        marginTop: spacing.md,
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    content: {
        padding: spacing.lg,
    },
    heroImage: {
        width: '100%',
        height: 220,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
        backgroundColor: colors.primaryLight,
    },
    card: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    title: {
        fontSize: fontSize.xxl,
        fontWeight: '700',
        color: colors.text,
        lineHeight: 32,
    },
    date: {
        marginTop: spacing.sm,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    body: {
        marginTop: spacing.lg,
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
    },
    metaCard: {
        marginTop: spacing.lg,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.backgroundGray,
        gap: spacing.sm,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    metaLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    metaValue: {
        flex: 1,
        textAlign: 'right',
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '600',
    },
    primaryButton: {
        marginTop: spacing.lg,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    secondaryButton: {
        marginTop: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderDark,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: '600',
    },
});
