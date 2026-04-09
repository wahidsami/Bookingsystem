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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const router = useRouter();
    const { t } = useTranslation();

    const handleReset = async () => {
        if (!email) {
            Alert.alert(t('common.error'), t('auth.errorEmailEmpty'));
            return;
        }

        setLoading(true);
        try {
            // Staff self-service reset is not exposed publicly; tenant admins trigger resets.
            setSent(true);
        } catch {
            setSent(true);
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
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('auth.forgotPasswordTitle')}</Text>
            </LinearGradient>

            <View style={styles.formContainer}>
                {sent ? (
                    <View style={styles.successContainer}>
                        <Ionicons name="checkmark-circle" size={64} color="#10b981" />
                        <Text style={styles.successTitle}>{t('auth.contactManagerTitle')}</Text>
                        <Text style={styles.successText}>
                            {t('auth.staffResetHelpDesc')}
                        </Text>
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={() => router.replace('/(auth)/login')}
                        >
                            <Text style={styles.submitButtonText}>{t('auth.returnToLogin')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <Text style={styles.descriptionText}>
                            {t('auth.staffResetHelpDesc')}
                        </Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>{t('auth.email')}</Text>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholder={t('auth.emailPlaceholder')}
                                placeholderTextColor="#9ca3af"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleReset}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>{t('auth.notifyManagerBtn')}</Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}
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
        paddingTop: 40,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
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
    descriptionText: {
        fontSize: 15,
        color: '#4b5563',
        lineHeight: 22,
        marginBottom: 24,
        textAlign: 'center',
    },
    successContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1f2937',
        marginTop: 16,
        marginBottom: 8,
    },
    successText: {
        fontSize: 15,
        color: '#4b5563',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    inputContainer: {
        marginBottom: 24,
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
        shadowColor: '#8B5ADF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
        width: '100%',
    },
    submitButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
