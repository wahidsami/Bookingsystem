import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LanguageSelection } from '../screens/LanguageSelection';
import { OnboardingScreens } from '../screens/OnboardingScreens';

type OnboardingStackParamList = {
  Language: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

interface OnboardingNavigatorProps {
  hasSavedLanguage: boolean;
  onLanguageSelected: (language: 'ar' | 'en') => Promise<void>;
  onOnboardingCompleted: () => Promise<void>;
}

export function OnboardingNavigator({
  hasSavedLanguage,
  onLanguageSelected,
  onOnboardingCompleted,
}: OnboardingNavigatorProps) {
  return (
    <Stack.Navigator
      initialRouteName={hasSavedLanguage ? 'Onboarding' : 'Language'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Language">
        {() => <LanguageSelection onLanguageSelect={onLanguageSelected} />}
      </Stack.Screen>
      <Stack.Screen name="Onboarding">
        {({ navigation }) => (
          <OnboardingScreens
            onComplete={onOnboardingCompleted}
            onBackToLanguage={() => navigation.navigate('Language')}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
