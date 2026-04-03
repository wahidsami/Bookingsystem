const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../models');
const pushNotificationService = require('../services/pushNotificationService');
const {
    STAFF_APPOINTMENT_TRANSITIONS,
    canTransitionAppointmentStatus,
    isValidAppointmentStatus,
    normalizeAppointmentStatus
} = require('../utils/appointmentStatus');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const buildStartOfDay = (value) => {
    const date = value ? new Date(`${value}T00:00:00.000Z`) : new Date();
    date.setUTCHours(0, 0, 0, 0);
    return date;
};

const buildEndOfDay = (value) => {
    const date = buildStartOfDay(value);
    date.setUTCHours(23, 59, 59, 999);
    return date;
};

const normalizeEmail = (value) => value.trim().toLowerCase();

const createAccessToken = (staffUser, staff) => jwt.sign({
    type: 'staff',
    userId: staffUser.id,
    tenantId: staff.tenantId,
    staffId: staff.id,
    email: staffUser.email
}, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
});

const createRefreshToken = (staffUser, staff) => jwt.sign({
    type: 'staff',
    isRefresh: true,
    userId: staffUser.id,
    tenantId: staff.tenantId,
    staffId: staff.id,
    email: staffUser.email
}, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN
});

const buildStaffPayload = async (staff) => {
    const tenant = await db.Tenant.findByPk(staff.tenantId, {
        attributes: ['id', 'name', 'name_en', 'name_ar', 'businessType', 'city', 'logo']
    });

    return {
        id: staff.id,
        tenantId: staff.tenantId,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        nationality: staff.nationality,
        bio: staff.bio,
        experience: staff.experience,
        skills: Array.isArray(staff.skills) ? staff.skills : [],
        photo: staff.photo,
        rating: staff.rating,
        totalBookings: staff.totalBookings,
        salary: staff.salary,
        commissionRate: staff.commissionRate,
        isActive: staff.isActive,
        tenant: tenant ? {
            id: tenant.id,
            businessName: tenant.name_ar || tenant.name_en || tenant.name,
            businessType: tenant.businessType,
            city: tenant.city,
            logo: tenant.logo
        } : null
    };
};

const getLinkedStaffForUser = async (staffUser) => {
    const normalizedEmail = normalizeEmail(staffUser.email);
    const staff = await db.Staff.findOne({
        where: {
            tenantId: staffUser.tenantId,
            email: normalizedEmail
        }
    });

    if (!staff) {
        throw new Error('No staff profile is linked to this account');
    }

    if (!staff.isActive) {
        throw new Error('This staff profile is inactive');
    }

    return staff;
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const staffUser = await db.User.findOne({
            where: {
                email: normalizedEmail,
                role: 'staff'
            }
        });

        if (!staffUser) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const isValidPassword = await staffUser.validatePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const staff = await getLinkedStaffForUser(staffUser);
        const staffPayload = await buildStaffPayload(staff);

        res.json({
            success: true,
            message: 'Staff login successful',
            accessToken: createAccessToken(staffUser, staff),
            refreshToken: createRefreshToken(staffUser, staff),
            staff: staffPayload
        });
    } catch (error) {
        const status = error.message === 'This staff profile is inactive' ? 403 : 401;
        res.status(status).json({
            success: false,
            message: error.message || 'Staff login failed'
        });
    }
};

const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        if (decoded.type !== 'staff' || !decoded.isRefresh) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        const staffUser = await db.User.findByPk(decoded.userId);
        if (!staffUser || staffUser.role !== 'staff' || staffUser.tenantId !== decoded.tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Staff account not found'
            });
        }

        const staff = await getLinkedStaffForUser(staffUser);

        res.json({
            success: true,
            accessToken: createAccessToken(staffUser, staff),
            refreshToken: createRefreshToken(staffUser, staff)
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token'
        });
    }
};

const logout = async (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
};

const getMe = async (req, res) => {
    try {
        const staff = await db.Staff.findByPk(req.staffId);
        const staffPayload = await buildStaffPayload(staff);

        res.json({
            success: true,
            staff: staffPayload
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load staff profile',
            error: error.message
        });
    }
};

const getAppointments = async (req, res) => {
    try {
        const { date } = req.query;
        const dayStart = buildStartOfDay(date);
        const dayEnd = buildEndOfDay(date);

        const appointments = await db.Appointment.findAll({
            where: {
                tenantId: req.tenantId,
                staffId: req.staffId,
                startTime: {
                    [Op.between]: [dayStart, dayEnd]
                }
            },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'finalPrice', 'rawPrice', 'image']
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage'],
                    required: false
                }
            ],
            order: [['startTime', 'ASC']]
        });

        res.json({
            success: true,
            appointments,
            date: dayStart.toISOString().split('T')[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load staff appointments',
            error: error.message
        });
    }
};

