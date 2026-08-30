const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../models');
const pushNotificationService = require('../services/pushNotificationService');
const notificationOrchestrator = require('../services/notificationOrchestratorService');
const { getActiveSubscriptionForTenant } = require('../services/tenantSubscriptionService');
const appointmentLifecycleService = require('../services/appointmentLifecycleService');
const availabilityService = require('../services/availabilityService');
const { normalizePackageEntitlements, isFeatureEnabled } = require('../utils/packageEntitlements');
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
const DEFAULT_STAFF_PERMISSIONS = {
    view_earnings: false,
    view_reviews: true,
    reply_reviews: false,
    view_clients: false,
    view_booking_notes: false,
    can_start_service: true,
    can_mark_no_show: true
};
const STAFF_BLOCKING_SESSION_STATUSES = Object.freeze(['pending', 'confirmed', 'checked_in', 'in_service']);

const toValidDate = (value) => {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
};

const getStaffPermissions = async (staffId) => {
    const permissionRecord = await db.StaffPermission.findOne({
        where: { staffId },
        attributes: ['permissions']
    });

    return {
        ...DEFAULT_STAFF_PERMISSIONS,
        ...(permissionRecord?.permissions || {})
    };
};

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

const buildTodayKey = () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
};

const buildCurrentWeekStart = () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diffToMonday = (today.getUTCDay() + 6) % 7;
    today.setUTCDate(today.getUTCDate() - diffToMonday);
    return today;
};

const buildScheduleVisibilityBounds = (scheduleVisibilityWeeks = 1) => {
    const weekCount = [1, 2, 3, 4].includes(Number(scheduleVisibilityWeeks))
        ? Number(scheduleVisibilityWeeks)
        : 1;
    const weekStart = buildCurrentWeekStart();
    const visibleEnd = new Date(weekStart);
    visibleEnd.setUTCDate(visibleEnd.getUTCDate() + (weekCount * 7) - 1);
    visibleEnd.setUTCHours(23, 59, 59, 999);

    return {
        visibleFrom: weekStart.toISOString().split('T')[0],
        visibleUntil: visibleEnd.toISOString().split('T')[0],
    };
};

const parseClockToMinutes = (value) => {
    if (!value || typeof value !== 'string') return null;
    const parts = value.split(':');
    if (parts.length < 2) return null;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return (hours * 60) + minutes;
};

