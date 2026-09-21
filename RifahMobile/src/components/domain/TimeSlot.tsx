import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, spacing, typography, shadows } from '../../theme';

export interface TimeSlotProps {
    time: string;
    isAvailable?: boolean;
    isSelected?: boolean;
    onSelect: () => void;
    reason?: string;
    style?: ViewStyle;
}

export function TimeSlot({
    time,
    isAvailable = true,
    isSelected = false,
    onSelect,
    reason,
    style,
}: TimeSlotProps) {
    let backgroundColor = colors.surface;
    let borderColor = colors.borderSubtle;
    let textColor = colors.textPrimary;

    if (!isAvailable) {
        backgroundColor = colors.surfaceAlt;
        borderColor = colors.borderSubtle;
        textColor = colors.textTertiary;
    } else if (isSelected) {
        backgroundColor = colors.brandPrimary;
        borderColor = colors.brandPrimary;
        textColor = colors.textInverse;
    }

    return (
        <TouchableOpacity
            style={[
                styles.slot,
                { backgroundColor, borderColor },
                isSelected && shadows.md,
                style,
            ]}
            onPress={onSelect}
            disabled={!isAvailable}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: !isAvailable }}
            accessibilityLabel={`${time} ${!isAvailable ? '(Unavailable' + (reason ? ': ' + reason : '') + ')' : ''}`}
        >
            <ThemedText
                style={[
                    styles.timeText,
                    { color: textColor },
                    isSelected && styles.selectedTimeText,
                ]}
            >
                {time}
            </ThemedText>

            {reason && !isAvailable ? (
                <ThemedText style={styles.reasonText} numberOfLines={1}>
                    {reason}
                </ThemedText>
            ) : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    slot: {
        minWidth: 80,
        height: 44,
        paddingHorizontal: spacing.md,
        borderRadius: layout.radius.md,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
    },
    timeText: {
        ...typography.caption,
        fontWeight: '600',
    },
    selectedTimeText: {
        fontFamily: typography.fontFamilies.bold,
        fontWeight: '700',
    },
    reasonText: {
        fontSize: 9,
        lineHeight: 12,
        color: colors.error,
        marginTop: 1,
    },
});
