const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  || '412b0087-4404-421d-aaf3-a44b474fed0b';
const updateUrl = easProjectId ? `https://u.expo.dev/${easProjectId}` : undefined;

module.exports = {
  expo: {
    name: 'Refah Staff',
    slug: 'refah-mobile',
    scheme: 'com.refah.mobile',
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
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#8B5CF6',
      },
      package: 'com.refah.mobile',
      versionCode: 1,
      edgeToEdgeEnabled: false,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || ''
        }
      }
    },
    web: {
      favicon: './assets/favicon.png',
    },
    locales: {
      ar: './locales/ar.json',
      en: './locales/en.json',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    ...(updateUrl ? {
      updates: {
        url: updateUrl,
      },
    } : {}),
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://rapi.unifinitylab.com/api/v1',
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
    plugins: [
      'expo-localization',
      'expo-font',
      'expo-notifications',
      'expo-web-browser',
    ],
  },
};
