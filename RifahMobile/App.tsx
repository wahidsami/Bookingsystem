import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus, Linking, StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import { SplashScreen } from './src/screens/SplashScreen';
import { LanguageSelection } from './src/screens/LanguageSelection';
import { OnboardingScreens } from './src/screens/OnboardingScreens';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { GoogleOnboardingScreen } from './src/screens/GoogleOnboardingScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { LanguageProvider, useLanguage } from './src/contexts/LanguageContext';
import { CartProvider } from './src/contexts/CartContext';
import { ServiceBookingCartProvider } from './src/contexts/ServiceBookingCartContext';
import { getLanguage } from './src/utils/language';
import { hasCompletedOnboarding, markOnboardingComplete } from './src/utils/onboarding';
import { colors } from './src/theme/colors';
import { RootNavigator } from './src/navigation/RootNavigator';
import { NavigationContainer } from '@react-navigation/native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { api } from './src/api/client';
import { AppSessionProvider } from './src/contexts/AppSessionContext';
import { consumePendingNotificationCampaignId, consumePendingNotificationInviteToken, initializeNotificationHandling, registerCustomerPushNotifications, unregisterCustomerPushNotifications } from './src/lib/notifications';
import { navigationRef, navigateToAppointmentInvite, navigateToNotifications } from './src/navigation/navigationService';

type AppScreen = 'splash' | 'language' | 'onboarding' | 'welcome' | 'login' | 'register' | 'googleOnboarding' | 'forgotPassword' | 'home';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { setLanguage } = useLanguage();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);

  const extractInviteToken = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const decoded = decodeURIComponent(url);
    const deepLinkMatch = decoded.match(/appointment-invite\/([^/?#]+)/i);
    if (deepLinkMatch?.[1]) return deepLinkMatch[1];
    const queryMatch = decoded.match(/[?&]inviteToken=([^&#]+)/i) || decoded.match(/[?&]token=([^&#]+)/i);
    return queryMatch?.[1] || null;
  };

  useEffect(() => {
    const init = async () => {
      await loadFontsAndLanguage();
    };
    init();
  }, []);

  useEffect(() => {
    const cleanup = initializeNotificationHandling();
    return cleanup;
  }, []);

  useEffect(() => {
    const handleUrl = (url?: string | null) => {
      const token = extractInviteToken(url);
      if (!token) return;
      setPendingInviteToken(token);
    };

    Linking.getInitialURL()
      .then((url) => handleUrl(url))
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    api.touchSession().catch(() => undefined);
    registerCustomerPushNotifications().catch((error) => {
      console.warn('Customer push registration warning:', error?.message || error);
    });
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextState;

      if (!isAuthenticated || !wasBackgrounded || nextState !== 'active') {
        return;
      }

      void (async () => {
        const hasActiveSession = await api.hasActiveSession();
        if (!hasActiveSession) {
          setIsAuthenticated(false);
          setCurrentScreen('welcome');
          return;
        }

        await api.touchSession().catch(() => undefined);
        registerCustomerPushNotifications().catch((error) => {
          console.warn('Customer push refresh warning:', error?.message || error);
        });
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!pendingInviteToken || !isAuthenticated || currentScreen !== 'home') {
      return;
    }

    if (navigationRef.isReady()) {
      navigateToAppointmentInvite(pendingInviteToken);
      setPendingInviteToken(null);
    }
  }, [pendingInviteToken, isAuthenticated, currentScreen]);

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
      const authenticated = await api.hasActiveSession();
      setIsAuthenticated(authenticated);
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
    api.touchSession().catch(() => undefined);
    setIsAuthenticated(true);
    setCurrentScreen('home');
  };

  const handleRegisterSuccess = () => {
    api.touchSession().catch(() => undefined);
    setIsAuthenticated(true);
    setCurrentScreen('home');
  };

  const handleLogout = async () => {
    await unregisterCustomerPushNotifications();
    await api.clearTokens();
    setIsAuthenticated(false);
    setCurrentScreen('welcome');
  };

  // Show nothing while fonts are loading
  if (!fontsLoaded) {
    return null;
  }

  return (
      <AppSessionProvider
      value={{
        isAuthenticated,
        login: handleLoginSuccess,
        logout: handleLogout,
        showLogin: () => setCurrentScreen('login'),
        showRegister: () => setCurrentScreen('register'),
        showForgotPassword: () => setCurrentScreen('forgotPassword'),
        continueAsGuest: () => setCurrentScreen('home'),
      }}
    >
      {currentScreen === 'splash' ? (
        <><SplashScreen onFinish={handleSplashFinish} /><StatusBar style="light" /></>
      ) : null}

      {currentScreen === 'language' ? (
        <><LanguageSelection onLanguageSelect={handleLanguageSelect} /><StatusBar style="dark" /></>
      ) : null}

      {currentScreen === 'onboarding' ? (
        <>
          <OnboardingScreens
            onComplete={handleOnboardingComplete}
            onBackToLanguage={() => setCurrentScreen('language')}
          />
          <StatusBar style="dark" />
        </>
      ) : null}

      {currentScreen === 'welcome' ? (
        <>
          <WelcomeScreen
            onLogin={() => setCurrentScreen('login')}
            onRegister={() => setCurrentScreen('register')}
            onGuest={() => setCurrentScreen('home')}
          />
          <StatusBar style="dark" />
        </>
      ) : null}

      {currentScreen === 'login' ? (
        <>
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onBackToWelcome={() => setCurrentScreen('welcome')}
            onGoToRegister={() => setCurrentScreen('register')}
            onForgotPassword={() => setCurrentScreen('forgotPassword')}
            onGoogleSignIn={() => setCurrentScreen('googleOnboarding')}
          />
          <StatusBar style="dark" />
        </>
      ) : null}

      {currentScreen === 'register' ? (
        <>
          <RegisterScreen
            onRegisterSuccess={handleRegisterSuccess}
            onBackToWelcome={() => setCurrentScreen('welcome')}
            onGoToLogin={() => setCurrentScreen('login')}
            onGoogleSignIn={() => setCurrentScreen('googleOnboarding')}
          />
          <StatusBar style="dark" />
        </>
      ) : null}

      {currentScreen === 'googleOnboarding' ? (
        <>
          <GoogleOnboardingScreen
            onSuccess={handleLoginSuccess}
            onBack={() => setCurrentScreen('welcome')}
          />
          <StatusBar style="dark" />
        </>
      ) : null}

      {currentScreen === 'forgotPassword' ? (
        <>
          <ForgotPasswordScreen
            onBackToLogin={() => setCurrentScreen('login')}
            onBackToWelcome={() => setCurrentScreen('welcome')}
          />
          <StatusBar style="dark" />
        </>
      ) : null}

      {currentScreen === 'home' ? (
        <ServiceBookingCartProvider>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              consumePendingNotificationInviteToken()
                .then((pendingInviteTokenFromNotification) => {
                  if (pendingInviteTokenFromNotification) {
                    navigateToAppointmentInvite(pendingInviteTokenFromNotification);
                  }
                })
                .catch(() => undefined);
              if (pendingInviteToken) {
                navigateToAppointmentInvite(pendingInviteToken);
                setPendingInviteToken(null);
              }
              consumePendingNotificationCampaignId()
                .then((pendingNotification) => {
                  if (pendingNotification) {
                    navigateToNotifications();
                  }
                })
                .catch(() => undefined);
            }}
          >
            <RootNavigator />
          </NavigationContainer>
        </ServiceBookingCartProvider>
      ) : null}
    </AppSessionProvider>
  );
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
