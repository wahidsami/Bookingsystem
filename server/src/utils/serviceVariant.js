const SERVICE_VARIANT_DEFAULT_DURATION = 30;

const toStringValue = (value, fallback = '') => {
    if (typeof value === 'string') {
        return value;
    }

    if (value === null || value === undefined) {
        return fallback;
    }

    return `${value}`;
};

const calculateRawPriceFromFinalPrice = (finalPrice, taxRate, commissionRate) => {
    const final = parseFloat(finalPrice || 0);
    const tax = parseFloat(taxRate || 15) / 100;
    const commission = parseFloat(commissionRate || 10) / 100;
    const multiplier = 1 + tax + commission;

    if (!Number.isFinite(final) || !Number.isFinite(multiplier) || multiplier <= 0) {
        return 0;
    }

    return parseFloat((final / multiplier).toFixed(2));
};

const createStableVariantId = (variant) => {
    const payload = JSON.stringify({
        description: toStringValue(variant?.description ?? '').trim().toLowerCase(),
        duration: parseInt(variant?.duration, 10) || SERVICE_VARIANT_DEFAULT_DURATION,
        finalPrice: parseFloat(variant?.finalPrice ?? variant?.price ?? 0) || 0,
        isActive: variant?.isActive === undefined || variant?.isActive === null
            ? true
            : variant.isActive === true || variant.isActive === 'true'
    });

    let hash = 0;
    for (let index = 0; index < payload.length; index += 1) {
        hash = ((hash << 5) - hash) + payload.charCodeAt(index);
        hash |= 0;
    }

    return `variant-${Math.abs(hash).toString(36)}`;
};

const buildServiceVariantId = (variant) => {
    return createStableVariantId(variant);
};

function normalizeServiceVariant(variant) {
    if (!variant || typeof variant !== 'object') {
        return null;
    }

    const description = toStringValue(variant.description ?? '').trim();
    const duration = parseInt(variant.duration, 10);
    const finalPrice = parseFloat(variant.finalPrice ?? variant.price ?? 0);
    const providedId = toStringValue(variant.id ?? '').trim();

    return {
        id: providedId || buildServiceVariantId(variant),
        description,
        duration: Number.isFinite(duration) && duration > 0 ? duration : SERVICE_VARIANT_DEFAULT_DURATION,
        finalPrice: Number.isFinite(finalPrice) && finalPrice >= 0 ? parseFloat(finalPrice.toFixed(2)) : 0,
        isActive: variant.isActive === undefined || variant.isActive === null
            ? true
            : variant.isActive === true || variant.isActive === 'true'
    };
}

function parseServiceVariants(input) {
    if (!input) {
        return [];
    }

    try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map(normalizeServiceVariant)
            .filter(Boolean);
    } catch (error) {
        return [];
    }
}

function resolveServiceVariant(variants, variantId) {
    if (!variantId || !Array.isArray(variants)) {
        return null;
    }

    const normalizedVariantId = toStringValue(variantId).trim();
    if (!normalizedVariantId) {
        return null;
    }

    return variants
        .map(normalizeServiceVariant)
        .find((variant) => variant && variant.id === normalizedVariantId) || null;
}

module.exports = {
    SERVICE_VARIANT_DEFAULT_DURATION,
    calculateRawPriceFromFinalPrice,
    normalizeServiceVariant,
    parseServiceVariants,
    resolveServiceVariant
};
