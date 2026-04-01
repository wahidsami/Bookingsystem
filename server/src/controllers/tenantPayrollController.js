const db = require('../models');
const { Op } = require('sequelize');

exports.getAllReviews = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { staffId, status } = req.query;
        const where = { tenantId };

        if (staffId) {
            where.staffId = staffId;
        }
        if (status === 'visible') {
            where.isVisible = true;
        } else if (status === 'hidden') {
            where.isVisible = false;
        }

        const reviews = await db.Review.findAll({
            where,
            include: [{ model: db.Staff, as: 'staff', attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC']]
        });

        const avgRating = reviews.length > 0
            ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
            : null;

        res.status(200).json({
            success: true,
            data: {
                reviews,
                avgRating,
                total: reviews.length
            }
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        const { isVisible, staffReply } = req.body;

        const review = await db.Review.findOne({
            where: { id, tenantId }
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        const updates = {};
        if (typeof isVisible === 'boolean') {
            updates.isVisible = isVisible;
        }
        if (staffReply !== undefined) {
            const trimmed = typeof staffReply === 'string' ? staffReply.trim() : '';
            updates.staffReply = trimmed || null;
            updates.staffRepliedAt = trimmed ? new Date() : null;
        }

        await review.update(updates);

        res.status(200).json({
            success: true,
            data: review
        });
    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.getPayrollRecords = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate, employeeId, status } = req.query;
        const where = { tenantId };

        if (employeeId) {
            where.staffId = employeeId;
        }
        if (status) {
            where.status = status;
        }
        if (startDate || endDate) {
            where.periodStart = {};
            if (startDate) {
                where.periodStart[Op.gte] = startDate;
            }
            if (endDate) {
                where.periodStart[Op.lte] = endDate;
            }
        }

        const records = await db.StaffPayroll.findAll({
            where,
            include: [{ model: db.Staff, as: 'staff', attributes: ['id', 'name'] }],
            order: [['periodStart', 'DESC'], ['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: records
        });
    } catch (error) {
        console.error('Error fetching payroll:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.generatePayroll = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const {
            staffId,
            periodStart,
            periodEnd,
            baseSalary,
            commission,
            tipsTotal,
            bonuses,
            deductions,
            notes
        } = req.body;

        if (!staffId || !periodStart || !periodEnd) {
            return res.status(400).json({
                success: false,
                message: 'staffId, periodStart and periodEnd are required'
            });
        }

        const staff = await db.Staff.findOne({
            where: { id: staffId, tenantId }
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }

        const [payroll, created] = await db.StaffPayroll.findOrCreate({
            where: { staffId, tenantId, periodStart },
            defaults: {
                staffId,
                tenantId,
                periodStart,
                periodEnd,
                baseSalary: baseSalary || 0,
                commission: commission || 0,
                tipsTotal: tipsTotal || 0,
                bonuses: bonuses || 0,
                deductions: deductions || 0,
                notes: notes || null,
                status: 'draft'
            }
        });

        if (!created) {
            await payroll.update({
                periodEnd,
                baseSalary: baseSalary || 0,
                commission: commission || 0,
                tipsTotal: tipsTotal || 0,
                bonuses: bonuses || 0,
                deductions: deductions || 0,
                notes: notes || null
            });
        }

        res.status(created ? 201 : 200).json({
            success: true,
            data: payroll
        });
    } catch (error) {
        console.error('Error generating payroll:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.updatePayrollStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        const { status } = req.body;
        const validStatuses = ['draft', 'processed', 'paid'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        const payroll = await db.StaffPayroll.findOne({
            where: { id, tenantId }
        });

        if (!payroll) {
            return res.status(404).json({
                success: false,
                message: 'Payroll record not found'
            });
        }

        await payroll.update({
            status,
            paidAt: status === 'paid' ? new Date() : payroll.paidAt
        });

        res.status(200).json({
            success: true,
            data: payroll
        });
    } catch (error) {
        console.error('Error updating payroll status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
