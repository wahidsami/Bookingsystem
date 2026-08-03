import React from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { api } from '../api/client';
import { registerCustomerPushNotifications, unregisterCustomerPushNotifications } from '../lib/notifications';
import { useAppSession } from '../contexts/AppSessionContext';

interface SettingsScreenProps {
    navigation: any;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
    const { t, language, setLanguage } = useLanguage();
    const { logout } = useAppSession();
    const { topInset } = useScreenSafeArea();
    const [profile, setProfile] = React.useState<any>(null);
    const [pushEnabled, setPushEnabled] = React.useState(true);
    const [pushLoading, setPushLoading] = React.useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
    const [deletePassword, setDeletePassword] = React.useState('');
    const [deleteLoading, setDeleteLoading] = React.useState(false);

    const nextLanguage = language === 'ar' ? 'en' : 'ar';
    const requiresPassword = profile?.authProvider === 'local';

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

    const confirmDeleteAccount = () => {
        Alert.alert(
            t('deleteAccountConfirmTitle'),
            t('deleteAccountConfirmBody'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('deleteAccount'),
                    style: 'destructive',
                    onPress: () => {
                        setDeletePassword('');
                        setDeleteModalVisible(true);
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = async () => {
        if (deleteLoading) return;
        if (requiresPassword && !deletePassword.trim()) {
            Alert.alert(t('error'), t('deleteAccountPasswordHint'));
            return;
        }

        setDeleteLoading(true);
        try {
            await api.deleteAccount(requiresPassword ? deletePassword.trim() : undefined);
            setDeleteModalVisible(false);
            setDeletePassword('');
            Alert.alert(t('success'), t('deleteAccountSuccess'));
            await logout();
        } catch (error: any) {
            Alert.alert(t('error'), error?.message || t('deleteAccountFailed'));
        } finally {
            setDeleteLoading(false);
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

            <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('deleteAccount')}</Text>
                <Text style={styles.cardDescription}>{t('deleteAccountSubtitle')}</Text>
                <TouchableOpacity style={[styles.deleteButton, deleteLoading && styles.actionButtonDisabled]} onPress={confirmDeleteAccount} disabled={deleteLoading}>
                    <Text style={styles.deleteButtonText}>{t('deleteAccount')}</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={deleteModalVisible} animationType="slide" transparent onRequestClose={() => setDeleteModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{t('deleteAccountConfirmTitle')}</Text>
                        <Text style={styles.modalBody}>{t('deleteAccountConfirmBody')}</Text>
                        {requiresPassword ? (
                            <>
                                <Text style={styles.modalLabel}>{t('deleteAccountPasswordLabel')}</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={deletePassword}
                                    onChangeText={setDeletePassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    placeholder={t('deleteAccountPasswordHint')}
                                    placeholderTextColor={colors.textSecondary}
                                />
                            </>
                        ) : (
                            <Text style={styles.modalHint}>{t('deleteAccountGoogleHint')}</Text>
                        )}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setDeleteModalVisible(false)}
                                disabled={deleteLoading}
                            >
                                <Text style={styles.modalCancelButtonText}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalDeleteButton, deleteLoading && styles.actionButtonDisabled]}
                                onPress={handleDeleteAccount}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? (
                                    <ActivityIndicator color={colors.textInverse} />
                                ) : (
                                    <Text style={styles.modalDeleteButtonText}>{t('deleteAccount')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F4FF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 0,
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
        backgroundColor: '#FFFFFF',
        margin: spacing.lg,
        borderRadius: 20,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        gap: spacing.sm,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 1,
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
        backgroundColor: '#7C3AED',
        borderRadius: 14,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        marginTop: 0,
    },
    actionButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    deleteButton: {
        backgroundColor: '#FEF2F2',
        borderRadius: 14,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        marginTop: spacing.xs,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    deleteButtonText: {
        color: '#DC2626',
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(17, 24, 39, 0.55)',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: spacing.lg,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: '#E9DDFD',
    },
    modalTitle: {
        fontSize: fontSize.xl,
        color: colors.text,
        fontWeight: '700',
    },
    modalBody: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    modalLabel: {
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 14,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: fontSize.md,
        backgroundColor: '#FAFAFF',
        color: colors.text,
    },
    modalHint: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    modalActions: {
        marginTop: spacing.md,
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'flex-end',
    },
    modalButton: {
        borderRadius: 14,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        minWidth: 110,
        alignItems: 'center',
    },
    modalCancelButton: {
        backgroundColor: '#F3F4F6',
    },
    modalCancelButtonText: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    modalDeleteButton: {
        backgroundColor: '#DC2626',
    },
    modalDeleteButtonText: {
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
