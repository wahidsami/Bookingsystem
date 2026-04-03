const FEATURE_ALIASES = {
    hasAIContentAssistant: ['hasAIContentAssistant', 'aiContentAssistant'],
    aiContentAssistant: ['aiContentAssistant', 'hasAIContentAssistant'],
    hasInternalMessaging: ['hasInternalMessaging', 'internalMessaging'],
    internalMessaging: ['internalMessaging', 'hasInternalMessaging'],
    hasProductsAndOrders: ['hasProductsAndOrders', 'productsAndOrders', 'maxProducts'],
    productsAndOrders: ['productsAndOrders', 'hasProductsAndOrders', 'maxProducts'],
    maxHotDeals: ['maxHotDeals', 'hotDeals'],
    hotDeals: ['hotDeals', 'maxHotDeals'],
    hasPushNotifications: ['hasPushNotifications', 'pushNotifications', 'inAppMarketingNotifications'],
    pushNotifications: ['pushNotifications', 'inAppMarketingNotifications'],
    inAppMarketingNotifications: ['inAppMarketingNotifications', 'pushNotifications'],
    hasWhatsAppNotifications: ['hasWhatsAppNotifications', 'whatsappNotifications'],
    whatsappNotifications: ['whatsappNotifications', 'hasWhatsAppNotifications'],
    reports: ['reports', 'hasAdvancedReports', 'advancedAnalytics'],
    payroll: ['payroll', 'hasPayroll'],
    publicPageCustomization: ['publicPageCustomization', 'hasCustomBranding', 'whiteLabel']
};

const getFeatureKeys = (feature) => FEATURE_ALIASES[feature] || [feature];

const toNumericEntitlement = (value, fallback = 0) => {
    if (value === -1 || value === '-1') return -1;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    if (value === true) return 1;
    return fallback;
};

const isFeatureEnabled = (value) => {
    if (value === true) return true;
    if (value === false || value == null) return false;

    if (typeof value === 'number') {
        return value === -1 || value > 0;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false' || normalized === '') return false;

        const parsed = Number(normalized);
        return Number.isFinite(parsed) && (parsed === -1 || parsed > 0);
    }

    return false;
};

const firstDefinedValue = (source, featureKey) => {
    for (const key of getFeatureKeys(featureKey)) {
        if (source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
};

const normalizePackageEntitlements = (...sources) => {
    const normalized = Object.assign({}, ...sources.filter((source) => source && typeof source === 'object'));

    const aiContentAssistant = firstDefinedValue(normalized, 'aiContentAssistant');
    const internalMessaging = firstDefinedValue(normalized, 'internalMessaging');
    const productsAndOrders = firstDefinedValue(normalized, 'productsAndOrders');
    const hotDeals = firstDefinedValue(normalized, 'maxHotDeals');
    const pushNotifications = firstDefinedValue(normalized, 'inAppMarketingNotifications');
    const whatsappNotifications = firstDefinedValue(normalized, 'whatsappNotifications');
    const reports = firstDefinedValue(normalized, 'reports');
    const payroll = firstDefinedValue(normalized, 'payroll');
    const publicPageCustomization = firstDefinedValue(normalized, 'publicPageCustomization');

    normalized.aiContentAssistant = toNumericEntitlement(aiContentAssistant, 0);
    normalized.hasAIContentAssistant = isFeatureEnabled(aiContentAssistant);

    if (internalMessaging !== undefined) {
        normalized.internalMessaging = internalMessaging;
        normalized.hasInternalMessaging = isFeatureEnabled(internalMessaging);
    }

    if (productsAndOrders !== undefined) {
        normalized.productsAndOrders = productsAndOrders;
        normalized.hasProductsAndOrders = isFeatureEnabled(productsAndOrders);
    }

    normalized.maxHotDeals = toNumericEntitlement(hotDeals, 0);
    normalized.hotDeals = normalized.maxHotDeals;

    normalized.inAppMarketingNotifications = toNumericEntitlement(pushNotifications, 0);
    normalized.pushNotifications = normalized.inAppMarketingNotifications;
    normalized.hasPushNotifications = isFeatureEnabled(normalized.inAppMarketingNotifications);

    normalized.whatsappNotifications = toNumericEntitlement(whatsappNotifications, 0);
    normalized.hasWhatsAppNotifications = isFeatureEnabled(normalized.whatsappNotifications);

    if (reports !== undefined) {
        normalized.reports = isFeatureEnabled(reports);
        normalized.hasAdvancedReports = normalized.reports;
        normalized.advancedAnalytics = normalized.reports;
    }

    if (payroll !== undefined) {
        normalized.payroll = isFeatureEnabled(payroll);
        normalized.hasPayroll = normalized.payroll;
    }

    if (publicPageCustomization !== undefined) {
        normalized.publicPageCustomization = isFeatureEnabled(publicPageCustomization);
        normalized.hasCustomBranding = normalized.publicPageCustomization;
    }

    return normalized;
};

module.exports = {
    FEATURE_ALIASES,
    getFeatureKeys,
    isFeatureEnabled,
    normalizePackageEntitlements,
    toNumericEntitlement
};
