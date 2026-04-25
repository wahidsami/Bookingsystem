/**
 * Tenant Appointment Controller
 * Handles appointment management for authenticated tenants
 */

const db = require('../models');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const pushNotificationService = require('../services/pushNotificationService');
const customerNotificationService = require('../services/customerNotificationService');
const bookingService = require('../services/bookingService');
const { calculateSplitPayment } = require('../services/splitPaymentService');
const userService = require('../services/userService');
const {
    createAppointmentTransaction,
    resolveLedgerPaymentMethod
} = require('../services/paymentTransactionLedgerService');
const {
    TENANT_APPOINTMENT_TRANSITIONS,
    canTransitionAppointmentStatus,
    isValidAppointmentStatus,
    normalizeAppointmentStatus
} = require('../utils/appointmentStatus');

function parseDateValue(value, endOfDay = false) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (endOfDay) {
            date.setHours(23, 59, 59, 999);
        } else {
            date.setHours(0, 0, 0, 0);
        }
    }

    return date;
}

function buildDateRangeWhere(field, startDate, endDate) {
    const start = parseDateValue(startDate, false);
    const end = parseDateValue(endDate, true);

    if (!start && !end) {
        return {};
    }

    const filter = {};
    if (start) {
        filter[Op.gte] = start;
    }
    if (end) {
        filter[Op.lte] = end;
    }

    return {
        [field]: filter
    };
}

