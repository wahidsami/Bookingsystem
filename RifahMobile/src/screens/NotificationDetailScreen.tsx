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
import { ThemedText as Text } from '../components/ThemedText';
import { CustomerNotification, api, getImageUrl } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { AppIcon } from '../components/AppIcon';
import { getLocalizedNotification } from '../utils/notificationLocalization';

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
    const { language, isRTL } = useLanguage();
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
                }
            } catch {
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
            return language === 'ar' ? 'الآن' : 'Just now';
        }

        try {
            return new Date(value).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US');
        } catch {
            return value;
        }
    };

    const googleReviewUrl = (notification as any)?.metadata?.googleReviewUrl;

    const openGoogleReview = async () => {
        if (!googleReviewUrl) return;
        try {
            const canOpen = await Linking.canOpenURL(googleReviewUrl);
            if (canOpen) {
                await Linking.openURL(googleReviewUrl);
            }
        } catch (err) {
            console.error('Failed to open Google review URL:', err);
        }
    };

    const openLinkedDestination = () => {
        if (!notification?.tenantId) return;

        const linkId = (notification as any).linkId;
        if (notification.linkType === 'service' && linkId) {
            navigation.navigate('Tenant', {
                tenantId: notification.tenantId,
                selectedServiceId: linkId,
                initialTab: 'services',
            });
            return;
        }

        navigation.navigate('Tenant', {
            tenantId: notification.tenantId,
            initialTab: 'overview',
        });
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader
                    title={language === 'ar' ? 'تفاصيل الإشعار' : 'Notification Details'}
                    onBack={() => navigation.goBack()}
                />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#6537C0" />
                </View>
            </View>
        );
    }

    if (!notification) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader
                    title={language === 'ar' ? 'تفاصيل الإشعار' : 'Notification Details'}
                    onBack={() => navigation.goBack()}
                />
                <View style={styles.emptyWrap}>
                    <View style={styles.emptyIconWrap}>
                        <AppIcon name="warning" size={36} color="#A379E2" />
                    </View>
                    <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
                        {language === 'ar' ? 'تعذر تحميل الإشعار' : 'Could not load notification'}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={language === 'ar' ? 'تفاصيل الإشعار' : 'Notification Details'}
                onBack={() => navigation.goBack()}
            />

            <ScrollView
                contentContainerStyle={{
                    paddingTop: 16,
                    paddingHorizontal: 16,
                    paddingBottom: scrollBottomPadding + 24,
                }}
                showsVerticalScrollIndicator={false}
            >
                {Boolean(imageUrl) && (
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: imageUrl! }} style={styles.heroImage} resizeMode="cover" />
                    </View>
                )}

                {(() => {
                    const localized = getLocalizedNotification(notification, isRTL);
                    return (
                        <View style={styles.card}>
                            <Text style={[styles.title, isRTL && styles.textRTL]}>{localized.title}</Text>
                            <Text style={[styles.date, isRTL && styles.textRTL]}>
                                {formatDateTime(notification.sentAt || notification.createdAt)}
                            </Text>
                            <Text style={[styles.body, isRTL && styles.textRTL]}>{localized.body}</Text>

                            {/* Meta Details Card */}
                            <View style={styles.metaCard}>
                                <View style={[styles.metaRow, isRTL && styles.rowRTL]}>
                                    <Text style={[styles.metaLabel, isRTL && styles.textRTL]}>
                                        {language === 'ar' ? 'المرسل' : 'Source'}
                                    </Text>
                                    <Text style={[styles.metaValue, isRTL && styles.textRTL]}>
                                        {notification.tenantName || (language === 'ar' ? 'منشأة BarSpa' : 'BarSpa Salon')}
                                    </Text>
                                </View>

                                <View style={[styles.metaRow, styles.metaDivider, isRTL && styles.rowRTL]}>
                                    <Text style={[styles.metaLabel, isRTL && styles.textRTL]}>
                                        {language === 'ar' ? 'نوع الرابط' : 'Link Type'}
                                    </Text>
                                    <Text style={[styles.metaValue, isRTL && styles.textRTL]}>
                                        {notification.linkType === 'service'
                                            ? (language === 'ar' ? 'خدمة' : 'Service')
                                            : notification.linkType === 'tenant'
                                                ? (language === 'ar' ? 'منشأة' : 'Tenant')
                                                : (language === 'ar' ? 'عام' : 'General')}
                                    </Text>
                                </View>
                            </View>

                            {/* CTAs */}
                            {notification.tenantId && googleReviewUrl ? (
                                <TouchableOpacity style={[styles.primaryButton, isRTL && styles.rowRTL]} onPress={openGoogleReview} activeOpacity={0.85}>
                                    <AppIcon name="star" size={18} color="#FFFFFF" />
                                    <Text style={styles.primaryButtonText}>
                                        {language === 'ar' ? 'قيّمنا على Google' : 'Rate Us on Google'}
                                    </Text>
                                </TouchableOpacity>
                            ) : notification.tenantId ? (
                                <TouchableOpacity style={[styles.primaryButton, isRTL && styles.rowRTL]} onPress={openLinkedDestination} activeOpacity={0.85}>
                                    <AppIcon name="storefront" size={18} color="#FFFFFF" />
                                    <Text style={styles.primaryButtonText}>
                                        {notification.linkType === 'service'
                                            ? (language === 'ar' ? 'عرض الخدمة في المنشأة' : 'View Service in Salon')
                                            : (language === 'ar' ? 'زيارة صفحة المنشأة' : 'Visit Salon Page')}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    );
                })()}
            </ScrollView>
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
    textRTL: {
        textAlign: 'right',
    },
    imageContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 16,
    },
    heroImage: {
        width: '100%',
        height: 200,
        backgroundColor: '#F1ECFD',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 20,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 6,
    },
    date: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        marginBottom: 16,
    },
    body: {
        fontSize: 14,
        color: '#374151',
        fontFamily: 'Cairo-Regular',
        lineHeight: 22,
        marginBottom: 20,
    },
    metaCard: {
        backgroundColor: '#FAF8FE',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 14,
        marginBottom: 20,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    metaDivider: {
        borderTopWidth: 1,
        borderTopColor: '#E7DDFC',
        marginTop: 6,
        paddingTop: 10,
    },
    metaLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
    },
    metaValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#6537C0',
        borderRadius: 16,
        paddingVertical: 14,
        gap: 8,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    primaryButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
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
        fontSize: 16,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        textAlign: 'center',
    },
});
