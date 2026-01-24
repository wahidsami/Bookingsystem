const db = require('../models');
const { Op } = require('sequelize');

/**
 * List all platform users
 */
const listUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            isVerified,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        // Apply filters
        if (isVerified !== undefined) {
            where.emailVerified = isVerified === 'true';
        }

        // Search
        if (search) {
            where[Op.or] = [
                { email: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } },
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows: users } = await db.PlatformUser.findAndCountAll({
            where,
            attributes: { exclude: ['password'] },
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            users,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
};

/**
 * Get user details
 */
const getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.PlatformUser.findByPk(id, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's bookings (with error handling)
        let bookings = [];
        try {
            bookings = await db.Appointment.findAll({
                where: { platformUserId: id },
                include: [
                    { 
                        model: db.Service, 
                        attributes: ['id', 'name_en', 'name_ar'],
                        required: false
                    },
                    { 
                        model: db.Staff, 
                        attributes: ['id', 'name'],
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: 20
            });
        } catch (bookingsError) {
            console.error('Error fetching bookings:', bookingsError.message);
            bookings = [];
        }

        // Get user's transactions (with error handling)
        let transactions = [];
        try {
            transactions = await db.Transaction.findAll({
                where: { platformUserId: id },
                order: [['createdAt', 'DESC']],
                limit: 20
            });
        } catch (transError) {
            console.error('Error fetching transactions:', transError.message);
            transactions = [];
        }

        // Get user's payment methods (with error handling)
        let paymentMethods = [];
        try {
            paymentMethods = await db.PaymentMethod.findAll({
                where: { platformUserId: id, isActive: true }
            });
        } catch (paymentError) {
            console.error('Error fetching payment methods:', paymentError.message);
            paymentMethods = [];
        }

        // Get activity logs (with error handling)
        let activities = [];
        try {
            activities = await db.ActivityLog.findAll({
                where: {
                    entityType: 'platform_user',
                    entityId: id
                },
                order: [['createdAt', 'DESC']],
                limit: 30
            });
        } catch (activityError) {
            console.error('Error fetching activities:', activityError.message);
            activities = [];
        }

        // Calculate stats (with error handling)
        let totalBookings = 0;
        let completedBookings = 0;
        let totalSpent = 0;
        
        try {
            totalBookings = await db.Appointment.count({ where: { platformUserId: id } });
        } catch (countError) {
            console.error('Error counting bookings:', countError.message);
        }
        
        try {
            completedBookings = await db.Appointment.count({ 
                where: { platformUserId: id, status: 'completed' } 
            });
        } catch (countError) {
            console.error('Error counting completed bookings:', countError.message);
        }
        
        try {
            let totalSpentRaw = await db.Transaction.sum('amount', {
                where: { platformUserId: id, status: 'completed', type: 'booking' }
            });
            
            // Handle DECIMAL conversion - Sequelize returns strings for DECIMAL fields
            totalSpent = totalSpentRaw ? parseFloat(totalSpentRaw) : 0;
            totalSpent = parseFloat(totalSpent.toFixed(2));
        } catch (sumError) {
            console.error('Error calculating total spent:', sumError.message);
            totalSpent = 0;
        }

        res.json({
            success: true,
            user,
            bookings,
            transactions,
            paymentMethods,
            activities,
            stats: {
                totalBookings,
                completedBookings,
                totalSpent,
                loyaltyPoints: user.loyaltyPoints || 0,
                walletBalance: parseFloat(user.walletBalance || 0)
            }
        });

    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user details',
            error: error.message
        });
    }
};

/**
 * Update user (admin actions)
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const user = await db.PlatformUser.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Store previous values
        const previousValue = user.toJSON();
        delete previousValue.password;

        // Allowed fields for admin to update
        const allowedFields = [
            'firstName', 'lastName', 'emailVerified', 'phoneVerified',
            'loyaltyPoints', 'walletBalance', 'isActive'
        ];

        const filteredUpdates = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        }

        await user.update(filteredUpdates);

        // Log activity
        await db.ActivityLog.create({
            entityType: 'platform_user',
            entityId: user.id,
            action: 'updated',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            previousValue,
            newValue: filteredUpdates,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'User updated',
            user: user.toJSON()
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message
        });
    }
};

/**
 * Deactivate/Activate user
 */
const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, reason } = req.body;

        const user = await db.PlatformUser.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await user.update({ isActive });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'platform_user',
            entityId: user.id,
            action: isActive ? 'activated' : 'suspended',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            details: { reason },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'}`
        });

    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status',
            error: error.message
        });
    }
};

/**
 * Adjust user wallet/loyalty points
 */
const adjustUserBalance = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, amount, reason } = req.body;

        if (!['wallet', 'loyalty'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be "wallet" or "loyalty"'
            });
        }

        if (!amount || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Amount and reason are required'
            });
        }

        const user = await db.PlatformUser.findByPk(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const field = type === 'wallet' ? 'walletBalance' : 'loyaltyPoints';
        const currentValue = parseFloat(user[field] || 0);
        const newValue = currentValue + parseFloat(amount);

        if (newValue < 0) {
            return res.status(400).json({
                success: false,
                message: 'Resulting balance cannot be negative'
            });
        }

        await user.update({ [field]: newValue });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'platform_user',
            entityId: user.id,
            action: 'updated',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            previousValue: { [field]: currentValue },
            newValue: { [field]: newValue },
            details: { type, amount, reason },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: `User ${type} adjusted`,
            previousValue: currentValue,
            newValue,
            adjustment: parseFloat(amount)
        });

    } catch (error) {
        console.error('Adjust user balance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to adjust balance',
            error: error.message
        });
    }
};

module.exports = {
    listUsers,
    getUserDetails,
    updateUser,
    toggleUserStatus,
    adjustUserBalance
};

