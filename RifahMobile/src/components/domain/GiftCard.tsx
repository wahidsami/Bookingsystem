import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';
import { AppButton } from '../ui/AppButton';
import { AppIcon } from '../AppIcon';

export interface GiftCardProps {
    id: string;
    title: string;
    price: number | string;
    walletCredit?: number | string;
    imageUrl?: string;
    onSelect: () => void;
    onPress?: () => void;
    style?: ViewStyle;
    currency?: string;
}

export function GiftCard({
    title,
    price,
    walletCredit,
    imageUrl,
    onSelect,
    onPress,
    style,
    currency = 'SAR',
}: GiftCardProps) {
    return (
        <TouchableOpacity
            style={[styles.card, style]}
            onPress={onPress || onSelect}
            activeOpacity={0.85}
        >
            <View style={styles.leftCol}>
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                    <View style={styles.placeholderThumb}>
                        <AppIcon name="gift" size={24} color={colors.brandPrimary} />
                    </View>
                )}

                <View style={styles.info}>
                    <ThemedText style={styles.title} numberOfLines={1}>
                        {title}
                    </ThemedText>

                    <ThemedText style={styles.price}>
                        {price} <ThemedText style={styles.currency}>{currency}</ThemedText>
                    </ThemedText>

                    {walletCredit && Number(walletCredit) > Number(price) ? (
                        <ThemedText style={styles.bonusText}>
                            Get {walletCredit} {currency} credit
                        </ThemedText>
                    ) : null}
                </View>
            </View>

            <AppButton
                variant="primary"
                label="Select"
                onPress={onSelect}
                style={styles.selectButton}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: layout.radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    leftCol: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.md,
    },
    thumbnail: {
        width: 64,
        height: 64,
        borderRadius: layout.radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    placeholderThumb: {
        width: 64,
        height: 64,
        borderRadius: layout.radius.md,
        backgroundColor: colors.surfaceLavender,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    info: {
        marginLeft: spacing.md,
        flex: 1,
    },
    title: {
        ...typography.cardTitle,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    price: {
        ...typography.price,
        color: colors.brandPrimary,
    },
    currency: {
        ...typography.currency,
        color: colors.textSecondary,
    },
    bonusText: {
        ...typography.caption,
        color: colors.success,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    selectButton: {
        height: 34,
        paddingHorizontal: spacing.base,
    },
});