const resolveDisplayHoursFromWorkingHours = (workingHours) => {
    const DEFAULT = { startMinute: 6 * 60, endMinute: 22 * 60 };
    if (!workingHours || typeof workingHours !== 'object') {
        return DEFAULT;
    }

    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const opens = [];
    const closes = [];

    dayKeys.forEach((dayKey) => {
        const day = workingHours[dayKey];
        if (!day || day.isOpen === false) return;
        const open = parseClockToMinutes(day.open || day.startTime || day.from);
        const close = parseClockToMinutes(day.close || day.endTime || day.to);
        if (open !== null) opens.push(open);
        if (close !== null) closes.push(close);
    });

    if (opens.length === 0 || closes.length === 0) {
        return DEFAULT;
    }

    const startMinute = Math.max(0, Math.min(...opens));
    const endMinute = Math.min(24 * 60, Math.max(...closes));
    if (endMinute <= startMinute) {
        return DEFAULT;
    }

    return { startMinute, endMinute };
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

const buildStaffFeatureFlags = (packageLimits = {}) => {
    const normalizedLimits = normalizePackageEntitlements(packageLimits || {});
    const messagingEntitled = Boolean(normalizedLimits.hasInternalMessaging);
    const earningsEntitled = isFeatureEnabled(normalizedLimits.payroll);
    const pushEntitled = Boolean(normalizedLimits.hasPushNotifications) || Boolean(normalizedLimits.pushNotifications);

    return {
        today: true,
        schedule: true,
        profile: true,
        messages: messagingEntitled,
        earnings: earningsEntitled,
        reviews: true,
        timeOff: true,
        clientNotes: true,
        pushNotifications: pushEntitled || true,
        entitlements: {
            internalMessaging: messagingEntitled,
            payroll: earningsEntitled,
            pushNotifications: pushEntitled,
        }
    };
};

const buildStaffPayload = async (staff, staffUser = null) => {
    const [tenant, permissionRecord, subscriptionResult] = await Promise.all([
        db.Tenant.findByPk(staff.tenantId, {
            attributes: ['id', 'name', 'name_en', 'name_ar', 'businessType', 'city', 'logo']
        }),
        db.StaffPermission.findOne({
            where: { staffId: staff.id },
            attributes: ['permissions']
        }),
        getActiveSubscriptionForTenant(staff.tenantId)
    ]);

    const permissions = {
        ...DEFAULT_STAFF_PERMISSIONS,
        ...(permissionRecord?.permissions || {})
    };
    const features = buildStaffFeatureFlags(subscriptionResult?.package?.limits || {});

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
        scheduleVisibilityWeeks: Number(staff.scheduleVisibilityWeeks || 1),
        isActive: staff.isActive,
        must_change_password: Boolean(staffUser?.must_change_password),
        permissions,
        features,
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
        const staffPayload = await buildStaffPayload(staff, staffUser);

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
        const staffPayload = await buildStaffPayload(staff, req.staffUser);

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
        const tenantSettings = await db.TenantSettings.findOne({
            where: { tenantId: req.tenantId },
            attributes: ['timezone']
        });
        const timezone = tenantSettings?.timezone || 'Asia/Riyadh';
        const { startOfDay: dayStart, endOfDay: dayEnd } = availabilityService._getTimeZoneDayRange(date, timezone);
        const dateKey = dayStart.toISOString().split('T')[0];
        const dayOfWeek = dayStart.getUTCDay();

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

        const permissions = await getStaffPermissions(req.staffId);
        const canViewNotes = permissions.view_booking_notes;

        const processedAppointments = appointments.map(app => {
            const appointmentData = app.toJSON ? app.toJSON() : app;
            if (!canViewNotes) {
                delete appointmentData.notes;
            }
            return appointmentData;
        });

        const breaks = await db.StaffBreak.findAll({
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
        });

        res.json({
            success: true,
            appointments: processedAppointments,
            breaks,
            date: dateKey
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load staff appointments',
            error: error.message
        });
    }
};

const getReviews = async (req, res) => {
    try {
        const permissions = await getStaffPermissions(req.staffId);
        if (!permissions.view_reviews) {
            return res.status(403).json({
                success: false,
                message: 'Review access is not enabled for this employee account'
            });
        }

        const reviews = await db.Review.findAll({
            where: {
                tenantId: req.tenantId,
                staffId: req.staffId
            },
            order: [['createdAt', 'DESC']]
        });

        const avgRating = reviews.length > 0
            ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
            : null;

        const distribution = reviews.reduce((acc, review) => {
            const rating = Number(review.rating || 0);
            if (rating >= 1 && rating <= 5) {
                acc[rating] = (acc[rating] || 0) + 1;
            }
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                reviews,
                avgRating,
                distribution,
                total: reviews.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load staff reviews',
            error: error.message
        });
    }
};

