import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api, AppContentEntry, PublicAppContent } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { colors, fontSize, spacing } from '../theme/colors';
import { useScreenSafeArea } from '../utils/safeArea';

interface InfoPageScreenProps {
    navigation: any;
    route: {
        params?: {
            pageType?: 'about' | 'privacy' | 'support';
        };
    };
}

const FALLBACK_KEYS = {
    about: 'about_refah',
    privacy: 'privacy_terms',
    support: 'help_support',
} as const;

export function InfoPageScreen({ navigation, route }: InfoPageScreenProps) {
    const { language, t } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [content, setContent] = useState<PublicAppContent | null>(null);
    const [loading, setLoading] = useState(true);

    const pageType = route?.params?.pageType || 'about';

    useEffect(() => {
        api.getCustomerAppContent()
            .then(setContent)
            .catch(() => setContent(null))
            .finally(() => setLoading(false));
    }, []);

    const entry = useMemo<AppContentEntry | null>(() => {
        const key = FALLBACK_KEYS[pageType];
        if (pageType === 'support') {
            return content?.support?.[key] || null;
        }
        return content?.legal?.[key] || null;
    }, [content, pageType]);

    const title = useMemo(() => {
        if (entry) {
            return language === 'ar' ? entry.titleAr : entry.titleEn;
        }

        if (pageType === 'privacy') return t('privacyTerms');
        if (pageType === 'support') return t('helpSupport');
        return t('aboutRefah');
    }, [entry, language, pageType, t]);

    const body = useMemo(() => {
        if (entry) {
            return language === 'ar' ? entry.contentAr : entry.contentEn;
        }

        if (pageType === 'privacy') return t('privacyTermsBody');
        if (pageType === 'support') return t('helpSupportBody');
        return t('aboutRefahBody');
    }, [entry, language, pageType, t]);

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={styles.headerSpacer} />
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}>
                    <View style={styles.card}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.body}>{body}</Text>
                    </View>
                </ScrollView>
            )}
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
        flex: 1,
        textAlign: 'center',
        fontSize: fontSize.lg,
        color: colors.text,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 24,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: spacing.lg,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    body: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 28,
    },
});
