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
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: 30,
        fontWeight: '800',
        color: '#15163E',
    },
    seeAll: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.primary,
    },
});
