const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined;

module.exports = {
  expo: {
    name: 'Refah - Beauty & Wellness',
    slug: 'refah-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#8B5CF6',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.refah.mobile',
      buildNumber: '1.0.0',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#8B5CF6',
      },
      package: 'com.refah.mobile',
      versionCode: 1,
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    locales: {
      ar: './locales/ar.json',
      en: './locales/en.json',
    },
    supportsRTL: true,
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://rapi.unifinitylab.com/api/v1',
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
    plugins: ['expo-localization', 'expo-font'],
  },
};
