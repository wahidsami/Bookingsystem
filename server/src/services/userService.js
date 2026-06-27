/**
 * User Service
 * Handles PlatformUser lookup, creation, and management
 */

const crypto = require('crypto');
const db = require('../models');
const { Op } = require('sequelize');
const { linkPendingGiftRecipients } = require('./giftRecipientLinkingService');

class UserService {
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
        if (!phone && !email) {
            throw new Error('Phone or email is required');
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
            }
        });

        if (!user) {
            // Create a soft account with a generated password so DB constraints are satisfied.
            const generatedPassword = `guest_${crypto.randomBytes(24).toString('hex')}`;
            const userData = {
                email: email ? email.toLowerCase().trim() : null,
                phone: phone ? phone.trim() : null,
                firstName: firstName || 'Guest',
                lastName: lastName || 'User',
                emailVerified: false,
                phoneVerified: false,
                password: generatedPassword,
                isActive: true,
                // Password can be reset or claimed later by support flows.
            };

            // PlatformUser model requires phone, so generate a valid placeholder if missing
            if (!userData.phone && userData.email) {
                userData.phone = await this.generateGuestPhonePlaceholder();
            } else if (!userData.phone) {
                throw new Error('Phone number is required');
            }

            user = await db.PlatformUser.create(userData, transaction ? { transaction } : undefined);

            // Link any pending gifts that were sent to this email/phone before the account existed.
            await linkPendingGiftRecipients({
                platformUserId: user.id,
                email: userData.email,
                phone: userData.phone
            }).catch((error) => {
                console.error('[UserService] Failed to reconcile gift recipients after platform user creation', {
                    userId: user.id,
                    error: error?.message || error
                });
            });
        } else {
            // Update info if provided and missing
            const updates = {};
            if (firstName && !user.firstName) updates.firstName = firstName;
            if (lastName && !user.lastName) updates.lastName = lastName;
            if (email && !user.email) updates.email = email.toLowerCase().trim();
            if (phone && !user.phone) updates.phone = phone.trim();

            if (Object.keys(updates).length > 0) {
                await user.update(updates, transaction ? { transaction } : undefined);
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
    async findUserByEmailOrPhone(email, phone) {
        const where = {};
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
            }
        });
    }
}

module.exports = new UserService();

