const normalizeBaseUrl = (value) => {
    if (!value || typeof value !== 'string') {
        return '';
    }

    const candidate = value
        .split(',')
        .map((part) => part.trim())
        .find(Boolean) || '';

    return candidate.replace(/\/+$/, '');
};

const stripLoginPath = (value) => value.replace(/\/[a-z]{2}\/login$/i, '').replace(/\/login$/i, '');

const getTenantDashboardBaseUrl = () => {
    const configuredUrl = stripLoginPath(normalizeBaseUrl(
        process.env.TENANT_DASHBOARD_BASE_URL || process.env.TENANT_DASHBOARD_URL
    ));

    if (configuredUrl) {
        return configuredUrl;
    }

    if (process.env.NODE_ENV !== 'production') {
        return 'http://localhost:3003';
    }

    return '';
};

const getTenantDashboardLoginUrl = (locale = 'ar') => {
    const explicitLoginUrl = normalizeBaseUrl(process.env.TENANT_DASHBOARD_LOGIN_URL);

    if (explicitLoginUrl) {
        return explicitLoginUrl;
    }

    const baseUrl = getTenantDashboardBaseUrl();

    if (!baseUrl) {
        return '';
    }

    if (/\/[a-z]{2}\/login$/i.test(baseUrl) || /\/login$/i.test(baseUrl)) {
        return baseUrl;
    }

    return `${baseUrl}/${locale}/login`;
};

const getServerPublicUrl = () => {
    const configuredUrl = normalizeBaseUrl(process.env.SERVER_PUBLIC_URL);

    if (configuredUrl) {
        return configuredUrl;
    }

    if (process.env.NODE_ENV !== 'production') {
        return 'http://localhost:5000';
    }

    return '';
};

const getStaffAppLoginUrl = () => {
    const explicitLoginUrl = normalizeBaseUrl(process.env.STAFF_APP_LOGIN_URL);

    if (explicitLoginUrl) {
        return explicitLoginUrl;
    }

    const baseUrl = normalizeBaseUrl(process.env.STAFF_APP_URL);
    if (baseUrl) {
        return baseUrl;
    }

    if (process.env.NODE_ENV !== 'production') {
        return 'exp://localhost:8081';
    }

    return '';
};

const getCustomerAppResetUrl = (token) => {
    const encodedToken = encodeURIComponent(token || '');
    const explicitBaseUrl = normalizeBaseUrl(process.env.CUSTOMER_APP_URL);
    const publicServerUrl = getServerPublicUrl();

    // Prefer an https/http bridge URL for email clients.
    // The bridge endpoint can deep-link into the app with a safe fallback.
    if (publicServerUrl) {
        return `${publicServerUrl}/api/v1/auth/user/reset-password/open?token=${encodedToken}`;
    }

    if (explicitBaseUrl) {
        if (explicitBaseUrl.startsWith('http://') || explicitBaseUrl.startsWith('https://')) {
            return `${explicitBaseUrl}/reset-password?token=${encodedToken}`;
        }
        return `${explicitBaseUrl}://reset-password?token=${encodedToken}`;
    }

    return `com.refah.mobile://reset-password?token=${encodedToken}`;
};

const getTenantDashboardResetUrl = (token, locale = 'ar') => {
    const encodedToken = encodeURIComponent(token || '');
    const baseUrl = getTenantDashboardBaseUrl();

    if (!baseUrl) {
        return '';
    }

    return `${baseUrl}/${locale}/reset-password?token=${encodedToken}`;
};

const buildPublicAssetUrl = (assetPath) => {
    if (!assetPath || typeof assetPath !== 'string') {
        return assetPath;
    }

    if (/^https?:\/\//i.test(assetPath)) {
        return assetPath;
    }

    let normalizedPath = assetPath;

    if (normalizedPath.startsWith('profiles/')) {
        normalizedPath = `/uploads/${normalizedPath}`;
    } else if (normalizedPath.startsWith('uploads/')) {
        normalizedPath = `/${normalizedPath}`;
    } else if (!normalizedPath.startsWith('/uploads/')) {
        normalizedPath = normalizedPath.startsWith('/')
            ? normalizedPath
            : `/uploads/profiles/${normalizedPath}`;
    }

    const publicUrl = getServerPublicUrl();
    return publicUrl ? `${publicUrl}${normalizedPath}` : normalizedPath;
};

module.exports = {
    normalizeBaseUrl,
    getTenantDashboardBaseUrl,
    getTenantDashboardLoginUrl,
    getStaffAppLoginUrl,
    getCustomerAppResetUrl,
    getTenantDashboardResetUrl,
    getServerPublicUrl,
    buildPublicAssetUrl
};
