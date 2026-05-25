import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus, Linking, Text } from 'react-native';
import * as Font from 'expo-font';
import { SplashScreen } from './src/screens/SplashScreen';
import { LanguageProvider, useLanguage } from './src/contexts/LanguageContext';
import { CartProvider } from './src/contexts/CartContext';
import { ServiceBookingCartProvider } from './src/contexts/ServiceBookingCartContext';
import { getLanguage } from './src/utils/language';
import { hasCompletedOnboarding, markOnboardingComplete } from './src/utils/onboarding';
import { RootNavigator } from './src/navigation/RootNavigator';
import { NavigationContainer } from '@react-navigation/native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { api } from './src/api/client';
import { AppSessionProvider } from './src/contexts/AppSessionContext';
import { consumePendingNotificationCampaignId, consumePendingNotificationInviteToken, initializeNotificationHandling, registerCustomerPushNotifications, unregisterCustomerPushNotifications } from './src/lib/notifications';
import { navigationRef, navigateToAppointmentInvite, navigateToGiftClaim, navigateToNotifications, navigateToReview } from './src/navigation/navigationService';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { AuthInitialRoute, AuthNavigator } from './src/navigation/AuthNavigator';

type AppPhase = 'splash' | 'onboarding' | 'auth' | 'home';

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
  const [appPhase, setAppPhase] = useState<AppPhase>('splash');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [hasSavedLanguage, setHasSavedLanguage] = useState(false);
  const [authInitialRoute, setAuthInitialRoute] = useState<AuthInitialRoute>('Welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { setLanguage } = useLanguage();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [pendingReviewAppointmentId, setPendingReviewAppointmentId] = useState<string | null>(null);
  const [pendingGiftClaimToken, setPendingGiftClaimToken] = useState<string | null>(null);
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);

  const extractInviteToken = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const decoded = decodeURIComponent(url);
    const deepLinkMatch = decoded.match(/appointment-invite\/([^/?#]+)/i);
    if (deepLinkMatch?.[1]) return deepLinkMatch[1];
    const queryMatch = decoded.match(/[?&]inviteToken=([^&#]+)/i) || decoded.match(/[?&]token=([^&#]+)/i);
    return queryMatch?.[1] || null;
  };

  const extractPasswordResetToken = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const decoded = decodeURIComponent(url);
    const pathMatch = decoded.match(/reset-password\/([^/?#]+)/i);
    if (pathMatch?.[1]) return pathMatch[1];
    const queryMatch = decoded.match(/[?&]token=([^&#]+)/i);
    return queryMatch?.[1] || null;
  };

  const extractReviewAppointmentId = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const decoded = decodeURIComponent(url);
    const pathMatch = decoded.match(/review\/([^/?#]+)/i);
    if (pathMatch?.[1]) return pathMatch[1];
    const queryMatch = decoded.match(/[?&]appointmentId=([^&#]+)/i);
    return queryMatch?.[1] || null;
  };

  const extractGiftClaimToken = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const decoded = decodeURIComponent(url);
    const pathMatch = decoded.match(/gift-claim\/([^/?#]+)/i);
    if (pathMatch?.[1]) return pathMatch[1];
    const queryMatch = decoded.match(/[?&]giftToken=([^&#]+)/i) || decoded.match(/[?&]token=([^&#]+)/i);
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
      const resetToken = extractPasswordResetToken(url);
      if (resetToken) {
        setPasswordResetToken(resetToken);
        setAuthInitialRoute('ResetPassword');
        setAppPhase('auth');
        return;
      }

      const token = extractInviteToken(url);
      if (token) {
        setPendingInviteToken(token);
        return;
      }

      const reviewAppointmentId = extractReviewAppointmentId(url);
      if (reviewAppointmentId) {
        setPendingReviewAppointmentId(reviewAppointmentId);
        return;
      }

      const giftClaimToken = extractGiftClaimToken(url);
      if (giftClaimToken) {
        setPendingGiftClaimToken(giftClaimToken);
      }
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
          setAuthInitialRoute('Welcome');
          setAppPhase('auth');
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
    if (!pendingInviteToken || !isAuthenticated || appPhase !== 'home') {
      return;
    }

    if (navigationRef.isReady()) {
      navigateToAppointmentInvite(pendingInviteToken);
      setPendingInviteToken(null);
    }
  }, [pendingInviteToken, isAuthenticated, appPhase]);

  useEffect(() => {
    if (!pendingReviewAppointmentId || !isAuthenticated || appPhase !== 'home') {
      return;
    }

    if (navigationRef.isReady()) {
      navigateToReview(pendingReviewAppointmentId);
      setPendingReviewAppointmentId(null);
    }
  }, [pendingReviewAppointmentId, isAuthenticated, appPhase]);

  useEffect(() => {
    if (!pendingGiftClaimToken || !isAuthenticated || appPhase !== 'home') {
      return;
    }

    if (navigationRef.isReady()) {
      navigateToGiftClaim(pendingGiftClaimToken);
      setPendingGiftClaimToken(null);
    }
  }, [pendingGiftClaimToken, isAuthenticated, appPhase]);

  const loadFontsAndLanguage = async () => {
    await loadFonts();
    setFontsLoaded(true);
    await checkAppState();
  };

  const checkAppState = async () => {
    const savedLanguage = await getLanguage();
    setHasSavedLanguage(Boolean(savedLanguage));
    if (savedLanguage) {
      await setLanguage(savedLanguage);
    }
  };

  const handleSplashFinish = async () => {
    const savedLanguage = await getLanguage();
    setHasSavedLanguage(Boolean(savedLanguage));
    const onboardingCompleted = await hasCompletedOnboarding();

    if (!savedLanguage) {
      setAppPhase('onboarding');
    } else if (!onboardingCompleted) {
      setAppPhase('onboarding');
    } else {
      const authenticated = await api.hasActiveSession();
      setIsAuthenticated(authenticated);
      setAuthInitialRoute('Welcome');
      setAppPhase(authenticated ? 'home' : 'auth');
    }
  };

  const handleLanguageSelect = async (language: 'ar' | 'en') => {
    await setLanguage(language);
    setHasSavedLanguage(true);
  };

  const handleOnboardingComplete = async () => {
    await markOnboardingComplete();
    setAuthInitialRoute('Welcome');
    setAppPhase('auth');
  };

  const handleLoginSuccess = () => {
    api.touchSession().catch(() => undefined);
    setIsAuthenticated(true);
    setAppPhase('home');
  };

  const handleRegisterSuccess = () => {
    api.touchSession().catch(() => undefined);
    setIsAuthenticated(true);
    setAppPhase('home');
  };

  const handleLogout = async () => {
    await unregisterCustomerPushNotifications();
    await api.clearTokens();
    setIsAuthenticated(false);
    setAuthInitialRoute('Welcome');
    setAppPhase('auth');
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
        showLogin: () => {
          setAuthInitialRoute('Login');
          setAppPhase('auth');
        },
        showRegister: () => {
          setAuthInitialRoute('Register');
          setAppPhase('auth');
        },
        showForgotPassword: () => {
          setAuthInitialRoute('ForgotPassword');
          setAppPhase('auth');
        },
        continueAsGuest: () => setAppPhase('home'),
      }}
    >
      {appPhase === 'splash' ? (
        <><SplashScreen onFinish={handleSplashFinish} /><StatusBar style="light" /></>
      ) : null}

      {appPhase === 'onboarding' ? (
        <>
          <NavigationContainer>
            <OnboardingNavigator
              hasSavedLanguage={hasSavedLanguage}
              onLanguageSelected={handleLanguageSelect}
              onOnboardingCompleted={handleOnboardingComplete}
            />
          </NavigationContainer>
          <StatusBar style="dark" />
        </>
      ) : null}

      {appPhase === 'auth' ? (
        <>
          <NavigationContainer key={`${authInitialRoute}:${passwordResetToken || ''}`}>
            <AuthNavigator
              initialRoute={authInitialRoute}
              passwordResetToken={passwordResetToken}
              onAuthSuccess={handleLoginSuccess}
              onContinueAsGuest={() => setAppPhase('home')}
            />
          </NavigationContainer>
          <StatusBar style="dark" />
        </>
      ) : null}

      {appPhase === 'home' ? (
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
          <StatusBar style="dark" />
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