function parseBoardDate(value) {
    if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildBreakDateTime(date, timeValue) {
    if (!date || !timeValue) {
        return null;
    }

    const safeTime = `${timeValue}`.slice(0, 8);
    return `${date}T${safeTime}`;
}

async function resolveAppointmentCustomer({ platformUserId, customer, transaction }) {
    if (platformUserId) {
        const existingUser = await db.PlatformUser.findByPk(platformUserId, { transaction });
        if (!existingUser) {
            throw new Error('Customer not found');
        }
        if (!existingUser.isActive) {
            throw new Error('Customer account is inactive');
        }
        if (existingUser.isBanned) {
            throw new Error('Customer account is banned');
        }
        return existingUser;
    }

    const normalizedCustomer = customer || {};
    const firstName = `${normalizedCustomer.firstName || ''}`.trim();
    const lastName = `${normalizedCustomer.lastName || ''}`.trim();
    const email = `${normalizedCustomer.email || ''}`.trim().toLowerCase();
    const phone = `${normalizedCustomer.phone || ''}`.trim();
    const password = `${normalizedCustomer.password || ''}`;

    if (!firstName || !lastName || !email || !phone || !password) {
        throw new Error('Customer details are required when no existing customer is selected');
    }

    const existingUser = await userService.findUserByEmailOrPhone(email, phone);
    if (existingUser) {
        if (!existingUser.isActive) {
            throw new Error('Customer account is inactive');
        }
        if (existingUser.isBanned) {
            throw new Error('Customer account is banned');
        }

        const updates = {};
        if (!existingUser.firstName && firstName) updates.firstName = firstName;
        if (!existingUser.lastName && lastName) updates.lastName = lastName;
        if (!existingUser.gender && normalizedCustomer.gender) updates.gender = normalizedCustomer.gender;
        if (!existingUser.dateOfBirth && normalizedCustomer.dateOfBirth) updates.dateOfBirth = normalizedCustomer.dateOfBirth;

        if (Object.keys(updates).length > 0) {
            await existingUser.update(updates, { transaction });
        }

        return existingUser;
    }

    return await db.PlatformUser.create({
        email,
        phone,
        password,
        firstName,
        lastName,
        gender: normalizedCustomer.gender || null,
        dateOfBirth: normalizedCustomer.dateOfBirth || null,
        emailVerified: false,
        phoneVerified: false,
        isActive: true
    }, { transaction });
}

/**
 * Create a new appointment from the tenant dashboard
 * POST /api/v1/tenant/appointments
 */
exports.createAppointment = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const {
            serviceId,
            variantId,
            staffId,
            requestedStaffId,
            startTime,
            notes,
            paymentMethod,
            platformUserId,
            customer,
            assignmentMode
        } = req.body || {};

        if (!serviceId || !startTime) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'serviceId and startTime are required'
            });
        }

        const customerUser = await resolveAppointmentCustomer({
            platformUserId,
            customer,
            transaction
        });

        const appointment = await bookingService.createBooking({
            serviceId,
            variantId: variantId || null,
            staffId: staffId || null,
            requestedStaffId: requestedStaffId || null,
            platformUserId: customerUser.id,
            tenantId,
            startTime,
            notes,
            paymentMethod,
            assignmentMode: assignmentMode || (staffId ? 'tenant_reassigned' : undefined),
            skipAdvanceValidation: true
        }, { transaction });

        const fullAppointment = await db.Appointment.findByPk(appointment.id, {
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'category', 'image', 'paymentOptions'],
                    required: true
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name', 'photo', 'phone', 'email'],
                    required: true
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'gender', ['profileImage', 'photo']],
                    required: false
                }
            ],
            transaction
        });

        await transaction.commit();

        try {
            const serviceName = fullAppointment?.service?.name_en || fullAppointment?.service?.name_ar || 'service';
            const customerName = `${customerUser.firstName || ''} ${customerUser.lastName || ''}`.trim() || 'A customer';
            const appointmentDate = new Date(appointment.startTime).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });

            await pushNotificationService.sendToUser(customerUser.id, {
                title: 'Booking confirmed',
                body: `Your ${serviceName} booking for ${appointmentDate} is confirmed.`,
                data: {
                    type: 'booking_created',
                    appointmentId: appointment.id,
                    tenantId,
                    staffId: appointment.staffId
                }
            });

            await customerNotificationService.sendCustomerInboxNotification(
                tenantId,
                customerUser.id,
                'New appointment booked',
                `Your ${serviceName} appointment for ${appointmentDate} has been scheduled.`,
                {
                    type: 'appointment_created',
                    appointmentId: appointment.id,
                    bookingReference: appointment.bookingReference || fullAppointment?.bookingNumber || null,
                    serviceId: appointment.serviceId,
                    staffId: appointment.staffId,
                    imageUrl: fullAppointment?.service?.image || '',
                    linkType: 'tenant'
                }
            );

            await pushNotificationService.sendToStaff(appointment.staffId, {
                title: 'New appointment assigned',
                body: `${customerName} booked ${serviceName} for ${appointmentDate}.`,
                data: {
                    type: 'staff_appointment_assigned',
                    appointmentId: appointment.id,
                    tenantId,
                    platformUserId: customerUser.id
                }
            });
        } catch (notificationError) {
            console.warn('Tenant appointment notification warning:', notificationError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Appointment created successfully',
            appointment: fullAppointment
        });
    } catch (error) {
        try {
            if (transaction && !transaction.finished) {
                await transaction.rollback();
            }
        } catch (rollbackError) {
            console.warn('Create appointment rollback warning:', rollbackError.message);
        }
        console.error('Create appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create appointment',
            error: error.message
        });
    }
};

/**
 * Get all appointments for the authenticated tenant
 * GET /api/v1/tenant/appointments
 */
