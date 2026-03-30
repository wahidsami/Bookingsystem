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
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
    },
    plugins: [],
  },
};
