import React, { createContext, useContext, useState, useEffect } from 'react';
import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import { getLanguage, saveLanguage } from '../utils/language';
import { translations, Language, TranslationKey } from '../i18n/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: TranslationKey) => string;
    isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('en');
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        const savedLang = await getLanguage();
        if (savedLang) {
            setLanguageState(savedLang);
        }
        setHydrated(true);
    };

    const setLanguage = async (lang: Language) => {
        const nextRTL = lang === 'ar';
        const currentRTL = I18nManager.isRTL;
        await saveLanguage(lang);
        setLanguageState(lang);

        // Ensure full layout direction parity across all screens/components.
        // A reload is required when direction changes so native/layout caches are rebuilt.
        if (currentRTL !== nextRTL) {
            I18nManager.allowRTL(true);
            I18nManager.forceRTL(nextRTL);
            try {
                await Updates.reloadAsync();
            } catch {
                // Fallback path: state already updated; direction-sensitive styles still use isRTL.
            }
        }
    };

    const t = (key: TranslationKey): string => {
        return translations[language][key] || key;
    };

    const isRTL = language === 'ar';

    useEffect(() => {
        if (!hydrated) return;
        I18nManager.allowRTL(true);
    }, [hydrated]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}
