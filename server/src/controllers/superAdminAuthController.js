const db = require('../models');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rifah-super-admin-secret-key-2024';
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/**
 * Super Admin Login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find admin by email
        const admin = await db.SuperAdmin.findOne({ where: { email: email.toLowerCase() } });

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Contact system administrator.'
            });
        }

        // Verify password
        const isValidPassword = await admin.verifyPassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { 
                adminId: admin.id, 
                email: admin.email, 
                role: admin.role,
                type: 'super_admin'
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const refreshToken = jwt.sign(
            { adminId: admin.id, type: 'refresh_super_admin' },
            JWT_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
        );

        // Update last login
        await admin.update({
            lastLoginAt: new Date(),
            lastLoginIP: req.ip || req.connection.remoteAddress
        });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'super_admin',
            entityId: admin.id,
            action: 'login',
            performedByType: 'super_admin',
            performedById: admin.id,
            performedByName: `${admin.firstName} ${admin.lastName}`,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            admin: admin.toSafeObject()
        });

    } catch (error) {
        console.error('Super Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

/**
 * Refresh Token
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.type !== 'refresh_super_admin') {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Find admin
        const admin = await db.SuperAdmin.findByPk(decoded.adminId);

        if (!admin || !admin.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Admin not found or deactivated'
            });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { 
                adminId: admin.id, 
                email: admin.email, 
                role: admin.role,
                type: 'super_admin'
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            accessToken,
            admin: admin.toSafeObject()
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token'
        });
    }
};

/**
 * Get Current Admin Profile
 */
const getProfile = async (req, res) => {
    try {
        const admin = await db.SuperAdmin.findByPk(req.adminId);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        res.json({
            success: true,
            admin: admin.toSafeObject()
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
};

/**
 * Logout (invalidate session - for logging purposes)
 */
const logout = async (req, res) => {
    try {
        // Log activity
        await db.ActivityLog.create({
            entityType: 'super_admin',
            entityId: req.adminId,
            action: 'logout',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
};

/**
 * Change Password
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current and new passwords are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        const admin = await db.SuperAdmin.findByPk(req.adminId);

        const isValidPassword = await admin.verifyPassword(currentPassword);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        await admin.update({ password: newPassword });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'super_admin',
            entityId: admin.id,
            action: 'password_change',
            performedByType: 'super_admin',
            performedById: admin.id,
            performedByName: `${admin.firstName} ${admin.lastName}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
};

module.exports = {
    login,
    refreshToken,
    getProfile,
    logout,
    changePassword
};