const getMessages = async (req, res) => {
    try {
        const subscriptionResult = await getActiveSubscriptionForTenant(req.tenantId);
        const features = buildStaffFeatureFlags(subscriptionResult?.package?.limits || {});

        if (!features.messages) {
            return res.status(403).json({
                success: false,
                message: 'Internal messaging is not enabled for this tenant subscription'
            });
        }

        const messages = await db.StaffMessage.findAll({
            where: {
                tenantId: req.tenantId,
                senderType: 'admin',
                [Op.or]: [
                    { recipientId: null },
                    { recipientId: req.staffId }
                ]
            },
            order: [['isPinned', 'DESC'], ['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load staff messages',
            error: error.message
        });
    }
};

const getClientSummary = async (req, res) => {
    try {
        const permissions = await getStaffPermissions(req.staffId);
        if (!permissions.view_clients) {
            return res.status(403).json({
                success: false,
                message: 'Client access is not enabled for this employee account'
            });
        }

        const customer = await db.PlatformUser.findByPk(req.params.id, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage']
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const [insight, appointments] = await Promise.all([
            db.CustomerInsight.findOne({
                where: {
                    platformUserId: customer.id,
                    tenantId: req.tenantId
                }
            }),
            db.Appointment.findAll({
                where: {
                    tenantId: req.tenantId,
                    platformUserId: customer.id
                },
                include: [
                    {
                        model: db.Service,
                        as: 'service',
                        attributes: ['id', 'name_en', 'name_ar', 'finalPrice', 'rawPrice'],
                        required: false
                    },
                    {
                        model: db.Staff,
                        as: 'staff',
                        attributes: ['id', 'name'],
                        required: false
                    }
                ],
                order: [['startTime', 'DESC']],
                limit: 6
            })
        ]);

        const totalVisits = Number(insight?.totalBookings || appointments.length || 0);
        const totalSpent = Number(insight?.totalSpent || 0);
        const completedVisits = appointments.filter((item) => item.status === 'completed').length;
        const recentAppointments = appointments.map((appointment) => ({
            id: appointment.id,
            startTime: appointment.startTime,
            status: appointment.status,
            price: appointment.price,
            notes: appointment.notes,
            service: appointment.service ? {
                id: appointment.service.id,
                name_en: appointment.service.name_en,
                name_ar: appointment.service.name_ar,
            } : null,
            staff: appointment.staff ? {
                id: appointment.staff.id,
                name: appointment.staff.name
            } : null
        }));

        res.json({
            success: true,
            data: {
                customer: {
                    id: customer.id,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    phone: customer.phone,
                    profileImage: customer.profileImage
                },
                summary: {
                    totalVisits,
                    completedVisits,
                    totalSpent,
                    lastVisit: insight?.lastVisit || recentAppointments[0]?.startTime || null,
                    firstVisit: insight?.firstVisit || null,
                    loyaltyTier: insight?.loyaltyTier || 'bronze',
                    loyaltyPoints: Number(insight?.tenantLoyaltyPoints || 0),
                    averageBookingValue: Number(insight?.averageBookingValue || 0),
                    noShowCount: Number(insight?.noShowCount || 0),
                    cancellationCount: Number(insight?.cancellationCount || 0),
                    notes: insight?.notes || '',
                    tags: Array.isArray(insight?.tags) ? insight.tags : [],
                    isRepeatClient: totalVisits > 1
                },
                recentAppointments
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load client summary',
            error: error.message
        });
    }
};

const markMessageAsRead = async (req, res) => {
    try {
        const message = await db.StaffMessage.findOne({
            where: {
                id: req.params.id,
                tenantId: req.tenantId,
                senderType: 'admin',
                [Op.or]: [
                    { recipientId: null },
                    { recipientId: req.staffId }
                ]
            }
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        const readBy = Array.isArray(message.readBy) ? message.readBy.map((value) => `${value}`) : [];
        if (!readBy.includes(req.staffId)) {
            readBy.push(req.staffId);
            await message.update({ readBy });
        }

        res.json({
            success: true,
            data: message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update message status',
            error: error.message
        });
    }
};

const getEarnings = async (req, res) => {
    try {
        const permissions = await getStaffPermissions(req.staffId);
        if (!permissions.view_earnings) {
            return res.status(403).json({
                success: false,
                message: 'Earnings access is not enabled for this employee account'
            });
        }

        const payrolls = await db.StaffPayroll.findAll({
            where: {
                tenantId: req.tenantId,
                staffId: req.staffId
            },
            order: [['periodStart', 'DESC'], ['createdAt', 'DESC']]
        });

        const totals = payrolls.reduce((acc, payroll) => {
            const base = Number(payroll.baseSalary || 0);
            const commission = Number(payroll.commission || 0);
            const tips = Number(payroll.tipsTotal || 0);
            const bonuses = Number(payroll.bonuses || 0);
            const deductions = Number(payroll.deductions || 0);
            const totalNet = base + commission + tips + bonuses - deductions;

            acc.totalBase += base;
            acc.totalCommission += commission;
            acc.totalTips += tips;
            acc.totalBonuses += bonuses;
            acc.totalDeductions += deductions;
            acc.totalNet += totalNet;
            return acc;
        }, {
            totalBase: 0,
            totalCommission: 0,
            totalTips: 0,
            totalBonuses: 0,
            totalDeductions: 0,
            totalNet: 0,
        });

        const currentMonth = payrolls.length > 0 ? payrolls[0] : null;

        res.json({
            success: true,
            data: {
                payrolls,
                totals,
                currentMonth
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load staff earnings',
            error: error.message
        });
    }
};

const replyToReview = async (req, res) => {
    try {
        const permissions = await getStaffPermissions(req.staffId);
        if (!permissions.reply_reviews) {
            return res.status(403).json({
                success: false,
                message: 'Review reply access is not enabled for this employee account'
            });
        }

        const review = await db.Review.findOne({
            where: {
                id: req.params.id,
                tenantId: req.tenantId,
                staffId: req.staffId
            }
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        const trimmedReply = typeof req.body?.staffReply === 'string'
            ? req.body.staffReply.trim()
            : '';

        await review.update({
            staffReply: trimmedReply || null,
            staffRepliedAt: trimmedReply ? new Date() : null
        });

        res.json({
            success: true,
            data: review
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update review reply',
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
        const staffProfile = await db.Staff.findOne({
            where: {
                id: req.staffId,
                tenantId: req.tenantId
            },
            attributes: ['id', 'scheduleVisibilityWeeks']
        });

        if (!staffProfile) {
            return res.status(404).json({
                success: false,
                message: 'Staff profile not found'
            });
        }

        const visibility = buildScheduleVisibilityBounds(staffProfile.scheduleVisibilityWeeks);
        if (dateKey < visibility.visibleFrom || dateKey > visibility.visibleUntil) {
            return res.status(403).json({
                success: false,
                message: `Schedule visibility is limited to ${staffProfile.scheduleVisibilityWeeks || 1} week(s) from the current week`,
                visibleFrom: visibility.visibleFrom,
                visibleUntil: visibility.visibleUntil,
            });
        }

        const [shifts, breaks, timeOff, tenant] = await Promise.all([
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
                        },
                        {
                            isRecurring: true,
                            dayOfWeek: null,
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
            }),
            db.Tenant.findByPk(req.tenantId, {
                attributes: ['workingHours']
            })
        ]);

        const displayHours = resolveDisplayHoursFromWorkingHours(tenant?.workingHours);

        res.json({
            success: true,
            schedule: {
                date: dateKey,
                shifts,
                breaks,
                timeOff,
                hasTimeOff: timeOff.length > 0,
                displayHours,
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

const getTimeOffRequests = async (req, res) => {
    try {
        const timeOff = await db.StaffTimeOff.findAll({
            where: {
                staffId: req.staffId
            },
            order: [['startDate', 'DESC'], ['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            data: timeOff
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load time off requests',
            error: error.message
        });
    }
};

const requestTimeOff = async (req, res) => {
    try {
        const { startDate, endDate, type, reason } = req.body || {};

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'startDate and endDate are required'
            });
        }

        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: 'End date cannot be before start date'
            });
        }

        const todayKey = buildTodayKey();
        if (startDate < todayKey) {
            return res.status(400).json({
                success: false,
                message: 'Time off cannot start in the past'
            });
        }

        const overlapping = await db.StaffTimeOff.findOne({
            where: {
                staffId: req.staffId,
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
                message: 'Time off overlaps with an existing request'
            });
        }

        const timeOff = await db.StaffTimeOff.create({
            staffId: req.staffId,
            startDate,
            endDate,
            type: type || 'vacation',
            reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
            isApproved: true,
            approvedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Time off request submitted successfully',
            data: timeOff
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to submit time off request',
            error: error.message
        });
    }
};

const cancelTimeOffRequest = async (req, res) => {
    try {
        const timeOff = await db.StaffTimeOff.findOne({
            where: {
                id: req.params.id,
                staffId: req.staffId
            }
        });

        if (!timeOff) {
            return res.status(404).json({
                success: false,
                message: 'Time off request not found'
            });
        }

        const todayKey = buildTodayKey();
        if (timeOff.startDate < todayKey) {
            return res.status(400).json({
                success: false,
                message: 'Past or active time off requests cannot be cancelled'
            });
        }

        await timeOff.destroy();

        res.json({
            success: true,
            message: 'Time off request cancelled successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to cancel time off request',
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

        const permissions = await getStaffPermissions(req.staffId);

        if (normalizedStatus === 'in_service' && !permissions.can_start_service) {
            await transaction.rollback();
            return res.status(403).json({
                success: false,
                message: 'Starting appointments is not enabled for this employee account'
            });
        }

        if (normalizedStatus === 'no_show' && !permissions.can_mark_no_show) {
            await transaction.rollback();
            return res.status(403).json({
                success: false,
                message: 'Marking no-shows is not enabled for this employee account'
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

        if (normalizedStatus === 'in_service' && currentStatus !== 'in_service') {
            const startAt = toValidDate(appointment.startTime);
            const endAt = toValidDate(appointment.endTime);
            if (!startAt || !endAt || endAt.getTime() <= startAt.getTime()) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Appointment time is invalid. Please contact admin support.'
                });
            }

            const overlappingAppointment = await db.Appointment.findOne({
                where: {
                    tenantId: req.tenantId,
                    staffId: req.staffId,
                    id: { [Op.ne]: appointment.id },
                    status: { [Op.in]: STAFF_BLOCKING_SESSION_STATUSES },
                    startTime: { [Op.lt]: endAt },
                    endTime: { [Op.gt]: startAt }
                },
                attributes: ['id', 'status', 'startTime', 'endTime'],
                order: [['startTime', 'ASC']],
                transaction
            });

            if (overlappingAppointment) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    message: 'Cannot start this appointment because it overlaps with another active or upcoming appointment.'
                });
            }

            const now = new Date();
            if (now.getTime() > endAt.getTime()) {
                const activeOrUpcomingSession = await db.Appointment.findOne({
                    where: {
                        tenantId: req.tenantId,
                        staffId: req.staffId,
                        id: { [Op.ne]: appointment.id },
                        status: { [Op.in]: STAFF_BLOCKING_SESSION_STATUSES },
                        endTime: { [Op.gt]: now }
                    },
                    attributes: ['id', 'status', 'startTime', 'endTime'],
                    order: [['startTime', 'ASC']],
                    transaction
                });

                if (activeOrUpcomingSession) {
                    await transaction.rollback();
                    return res.status(409).json({
                        success: false,
                        message: 'This appointment window has already passed, and you already have another active or upcoming session.'
                    });
                }
            }
        }

        appointment.status = normalizedStatus;
        if (notes !== undefined) {
            appointment.notes = notes;
        }
        if (normalizedStatus === 'in_service' && !appointment.serviceStartedAt) {
            appointment.serviceStartedAt = new Date();
        }
        if (normalizedStatus === 'completed' && !appointment.serviceCompletedAt) {
            appointment.serviceCompletedAt = new Date();
        }

        await appointment.save({ transaction });
        await transaction.commit();

        try {
            if (normalizedStatus === 'in_service') {
                await appointmentLifecycleService.notifyServiceStarted(appointment);
            } else if (normalizedStatus === 'completed') {
                await appointmentLifecycleService.notifyServiceCompleted(appointment);
            } else {
                await notificationOrchestrator.notifyCustomer({
                    tenantId: appointment.tenantId,
                    platformUserId: appointment.platformUserId,
                    eventType: 'booking_status_updated',
                    title: 'Booking updated',
                    body: `Your appointment is now ${normalizedStatus.replace(/_/g, ' ')}.`,
                    data: {
                        type: 'booking_status_updated',
                        appointmentId: appointment.id,
                        status: normalizedStatus
                    }
                });
            }
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
    getEarnings,
    getReviews,
    getMessages,
    getClientSummary,
    markMessageAsRead,
    getSchedule,
    getTimeOffRequests,
    requestTimeOff,
    cancelTimeOffRequest,
    updateAppointmentStatus,
    replyToReview,
    changePassword,
    registerPushToken,
    unregisterPushToken
};
