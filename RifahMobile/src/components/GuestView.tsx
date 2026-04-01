import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';

interface GuestViewProps {
    type: 'orders' | 'bookings';
    onLoginPress: () => void;
}

export function GuestView({ type, onLoginPress }: GuestViewProps) {
    const { t } = useLanguage();

    const icon = type === 'orders' ? '🛍️' : '📅';
    const message = type === 'orders' ? t('loginToOrderOrders') : t('loginToOrderBookings');

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.title}>{t('guestTitle')}</Text>
            <Text style={styles.message}>{message}</Text>

            <TouchableOpacity style={styles.loginButton} onPress={onLoginPress}>
                <Text style={styles.loginButtonText}>{t('loginNow')}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        backgroundColor: colors.background,
    },
    icon: {
        fontSize: 72,
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    message: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xxl,
        lineHeight: 24,
    },
    loginButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        width: '100%',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.md,
        fontWeight: '700',
    },
});
