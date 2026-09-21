import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api, AppContentEntry, PublicAppContent } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';

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
    const { language, t, isRTL } = useLanguage();
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
            const raw = language === 'ar' ? entry.titleAr : entry.titleEn;
            if (raw && !raw.toLowerCase().includes('vanilla') && !raw.includes('فانيلا')) {
                return raw;
            }
        }

        if (pageType === 'privacy') return t('privacyTerms');
        if (pageType === 'support') return t('helpSupport');
        return t('aboutBarSpa');
    }, [entry, language, pageType, t]);

    const body = useMemo(() => {
        if (entry) {
            const raw = language === 'ar' ? entry.contentAr : entry.contentEn;
            if (raw && !raw.toLowerCase().includes('vanilla') && !raw.includes('فانيلا')) {
                return raw;
            }
        }

        if (pageType === 'privacy') return t('privacyTermsBody');
        if (pageType === 'support') return t('helpSupportBody');
        return t('aboutBarSpaBody');
    }, [entry, language, pageType, t]);

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={title}
                onBack={() => navigation.goBack()}
            />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#6537C0" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        { paddingBottom: scrollBottomPadding + 24 }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        <Text style={[styles.title, isRTL && styles.textRTL]}>{title}</Text>
                        <Text style={[styles.body, isRTL && styles.textRTL]}>{body}</Text>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textRTL: {
        textAlign: 'right',
    },
    content: {
        paddingTop: 16,
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 16,
    },
    body: {
        fontSize: 14,
        color: '#4B5563',
        fontFamily: 'Cairo-Regular',
        lineHeight: 26,
    },
});
