import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import { SplashScreen } from './src/screens/SplashScreen';
import { LanguageSelection } from './src/screens/LanguageSelection';
import { OnboardingScreens } from './src/screens/OnboardingScreens';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { LanguageProvider, useLanguage } from './src/contexts/LanguageContext';
import { CartProvider } from './src/contexts/CartContext';
import { getLanguage } from './src/utils/language';
import { hasCompletedOnboarding, markOnboardingComplete } from './src/utils/onboarding';
import { colors } from './src/theme/colors';
import { RootNavigator } from './src/navigation/RootNavigator';
import { NavigationContainer } from '@react-navigation/native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { api } from './src/api/client';

type AppScreen = 'splash' | 'language' | 'onboarding' | 'welcome' | 'login' | 'register' | 'home';

// Load Cairo fonts
const loadFonts = async () => {
  await Font.loadAsync({
    'Cairo-Regular': require('./assets/fonts/Cairo-Regular.ttf'),
    'Cairo-Light': require('./assets/fonts/Cairo-Light.ttf'),
    'Cairo-Medium': require('./assets/fonts/Cairo-Medium.ttf'),
    'Cairo-SemiBold': require('./assets/fonts/Cairo-SemiBold.ttf'),
    'Cairo-Bold': require('./assets/fonts/Cairo-Bold.ttf'),
  });

  // Set Cairo as default font for Text component
  const DefaultText = Text as any;
  if (DefaultText.defaultProps == null) DefaultText.defaultProps = {};
  DefaultText.defaultProps.style = { fontFamily: 'Cairo-Regular' };
};

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const { setLanguage } = useLanguage();

  useEffect(() => {
    const init = async () => {
      await loadFontsAndLanguage();
    };
    init();
  }, []);

  const loadFontsAndLanguage = async () => {
    await loadFonts();
    setFontsLoaded(true);
    await checkAppState();
  };

  const checkAppState = async () => {
    const savedLanguage = await getLanguage();
    if (savedLanguage) {
      await setLanguage(savedLanguage);
    }
  };

  const handleSplashFinish = async () => {
    const savedLanguage = await getLanguage();
    const onboardingCompleted = await hasCompletedOnboarding();

    if (!savedLanguage) {
      setCurrentScreen('language');
    } else if (!onboardingCompleted) {
      setCurrentScreen('onboarding');
    } else {
      const authenticated = await api.isAuthenticated();
      setCurrentScreen(authenticated ? 'home' : 'welcome');
    }
  };

  const handleLanguageSelect = async (language: 'ar' | 'en') => {
    await setLanguage(language); // Use context's setLanguage instead
    setCurrentScreen('onboarding');
  };

  const handleOnboardingComplete = async () => {
    await markOnboardingComplete();
    setCurrentScreen('welcome');
  };

  const handleLoginSuccess = () => {
    setCurrentScreen('home');
  };

  const handleRegisterSuccess = () => {
    setCurrentScreen('home');
  };

  // Show nothing while fonts are loading
  if (!fontsLoaded) {
    return null;
  }

  if (currentScreen === 'splash') {
    return <><SplashScreen onFinish={handleSplashFinish} /><StatusBar style="light" /></>;
  }

  if (currentScreen === 'language') {
    return <><LanguageSelection onLanguageSelect={handleLanguageSelect} /><StatusBar style="dark" /></>;
  }

  if (currentScreen === 'onboarding') {
    return (
      <>
        <OnboardingScreens
          onComplete={handleOnboardingComplete}
          onBackToLanguage={() => setCurrentScreen('language')}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (currentScreen === 'welcome') {
    return (
      <>
        <WelcomeScreen
          onLogin={() => setCurrentScreen('login')}
          onRegister={() => setCurrentScreen('register')}
          onGuest={() => setCurrentScreen('home')}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (currentScreen === 'login') {
    return (
      <>
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onBackToWelcome={() => setCurrentScreen('welcome')}
          onGoToRegister={() => setCurrentScreen('register')}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (currentScreen === 'register') {
    return (
      <>
        <RegisterScreen
          onRegisterSuccess={handleRegisterSuccess}
          onBackToWelcome={() => setCurrentScreen('welcome')}
          onGoToLogin={() => setCurrentScreen('login')}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (currentScreen === 'home') {
    return (
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );
  }

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <LanguageProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
});
