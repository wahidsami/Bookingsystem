import Constants from 'expo-constants';

/** Rifah API base (e.g. https://api.rifah.sa/api/v1) */
export function getApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromExtra && fromExtra.length > 0) return fromExtra.replace(/\/$/, '');
  return 'http://localhost:5000/api/v1';
}
