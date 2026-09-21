import React from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { api } from '../api/client';
import { registerCustomerPushNotifications, unregisterCustomerPushNotifications } from '../lib/notifications';
import { useAppSession } from '../contexts/AppSessionContext';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { AppIcon } from '../components/AppIcon';

interface SettingsScreenProps {
    navigation: any;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
    const { t, language, setLanguage, isRTL } = useLanguage();
    const { logout } = useAppSession();
    const { scrollBottomPadding } = useScreenSafeArea();
    const [profile, setProfile] = React.useState<any>(null);
    const [pushEnabled, setPushEnabled] = React.useState(true);
    const [pushLoading, setPushLoading] = React.useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
    const [deletePassword, setDeletePassword] = React.useState('');
    const [deleteLoading, setDeleteLoading] = React.useState(false);

    const requiresPassword = profile?.authProvider === 'local';

    React.useEffect(() => {
        let active = true;
        api.getProfile()
            .then((prof) => {
                if (!active) return;
                setProfile(prof);
                setPushEnabled(prof.notificationPreferences?.push !== false);
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);

    const handleSelectLanguage = async (newLang: 'ar' | 'en') => {
        if (newLang === language) return;
        await setLanguage(newLang);
    };

    const handlePushToggle = async (value: boolean) => {
        if (pushLoading) return;
        const previous = pushEnabled;
        setPushEnabled(value);
        setPushLoading(true);

        try {
            await api.put('/users/profile', {
                notificationPreferences: {
                    push: value,
                },
            });
            if (value) {
                await registerCustomerPushNotifications();
            } else {
                await unregisterCustomerPushNotifications();
            }
        } catch (error: any) {
            setPushEnabled(previous);
            Alert.alert(t('error'), error?.message || (isRTL ? 'فشل تحديث الإعدادات' : 'Failed to update settings'));
        } finally {
            setPushLoading(false);
        }
    };

    const confirmDeleteAccount = () => {
        setDeletePassword('');
        setDeleteModalVisible(true);
    };

    const handleDeleteAccount = async () => {
        if (requiresPassword && !deletePassword.trim()) {
            Alert.alert(t('error'), isRTL ? 'يرجى إدخال كلمة المرور لتأكيد حذف الحساب' : 'Password is required to delete account');
            return;
        }

        try {
            setDeleteLoading(true);
            await api.deleteAccount(requiresPassword ? deletePassword : undefined);
            setDeleteModalVisible(false);
            await logout();
            Alert.alert(t('success'), t('deleteAccountSuccess'));
        } catch (error: any) {
            Alert.alert(t('error'), error?.message || t('deleteAccountFailed'));
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={t('settings')}
                onBack={() => navigation.goBack()}
            />

            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: scrollBottomPadding + 24 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Language Section */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'لغة التطبيق' : 'App Language'}
                    </Text>
                </View>

                <View style={styles.groupCard}>
                    <View style={[styles.languageHeaderRow, isRTL && styles.rowRTL]}>
                        <View style={styles.iconCircle}>
                            <AppIcon name="globe" size={18} color="#6537C0" />
                        </View>
                        <View style={[styles.itemTextContainer, isRTL && styles.alignRTL]}>
                            <Text style={[styles.itemTitle, isRTL && styles.textRTL]}>
                                {t('appLanguage')}
                            </Text>
                            <Text style={[styles.itemSubtitle, isRTL && styles.textRTL]}>
                                {isRTL ? 'اختر لغة واجهة التطبيق المفضلة' : 'Choose your preferred app language'}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.langPillsRow, isRTL && styles.rowRTL]}>
                        <TouchableOpacity
                            style={[
                                styles.langPill,
                                language === 'ar' && styles.langPillActive,
                            ]}
                            onPress={() => handleSelectLanguage('ar')}
                            activeOpacity={0.8}
                        >
                            <Text
                                style={[
                                    styles.langPillText,
                                    language === 'ar' && styles.langPillTextActive,
                                ]}
                            >
                                العربية (Arabic)
                            </Text>
                            {language === 'ar' && (
                                <AppIcon name="check" size={16} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.langPill,
                                language === 'en' && styles.langPillActive,
                            ]}
                            onPress={() => handleSelectLanguage('en')}
                            activeOpacity={0.8}
                        >
                            <Text
                                style={[
                                    styles.langPillText,
                                    language === 'en' && styles.langPillTextActive,
                                ]}
                            >
                                English
                            </Text>
                            {language === 'en' && (
                                <AppIcon name="check" size={16} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 2. Notifications Section */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'التنبيهات' : 'Notifications'}
                    </Text>
                </View>

                <View style={styles.groupCard}>
                    <View style={[styles.toggleRow, isRTL && styles.rowRTL]}>
                        <View style={styles.iconCircle}>
                            <AppIcon name="bell" size={18} color="#6537C0" />
                        </View>
                        <View style={[styles.itemTextContainer, isRTL && styles.alignRTL]}>
                            <Text style={[styles.itemTitle, isRTL && styles.textRTL]}>
                                {t('pushNotifications')}
                            </Text>
                            <Text style={[styles.itemSubtitle, isRTL && styles.textRTL]}>
                                {t('pushNotificationsDescription')}
                            </Text>
                        </View>

                        {pushLoading ? (
                            <ActivityIndicator size="small" color="#6537C0" />
                        ) : (
                            <Switch
                                value={pushEnabled}
                                onValueChange={handlePushToggle}
                                trackColor={{ false: '#E5E7EB', true: '#C4B5FD' }}
                                thumbColor={pushEnabled ? '#6537C0' : '#9CA3AF'}
                            />
                        )}
                    </View>
                </View>

                {/* 3. Account Deletion Section */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitleDanger, isRTL && styles.textRTL]}>
                        {isRTL ? 'إدارة الحساب' : 'Account Management'}
                    </Text>
                </View>

                <View style={styles.dangerCard}>
                    <View style={[styles.dangerHeaderRow, isRTL && styles.rowRTL]}>
                        <View style={styles.dangerIconCircle}>
                            <AppIcon name="delete" size={18} color="#DC2626" />
                        </View>
                        <View style={[styles.itemTextContainer, isRTL && styles.alignRTL]}>
                            <Text style={[styles.dangerTitle, isRTL && styles.textRTL]}>
                                {t('deleteAccount')}
                            </Text>
                            <Text style={[styles.dangerSubtitle, isRTL && styles.textRTL]}>
                                {t('deleteAccountSubtitle')}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.deleteButton, deleteLoading && styles.actionButtonDisabled, isRTL && styles.rowRTL]}
                        onPress={confirmDeleteAccount}
                        disabled={deleteLoading}
                        activeOpacity={0.85}
                    >
                        <AppIcon name="delete" size={16} color="#DC2626" />
                        <Text style={styles.deleteButtonText}>{t('deleteAccount')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Delete Account Modal */}
            <Modal
                visible={deleteModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={[styles.modalHeader, isRTL && styles.rowRTL]}>
                            <View style={styles.dangerIconCircle}>
                                <AppIcon name="warning" size={24} color="#DC2626" />
                            </View>
                            <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
                                {t('deleteAccountConfirmTitle')}
                            </Text>
                        </View>

                        <Text style={[styles.modalBody, isRTL && styles.textRTL]}>
                            {t('deleteAccountConfirmBody')}
                        </Text>

                        {requiresPassword ? (
                            <View style={styles.modalInputWrap}>
                                <Text style={[styles.modalLabel, isRTL && styles.textRTL]}>
                                    {t('deleteAccountPasswordLabel')}
                                </Text>
                                <TextInput
                                    style={[styles.modalInput, isRTL && styles.textRTL]}
                                    value={deletePassword}
                                    onChangeText={setDeletePassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    placeholder={t('deleteAccountPasswordHint')}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        ) : (
                            <Text style={[styles.modalHint, isRTL && styles.textRTL]}>
                                {t('deleteAccountGoogleHint')}
                            </Text>
                        )}

                        <View style={[styles.modalActions, isRTL && styles.rowRTL]}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setDeleteModalVisible(false)}
                                disabled={deleteLoading}
                            >
                                <Text style={styles.modalCancelButtonText}>{t('cancel')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalDeleteButton,
                                    deleteLoading && styles.actionButtonDisabled,
                                ]}
                                onPress={handleDeleteAccount}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
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
        backgroundColor: '#FAF9FC',
    },
    content: {
        paddingTop: 16,
        paddingHorizontal: 16,
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
    sectionHeaderRow: {
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7C3AED',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontFamily: 'Cairo-Bold',
    },
    sectionTitleDanger: {
        fontSize: 13,
        fontWeight: '700',
        color: '#DC2626',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontFamily: 'Cairo-Bold',
    },
    groupCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 16,
        marginBottom: 20,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    languageHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    iconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemTextContainer: {
        flex: 1,
        marginHorizontal: 12,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        marginTop: 2,
    },
    langPillsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    langPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#FAF8FE',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    langPillActive: {
        backgroundColor: '#6537C0',
        borderColor: '#6537C0',
    },
    langPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
        fontFamily: 'Cairo-Bold',
    },
    langPillTextActive: {
        color: '#FFFFFF',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dangerCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#FECACA',
        padding: 16,
        marginBottom: 24,
    },
    dangerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    dangerIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dangerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#DC2626',
        fontFamily: 'Cairo-Bold',
    },
    dangerSubtitle: {
        fontSize: 12,
        color: '#991B1B',
        fontFamily: 'Cairo-Regular',
        marginTop: 2,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 14,
        paddingVertical: 12,
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#DC2626',
        fontFamily: 'Cairo-Bold',
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 24,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        textAlign: 'center',
    },
    modalBody: {
        fontSize: 13,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 16,
    },
    modalInputWrap: {
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 6,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#E7DDFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: '#1D035F',
        backgroundColor: '#FAF8FE',
        fontFamily: 'Cairo-Regular',
    },
    modalHint: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: 'Cairo-Regular',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelButton: {
        backgroundColor: '#F3F4F6',
    },
    modalCancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
        fontFamily: 'Cairo-Bold',
    },
    modalDeleteButton: {
        backgroundColor: '#DC2626',
    },
    modalDeleteButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
    },
});
