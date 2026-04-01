import Constants from 'expo-constants';

const DEFAULT_API_URL = 'https://rapi.unifinitylab.com/api/v1';

function trimTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, '');
}

function normalizeApiUrl(value: string): string {
    const trimmed = trimTrailingSlashes(value);
    return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

export function getApiUrl(): string {
    const publicEnv = process.env.EXPO_PUBLIC_API_URL;
    if (publicEnv && publicEnv.trim().length > 0) {
        return normalizeApiUrl(publicEnv.trim());
    }

    const extraApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
    if (extraApiUrl && extraApiUrl.trim().length > 0) {
        return normalizeApiUrl(extraApiUrl.trim());
    }

    return DEFAULT_API_URL;
}

export function getServerUrl(): string {
    return getApiUrl().replace(/\/api\/v1$/, '');
}
