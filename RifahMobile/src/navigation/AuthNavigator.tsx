import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { GoogleOnboardingScreen } from '../screens/GoogleOnboardingScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';

export type AuthInitialRoute =
  | 'Welcome'
  | 'Login'
  | 'Register'
  | 'GoogleOnboarding'
  | 'ForgotPassword'
  | 'ResetPassword';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  GoogleOnboarding: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthNavigatorProps {
  initialRoute: AuthInitialRoute;
  passwordResetToken: string | null;
  onAuthSuccess: () => void;
  onContinueAsGuest: () => void;
}

export function AuthNavigator({
  initialRoute,
  passwordResetToken,
  onAuthSuccess,
  onContinueAsGuest,
}: AuthNavigatorProps) {
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome">
        {({ navigation }) => (
          <WelcomeScreen
            onLogin={() => navigation.navigate('Login')}
            onRegister={() => navigation.navigate('Register')}
            onGuest={onContinueAsGuest}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Login">
        {({ navigation }) => (
          <LoginScreen
            onLoginSuccess={onAuthSuccess}
            onBackToWelcome={() => navigation.navigate('Welcome')}
            onGoToRegister={() => navigation.navigate('Register')}
            onForgotPassword={() => navigation.navigate('ForgotPassword')}
            onGoogleSignIn={() => navigation.replace('GoogleOnboarding')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {({ navigation }) => (
          <RegisterScreen
            onRegisterSuccess={onAuthSuccess}
            onBackToWelcome={() => navigation.navigate('Welcome')}
            onGoToLogin={() => navigation.navigate('Login')}
            onGoogleSignIn={() => navigation.replace('GoogleOnboarding')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="GoogleOnboarding">
        {({ navigation }) => (
          <GoogleOnboardingScreen onSuccess={onAuthSuccess} onBack={() => navigation.navigate('Welcome')} />
        )}
      </Stack.Screen>
      <Stack.Screen name="ForgotPassword">
        {({ navigation }) => (
          <ForgotPasswordScreen
            onBackToLogin={() => navigation.navigate('Login')}
            onBackToWelcome={() => navigation.navigate('Welcome')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ResetPassword">
        {({ navigation }) => (
          <ResetPasswordScreen
            token={passwordResetToken || ''}
            onBackToLogin={() => navigation.navigate('Login')}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