exports.getAppointments = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { 
            startDate, 
            endDate, 
            staffId, 
            serviceId, 
            status,
            paymentStatus,
            platformUserId,
            page = 1,
            limit = 50
        } = req.query;

        const where = {};
        
        // Filter by tenant (through service or staff)
        // We need to ensure appointments belong to this tenant
        // Since appointments link to services and staff, we'll filter through those

        // Build date range filter
        Object.assign(where, buildDateRangeWhere('startTime', startDate, endDate));

        if (staffId) {
            where.staffId = staffId;
        }

        if (serviceId) {
            where.serviceId = serviceId;
        }

        if (status) {
            where.status = status;
        }

        if (paymentStatus) {
            where.paymentStatus = paymentStatus;
        }

        if (platformUserId) {
            where.platformUserId = platformUserId;
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Get appointments with related data
        const { count, rows: appointments } = await db.Appointment.findAndCountAll({
            where,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId }, // Ensure service belongs to tenant
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'category', 'image'],
                    required: true
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    where: { tenantId }, // Ensure staff belongs to tenant
                    attributes: ['id', 'name', 'photo', 'phone', 'email'],
                    required: true
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', ['profileImage', 'photo']],
                    required: false
                }
            ],
            order: [['startTime', 'ASC']],
            limit: parseInt(limit),
            offset: offset
        });

        res.json({
            success: true,
            appointments,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointments',
            error: error.message
        });
    }
};

/**
 * Get appointments for calendar view (grouped by date)
 * GET /api/v1/tenant/appointments/calendar
 */
exports.getCalendarAppointments = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate, staffId } = req.query;

        const where = {};
        
        // Build date range filter
        Object.assign(where, buildDateRangeWhere('startTime', startDate, endDate));

        if (staffId) {
            where.staffId = staffId;
        }

        const appointments = await db.Appointment.findAll({
            where,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'category', 'image'],
                    required: true
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    where: { tenantId },
                    attributes: ['id', 'name', 'photo'],
                    required: true
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', ['profileImage', 'photo']],
                    required: false
                }
            ],
            order: [['startTime', 'ASC']]
        });

        // Group appointments by date
        const groupedByDate = {};
        appointments.forEach(appointment => {
            const dateKey = appointment.startTime.toISOString().split('T')[0];
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = [];
            }
            groupedByDate[dateKey].push(appointment);
        });

        res.json({
            success: true,
            appointments: groupedByDate,
            total: appointments.length
        });
    } catch (error) {
        console.error('Get calendar appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar appointments',
            error: error.message
        });
    }
};

/**
 * Get appointments board data for a single day.
 * Includes appointments plus resolved employee breaks for the same date.
 * GET /api/v1/tenant/appointments/board
 */
