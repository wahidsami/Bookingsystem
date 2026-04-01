import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = 'refah_language';

export const saveLanguage = async (language: 'ar' | 'en'): Promise<void> => {
    try {
        await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
        console.error('Error saving language:', error);
    }
};

export const getLanguage = async (): Promise<'ar' | 'en' | null> => {
    try {
        return await AsyncStorage.getItem(LANGUAGE_KEY) as 'ar' | 'en' | null;
    } catch (error) {
        console.error('Error getting language:', error);
        return null;
    }
};
