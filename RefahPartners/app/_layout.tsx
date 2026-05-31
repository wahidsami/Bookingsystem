import '../src/i18n'; // Initialize i18next first!
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext';
import { useFonts, Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { logRuntimeError, logRuntimeInfo } from '../src/utils/runtimeLogs';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be controlled by the native layer during fast refresh.
});

function RootNavigator({
  fontsLoaded,
  fontError,
}: {
  fontsLoaded: boolean;
  fontError: Error | null;
}) {
  const colorScheme = useColorScheme();
  const { isLoading: authLoading } = useAuth();
  const { isLoading: languageLoading } = useLanguage();
  usePushNotifications();
  const isReady = (fontsLoaded || !!fontError) && !authLoading && !languageLoading;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore duplicate hide calls.
      });
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5ADF" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(modals)/request-time-off" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  useEffect(() => {
    logRuntimeInfo('app_boot', {
      platform: process?.platform || 'unknown',
    });

    const errorUtils = (global as any)?.ErrorUtils;
    if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
      return;
    }

    const originalHandler = errorUtils.getGlobalHandler();

    errorUtils.setGlobalHandler((err: unknown, isFatal?: boolean) => {
      logRuntimeError('global_js_error', err, { isFatal: Boolean(isFatal) });
      if (typeof originalHandler === 'function') {
        originalHandler(err, isFatal);
      }
    });

    return () => {
      if (typeof originalHandler === 'function') {
        errorUtils.setGlobalHandler(originalHandler);
      }
    };
  }, []);

  return (
    <AppErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <RootNavigator fontsLoaded={loaded} fontError={error} />
        </AuthProvider>
      </LanguageProvider>
    </AppErrorBoundary>
  );
}
