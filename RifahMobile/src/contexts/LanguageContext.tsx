import React, { createContext, useContext, useState, useEffect } from 'react';
import { I18nManager } from 'react-native';
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

    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        const savedLang = await getLanguage();
        if (savedLang) {
            setLanguageState(savedLang);

            // Set RTL for Arabic
            const isRTL = savedLang === 'ar';
            if (I18nManager.isRTL !== isRTL) {
                I18nManager.forceRTL(isRTL);
                // Note: App needs to restart for RTL to take effect
            }
        }
    };

    const setLanguage = async (lang: Language) => {
        await saveLanguage(lang);
        setLanguageState(lang);

        // Set RTL for Arabic
        const isRTL = lang === 'ar';
        if (I18nManager.isRTL !== isRTL) {
            I18nManager.forceRTL(isRTL);
            // App will need restart for RTL to fully work
        }
    };

    const t = (key: TranslationKey): string => {
        return translations[language][key] || key;
    };

    const isRTL = language === 'ar';

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
