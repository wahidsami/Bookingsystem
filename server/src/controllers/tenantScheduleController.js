/**
 * Tenant Schedule Controller
 * Manages staff schedules, breaks, time-off, and overrides
 */

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get all shifts for an employee
 * GET /api/v1/tenant/employees/:id/shifts
 */
exports.getShifts = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId } = req.params;

        // Verify employee belongs to tenant
        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if StaffShift model exists
        if (!db.StaffShift) {
            console.error('StaffShift model not found in db object');
            return res.status(500).json({
                success: false,
                message: 'StaffShift model not available',
                error: 'Database model not loaded'
            });
        }

        const shifts = await db.StaffShift.findAll({
            where: { staffId: employeeId, isActive: true },
            order: [
                ['isRecurring', 'DESC'],
                ['dayOfWeek', 'ASC'],
                ['startTime', 'ASC']
            ]
        });

        res.json({
            success: true,
            shifts
        });
    } catch (error) {
        console.error('Get shifts error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            original: error.original
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch shifts',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Create a shift for an employee
 * POST /api/v1/tenant/employees/:id/shifts
 */
exports.createShift = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId } = req.params;
        const {
            dayOfWeek,
            specificDate,
            startTime,
            endTime,
            isRecurring,
            startDate,
            endDate,
            label
        } = req.body;

        // Verify employee belongs to tenant
        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Validate: either dayOfWeek (recurring) or specificDate (one-time)
        if (isRecurring && dayOfWeek === null) {
            return res.status(400).json({
                success: false,
                message: 'dayOfWeek is required for recurring shifts'
            });
        }

        if (!isRecurring && !specificDate) {
            return res.status(400).json({
                success: false,
                message: 'specificDate is required for one-time shifts'
            });
        }

        const shift = await db.StaffShift.create({
            staffId: employeeId,
            dayOfWeek: isRecurring ? dayOfWeek : null,
            specificDate: isRecurring ? null : specificDate,
            startTime,
            endTime,
            isRecurring: isRecurring !== false,
            startDate,
            endDate,
            label
        });

        res.status(201).json({
            success: true,
            message: 'Shift created successfully',
            shift
        });
    } catch (error) {
        console.error('Create shift error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create shift',
            error: error.message
        });
    }
};

/**
 * Update a shift
 * PUT /api/v1/tenant/employees/:id/shifts/:shiftId
 */
exports.updateShift = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId, shiftId } = req.params;

        // Verify employee belongs to tenant
        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const shift = await db.StaffShift.findOne({
            where: { id: shiftId, staffId: employeeId }
        });

        if (!shift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }

        await shift.update(req.body);

        res.json({
            success: true,
            message: 'Shift updated successfully',
            shift
        });
    } catch (error) {
        console.error('Update shift error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update shift',
            error: error.message
        });
    }
};

/**
 * Delete a shift
 * DELETE /api/v1/tenant/employees/:id/shifts/:shiftId
 */
exports.deleteShift = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId, shiftId } = req.params;

        // Verify employee belongs to tenant
        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const shift = await db.StaffShift.findOne({
            where: { id: shiftId, staffId: employeeId }
        });

        if (!shift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }

        await shift.destroy();

        res.json({
            success: true,
            message: 'Shift deleted successfully'
        });
    } catch (error) {
        console.error('Delete shift error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete shift',
            error: error.message
        });
    }
};

/**
 * Get all breaks for an employee
 * GET /api/v1/tenant/employees/:id/breaks
 */
exports.getBreaks = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId } = req.params;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if StaffBreak model exists
        if (!db.StaffBreak) {
            console.error('StaffBreak model not found in db object');
            return res.status(500).json({
                success: false,
                message: 'StaffBreak model not available',
                error: 'Database model not loaded'
            });
        }

        const breaks = await db.StaffBreak.findAll({
            where: { staffId: employeeId, isActive: true },
            order: [
                ['isRecurring', 'DESC'],
                ['dayOfWeek', 'ASC'],
                ['startTime', 'ASC']
            ]
        });

        res.json({
            success: true,
            breaks
        });
    } catch (error) {
        console.error('Get breaks error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            original: error.original
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch breaks',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Create a break
 * POST /api/v1/tenant/employees/:id/breaks
 */
exports.createBreak = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId } = req.params;
        const {
            dayOfWeek,
            specificDate,
            startTime,
            endTime,
            type,
            label,
            isRecurring,
            startDate,
            endDate
        } = req.body;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        if (isRecurring && dayOfWeek === null) {
            return res.status(400).json({
                success: false,
                message: 'dayOfWeek is required for recurring breaks'
            });
        }

        if (!isRecurring && !specificDate) {
            return res.status(400).json({
                success: false,
                message: 'specificDate is required for one-time breaks'
            });
        }

        const breakRecord = await db.StaffBreak.create({
            staffId: employeeId,
            dayOfWeek: isRecurring ? dayOfWeek : null,
            specificDate: isRecurring ? null : specificDate,
            startTime,
            endTime,
            type: type || 'lunch',
            label: label || `${type || 'lunch'} break`,
            isRecurring: isRecurring !== false,
            startDate,
            endDate
        });

        res.status(201).json({
            success: true,
            message: 'Break created successfully',
            break: breakRecord
        });
    } catch (error) {
        console.error('Create break error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create break',
            error: error.message
        });
    }
};

