const db = require('../models');

const DEFAULT_TENANT_PAYMENT_SETTINGS = Object.freeze({
    acceptCash: true,
    acceptCard: true,
    acceptWallet: true,
    allowServicePayAtCenter: true,
    allowServiceFullOnline: true,
    allowServiceDeposit: true,
    serviceDepositMode: 'fixed',
    serviceDepositFixedAmount: 50,
    serviceDepositPercentage: 50,
    allowProductOnline: true,
    allowProductPayOnPickup: true,
    allowProductCashOnDelivery: true,
    defaultDeliveryFee: 25
});

const SERVICE_PAYMENT_METHOD_RULES = {
    'at-center': 'allowServicePayAtCenter',
    'online-full': 'allowServiceFullOnline',
    'booking-fee': 'allowServiceDeposit'
};

const toBoolean = (value, fallback) => (value === undefined || value === null ? fallback : Boolean(value));

const toSafeAmount = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
};

const toSafePercentage = (value, fallback = 50) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(100, Math.max(1, numeric));
};

const normalizeTenantPaymentSettings = (settings = {}, legacyFields = {}) => {
    const merged = {
        ...DEFAULT_TENANT_PAYMENT_SETTINGS,
        ...(settings || {})
    };

    const serviceDepositMode = merged.serviceDepositMode === 'percentage' ? 'percentage' : 'fixed';

    return {
        acceptCash: toBoolean(legacyFields.acceptCash ?? merged.acceptCash, DEFAULT_TENANT_PAYMENT_SETTINGS.acceptCash),
        acceptCard: toBoolean(legacyFields.acceptCard ?? merged.acceptCard, DEFAULT_TENANT_PAYMENT_SETTINGS.acceptCard),
        acceptWallet: toBoolean(legacyFields.acceptWallet ?? merged.acceptWallet, DEFAULT_TENANT_PAYMENT_SETTINGS.acceptWallet),
        allowServicePayAtCenter: toBoolean(merged.allowServicePayAtCenter, DEFAULT_TENANT_PAYMENT_SETTINGS.allowServicePayAtCenter),
        allowServiceFullOnline: toBoolean(merged.allowServiceFullOnline, DEFAULT_TENANT_PAYMENT_SETTINGS.allowServiceFullOnline),
        allowServiceDeposit: toBoolean(merged.allowServiceDeposit, DEFAULT_TENANT_PAYMENT_SETTINGS.allowServiceDeposit),
        serviceDepositMode,
        serviceDepositFixedAmount: parseFloat(
            toSafeAmount(merged.serviceDepositFixedAmount, DEFAULT_TENANT_PAYMENT_SETTINGS.serviceDepositFixedAmount).toFixed(2)
        ),
        serviceDepositPercentage: parseFloat(
            toSafePercentage(merged.serviceDepositPercentage, DEFAULT_TENANT_PAYMENT_SETTINGS.serviceDepositPercentage).toFixed(2)
        ),
        allowProductOnline: toBoolean(merged.allowProductOnline, DEFAULT_TENANT_PAYMENT_SETTINGS.allowProductOnline),
        allowProductPayOnPickup: toBoolean(merged.allowProductPayOnPickup, DEFAULT_TENANT_PAYMENT_SETTINGS.allowProductPayOnPickup),
        allowProductCashOnDelivery: toBoolean(merged.allowProductCashOnDelivery, DEFAULT_TENANT_PAYMENT_SETTINGS.allowProductCashOnDelivery),
        defaultDeliveryFee: parseFloat(
            toSafeAmount(merged.defaultDeliveryFee, DEFAULT_TENANT_PAYMENT_SETTINGS.defaultDeliveryFee).toFixed(2)
        )
    };
};

const validateTenantPaymentSettings = (settings) => {
    if (!settings.allowServicePayAtCenter && !settings.allowServiceFullOnline && !settings.allowServiceDeposit) {
        throw new Error('At least one service booking payment option must be enabled');
    }

    if (!settings.allowProductOnline && !settings.allowProductPayOnPickup && !settings.allowProductCashOnDelivery) {
        throw new Error('At least one product payment option must be enabled');
    }

    if (settings.serviceDepositMode === 'fixed' && settings.allowServiceDeposit && settings.serviceDepositFixedAmount <= 0) {
        throw new Error('Service deposit fixed amount must be greater than 0');
    }

    if (settings.serviceDepositMode === 'percentage' && settings.allowServiceDeposit
        && (settings.serviceDepositPercentage <= 0 || settings.serviceDepositPercentage > 100)) {
        throw new Error('Service deposit percentage must be between 1 and 100');
    }
};

