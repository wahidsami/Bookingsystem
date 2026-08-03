/**
 * User Service
 * Handles PlatformUser lookup, creation, and management
 */

const crypto = require('crypto');
const db = require('../models');
const { Op } = require('sequelize');
const { linkPendingGiftRecipients } = require('./giftRecipientLinkingService');

class UserService {
    async generateGuestEmailPlaceholder() {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidate = `guest+${Date.now()}${crypto.randomInt(1000, 9999)}@guest.refah.local`;
            const existing = await db.PlatformUser.findOne({
                where: { email: candidate }
            });

            if (!existing) {
                return candidate;
            }
        }

        return `guest+${Date.now()}@guest.refah.local`;
    }

    async generateGuestPhonePlaceholder() {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidate = `+99${crypto.randomInt(100000000000, 999999999999)}`;
            const existing = await db.PlatformUser.findOne({
                where: { phone: candidate }
            });

            if (!existing) {
                return candidate;
            }
        }

        return `+99${String(Date.now()).slice(-12)}`;
    }

    /**
     * Find or create PlatformUser from customer info
     * Used for public bookings where user may not have an account
     * 
     * @param {Object} userData - { email, phone, firstName, lastName }
     * @returns {Promise<PlatformUser>}
     */
    async findOrCreatePlatformUser({ email, phone, firstName, lastName }, options = {}) {
        const transaction = options.transaction || null;
        const forensicTrace = options.forensicTrace || null;
        const sqlLogger = forensicTrace?.sqlLogger || null;
        const trimmedFirstName = `${firstName || ''}`.trim();
        const trimmedLastName = `${lastName || ''}`.trim();

        if (!phone && !email && !trimmedFirstName) {
            throw new Error('Phone, email, or customer name is required');
        }

        // Try to find by email or phone
        const where = {};
        if (email) {
            where.email = email.toLowerCase().trim();
        }
        if (phone) {
            where.phone = phone.trim();
        }

        let user = await db.PlatformUser.findOne({
            where: {
                [Op.or]: Object.keys(where).map(key => ({ [key]: where[key] }))
            },
            ...(sqlLogger ? { logging: sqlLogger } : {})
        });

        if (!user) {
            // Create a soft account with a generated password so DB constraints are satisfied.
            const generatedPassword = `guest_${crypto.randomBytes(24).toString('hex')}`;
            const normalizedEmail = email ? email.toLowerCase().trim() : await this.generateGuestEmailPlaceholder();
            const normalizedPhone = phone ? phone.trim() : await this.generateGuestPhonePlaceholder();
            const userData = {
                email: normalizedEmail,
                phone: normalizedPhone,
                firstName: trimmedFirstName || 'Guest',
                lastName: trimmedLastName || 'User',
                emailVerified: false,
                phoneVerified: false,
                password: generatedPassword,
                isActive: true,
                // Password can be reset or claimed later by support flows.
            };

            user = await db.PlatformUser.create(userData, {
                ...(transaction ? { transaction } : {}),
                ...(sqlLogger ? { logging: sqlLogger } : {})
            });

            // Link any pending gifts that were sent to this email/phone before the account existed.
            await linkPendingGiftRecipients({
                platformUserId: user.id,
                email: userData.email,
                phone: userData.phone
            }).catch((error) => {
                if (forensicTrace) {
                    forensicTrace.log('Exception', {
                        scope: 'userService.linkPendingGiftRecipients',
                        userId: user.id,
                        message: error?.message || String(error),
                        stack: error?.stack || null
                    });
                } else {
                    console.error('[UserService] Failed to reconcile gift recipients after platform user creation', {
                        userId: user.id,
                        error: error?.message || error
                    });
                }
            });
        } else {
            // Update info if provided and missing
            const updates = {};
            if (firstName && !user.firstName) updates.firstName = firstName;
            if (lastName && !user.lastName) updates.lastName = lastName;
            if (email && !user.email) updates.email = email.toLowerCase().trim();
            if (phone && !user.phone) updates.phone = phone.trim();

            if (Object.keys(updates).length > 0) {
                await user.update(updates, {
                    ...(transaction ? { transaction } : {}),
                    ...(sqlLogger ? { logging: sqlLogger } : {})
                });
            }
        }

        return user;
    }

    /**
     * Check if user exists by email or phone
     * @param {string} email 
     * @param {string} phone 
     * @returns {Promise<PlatformUser|null>}
     */
    async findUserByEmailOrPhone(email, phone, options = {}) {
        const where = {};
        const forensicTrace = options.forensicTrace || null;
        const sqlLogger = forensicTrace?.sqlLogger || null;
        if (email) {
            where.email = email.toLowerCase().trim();
        }
        if (phone) {
            where.phone = phone.trim();
        }

        if (Object.keys(where).length === 0) {
            return null;
        }

        return await db.PlatformUser.findOne({
            where: {
                [Op.or]: Object.keys(where).map(key => ({ [key]: where[key] }))
            },
            ...(sqlLogger ? { logging: sqlLogger } : {})
        });
    }
}

module.exports = new UserService();

