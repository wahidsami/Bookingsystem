const fs = require('fs');

const content = `import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api, AppContentEntry, PublicAppContent } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { PageHeader } from '../components/ui/PageHeader';
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
    const { scrollBottomPadding } = useScreenSafeArea();
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
            <PageHeader
                title={title}
                showBack
                onBack={() => navigation.goBack()}
                variant="standard"
            />

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
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: spacing.lg,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.xl,
        gap: spacing.md,
        shadowColor: colors.brandPrimary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    body: {
        fontSize: 15,
        color: colors.textSecondary,
        lineHeight: 26,
    },
});
`;
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/InfoPageScreen.tsx', content);
