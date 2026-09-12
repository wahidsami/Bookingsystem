const fs = require('fs');

const content = `import React, { useEffect, useMemo, useState } from 'react';
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
import { PageHeader } from '../components/ui/PageHeader';
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
    const { scrollBottomPadding } = useScreenSafeArea();
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
    const googleReviewUrl = useMemo(
        () => notification?.data?.googleReviewUrl || notification?.data?.googleMapLink || notification?.data?.reviewUrl || '',
        [notification?.data]
    );

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

    const openTenantReviewsTab = () => {
        if (!notification?.tenantId) {
            return;
        }

        navigation.navigate('Tenant', {
            tenantId: notification.tenantId,
            initialTab: 'reviews',
        });
    };

    const openGoogleReview = async () => {
        if (!googleReviewUrl) {
            return;
        }

        try {
            await Linking.openURL(googleReviewUrl);
        } catch (error) {
            console.warn('Failed to open review URL:', error);
        }
    };

    return (
        <View style={styles.container}>
            <PageHeader
                title={language === 'ar' ? 'تفاصيل الإشعار' : 'Notification Detail'}
                showBack
                onBack={() => navigation.goBack()}
                variant="standard"
            />

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

                        {notification.tenantId && googleReviewUrl ? (
                            <TouchableOpacity style={styles.primaryButton} onPress={openGoogleReview}>
                                <Text style={styles.primaryButtonText}>
                                    {language === 'ar' ? 'قيّمنا' : 'Rate Us'}
                                </Text>
                            </TouchableOpacity>
                        ) : notification.tenantId ? (
                            <TouchableOpacity style={styles.primaryButton} onPress={openLinkedDestination}>
                                <Text style={styles.primaryButtonText}>
                                    {notification.linkType === 'service'
                                        ? (language === 'ar' ? 'فتح صفحة المنشأة والخدمة' : 'Open Tenant & Service')
                                        : (language === 'ar' ? 'فتح صفحة المنشأة' : 'Open Tenant')}
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        {notification.tenantId ? (
                            <TouchableOpacity style={styles.reviewTabButton} onPress={openTenantReviewsTab}>
                                <Text style={styles.reviewTabButtonText}>
                                    {language === 'ar' ? 'عرض التقييمات' : 'View Reviews'}
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
        backgroundColor: colors.background,
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
        fontSize: 20,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    content: {
        padding: spacing.lg,
    },
    heroImage: {
        width: '100%',
        height: 220,
        borderRadius: 16,
        marginBottom: spacing.lg,
        backgroundColor: colors.primaryLight,
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
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.textPrimary,
        lineHeight: 32,
    },
    date: {
        marginTop: spacing.sm,
        fontSize: 12,
        color: colors.textSecondary,
    },
    body: {
        marginTop: spacing.lg,
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    metaCard: {
        marginTop: spacing.lg,
        padding: spacing.md,
        borderRadius: 16,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        gap: spacing.sm,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    metaLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    metaValue: {
        flex: 1,
        textAlign: 'right',
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '700',
    },
    primaryButton: {
        marginTop: spacing.lg,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: 16,
        alignItems: 'center',
        minHeight: 52,
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        marginTop: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        paddingVertical: spacing.md,
        borderRadius: 16,
        alignItems: 'center',
        minHeight: 52,
        justifyContent: 'center',
    },
    secondaryButtonText: {
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
    reviewTabButton: {
        marginTop: spacing.md,
        backgroundColor: colors.brandPrimaryLight + '33',
        paddingVertical: spacing.md,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.primary + '33',
        minHeight: 52,
        justifyContent: 'center',
    },
    reviewTabButtonText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '700',
    },
});
`;
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/NotificationDetailScreen.tsx', content);
