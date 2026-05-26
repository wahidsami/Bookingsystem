import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api, AppointmentInviteDetails, getImageUrl } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';

export function AppointmentInviteScreen({ route, navigation }: any) {
    const { token } = route.params || {};
    const { language } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [invite, setInvite] = useState<AppointmentInviteDetails | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            if (!token) {
                setError(language === 'ar' ? 'رابط الدعوة غير صالح.' : 'Invalid invite link.');
                setLoading(false);
                return;
            }

            try {
                const result = await api.getAppointmentInvite(token);
                setInvite(result);
            } catch (err: any) {
                setError(err?.message || (language === 'ar' ? 'تعذر تحميل الدعوة.' : 'Failed to load invite.'));
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [token, language]);

    const submitResponse = async (response: 'confirm' | 'decline') => {
        if (!invite) return;
        try {
            setSubmitting(true);
            await api.respondToAppointmentInviteByToken(token, response);
            Alert.alert(
                language === 'ar' ? 'تم' : 'Done',
                response === 'confirm'
                    ? (language === 'ar' ? 'تم تأكيد الموعد.' : 'Appointment confirmed.')
                    : (language === 'ar' ? 'تم إلغاء الموعد.' : 'Appointment cancelled.')
            );
            navigation.navigate('Tabs');
        } catch (err: any) {
            Alert.alert(
                language === 'ar' ? 'خطأ' : 'Error',
                err?.message || (language === 'ar' ? 'تعذر إرسال الرد.' : 'Failed to submit response.')
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (error || !invite) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error || (language === 'ar' ? 'لا توجد دعوة.' : 'No invite found.')}</Text>
            </View>
        );
    }

    const serviceName = language === 'ar'
        ? (invite.service?.name_ar || invite.service?.name_en || '-')
        : (invite.service?.name_en || invite.service?.name_ar || '-');
    const tenantLogoUrl = getImageUrl(invite.tenant?.logo);
    const tenantName = (invite.tenant?.name || 'Refah').trim();
    const tenantInitial = tenantName.charAt(0).toUpperCase();
    const providerName = invite.staff?.name || (language === 'ar' ? 'مقدم الخدمة' : 'Service provider');
    const customerName = language === 'ar' ? 'عميلنا' : 'Customer';
    const detailDate = new Date(invite.startTime).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <View style={styles.container}>
            <View style={styles.topBand} />
            <View style={styles.logoCard}>
                {tenantLogoUrl ? (
                    <Image source={{ uri: tenantLogoUrl }} style={styles.logo} resizeMode="cover" />
                ) : (
                    <View style={styles.logoFallbackWrap}>
                        <Text style={styles.logoFallbackText}>{tenantInitial || 'R'}</Text>
                    </View>
                )}
            </View>
            <Text style={styles.heroTitle}>{language === 'ar' ? 'تأكيد الموعد' : 'Appointment confirmation'}</Text>

            <View style={styles.content}>
                <Text style={styles.greeting}>
                    {language === 'ar' ? `مرحباً ${customerName}` : `Hi ${customerName}`}
                </Text>
                <Text style={styles.messageLine}>
                    {language === 'ar' ? 'لديك موعد لدى' : 'You have an appointment at'}
                </Text>
                <Text style={styles.messageTenant}>{tenantName}</Text>

                <View style={styles.detailsCard}>
                    <Text style={styles.detailsText}>{detailDate}</Text>
                    <Text style={styles.detailsText}>{serviceName}</Text>
                    <Text style={styles.detailsText}>{providerName}</Text>
                </View>

                <View style={styles.providerAvatar}>
                    <Text style={styles.providerAvatarText}>
                        {providerName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SP'}
                    </Text>
                </View>

                <Text style={styles.confirmLine}>
                    {language === 'ar'
                        ? 'يرجى تأكيد الحضور أو الاعتذار عن الموعد'
                        : 'Please confirm if you would like to attend or not'}
                </Text>

                {invite.isExpired ? (
                    <Text style={styles.errorText}>{language === 'ar' ? 'انتهت صلاحية رابط الدعوة.' : 'Invite link has expired.'}</Text>
                ) : invite.customerConfirmationStatus !== 'pending' ? (
                    <Text style={styles.infoText}>
                        {invite.customerConfirmationStatus === 'confirmed'
                            ? (language === 'ar' ? 'تم تأكيد هذا الموعد مسبقًا.' : 'This appointment was already confirmed.')
                            : (language === 'ar' ? 'تم التعامل مع هذه الدعوة مسبقًا.' : 'This invite was already handled.')}
                    </Text>
                ) : (
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.confirmButton} disabled={submitting} onPress={() => submitResponse('confirm')}>
                            <Text style={styles.confirmText}>{language === 'ar' ? 'نعم، سأحضر' : 'Sure, i will attend'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineButton} disabled={submitting} onPress={() => submitResponse('decline')}>
                            <Text style={styles.declineText}>{language === 'ar' ? 'عذرًا، لا أستطيع الحضور' : "Sorry, i can’t attend"}</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {submitting ? (
                    <View style={styles.inlineLoader}>
                        <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundGray,
    },
    topBand: {
        height: 195,
        backgroundColor: colors.primary
    },
    heroTitle: {
        position: 'absolute',
        top: 110,
        left: 196,
        right: 20,
        fontSize: 52 / 2,
        lineHeight: 56 / 2,
        color: colors.textInverse,
        fontWeight: '800'
    },
    logoCard: {
        position: 'absolute',
        top: 98,
        left: 26,
        width: 152,
        height: 152,
        borderRadius: 36,
        backgroundColor: colors.black,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center'
    },
    content: {
        marginTop: 30,
        paddingHorizontal: 24
    },
    greeting: {
        textAlign: 'center',
        fontSize: 42 / 2,
        fontWeight: '800',
        color: colors.text,
    },
    messageLine: {
        marginTop: 8,
        textAlign: 'center',
        color: colors.text,
        fontSize: 24 / 2
    },
    messageTenant: {
        textAlign: 'center',
        color: colors.text,
        fontSize: 24 / 2,
        fontWeight: '700',
        marginBottom: 16
    },
    detailsCard: {
        height: 164,
        borderRadius: 14,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6
    },
    detailsText: {
        color: colors.textInverse,
        fontSize: 20 / 2,
        fontWeight: '500'
    },
    providerAvatar: {
        alignSelf: 'center',
        marginTop: -28,
        width: 98,
        height: 98,
        borderRadius: 49,
        backgroundColor: colors.black,
        alignItems: 'center',
        justifyContent: 'center'
    },
    providerAvatarText: {
        color: colors.textInverse,
        fontWeight: '800',
        fontSize: 26 / 2
    },
    confirmLine: {
        marginTop: 20,
        textAlign: 'center',
        color: colors.text,
        fontSize: 22 / 2,
        marginBottom: 20
    },
    logo: {
        width: '100%',
        height: '100%',
        borderRadius: 36
    },
    logoFallbackWrap: {
        width: '100%',
        height: '100%',
        borderRadius: 36,
        backgroundColor: colors.black,
        alignItems: 'center',
        justifyContent: 'center'
    },
    logoFallbackText: {
        color: colors.textInverse,
        fontSize: 36 / 2,
        fontWeight: '700'
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    actions: {
        gap: 14,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
    },
    declineButton: {
        borderColor: colors.primary,
        borderWidth: 2,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: 'transparent'
    },
    confirmText: {
        color: colors.textInverse,
        fontWeight: '700',
        fontSize: 20 / 2,
    },
    declineText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 20 / 2,
    },
    errorText: {
        color: colors.error,
        textAlign: 'center',
        fontSize: fontSize.md,
    },
    infoText: {
        color: colors.textSecondary,
        textAlign: 'center',
        fontSize: fontSize.md,
    },
    inlineLoader: {
        marginTop: spacing.md,
        alignItems: 'center'
    },
});
