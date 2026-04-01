import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';

interface SectionHeaderProps {
    title: string;
    onSeeAll?: () => void;
}

export function SectionHeader({ title, onSeeAll }: SectionHeaderProps) {
    const { t } = useLanguage();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            {onSeeAll && (
                <TouchableOpacity onPress={onSeeAll}>
                    <Text style={styles.seeAll}>{t('seeAll')} ›</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    seeAll: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.primary,
    },
});
