import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

export default function ChangePasswordScreen() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const { user, updateUser } = useAuth();
    const { t } = useTranslation();

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 8) {
            Alert.alert(t('common.error'), t('auth.errorPasswordLength'));
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert(t('common.error'), t('auth.errorPasswordMatch'));
            return;
        }

        setLoading(true);
        try {
            const response = await api.patch('/staff/me/password', {
                currentPassword,
                newPassword
            });

            if (response.data.success) {
                Alert.alert(t('common.success'), t('auth.successChangePassword'), [
                    {
                        text: t('common.ok'),
                        onPress: () => {
                            // Update local user state
                            updateUser({ must_change_password: false });
                            // Root _layout logic will redirect to (tabs) automatically when must_change_password changes
                            router.replace('/(tabs)');
                        }
                    }
                ]);
            }
        } catch (error: any) {
            console.error('Change password error:', error.response?.data || error.message);
            Alert.alert(
                t('auth.errorLogin'),
                error.response?.data?.message || t('auth.errorChangePasswordMsg')
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <LinearGradient
                colors={['#8B5ADF', '#683AB7']}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>{t('auth.changePasswordTitle')}</Text>
                <Text style={styles.headerSubtitle}>{t('auth.changePasswordSubtitle')}</Text>
            </LinearGradient>

            <View style={styles.formContainer}>
                {user?.must_change_password && (
                    <View style={styles.alertBox}>
                        <Text style={styles.alertText}>
                            {t('auth.firstLoginMessage')}
                        </Text>
                    </View>
                )}

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('auth.currentPassword')}</Text>
                    <TextInput
                        style={styles.input}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        placeholder={t('auth.currentPasswordPlaceholder')}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('auth.newPassword')}</Text>
                    <TextInput
                        style={styles.input}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        placeholder={t('auth.newPasswordPlaceholder')}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleChangePassword}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>{t('auth.changePasswordBtn')}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    formContainer: {
        flex: 1,
        paddingHorizontal: 24,
        marginTop: -40,
        backgroundColor: '#ffffff',
        marginHorizontal: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        paddingVertical: 30,
    },
    alertBox: {
        backgroundColor: '#fef2f2',
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
        padding: 12,
        marginBottom: 20,
        borderRadius: 4,
    },
    alertText: {
        color: '#991b1b',
        fontSize: 13,
        lineHeight: 18,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        color: '#1f2937',
    },
    submitButton: {
        backgroundColor: '#8B5ADF',
        borderRadius: 10,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#8B5ADF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    submitButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
