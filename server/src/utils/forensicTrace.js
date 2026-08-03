'use strict';

const crypto = require('crypto');

const safeJson = (value) => {
    try {
        return value;
    } catch (error) {
        return { serializationError: error?.message || String(error) };
    }
};

const createForensicTrace = ({ label, req = null, res = null } = {}) => {
    const traceId = crypto.randomUUID();
    const prefix = `[FORENSIC][${traceId}]${label ? ` [${label}]` : ''}`;

    const log = (event, details = {}) => {
        console.info(`${prefix} ${event}`, safeJson(details));
    };

    const sqlLogger = (sql) => {
        console.info(`${prefix} SQL`, typeof sql === 'string' ? sql : safeJson(sql));
    };

    if (req) {
        log('Request received', {
            method: req.method,
            url: req.originalUrl,
            params: req.params,
            query: req.query
        });
    }

    if (res) {
        res.once('finish', () => {
            log('Response finished', {
                statusCode: res.statusCode
            });
        });
    }

    return {
        traceId,
        label,
        log,
        sqlLogger
    };
};

module.exports = {
    createForensicTrace
};
