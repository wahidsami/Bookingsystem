import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api, AppointmentInviteDetails } from '../api/client';
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
                    : (language === 'ar' ? 'تم رفض الموعد.' : 'Appointment declined.')
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

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>Refah</Text>
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
        backgroundColor: '#f5f7fb',
        padding: spacing.xl,
        justifyContent: 'center',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        shadowColor: '#0f172a',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4
    },
    badge: {
        alignSelf: 'center',
        backgroundColor: '#eef2ff',
        borderRadius: 999,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginBottom: spacing.md
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
        color: colors.text,
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
        marginBottom: spacing.xl,
    },
    actions: {
        gap: spacing.md,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    declineButton: {
        borderColor: '#ef4444',
        borderWidth: 1,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
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
        marginTop: spacing.md,
        color: '#64748b',
        textAlign: 'center',
        fontSize: fontSize.sm
    }
});