const getTenantPaymentSettings = async (tenantId, options = {}) => {
    const settings = await db.TenantSettings.findOne({
        where: { tenantId },
        attributes: ['paymentSettings', 'acceptCash', 'acceptCard', 'acceptWallet'],
        transaction: options.transaction
    });

    return normalizeTenantPaymentSettings(settings?.paymentSettings || {}, {
        acceptCash: settings?.acceptCash,
        acceptCard: settings?.acceptCard,
        acceptWallet: settings?.acceptWallet
    });
};

const calculateServiceDeposit = (totalPrice, settings) => {
    const normalizedSettings = normalizeTenantPaymentSettings(settings);
    const price = toSafeAmount(totalPrice, 0);

    const rawDepositAmount = normalizedSettings.serviceDepositMode === 'percentage'
        ? price * (normalizedSettings.serviceDepositPercentage / 100)
        : normalizedSettings.serviceDepositFixedAmount;

    const depositAmount = parseFloat(Math.min(price, Math.max(0, rawDepositAmount)).toFixed(2));
    const remainderAmount = parseFloat(Math.max(0, price - depositAmount).toFixed(2));

    return {
        depositAmount,
        remainderAmount,
        depositMode: normalizedSettings.serviceDepositMode,
        depositPercentage: normalizedSettings.serviceDepositMode === 'percentage'
            ? normalizedSettings.serviceDepositPercentage
            : price > 0
                ? parseFloat(((depositAmount / price) * 100).toFixed(2))
                : 0,
        depositFixedAmount: normalizedSettings.serviceDepositFixedAmount
    };
};

const assertServicePaymentMethodAllowed = (paymentMethod, settings) => {
    const normalizedSettings = normalizeTenantPaymentSettings(settings);
    const paymentFlag = SERVICE_PAYMENT_METHOD_RULES[paymentMethod];

    if (!paymentFlag || !normalizedSettings[paymentFlag]) {
        throw new Error('Selected service payment option is not available for this center');
    }

    return normalizedSettings;
};

const resolvePublicOrderPaymentMethod = (paymentMethod, deliveryType, settings) => {
    const normalizedSettings = normalizeTenantPaymentSettings(settings);

    if (paymentMethod === 'online') {
        if (!normalizedSettings.allowProductOnline) {
            throw new Error('Online product payment is not available for this center');
        }
        return 'online';
    }

    if (paymentMethod === 'pay_on_visit' || paymentMethod === 'pay-on-visit') {
        if (deliveryType !== 'pickup') {
            throw new Error('Pay at center is only available for pickup orders');
        }
        if (!normalizedSettings.allowProductPayOnPickup) {
            throw new Error('Pay at pickup is not available for this center');
        }
        return 'pay_on_visit';
    }

    if (paymentMethod === 'cash_on_delivery' || paymentMethod === 'cash-on-delivery') {
        if (deliveryType !== 'delivery') {
            throw new Error('Cash on delivery is only available for delivery orders');
        }
        if (!normalizedSettings.allowProductCashOnDelivery) {
            throw new Error('Cash on delivery is not available for this center');
        }
        return 'cash_on_delivery';
    }

    if (deliveryType === 'pickup') {
        return resolvePublicOrderPaymentMethod('pay_on_visit', deliveryType, normalizedSettings);
    }

    return resolvePublicOrderPaymentMethod('cash_on_delivery', deliveryType, normalizedSettings);
};

module.exports = {
    DEFAULT_TENANT_PAYMENT_SETTINGS,
    normalizeTenantPaymentSettings,
    validateTenantPaymentSettings,
    getTenantPaymentSettings,
    calculateServiceDeposit,
    assertServicePaymentMethodAllowed,
    resolvePublicOrderPaymentMethod
};
