import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './translations/en';
import ar from './translations/ar';
import hi from './translations/hi';
import ur from './translations/ur';
import ta from './translations/ta';
import te from './translations/te';
import tl from './translations/tl';
import th from './translations/th';

const resources = {
    en: { translation: en },
    ar: { translation: ar },
    hi: { translation: hi },
    ur: { translation: ur },
    ta: { translation: ta },
    te: { translation: te },
    tl: { translation: tl },
    th: { translation: th },
};

// Map device locales to our supported language codes
const getDeviceLanguage = () => {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
        const code = locales[0].languageCode;
        // Return supported code or fallback to 'en'
        if (code && resources[code as keyof typeof resources]) {
            return code;
        }
    }
    return 'en';
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getDeviceLanguage(), // Initial language based on device settings
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already safeguards from XSS
        },
        compatibilityJSON: 'v3' as any, // Required for React Native
    });

export default i18n;
