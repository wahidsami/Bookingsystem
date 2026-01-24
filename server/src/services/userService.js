/**
 * User Service
 * Handles PlatformUser lookup, creation, and management
 */

const db = require('../models');
const { Op } = require('sequelize');

class UserService {
    /**
     * Find or create PlatformUser from customer info
     * Used for public bookings where user may not have an account
     * 
     * @param {Object} userData - { email, phone, firstName, lastName }
     * @returns {Promise<PlatformUser>}
     */
    async findOrCreatePlatformUser({ email, phone, firstName, lastName }) {
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
            // Create soft account (no password, can claim later)
            const userData = {
                email: email ? email.toLowerCase().trim() : null,
                phone: phone ? phone.trim() : null,
                firstName: firstName || 'Guest',
                lastName: lastName || 'User',
                emailVerified: false,
                phoneVerified: false,
                isActive: true,
                // No password set - user can claim account later via email/SMS
            };

            // PlatformUser model requires phone, so generate a placeholder if missing
            if (!userData.phone && userData.email) {
                // Use email as temporary phone (will need to be updated)
                userData.phone = `temp_${Date.now()}@email`;
            } else if (!userData.phone) {
                throw new Error('Phone number is required');
            }

            user = await db.PlatformUser.create(userData);
        } else {
            // Update info if provided and missing
            const updates = {};
            if (firstName && !user.firstName) updates.firstName = firstName;
            if (lastName && !user.lastName) updates.lastName = lastName;
            if (email && !user.email) updates.email = email.toLowerCase().trim();
            if (phone && !user.phone) updates.phone = phone.trim();

            if (Object.keys(updates).length > 0) {
                await user.update(updates);
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

