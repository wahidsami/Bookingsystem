/**
 * Tenant Appointment Controller
 * Handles appointment management for authenticated tenants
 */

const db = require('../models');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const pushNotificationService = require('../services/pushNotificationService');
const bookingService = require('../services/bookingService');
const { calculateSplitPayment } = require('../services/splitPaymentService');
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
            platformUserId,
            page = 1,
            limit = 50
        } = req.query;

        const where = {};
        
        // Filter by tenant (through service or staff)
        // We need to ensure appointments belong to this tenant
        // Since appointments link to services and staff, we'll filter through those

        // Build date range filter
        if (startDate || endDate) {
            where.startTime = {};
            if (startDate) {
                where.startTime[Op.gte] = new Date(startDate);
            }
            if (endDate) {
                where.startTime[Op.lte] = new Date(endDate);
            }
        }

        if (staffId) {
            where.staffId = staffId;
        }

        if (serviceId) {
            where.serviceId = serviceId;
        }

        if (status) {
            where.status = status;
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
        if (startDate || endDate) {
            where.startTime = {};
            if (startDate) {
                where.startTime[Op.gte] = new Date(startDate);
            }
            if (endDate) {
                where.startTime[Op.lte] = new Date(endDate);
            }
        }

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

        appointment.staffId = requestedStaffId;
        appointment.startTime = requestedStart;
        appointment.endTime = requestedEnd;
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
        
        if (startDate || endDate) {
            where.startTime = {};
            if (startDate) {
                where.startTime[Op.gte] = new Date(startDate);
            }
            if (endDate) {
                where.startTime[Op.lte] = new Date(endDate);
            }
        }

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

