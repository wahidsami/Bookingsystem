'use strict';

const PAYMENT_SOURCE_PRIORITY = Object.freeze([
    'wallet',
    'platform_gift',
    'tenant_gift',
    'online_payment'
]);

module.exports = {
    PAYMENT_SOURCE_PRIORITY
};

