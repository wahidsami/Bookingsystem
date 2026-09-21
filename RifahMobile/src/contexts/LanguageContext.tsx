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
        await saveLanguage(lang);
        setLanguageState(lang);
    };

    const t = (key: TranslationKey): string => {
        return translations[language][key] || key;
    };

    const isRTL = language === 'ar';

    useEffect(() => {
        if (!hydrated) return;
        // Keep native coordinate system uniform so explicit JS mirroring is 100% predictable
        try {
            if (I18nManager.isRTL) {
                I18nManager.allowRTL(false);
                I18nManager.forceRTL(false);
            }
        } catch {
            // Ignore if native manager is not accessible
        }
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
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
