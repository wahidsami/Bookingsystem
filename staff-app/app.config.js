/**
 * Expo config – https://docs.expo.dev/workflow/configuration/
 * Set EXPO_PUBLIC_API_URL in .env (see .env.example)
 */
module.exports = {
  expo: {
    name: 'Rifah Staff',
    slug: 'rifah-staff',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#4c1d95',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'sa.rifah.staff',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#4c1d95',
      },
      package: 'sa.rifah.staff',
      edgeToEdgeEnabled: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    scheme: 'rifah-staff',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/6f9bc7f6-b461-46b1-95d2-a4158a47adb6',
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://rapi.unifinitylab.com/api/v1',
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '6f9bc7f6-b461-46b1-95d2-a4158a47adb6',
      },
    },
    plugins: ['expo-secure-store', 'expo-notifications'],
  },
};
