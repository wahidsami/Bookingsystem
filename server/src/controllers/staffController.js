const db = require('../models');

/**
 * Get all staff members
 */
const getStaff = async (req, res) => {
    try {
        const { isActive } = req.query;

        const where = {};
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const staff = await db.Staff.findAll({
            where,
            include: [{ model: db.Service, as: 'services' }]
        });

        res.json({ staff, count: staff.length });
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new staff member
 */
const createStaff = async (req, res) => {
    try {
        const staff = await db.Staff.create(req.body);
        res.status(201).json({ message: 'Staff created', staff });
    } catch (error) {
        console.error('Create staff error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get staff availability for a specific date
 */
const getStaffAvailability = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ message: 'date parameter is required' });
        }

        const dayOfWeek = new Date(date).getDay();

        const schedule = await db.StaffSchedule.findAll({
            where: {
                staffId,
                dayOfWeek,
                isAvailable: true
            }
        });

        res.json({ schedule });
    } catch (error) {
        console.error('Get staff availability error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getStaff,
    createStaff,
    getStaffAvailability
};
