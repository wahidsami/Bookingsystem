import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = 'refah_onboarding_completed';

export const markOnboardingComplete = async (): Promise<void> => {
    try {
        await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (error) {
        console.error('Error marking onboarding complete:', error);
    }
};

export const hasCompletedOnboarding = async (): Promise<boolean> => {
    try {
        const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        return completed === 'true';
    } catch (error) {
        console.error('Error checking onboarding status:', error);
        return false;
    }
};
