'use strict';

const https = require('https');
const db = require('../models');
const logger = require('../utils/productionLogger');
const { Op } = require('sequelize');

const EXPO_PUSH_HOST = 'exp.host';
const EXPO_PUSH_PATH = '/--/api/v2/push/send';
const VALID_EXPO_PUSH_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

const normalizeToken = (value) => `${value || ''}`.trim();
const normalizePlatform = (value) => {
    const candidate = `${value || ''}`.trim().toLowerCase();
    return ['ios', 'android', 'web'].includes(candidate) ? candidate : 'unknown';
};

const sanitizeText = (value, fallback) => {
    const candidate = `${value || ''}`.trim();
    return candidate || fallback;
};

class PushNotificationService {
    isValidExpoPushToken(token) {
        return VALID_EXPO_PUSH_TOKEN.test(normalizeToken(token));
    }

    async registerUserDevice({ platformUserId, token, platform, appVersion, deviceName }) {
        const normalizedToken = normalizeToken(token);
        if (!this.isValidExpoPushToken(normalizedToken)) {
            throw new Error('Invalid Expo push token');
        }

        const now = new Date();
        const [record] = await db.MobilePushToken.findOrCreate({
            where: { token: normalizedToken },
            defaults: {
                token: normalizedToken,
                appType: 'customer',
                platform: normalizePlatform(platform),
                appVersion: appVersion || null,
                deviceName: deviceName || null,
                platformUserId,
                isActive: true,
                lastRegisteredAt: now,
                lastSeenAt: now
            }
        });

        await record.update({
            appType: 'customer',
            platform: normalizePlatform(platform),
            appVersion: appVersion || null,
            deviceName: deviceName || null,
            platformUserId,
            staffUserId: null,
            staffId: null,
            tenantId: null,
            isActive: true,
            lastRegisteredAt: now,
            lastSeenAt: now
        });

        return record;
    }

    async registerStaffDevice({ staffUserId, staffId, tenantId, token, platform, appVersion, deviceName }) {
        const normalizedToken = normalizeToken(token);
        if (!this.isValidExpoPushToken(normalizedToken)) {
            throw new Error('Invalid Expo push token');
        }

        const now = new Date();
        const [record] = await db.MobilePushToken.findOrCreate({
            where: { token: normalizedToken },
            defaults: {
                token: normalizedToken,
                appType: 'staff',
                platform: normalizePlatform(platform),
                appVersion: appVersion || null,
                deviceName: deviceName || null,
                staffUserId,
                staffId,
                tenantId,
                isActive: true,
                lastRegisteredAt: now,
                lastSeenAt: now
            }
        });

        await record.update({
            appType: 'staff',
            platform: normalizePlatform(platform),
            appVersion: appVersion || null,
            deviceName: deviceName || null,
            platformUserId: null,
            staffUserId,
            staffId,
            tenantId,
            isActive: true,
            lastRegisteredAt: now,
            lastSeenAt: now
        });

        return record;
    }

    async unregisterUserDevice({ platformUserId, token }) {
        const normalizedToken = normalizeToken(token);
        if (!normalizedToken) {
            return 0;
        }

        const [updatedCount] = await db.MobilePushToken.update({
            isActive: false
        }, {
            where: {
                token: normalizedToken,
                appType: 'customer',
                platformUserId
            }
        });

        return updatedCount;
    }

    async unregisterStaffDevice({ staffUserId, token }) {
        const normalizedToken = normalizeToken(token);
        if (!normalizedToken) {
            return 0;
        }

        const [updatedCount] = await db.MobilePushToken.update({
            isActive: false
        }, {
            where: {
                token: normalizedToken,
                appType: 'staff',
                staffUserId
            }
        });

        return updatedCount;
    }

    async sendToUser(platformUserId, payload) {
        const platformUser = await db.PlatformUser.findByPk(platformUserId, {
            attributes: ['id', 'notificationPreferences']
        });

        if (!platformUser) {
            return { success: false, skipped: true, reason: 'user_not_found', deviceCount: 0, tokenCount: 0, invalidTokenCount: 0 };
        }

        if (platformUser.notificationPreferences?.push === false) {
            return { success: false, skipped: true, reason: 'push_disabled', deviceCount: 0, tokenCount: 0, invalidTokenCount: 0 };
        }

        const devices = await db.MobilePushToken.findAll({
            where: {
                appType: 'customer',
                platformUserId,
                isActive: true
            }
        });

        return this._sendToDevices(devices, payload);
    }

    async sendToStaff(staffId, payload) {
        const devices = await db.MobilePushToken.findAll({
            where: {
                appType: 'staff',
                staffId,
                isActive: true
            }
        });

        return this._sendToDevices(devices, payload);
    }

    async _sendToDevices(devices, payload) {
        const tokens = devices
            .map((device) => normalizeToken(device.token))
            .filter((token) => this.isValidExpoPushToken(token));

        if (tokens.length === 0) {
            return {
                success: false,
                skipped: true,
                reason: 'no_active_tokens',
                deviceCount: devices.length,
                tokenCount: 0,
                invalidTokenCount: 0
            };
        }

        const messages = tokens.map((to) => ({
            to,
            sound: 'default',
            title: sanitizeText(payload.title, 'Rifah'),
            body: sanitizeText(payload.body, ''),
            data: payload.data || {},
            channelId: 'default'
        }));

        try {
            const response = await this._postJson(EXPO_PUSH_HOST, EXPO_PUSH_PATH, messages);
            const parsed = JSON.parse(response.body || '{}');
            let invalidTokenCount = 0;

            if (Array.isArray(parsed.data)) {
                const invalidTokens = [];

                parsed.data.forEach((result, index) => {
                    if (result?.status === 'error' && result?.details?.error === 'DeviceNotRegistered') {
                        invalidTokens.push(tokens[index]);
                    }
                });

                 invalidTokenCount = invalidTokens.length;

                if (invalidTokens.length > 0) {
                    await db.MobilePushToken.update({
                        isActive: false
                    }, {
                        where: {
                            token: { [Op.in]: invalidTokens }
                        }
                    });
                }
            }

            return {
                success: response.statusCode >= 200 && response.statusCode < 300,
                deviceCount: devices.length,
                tokenCount: tokens.length,
                invalidTokenCount,
                response: parsed
            };
        } catch (error) {
            logger.warn('Push notification send failed', {
                error: error.message,
                title: payload.title,
                dataType: payload.data?.type
            });

            return {
                success: false,
                skipped: true,
                reason: 'send_failed',
                error: error.message,
                deviceCount: devices.length,
                tokenCount: tokens.length,
                invalidTokenCount: 0
            };
        }
    }

    _postJson(hostname, path, body) {
        return new Promise((resolve, reject) => {
            const payload = JSON.stringify(body);
            const request = https.request({
                hostname,
                path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    Accept: 'application/json',
                    'Accept-Encoding': 'gzip, deflate'
                }
            }, (response) => {
                let chunks = '';

                response.on('data', (chunk) => {
                    chunks += chunk;
                });

                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode || 500,
                        body: chunks
                    });
                });
            });

            request.on('error', reject);
            request.write(payload);
            request.end();
        });
    }
}

module.exports = new PushNotificationService();

