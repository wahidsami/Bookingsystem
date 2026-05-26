import React from 'react';
import { ActivityIndicator, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { api } from '../api/client';
import { registerCustomerPushNotifications, unregisterCustomerPushNotifications } from '../lib/notifications';

interface SettingsScreenProps {
    navigation: any;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
    const { t, language, setLanguage } = useLanguage();
    const { topInset } = useScreenSafeArea();
    const [profile, setProfile] = React.useState<any>(null);
    const [pushEnabled, setPushEnabled] = React.useState(true);
    const [pushLoading, setPushLoading] = React.useState(false);

    const nextLanguage = language === 'ar' ? 'en' : 'ar';

    React.useEffect(() => {
        let active = true;
        api.getProfile()
            .then((profile) => {
                if (!active) return;
                setProfile(profile);
                setPushEnabled(profile.notificationPreferences?.push !== false);
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);

    const handleLanguageToggle = async () => {
        await setLanguage(nextLanguage);
    };

    const handlePushToggle = async (value: boolean) => {
        if (pushLoading) return;
        const previous = pushEnabled;
        setPushEnabled(value);
        setPushLoading(true);

        try {
            await api.updateProfile({
                notificationPreferences: {
                    email: profile?.notificationPreferences?.email !== false,
                    sms: profile?.notificationPreferences?.sms !== false,
                    push: value,
                    whatsapp: profile?.notificationPreferences?.whatsapp === true,
                },
            });

            setProfile((current: any) => ({
                ...(current || {}),
                notificationPreferences: {
                    ...(current?.notificationPreferences || {}),
                    push: value,
                },
            }));

            if (value) {
                await registerCustomerPushNotifications();
            } else {
                await unregisterCustomerPushNotifications();
            }
        } catch (error) {
            setPushEnabled(previous);
        } finally {
            setPushLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('settings')}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('appLanguage')}</Text>
                <View style={styles.simpleRow}>
                    <Text style={styles.currentValue}>
                        {language === 'ar' ? t('arabicLanguage') : t('englishLanguage')}
                    </Text>
                    <TouchableOpacity style={styles.actionButton} onPress={handleLanguageToggle}>
                        <Text style={styles.actionButtonText}>
                            {nextLanguage === 'ar' ? t('arabicLanguage') : t('englishLanguage')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('pushNotifications')}</Text>
                <Text style={styles.cardDescription}>{t('pushNotificationsDescription')}</Text>
                <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>
                        {pushEnabled ? t('yes') : t('no')}
                    </Text>
                    {pushLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <Switch
                            value={pushEnabled}
                            onValueChange={handlePushToggle}
                            trackColor={{ false: colors.borderStrong, true: colors.primaryLight }}
                            thumbColor={pushEnabled ? colors.primary : colors.textTertiary}
                        />
                    )}
                </View>
            </View>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backText: {
        fontSize: fontSize.xl,
        color: colors.text,
    },
    headerTitle: {
        fontSize: fontSize.xl,
        color: colors.text,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 24,
    },
    card: {
        backgroundColor: colors.surface,
        margin: spacing.lg,
        borderRadius: 20,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.sm,
    },
    cardTitle: {
        fontSize: fontSize.lg,
        color: colors.text,
        fontWeight: '700',
    },
    cardDescription: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    simpleRow: {
        marginTop: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    currentValue: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '600',
    },
    actionButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        marginTop: 0,
    },
    actionButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    hint: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    toggleRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleLabel: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '600',
    },
});
