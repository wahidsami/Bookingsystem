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

const toNumberValue = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const toBooleanValue = (value, fallback = false) => {
    if (value === undefined || value === null) {
        return fallback;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }

    return Boolean(value);
};

const calculateRawPriceFromFinalPrice = (finalPrice, taxRate, commissionRate) => {
    const final = parseFloat(finalPrice ?? 0);
    const tax = parseFloat(taxRate ?? 15) / 100;
    const commission = parseFloat(commissionRate ?? 10) / 100;
    const multiplier = 1 + tax + commission;

    if (!Number.isFinite(final) || !Number.isFinite(multiplier) || multiplier <= 0) {
        return 0;
    }

    return parseFloat((final / multiplier).toFixed(2));
};

const createStableVariantId = (variant) => {
    const nameAr = toStringValue(variant?.name_ar ?? variant?.nameAr ?? '', '').trim();
    const nameEn = toStringValue(variant?.name_en ?? variant?.nameEn ?? '', '').trim();
    const descriptionAr = toStringValue(variant?.description_ar ?? variant?.descriptionAr ?? variant?.description ?? '', '').trim();
    const descriptionEn = toStringValue(variant?.description_en ?? variant?.descriptionEn ?? variant?.description ?? '', '').trim();
    const payload = JSON.stringify({
        nameAr: nameAr.toLowerCase(),
        nameEn: nameEn.toLowerCase(),
        descriptionAr: descriptionAr.toLowerCase(),
        descriptionEn: descriptionEn.toLowerCase(),
        duration: Math.max(5, Math.round(toNumberValue(variant?.duration, SERVICE_VARIANT_DEFAULT_DURATION) / 5) * 5),
        finalPrice: parseFloat(toNumberValue(variant?.finalPrice ?? variant?.price ?? 0, 0).toFixed(2)),
        isActive: toBooleanValue(variant?.isActive, true)
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

    const nameAr = toStringValue(variant.name_ar ?? variant.nameAr ?? variant.name ?? '', '').trim();
    const nameEn = toStringValue(variant.name_en ?? variant.nameEn ?? variant.name ?? '', '').trim();
    const descriptionAr = toStringValue(variant.description_ar ?? variant.descriptionAr ?? variant.description ?? '', '').trim();
    const descriptionEn = toStringValue(variant.description_en ?? variant.descriptionEn ?? variant.description ?? '', '').trim();
    const duration = parseInt(variant.duration, 10);
    const finalPrice = parseFloat(variant.finalPrice ?? variant.price ?? 0);
    const providedId = toStringValue(variant.id ?? '').trim();
    const normalizedDuration = Number.isFinite(duration) && duration > 0
        ? Math.max(5, Math.round(duration / 5) * 5)
        : SERVICE_VARIANT_DEFAULT_DURATION;
    const normalizedFinalPrice = Number.isFinite(finalPrice) && finalPrice >= 0 ? parseFloat(finalPrice.toFixed(2)) : 0;
    const isActive = toBooleanValue(variant.isActive, true);

    return {
        id: providedId || buildServiceVariantId(variant),
        name_ar: nameAr,
        name_en: nameEn,
        description_ar: descriptionAr,
        description_en: descriptionEn,
        description: descriptionEn || descriptionAr || nameEn || nameAr,
        duration: normalizedDuration,
        finalPrice: normalizedFinalPrice,
        rawPrice: toNumberValue(variant.rawPrice ?? variant.basePrice ?? variant.price ?? 0, 0),
        isActive,
        nameAr,
        nameEn,
        descriptionAr,
        descriptionEn,
        price: normalizedFinalPrice
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
