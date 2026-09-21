import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';
import { AppButton } from '../ui/AppButton';
import { AppIcon } from '../AppIcon';

export interface WalletCardProps {
    balance: number | string;
    currency?: string;
    onTopUp?: () => void;
    onViewHistory?: () => void;
    style?: ViewStyle;
}

export function WalletCard({
    balance,
    currency = 'SAR',
    onTopUp,
    onViewHistory,
    style,
}: WalletCardProps) {
    return (
        <LinearGradient
            colors={['#1D035F', '#4A1D96']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, style]}
        >
            <View style={styles.topRow}>
                <View style={styles.badgeRow}>
                    <AppIcon name="wallet" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.badgeText}>BarSpa Wallet</ThemedText>
                </View>
                {onViewHistory ? (
                    <TouchableOpacity onPress={onViewHistory} activeOpacity={0.8}>
                        <ThemedText style={styles.historyLink}>History</ThemedText>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.balanceContainer}>
                <ThemedText style={styles.balanceLabel}>Available Balance</ThemedText>
                <ThemedText style={styles.balanceValue}>
                    {balance} <ThemedText style={styles.currency}>{currency}</ThemedText>
                </ThemedText>
            </View>

            {onTopUp ? (
                <View style={styles.actionRow}>
                    <AppButton
                        variant="secondary"
                        label="+ Add Funds"
                        onPress={onTopUp}
                        style={styles.topUpButton}
                    />
                </View>
            ) : null}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: layout.radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        ...shadows.md,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    badgeText: {
        ...typography.captionStrong,
        color: colors.textInverse,
        opacity: 0.9,
    },
    historyLink: {
        ...typography.caption,
        color: colors.brandPrimaryLight,
        fontWeight: '600',
    },
    balanceContainer: {
        marginBottom: spacing.md,
    },
    balanceLabel: {
        ...typography.caption,
        color: colors.textInverse,
        opacity: 0.75,
        marginBottom: 2,
    },
    balanceValue: {
        ...typography.display,
        color: colors.textInverse,
        fontWeight: '700',
    },
    currency: {
        ...typography.sectionTitle,
        color: colors.brandPrimaryLight,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.15)',
        paddingTop: spacing.md,
    },
    topUpButton: {
        height: 36,
        paddingHorizontal: spacing.lg,
    },
});
