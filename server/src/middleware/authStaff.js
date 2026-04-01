const jwt = require('jsonwebtoken');
const db = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateStaff = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No staff token provided. Please login.'
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.type !== 'staff' || !decoded.userId || !decoded.staffId || !decoded.tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid staff token'
            });
        }

        const [staffUser, staff] = await Promise.all([
            db.User.findByPk(decoded.userId),
            db.Staff.findByPk(decoded.staffId)
        ]);

        if (!staffUser || staffUser.role !== 'staff' || staffUser.tenantId !== decoded.tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Staff account is no longer valid'
            });
        }

        if (!staff || staff.tenantId !== decoded.tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Staff profile not found'
            });
        }

        if (!staff.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Staff account is inactive'
            });
        }

        req.staffUser = staffUser;
        req.staff = staff;
        req.staffId = staff.id;
        req.tenantId = staff.tenantId;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired staff token',
            error: error.message
        });
    }
};

module.exports = {
    authenticateStaff
};
