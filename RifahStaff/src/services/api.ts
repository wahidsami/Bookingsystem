import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// We use a configurable API URL so that Expo Go and builds can target local or production.
// Priority: 1) EXPO_PUBLIC_API_URL (.env / EAS env)  2) app.json extra.apiUrl  3) default below.
// For Expo Go: set EXPO_PUBLIC_API_URL in .env to your PC's LAN IP (e.g. http://192.168.0.101:5000/api/v1).
// For production builds, set via EAS env or app.json extra.apiUrl.
// Staff app routes live under /api/v1/staff/*
import Constants from 'expo-constants';

const _defaultApiUrl = 'https://rapi.unifinitylab.com/api/v1';

export const BASE_URL =
  (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_API_URL as string)) ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  _defaultApiUrl;

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Helper to get full image URL from relative path
 */
export const getImageUrl = (path: string | null | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;

    // Normalize path (convert backslashes to forward slashes if any)
    const normalizedPath = path.replace(/\\/g, '/');

    const base = BASE_URL.replace('/api/v1', '');

    // Check if the path already starts with /uploads
    if (normalizedPath.startsWith('uploads/') || normalizedPath.startsWith('/uploads/')) {
        const fullPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
        return `${base}${fullPath}`;
    }

    // Prepend /uploads/ if missing
    const prefix = normalizedPath.startsWith('/') ? '/uploads' : '/uploads/';
    return `${base}${prefix}${normalizedPath}`;
};

// Request interceptor to add the access token to headers
api.interceptors.request.use(
    async (config) => {
        try {
            const accessToken = await SecureStore.getItemAsync('refah_staff_access_token');
            if (accessToken) {
                config.headers.Authorization = `Bearer ${accessToken}`;
            }
        } catch (error) {
            console.error('Error fetching token for request', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token refresh automatically
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const responseStatus = error.response?.status;

        // Avoid infinite loop if refresh token fails
        if (originalRequest?.url === '/staff/auth/refresh-token' && responseStatus === 401) {
            return Promise.reject(error);
        }

        if (responseStatus === 401 && originalRequest && !originalRequest._retry) {
            // If the original request had no auth header, this is a deliberately
            // unauthenticated request that got a 401. There is nothing to refresh.
            // Just reject cleanly — AuthContext will redirect the user to login.
            if (!originalRequest.headers?.Authorization) {
                return Promise.reject(error);
            }

            originalRequest._retry = true;

            try {
                const refreshToken = await SecureStore.getItemAsync('refah_staff_refresh_token');
                if (!refreshToken) {
                    // No refresh token means we can't refresh, need to login
                    throw new Error('No refresh token available');
                }

                // Call the refresh token endpoint
                // NOTE: Make sure this URL matches what you defined in your backend
                const response = await axios.post(`${BASE_URL}/staff/auth/refresh-token`, {
                    refreshToken,
                });

                const { accessToken, refreshToken: nextRefreshToken } = response.data;

                // Save new tokens
                await SecureStore.setItemAsync('refah_staff_access_token', accessToken);
                await SecureStore.setItemAsync('refah_staff_refresh_token', nextRefreshToken);

                // Update authorization header and retry original request
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return axios(originalRequest);
            } catch (refreshError) {
                console.error('Error refreshing token:', refreshError);
                // Dispatch an event so AuthContext can log the user out
                // (Implementation detail can vary - usually AuthContext manages this part directly)
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
