import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager, NativeModules, Alert, Text, TextInput } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import i18n from '../i18n';

// Arabic and Urdu are RTL
const RTL_LANGUAGES = ['ar', 'ur'];

interface LanguageContextType {
    language: string;
    isRTL: boolean;
    setLanguage: (code: string) => Promise<void>;
    isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    isRTL: false,
    setLanguage: async () => { },
    isLoading: true,
});

// SecureStore keys must be alphanumeric, ".", "-", "_" only (no @)
const LANGUAGE_STORAGE_KEY = 'rifah_staff_app_language';

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [language, setLanguageState] = useState<string>(i18n.language || 'en');
    const [isRTL, setIsRTL] = useState<boolean>(I18nManager.isRTL);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load saved language on startup
        const loadSavedLanguage = async () => {
            try {
                const savedLanguage = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
                if (savedLanguage && savedLanguage !== i18n.language) {
                    await applyLanguage(savedLanguage, false); // Don't reload on initial boot
                } else {
                    // If no stored language, ensure RTL orientation matches device locale
                    checkRTL(i18n.language, false);
                }
            } catch (error) {
                console.error('Failed to load language', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSavedLanguage();
    }, []);

    const checkRTL = (langCode: string, shouldReload = true) => {
        const isLangRTL = RTL_LANGUAGES.includes(langCode);

        if (isLangRTL !== I18nManager.isRTL) {
            I18nManager.allowRTL(isLangRTL);
            I18nManager.forceRTL(isLangRTL);


            if (shouldReload) {
                // App must reload for RTL layout changes to take effect in React Native
                setTimeout(() => {
                    if (__DEV__ && NativeModules.DevSettings) {
                        NativeModules.DevSettings.reload();
                    } else {
                        Alert.alert(
                            'Restart Required',
                            'Please completely close and restart the app for the layout direction and fonts to be properly applied.'
                        );
                    }
                }, 100);
            }
        }

        // Apply global font override for Arabic/Urdu
        const fontFamily = isLangRTL ? 'Cairo_400Regular' : undefined;

        // @ts-ignore - overriding defaultProps is the standard approach for global text styles in React Native
        if (Text.defaultProps) {
            // @ts-ignore
            Text.defaultProps.style = [{ fontFamily }, Text.defaultProps.style];
        } else {
            // @ts-ignore
            Text.defaultProps = { style: { fontFamily } };
        }

        // @ts-ignore
        if (TextInput.defaultProps) {
            // @ts-ignore
            TextInput.defaultProps.style = [{ fontFamily }, TextInput.defaultProps.style];
        } else {
            // @ts-ignore
            TextInput.defaultProps = { style: { fontFamily } };
        }

        setIsRTL(isLangRTL);
    };

    const applyLanguage = async (code: string, shouldReload = true) => {
        try {
            await i18n.changeLanguage(code);
            setLanguageState(code);
            await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, code);
            checkRTL(code, shouldReload);
        } catch (error) {
            console.error('Error changing language:', error);
        }
    };

    const setLanguage = async (code: string) => {
        await applyLanguage(code, true);
    };

    return (
        <LanguageContext.Provider value={{ language, isRTL, setLanguage, isLoading }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