/**
 * Update a break
 * PUT /api/v1/tenant/employees/:id/breaks/:breakId
 */
exports.updateBreak = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId, breakId } = req.params;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const breakRecord = await db.StaffBreak.findOne({
            where: { id: breakId, staffId: employeeId }
        });

        if (!breakRecord) {
            return res.status(404).json({
                success: false,
                message: 'Break not found'
            });
        }

        await breakRecord.update(req.body);

        res.json({
            success: true,
            message: 'Break updated successfully',
            break: breakRecord
        });
    } catch (error) {
        console.error('Update break error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update break',
            error: error.message
        });
    }
};

/**
 * Delete a break
 * DELETE /api/v1/tenant/employees/:id/breaks/:breakId
 */
exports.deleteBreak = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId, breakId } = req.params;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const breakRecord = await db.StaffBreak.findOne({
            where: { id: breakId, staffId: employeeId }
        });

        if (!breakRecord) {
            return res.status(404).json({
                success: false,
                message: 'Break not found'
            });
        }

        await breakRecord.destroy();

        res.json({
            success: true,
            message: 'Break deleted successfully'
        });
    } catch (error) {
        console.error('Delete break error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete break',
            error: error.message
        });
    }
};

/**
 * Get all time-off records for an employee
 * GET /api/v1/tenant/employees/:id/time-off
 */
exports.getTimeOff = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId } = req.params;
        const { startDate, endDate } = req.query;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const where = { staffId: employeeId };
        if (startDate || endDate) {
            where[Op.or] = [
                {
                    startDate: { [Op.between]: [startDate || '1900-01-01', endDate || '2100-12-31'] }
                },
                {
                    endDate: { [Op.between]: [startDate || '1900-01-01', endDate || '2100-12-31'] }
                },
                {
                    [Op.and]: [
                        { startDate: { [Op.lte]: startDate || '1900-01-01' } },
                        { endDate: { [Op.gte]: endDate || '2100-12-31' } }
                    ]
                }
            ];
        }

        // Check if StaffTimeOff model exists
        if (!db.StaffTimeOff) {
            console.warn('StaffTimeOff model not found - returning empty array');
            return res.json({
                success: true,
                timeOff: []
            });
        }

        const timeOff = await db.StaffTimeOff.findAll({
            where,
            order: [['startDate', 'ASC']]
        });

        res.json({
            success: true,
            timeOff
        });
    } catch (error) {
        // If table doesn't exist, return empty array instead of error
        if (error.message && error.message.includes('does not exist')) {
            console.warn('Time-off table does not exist yet - returning empty array');
            return res.json({
                success: true,
                timeOff: []
            });
        }
        console.error('Get time-off error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            original: error.original
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch time-off',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Create time-off
 * POST /api/v1/tenant/employees/:id/time-off
 */
exports.createTimeOff = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId } = req.params;
        const { startDate, endDate, type, reason } = req.body;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'startDate and endDate are required'
            });
        }

        // Check for overlapping time-off
        const overlapping = await db.StaffTimeOff.findOne({
            where: {
                staffId: employeeId,
                [Op.or]: [
                    {
                        [Op.and]: [
                            { startDate: { [Op.lte]: startDate } },
                            { endDate: { [Op.gte]: startDate } }
                        ]
                    },
                    {
                        [Op.and]: [
                            { startDate: { [Op.lte]: endDate } },
                            { endDate: { [Op.gte]: endDate } }
                        ]
                    },
                    {
                        [Op.and]: [
                            { startDate: { [Op.gte]: startDate } },
                            { endDate: { [Op.lte]: endDate } }
                        ]
                    }
                ]
            }
        });

        if (overlapping) {
            return res.status(409).json({
                success: false,
                message: 'Time-off overlaps with existing time-off period'
            });
        }

        const timeOff = await db.StaffTimeOff.create({
            staffId: employeeId,
            startDate,
            endDate,
            type: type || 'vacation',
            reason,
            isApproved: true // Auto-approve for now
        });

        res.status(201).json({
            success: true,
            message: 'Time-off created successfully',
            timeOff
        });
    } catch (error) {
        console.error('Create time-off error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create time-off',
            error: error.message
        });
    }
};