const getSchedule = async (req, res) => {
    try {
        const { date } = req.query;
        const dayStart = buildStartOfDay(date);
        const dayEnd = buildEndOfDay(date);
        const dateKey = dayStart.toISOString().split('T')[0];
        const dayOfWeek = dayStart.getUTCDay();

        const [shifts, breaks, timeOff] = await Promise.all([
            db.StaffShift.findAll({
                where: {
                    staffId: req.staffId,
                    isActive: true,
                    [Op.or]: [
                        { specificDate: dateKey },
                        {
                            isRecurring: true,
                            dayOfWeek,
                            [Op.and]: [
                                {
                                    [Op.or]: [
                                        { startDate: null },
                                        { startDate: { [Op.lte]: dateKey } }
                                    ]
                                },
                                {
                                    [Op.or]: [
                                        { endDate: null },
                                        { endDate: { [Op.gte]: dateKey } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                order: [['startTime', 'ASC']]
            }),
            db.StaffBreak.findAll({
                where: {
                    staffId: req.staffId,
                    isActive: true,
                    [Op.or]: [
                        { specificDate: dateKey },
                        {
                            isRecurring: true,
                            dayOfWeek,
                            [Op.and]: [
                                {
                                    [Op.or]: [
                                        { startDate: null },
                                        { startDate: { [Op.lte]: dateKey } }
                                    ]
                                },
                                {
                                    [Op.or]: [
                                        { endDate: null },
                                        { endDate: { [Op.gte]: dateKey } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                order: [['startTime', 'ASC']]
            }),
            db.StaffTimeOff.findAll({
                where: {
                    staffId: req.staffId,
                    startDate: { [Op.lte]: dateKey },
                    endDate: { [Op.gte]: dateKey }
                },
                order: [['startDate', 'ASC']]
            })
        ]);

        res.json({
            success: true,
            schedule: {
                date: dateKey,
                shifts,
                breaks,
                timeOff,
                hasTimeOff: timeOff.length > 0,
                workingWindow: shifts.map((shift) => ({
                    id: shift.id,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    label: shift.label
                }))
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load staff schedule',
            error: error.message
        });
    }
};

const updateAppointmentStatus = async (req, res) => {
    const transaction = await db.sequelize.transaction();

    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const normalizedStatus = normalizeAppointmentStatus(status);

        if (!status || !isValidAppointmentStatus(normalizedStatus)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Invalid staff appointment status update'
            });
        }

        const appointment = await db.Appointment.findOne({
            where: {
                id,
                tenantId: req.tenantId,
                staffId: req.staffId
            },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'finalPrice', 'rawPrice', 'image'],
                    required: false
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage'],
                    required: false
                }
            ],
            transaction
        });

        if (!appointment) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        const currentStatus = appointment.status;
        if (
            currentStatus !== normalizedStatus &&
            !canTransitionAppointmentStatus(
                currentStatus,
                normalizedStatus,
                STAFF_APPOINTMENT_TRANSITIONS
            )
        ) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot change appointment from ${currentStatus} to ${normalizedStatus}`
            });
        }

        appointment.status = normalizedStatus;
        if (notes !== undefined) {
            appointment.notes = notes;
        }

        await appointment.save({ transaction });
        await transaction.commit();

        try {
            await pushNotificationService.sendToUser(appointment.platformUserId, {
                title: 'Booking updated',
                body: `Your appointment is now ${normalizedStatus.replace(/_/g, ' ')}.`,
                data: {
                    type: 'booking_status_updated',
                    appointmentId: appointment.id,
                    status: normalizedStatus
                }
            });
        } catch (notificationError) {
            console.warn('Staff booking status notification warning:', notificationError.message);
        }

        res.json({
            success: true,
            message: 'Appointment status updated successfully',
            appointment
        });
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({
            success: false,
            message: 'Failed to update staff appointment status',
            error: error.message
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long'
            });
        }

        const isValidPassword = await req.staffUser.validatePassword(currentPassword);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        req.staffUser.password = newPassword;
        await req.staffUser.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update password',
            error: error.message
        });
    }
};

const registerPushToken = async (req, res) => {
    try {
        const { token, platform, appVersion, deviceName } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Push token is required'
            });
        }

        await pushNotificationService.registerStaffDevice({
            staffUserId: req.staffUser.id,
            staffId: req.staffId,
            tenantId: req.tenantId,
            token,
            platform,
            appVersion,
            deviceName
        });

        res.json({
            success: true,
            message: 'Staff push token registered successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to register push token'
        });
    }
};

const unregisterPushToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Push token is required'
            });
        }

        await pushNotificationService.unregisterStaffDevice({
            staffUserId: req.staffUser.id,
            token
        });

        res.json({
            success: true,
            message: 'Staff push token unregistered successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to unregister push token'
        });
    }
};

module.exports = {
    login,
    refreshToken,
    logout,
    getMe,
    getAppointments,
    getSchedule,
    updateAppointmentStatus,
    changePassword,
    registerPushToken,
    unregisterPushToken
};