exports.getAppointmentsBoard = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const {
            date,
            staffId,
            serviceId,
            status,
            paymentStatus
        } = req.query;

        const selectedDate = parseBoardDate(date);
        if (!selectedDate) {
            return res.status(400).json({
                success: false,
                message: 'A valid date (YYYY-MM-DD) is required'
            });
        }

        const dateKey = date;
        const dayStart = new Date(`${dateKey}T00:00:00`);
        const dayEnd = new Date(`${dateKey}T23:59:59.999`);
        const dayOfWeek = selectedDate.getDay();

        const appointmentWhere = {
            startTime: {
                [Op.between]: [dayStart, dayEnd]
            }
        };

        if (staffId) {
            appointmentWhere.staffId = staffId;
        }

        if (serviceId) {
            appointmentWhere.serviceId = serviceId;
        }

        if (status) {
            appointmentWhere.status = status;
        }

        if (paymentStatus) {
            appointmentWhere.paymentStatus = paymentStatus;
        }

        const appointments = await db.Appointment.findAll({
            where: appointmentWhere,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'category', 'image'],
                    required: true
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    where: { tenantId },
                    attributes: ['id', 'name', 'photo', 'phone', 'email'],
                    required: true
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', ['profileImage', 'photo']],
                    required: false
                }
            ],
            order: [['startTime', 'ASC']]
        });

        const activeStaffWhere = {
            tenantId,
            isActive: true
        };

        if (staffId) {
            activeStaffWhere.id = staffId;
        }

        const boardStaff = await db.Staff.findAll({
            where: activeStaffWhere,
            attributes: ['id']
        });

        const boardStaffIds = boardStaff.map((staffMember) => staffMember.id);
        let breaks = [];

        if (boardStaffIds.length > 0) {
            breaks = await db.StaffBreak.findAll({
                where: {
                    staffId: { [Op.in]: boardStaffIds },
                    isActive: true,
                    [Op.or]: [
                        {
                            isRecurring: false,
                            specificDate: dateKey
                        },
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
        }

        const mappedBreaks = breaks.map((breakRecord) => ({
            id: breakRecord.id,
            staffId: breakRecord.staffId,
            type: breakRecord.type,
            label: breakRecord.label,
            isRecurring: breakRecord.isRecurring,
            specificDate: breakRecord.specificDate,
            dayOfWeek: breakRecord.dayOfWeek,
            startTime: breakRecord.startTime,
            endTime: breakRecord.endTime,
            startDateTime: buildBreakDateTime(dateKey, breakRecord.startTime),
            endDateTime: buildBreakDateTime(dateKey, breakRecord.endTime)
        }));

        res.json({
            success: true,
            date: dateKey,
            appointments,
            breaks: mappedBreaks
        });
    } catch (error) {
        console.error('Get appointments board error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointments board',
            error: error.message
        });
    }
};

/**
 * Get a single appointment by ID
 * GET /api/v1/tenant/appointments/:id
 */
exports.getAppointment = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const appointment = await db.Appointment.findOne({
            where: { id },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    attributes: ['id', 'name_en', 'name_ar', 'description_en', 'description_ar', 'duration', 'category', 'image', 'rawPrice', 'taxRate', 'commissionRate', 'finalPrice'],
                    required: true
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    where: { tenantId },
                    attributes: ['id', 'name', 'photo', 'phone', 'email', 'commissionRate'],
                    required: true
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', ['profileImage', 'photo']],
                    required: false
                },
                {
                    model: db.PaymentTransaction,
                    as: 'paymentTransactions',
                    include: [
                        {
                            model: db.Staff,
                            as: 'processor',
                            attributes: ['id', 'name'],
                            required: false
                        }
                    ],
                    required: false
                }
            ]
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        res.json({
            success: true,
            appointment
        });
    } catch (error) {
        console.error('Get appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointment',
            error: error.message
        });
    }
};

/**
 * Update appointment status
 * PATCH /api/v1/tenant/appointments/:id/status
 */
