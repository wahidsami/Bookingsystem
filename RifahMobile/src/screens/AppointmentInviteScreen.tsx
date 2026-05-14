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

    return (
        <View style={styles.container}>
            <View style={styles.bgOrbOne} />
            <View style={styles.bgOrbTwo} />
            <View style={styles.card}>
                <View style={styles.logoShell}>
                    {tenantLogoUrl ? (
                        <View style={styles.logoWrap}>
                            <Image source={{ uri: tenantLogoUrl }} style={styles.logo} resizeMode="cover" />
                        </View>
                    ) : (
                        <View style={styles.logoFallbackWrap}>
                            <Text style={styles.logoFallbackText}>{tenantInitial || 'R'}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.centerName}>{tenantName}</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{language === 'ar' ? 'دعوة حضور' : 'Attendance request'}</Text>
                </View>
                <Text style={styles.title}>{language === 'ar' ? 'تأكيد الموعد' : 'Appointment Confirmation'}</Text>
                <Text style={styles.subtitle}>
                    {invite.tenant?.name || 'Refah'} - {serviceName}
                </Text>
                <Text style={styles.timeText}>{new Date(invite.startTime).toLocaleString()}</Text>

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
                            <Text style={styles.confirmText}>{language === 'ar' ? 'سأحضر' : 'I will attend'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineButton} disabled={submitting} onPress={() => submitResponse('decline')}>
                            <Text style={styles.declineText}>{language === 'ar' ? 'لا أستطيع الحضور' : "I can't attend"}</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {submitting ? (
                    <View style={styles.inlineLoader}>
                        <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                ) : null}
            </View>
            <Text style={styles.footerText}>
                {language === 'ar'
                    ? 'يمكنك تحديث قرارك قبل انتهاء صلاحية الرابط.'
                    : 'You can update your response before the invite expires.'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#eef1f8',
        padding: spacing.xl,
        justifyContent: 'center',
    },
    bgOrbOne: {
        position: 'absolute',
        top: -80,
        right: -40,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(126, 81, 211, 0.20)'
    },
    bgOrbTwo: {
        position: 'absolute',
        bottom: -100,
        left: -60,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(56, 189, 248, 0.14)'
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 28,
        padding: spacing.xl,
        shadowColor: '#0f172a',
        shadowOpacity: 0.14,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    logoShell: {
        alignSelf: 'center',
        borderRadius: 44,
        padding: 6,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: spacing.xs
    },
    centerName: {
        textAlign: 'center',
        color: '#0f172a',
        fontSize: fontSize.md,
        fontWeight: '700',
        marginBottom: spacing.sm
    },
    badge: {
        alignSelf: 'center',
        backgroundColor: '#f1effc',
        borderRadius: 999,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginBottom: spacing.md
    },
    logoWrap: {
        alignSelf: 'center',
        width: 76,
        height: 76,
        borderRadius: 38,
        padding: 2,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#ddd6fe'
    },
    logo: {
        width: '100%',
        height: '100%',
        borderRadius: 35
    },
    logoFallbackWrap: {
        alignSelf: 'center',
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
        alignItems: 'center',
        justifyContent: 'center'
    },
    logoFallbackText: {
        color: colors.primaryDark,
        fontSize: fontSize.xl,
        fontWeight: '700'
    },
    badgeText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: fontSize.sm
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    title: {
        fontSize: fontSize.xxl,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: fontSize.lg,
        color: colors.text,
        textAlign: 'center',
    },
    timeText: {
        marginTop: spacing.sm,
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    actions: {
        gap: spacing.md,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        borderRadius: 14,
        paddingVertical: spacing.md + 2,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4
    },
    declineButton: {
        borderColor: '#ef4444',
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: spacing.md + 2,
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    confirmText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: fontSize.md,
    },
    declineText: {
        color: '#ef4444',
        fontWeight: '700',
        fontSize: fontSize.md,
    },
    errorText: {
        color: '#ef4444',
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
    footerText: {
        marginTop: spacing.lg,
        color: '#64748b',
        textAlign: 'center',
        fontSize: fontSize.sm
    }
});
