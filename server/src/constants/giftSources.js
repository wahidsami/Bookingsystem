'use strict';

const GIFT_SOURCES = Object.freeze({
    WALLET: 'wallet',
    PLATFORM_GIFT: 'platform_gift',
    TENANT_GIFT: 'tenant_gift'
});

const GIFT_DELIVERY_MODES = Object.freeze({
    AUTO_WALLET: 'auto_wallet',
    EXTERNAL_CODE: 'external_code'
});

module.exports = {
    GIFT_SOURCES,
    GIFT_DELIVERY_MODES
};

