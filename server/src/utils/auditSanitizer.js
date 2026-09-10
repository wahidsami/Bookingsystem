/**
 * Audit Sanitizer Utility
 * 
 * Cleans metadata/details payloads before persisting to the ActivityLog.
 * - Removes sensitive fields recursively.
 * - Ensures valid JSON is persisted.
 * - Bounds the size of the metadata to ~2KB.
 */

const SENSITIVE_KEYS = [
    'password',
    'token',
    'secret',
    'authorization',
    'cookie',
    'apikey',
    'cardnumber',
    'cvv',
    'expiry',
    'ccv',
    'creditcard'
];

const MAX_PAYLOAD_SIZE = 2000; // ~2KB limit

/**
 * Recursively removes sensitive fields from an object.
 * @param {any} obj - The object to sanitize.
 * @returns {any} A sanitized copy of the object.
 */
function stripSensitiveFields(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => stripSensitiveFields(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key is sensitive
        const isSensitive = SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey));
        
        if (isSensitive) {
            sanitized[key] = '[REDACTED]';
        } else {
            sanitized[key] = stripSensitiveFields(value);
        }
    }
    return sanitized;
}

/**
 * Bounds the size of the JSON object.
 * If the stringified payload exceeds the maximum size, it will return a simplified valid JSON.
 * @param {Object} obj - The sanitized object.
 * @returns {Object} Valid, bounded JSON object.
 */
function boundSize(obj) {
    const stringified = JSON.stringify(obj);
    if (stringified.length <= MAX_PAYLOAD_SIZE) {
        return obj;
    }

    // Attempt to truncate large string values to save space
    const truncatedObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length > 100) {
            truncatedObj[key] = value.substring(0, 100) + '...[TRUNCATED]';
        } else {
            truncatedObj[key] = value;
        }
    }

    const truncatedStringified = JSON.stringify(truncatedObj);
    if (truncatedStringified.length <= MAX_PAYLOAD_SIZE) {
        return truncatedObj;
    }

    // If still too large, return a hard-capped valid JSON structure
    return {
        _warning: "Metadata exceeded size limit and was dropped.",
        originalKeys: Object.keys(obj).slice(0, 10)
    };
}

/**
 * Main sanitization entry point.
 * @param {Object} details - The metadata to sanitize.
 * @returns {Object} Cleaned metadata.
 */
function sanitize(details) {
    if (!details || typeof details !== 'object') {
        return details || {};
    }

    const noSensitive = stripSensitiveFields(details);
    return boundSize(noSensitive);
}

module.exports = {
    sanitize,
    stripSensitiveFields, // exported for testing
    boundSize // exported for testing
};