exports.updateAppointmentStatus = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { status, notes } = req.body;
        const normalizedStatus = normalizeAppointmentStatus(status);

        if (!isValidAppointmentStatus(normalizedStatus)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const appointment = await db.Appointment.findOne({
            where: { id },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true
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

        if (
            appointment.status !== normalizedStatus &&
            !canTransitionAppointmentStatus(
                appointment.status,
                normalizedStatus,
                TENANT_APPOINTMENT_TRANSITIONS
            )
        ) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot change appointment from ${appointment.status} to ${normalizedStatus}`
            });
        }

        appointment.status = normalizedStatus;
        if (notes !== undefined) {
            appointment.notes = notes;
        }
        if (normalizedStatus === 'no_show' && !appointment.noShowMarkedAt) {
            appointment.noShowMarkedAt = new Date();
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
            console.warn('Tenant booking status notification warning:', notificationError.message);
        }

        res.json({
            success: true,
            message: 'Appointment status updated successfully',
            appointment
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Update appointment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update appointment status',
            error: error.message
        });
    }
};

/**
 * Update payment status
 * PATCH /api/v1/tenant/appointments/:id/payment
 */
exports.updatePaymentStatus = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { paymentStatus, paymentMethod, transactionRef, notes } = req.body;

        const validPaymentStatuses = [
            APPOINTMENT_PAYMENT_STATUS.PENDING,
            APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID,
            APPOINTMENT_PAYMENT_STATUS.FULLY_PAID,
            APPOINTMENT_PAYMENT_STATUS.REFUNDED,
            APPOINTMENT_PAYMENT_STATUS.PARTIALLY_REFUNDED
        ];
        if (!validPaymentStatuses.includes(paymentStatus)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Invalid payment status'
            });
        }

        const appointment = await db.Appointment.findOne({
            where: { id },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true
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

        const previousTotalPaid = parseFloat(appointment.totalPaid || 0);
        const previousPaymentStatus = appointment.paymentStatus;

        appointment.paymentStatus = paymentStatus;
        if (paymentMethod) {
            appointment.paymentMethod = paymentMethod;
        }
        if (paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID) {
            appointment.paidAt = new Date();
            appointment.depositAmount = 0;
            appointment.depositPaid = true;
            appointment.remainderAmount = 0;
            appointment.remainderPaid = true;
            appointment.totalPaid = appointment.price;
        } else if (paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID) {
            appointment.depositPaid = true;
            appointment.remainderPaid = false;
            if (!appointment.depositAmount || parseFloat(appointment.depositAmount) === 0) {
                const splitPayment = await calculateSplitPayment(tenantId, appointment.price || 0);
                appointment.depositAmount = splitPayment.depositAmount;
                appointment.remainderAmount = splitPayment.remainderAmount;
                appointment.totalPaid = splitPayment.depositAmount;
            }
            appointment.paidAt = appointment.paidAt || new Date();
        } else if (paymentStatus === APPOINTMENT_PAYMENT_STATUS.PENDING) {
            appointment.paidAt = null;
            appointment.depositPaid = false;
            appointment.remainderPaid = false;
            appointment.totalPaid = 0;
        }

        await appointment.save({ transaction });

        const nextTotalPaid = parseFloat(appointment.totalPaid || 0);
        const paymentDelta = parseFloat((nextTotalPaid - previousTotalPaid).toFixed(2));

        if (paymentDelta > 0) {
            const transactionType = paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                ? 'deposit'
                : previousPaymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                    ? 'remainder'
                    : 'full';

            await createAppointmentTransaction({
                appointmentId: appointment.id,
                type: transactionType,
                amount: paymentDelta,
                paymentMethod: resolveLedgerPaymentMethod(
                    paymentMethod || appointment.paymentMethod,
                    paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID
                        ? appointment.paymentMethod || 'cash'
                        : 'cash'
                ),
                status: 'completed',
                transactionRef: transactionRef || `APT-PAY-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`,
                processedBy: null,
                processedAt: appointment.paidAt || new Date(),
                notes: notes || (paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                    ? 'Deposit collected from tenant dashboard'
                    : 'Full payment collected from tenant dashboard'),
                metadata: {
                    source: 'tenant_appointment_payment_status_update',
                    previousTotalPaid,
                    nextTotalPaid,
                    previousPaymentStatus,
                    nextPaymentStatus: paymentStatus
                }
            }, { transaction });
        }

        if (appointment.platformUserId && paymentDelta > 0) {
            await db.PlatformUser.increment('totalSpent', {
                by: paymentDelta,
                where: { id: appointment.platformUserId },
                transaction
            });

            await db.CustomerInsight.increment('totalSpent', {
                by: paymentDelta,
                where: { platformUserId: appointment.platformUserId, tenantId },
                transaction
            });
        }

        await transaction.commit();

        try {
            await pushNotificationService.sendToUser(appointment.platformUserId, {
                title: 'Booking payment updated',
                body: `Payment status for your appointment is now ${paymentStatus.replace(/_/g, ' ')}.`,
                data: {
                    type: 'booking_payment_updated',
                    appointmentId: appointment.id,
                    paymentStatus
                }
            });
        } catch (notificationError) {
            console.warn('Tenant booking payment notification warning:', notificationError.message);
        }

        res.json({
            success: true,
            message: 'Payment status updated successfully',
            appointment
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Update payment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment status',
            error: error.message
        });
    }
};

/**
 * Reassign an appointment to another staff member without changing time.
 * PATCH /api/v1/tenant/appointments/:id/reassign-staff
 */
exports.reassignAppointmentStaff = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { staffId } = req.body;

        if (!staffId) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'staffId is required'
            });
        }

        const appointment = await db.Appointment.findOne({
            where: { id },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    where: { tenantId },
                    required: true
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
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

        if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Closed appointments cannot be reassigned'
            });
        }

        if (appointment.staffId === staffId) {
            await transaction.commit();
            return res.json({
                success: true,
                message: 'Appointment already assigned to this staff member',
                appointment
            });
        }

        const assignedStaff = await db.Staff.findOne({
            where: {
                id: staffId,
                tenantId,
                isActive: true
            },
            transaction
        });

        if (!assignedStaff) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }

        const canPerform = await db.ServiceEmployee.findOne({
            where: {
                serviceId: appointment.serviceId,
                staffId
            },
            transaction
        });

        if (!canPerform) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Selected staff cannot perform this service'
            });
        }

        const hasConflict = await bookingService.hasConflict(
            staffId,
            new Date(appointment.startTime),
            new Date(appointment.endTime),
            appointment.id,
            transaction
        );

        if (hasConflict) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: 'Selected staff is not available for this time slot'
            });
        }

        appointment.requestedStaffId = staffId;
        appointment.assignmentMode = 'tenant_reassigned';
        appointment.staffId = staffId;
        await appointment.save({ transaction });

        await transaction.commit();

        try {
            const serviceName = appointment.service?.name_en || appointment.service?.name_ar || 'service';
            const customerName = appointment.user
                ? `${appointment.user.firstName || ''} ${appointment.user.lastName || ''}`.trim()
                : 'A customer';
            const appointmentDate = new Date(appointment.startTime).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });

            await pushNotificationService.sendToUser(appointment.platformUserId, {
                title: 'Booking updated',
                body: `Your ${serviceName} appointment on ${appointmentDate} was reassigned.`,
                data: {
                    type: 'booking_staff_reassigned',
                    appointmentId: appointment.id,
                    tenantId,
                    staffId
                }
            });

            await pushNotificationService.sendToStaff(staffId, {
                title: 'Appointment assigned',
                body: `${customerName} booked ${serviceName} for ${appointmentDate}.`,
                data: {
                    type: 'staff_appointment_assigned',
                    appointmentId: appointment.id,
                    tenantId,
                    platformUserId: appointment.platformUserId
                }
            });
        } catch (notificationError) {
            console.warn('Tenant appointment reassignment notification warning:', notificationError.message);
        }

        res.json({
            success: true,
            message: 'Appointment reassigned successfully',
            appointment
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Reassign appointment staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reassign appointment',
            error: error.message
        });
    }
};

/**
 * Reschedule an appointment from the tenant dashboard.
 * PATCH /api/v1/tenant/appointments/:id/reschedule
 */
exports.rescheduleAppointment = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { startTime, staffId } = req.body;

        if (!startTime) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'startTime is required'
            });
        }

        const requestedStart = new Date(startTime);
        if (Number.isNaN(requestedStart.getTime())) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Invalid startTime'
            });
        }

        const appointment = await db.Appointment.findOne({
            where: { id },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    where: { tenantId },
                    required: true
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

        if (!['pending', 'confirmed'].includes(appointment.status)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Only pending or confirmed appointments can be rescheduled'
            });
        }

        const hoursUntilCurrentStart = (new Date(appointment.startTime).getTime() - Date.now()) / (60 * 60 * 1000);
        if (hoursUntilCurrentStart <= 24) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Appointments can only be rescheduled more than 24 hours before the original start time'
            });
        }

        if (requestedStart.getTime() <= Date.now()) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'New appointment time must be in the future'
            });
        }

        const requestedStaffId = staffId || appointment.staffId;
        const assignedStaff = await db.Staff.findOne({
            where: {
                id: requestedStaffId,
                tenantId,
                isActive: true
            },
            transaction
        });

        if (!assignedStaff) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }

        const durationMinutes =
            parseInt(appointment.service?.duration, 10) ||
            Math.max(15, Math.round((new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60000));
        const requestedEnd = new Date(requestedStart.getTime() + durationMinutes * 60000);

        const hasConflict = await bookingService.hasConflict(
            requestedStaffId,
            requestedStart,
            requestedEnd,
            appointment.id,
            transaction
        );

        if (hasConflict) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: 'Selected time slot is no longer available'
            });
        }

        if (staffId) {
            appointment.requestedStaffId = staffId;
            appointment.assignmentMode = 'tenant_reassigned';
        }

        appointment.staffId = requestedStaffId;
        appointment.startTime = requestedStart;
        appointment.endTime = requestedEnd;
        appointment.customerReminderSentAt = null;
        appointment.noShowMarkedAt = null;
        await appointment.save({ transaction });
        await transaction.commit();

        try {
            await pushNotificationService.sendToUser(appointment.platformUserId, {
                title: 'Booking rescheduled',
                body: 'Your appointment time has been updated.',
                data: {
                    type: 'booking_rescheduled',
                    appointmentId: appointment.id,
                    startTime: requestedStart.toISOString(),
                    staffId: requestedStaffId
                }
            });
        } catch (notificationError) {
            console.warn('Tenant booking reschedule notification warning:', notificationError.message);
        }

        res.json({
            success: true,
            message: 'Appointment rescheduled successfully',
            appointment
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Reschedule appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reschedule appointment',
            error: error.message
        });
    }
};

/**
 * Get appointment statistics
 * GET /api/v1/tenant/appointments/stats
 */
exports.getAppointmentStats = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;

        const where = {};
        
        Object.assign(where, buildDateRangeWhere('startTime', startDate, endDate));

        // Get appointments with service filter
        const appointments = await db.Appointment.findAll({
            where,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    attributes: ['id'],
                    required: true
                }
            ],
            attributes: ['id', 'status', 'paymentStatus', 'price', 'tenantRevenue', 'employeeCommission', 'startTime']
        });

        const stats = {
            total: appointments.length,
            byStatus: {
                pending: 0,
                confirmed: 0,
                checked_in: 0,
                in_service: 0,
                completed: 0,
                cancelled: 0,
                no_show: 0
            },
            byPaymentStatus: {
                pending: 0,
                deposit_paid: 0,
                fully_paid: 0,
                refunded: 0,
                partially_refunded: 0
            },
            totalRevenue: 0,
            totalTenantRevenue: 0,
            totalEmployeeCommission: 0
        };

        appointments.forEach(appointment => {
            // Count by status
            if (stats.byStatus[appointment.status] !== undefined) {
                stats.byStatus[appointment.status]++;
            }

            // Count by payment status
            if (stats.byPaymentStatus[appointment.paymentStatus] !== undefined) {
                stats.byPaymentStatus[appointment.paymentStatus]++;
            }

            // Sum revenues
            if (appointment.price) {
                stats.totalRevenue += parseFloat(appointment.price);
            }
            if (appointment.tenantRevenue) {
                stats.totalTenantRevenue += parseFloat(appointment.tenantRevenue);
            }
            if (appointment.employeeCommission) {
                stats.totalEmployeeCommission += parseFloat(appointment.employeeCommission);
            }
        });

        // Round to 2 decimal places
        stats.totalRevenue = parseFloat(stats.totalRevenue.toFixed(2));
        stats.totalTenantRevenue = parseFloat(stats.totalTenantRevenue.toFixed(2));
        stats.totalEmployeeCommission = parseFloat(stats.totalEmployeeCommission.toFixed(2));

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get appointment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointment statistics',
            error: error.message
        });
    }
};