/**
 * Update time-off
 * PUT /api/v1/tenant/employees/:id/time-off/:timeOffId
 */
exports.updateTimeOff = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId, timeOffId } = req.params;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const timeOff = await db.StaffTimeOff.findOne({
            where: { id: timeOffId, staffId: employeeId }
        });

        if (!timeOff) {
            return res.status(404).json({
                success: false,
                message: 'Time-off not found'
            });
        }

        await timeOff.update(req.body);

        res.json({
            success: true,
            message: 'Time-off updated successfully',
            timeOff
        });
    } catch (error) {
        console.error('Update time-off error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update time-off',
            error: error.message
        });
    }
};

/**
 * Delete time-off
 * DELETE /api/v1/tenant/employees/:id/time-off/:timeOffId
 */
exports.deleteTimeOff = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId, timeOffId } = req.params;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const timeOff = await db.StaffTimeOff.findOne({
            where: { id: timeOffId, staffId: employeeId }
        });

        if (!timeOff) {
            return res.status(404).json({
                success: false,
                message: 'Time-off not found'
            });
        }

        await timeOff.destroy();

        res.json({
            success: true,
            message: 'Time-off deleted successfully'
        });
    } catch (error) {
        console.error('Delete time-off error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete time-off',
            error: error.message
        });
    }
};

/**
 * Get all schedule overrides for an employee
 * GET /api/v1/tenant/employees/:id/overrides
 */
exports.getOverrides = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId } = req.params;
        const { startDate, endDate } = req.query;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const where = { staffId: employeeId };
        if (startDate && endDate) {
            where.date = { [Op.between]: [startDate, endDate] };
        } else if (startDate) {
            where.date = { [Op.gte]: startDate };
        } else if (endDate) {
            where.date = { [Op.lte]: endDate };
        }

        // Check if StaffScheduleOverride model exists
        if (!db.StaffScheduleOverride) {
            console.warn('StaffScheduleOverride model not found - returning empty array');
            return res.json({
                success: true,
                overrides: []
            });
        }

        const overrides = await db.StaffScheduleOverride.findAll({
            where,
            order: [['date', 'ASC']]
        });

        res.json({
            success: true,
            overrides
        });
    } catch (error) {
        // If table doesn't exist, return empty array instead of error
        if (error.message && error.message.includes('does not exist')) {
            console.warn('Overrides table does not exist yet - returning empty array');
            return res.json({
                success: true,
                overrides: []
            });
        }
        console.error('Get overrides error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            original: error.original
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch overrides',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Create schedule override
 * POST /api/v1/tenant/employees/:id/overrides
 */
exports.createOverride = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId } = req.params;
        const { date, type, startTime, endTime, isAvailable, reason } = req.body;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'date is required'
            });
        }

        // Check if override already exists for this date
        const existing = await db.StaffScheduleOverride.findOne({
            where: { staffId: employeeId, date }
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Override already exists for this date. Use update instead.'
            });
        }

        const override = await db.StaffScheduleOverride.create({
            staffId: employeeId,
            date,
            type: type || 'override',
            startTime: isAvailable !== false ? (startTime || null) : null,
            endTime: isAvailable !== false ? (endTime || null) : null,
            isAvailable: isAvailable !== false,
            reason
        });

        res.status(201).json({
            success: true,
            message: 'Override created successfully',
            override
        });
    } catch (error) {
        console.error('Create override error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create override',
            error: error.message
        });
    }
};

/**
 * Update schedule override
 * PUT /api/v1/tenant/employees/:id/overrides/:overrideId
 */
exports.updateOverride = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId, overrideId } = req.params;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const override = await db.StaffScheduleOverride.findOne({
            where: { id: overrideId, staffId: employeeId }
        });

        if (!override) {
            return res.status(404).json({
                success: false,
                message: 'Override not found'
            });
        }

        await override.update(req.body);

        res.json({
            success: true,
            message: 'Override updated successfully',
            override
        });
    } catch (error) {
        console.error('Update override error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update override',
            error: error.message
        });
    }
};

/**
 * Delete schedule override
 * DELETE /api/v1/tenant/employees/:id/overrides/:overrideId
 */
exports.deleteOverride = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id: employeeId, overrideId } = req.params;

        const employee = await db.Staff.findOne({
            where: { id: employeeId, tenantId }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const override = await db.StaffScheduleOverride.findOne({
            where: { id: overrideId, staffId: employeeId }
        });

        if (!override) {
            return res.status(404).json({
                success: false,
                message: 'Override not found'
            });
        }

        await override.destroy();

        res.json({
            success: true,
            message: 'Override deleted successfully'
        });
    } catch (error) {
        console.error('Delete override error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete override',
            error: error.message
        });
    }
};

