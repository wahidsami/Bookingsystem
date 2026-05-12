import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';

interface SettingsScreenProps {
    navigation: any;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
    const { t, language, setLanguage } = useLanguage();
    const { topInset } = useScreenSafeArea();

    const nextLanguage = language === 'ar' ? 'en' : 'ar';

    const handleLanguageToggle = async () => {
        await setLanguage(nextLanguage);
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('settings')}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('appLanguage')}</Text>
                <Text style={styles.cardDescription}>{t('tapToSwitchLanguage')}</Text>
                <TouchableOpacity style={styles.actionButton} onPress={handleLanguageToggle}>
                    <Text style={styles.actionButtonText}>
                        {nextLanguage === 'ar' ? t('arabicLanguage') : t('englishLanguage')}
                    </Text>
                </TouchableOpacity>
                <Text style={styles.hint}>{t('languageRestartHint')}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backText: {
        fontSize: fontSize.xl,
        color: colors.text,
    },
    headerTitle: {
        fontSize: fontSize.xl,
        color: colors.text,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 24,
    },
    card: {
        backgroundColor: '#FFFFFF',
        margin: spacing.lg,
        borderRadius: 20,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.sm,
    },
    cardTitle: {
        fontSize: fontSize.lg,
        color: colors.text,
        fontWeight: '700',
    },
    cardDescription: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    actionButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    hint: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
});
