import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { t } = useTranslation();

    useLocalSearchParams<{ token: string; email: string }>();

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
                    onPress={() => router.replace('/(auth)/login')}
                >
                    <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('auth.resetPasswordTitle')}</Text>
            </LinearGradient>

            <View style={styles.formContainer}>
                <View style={styles.centeredState}>
                    <Ionicons name="information-circle-outline" size={64} color="#8B5ADF" />
                    <Text style={styles.stateTitle}>{t('auth.contactManagerTitle')}</Text>
                    <Text style={styles.descriptionText}>{t('auth.staffResetHelpDesc')}</Text>
                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={() => router.replace('/(auth)/forgot-password')}
                    >
                        <Text style={styles.submitButtonText}>{t('auth.returnToResetHelp')}</Text>
                    </TouchableOpacity>
                </View>
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
    centeredState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingVertical: 20,
    },
    stateTitle: {
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 10,
    },
    descriptionText: {
        fontSize: 15,
        color: '#4b5563',
        lineHeight: 22,
        marginBottom: 24,
        textAlign: 'center',
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
