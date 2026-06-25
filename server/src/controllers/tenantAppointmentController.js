/**
 * Tenant Appointment Controller
 * Handles appointment management for authenticated tenants
 */

const db = require('../models');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const { APPOINTMENT_PAYMENT_STATUS, isAppointmentFullyPaid } = require('../utils/appointmentPaymentStatus');
const pushNotificationService = require('../services/pushNotificationService');
const customerNotificationService = require('../services/customerNotificationService');
const bookingService = require('../services/bookingService');
const appointmentLifecycleService = require('../services/appointmentLifecycleService');
const { createStaffAppointmentMessage } = require('../services/staffNotificationService');
const {
    calculateSplitPayment,
    createAppointmentPaymentTransactions,
    normalizePaymentAllocations
} = require('../services/splitPaymentService');
const userService = require('../services/userService');
const {
    createAppointmentTransaction,
    resolveLedgerPaymentMethod
} = require('../services/paymentTransactionLedgerService');
const {
    ensureAppointmentInvoice
} = require('../services/customerInvoiceService');
const { sendCustomerInvoiceLifecycleEmail } = require('../services/customerInvoiceEmailService');
const {
    TENANT_APPOINTMENT_TRANSITIONS,
    canTransitionAppointmentStatus,
    isValidAppointmentStatus,
    normalizeAppointmentStatus
} = require('../utils/appointmentStatus');
const { getServerPublicUrl } = require('../utils/url');
const { sendEmail } = require('../utils/emailService');
const availabilityService = require('../services/availabilityService');

const INVITE_EXPIRY_HOURS = 72;
const TENANT_APPOINTMENT_AUDIT_LOGS_ENABLED = process.env.TENANT_APPOINTMENT_AUDIT_LOGS === '1';
const TENANT_APPOINTMENT_ADVANCED_DRAG_ENABLED = process.env.TENANT_APPOINTMENT_ADVANCED_DRAG !== '0';

function logTenantAppointmentAudit(event, payload = {}) {
    if (!TENANT_APPOINTMENT_AUDIT_LOGS_ENABLED) {
        return;
    }

    try {
        console.info('[tenant-appointment-audit]', JSON.stringify({
            event,
            at: new Date().toISOString(),
            ...payload
        }));
    } catch (error) {
        console.info('[tenant-appointment-audit]', event, payload);
    }
}

function generateInviteToken() {
    return crypto.randomBytes(32).toString('hex');
}

function buildAppointmentInviteLink(token) {
    const baseUrl = getServerPublicUrl() || 'http://localhost:5000';
    return `${baseUrl.replace(/\/+$/, '')}/api/v1/bookings/invites/${encodeURIComponent(token)}/open`;
}

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

async function createAppointmentEventSafe({
    appointmentId,
    tenantId,
    platformUserId,
    actorType,
    actorId,
    eventType,
    payload,
    occurredAt,
    transaction
}) {
    try {
        if (!db.AppointmentEvent || !appointmentId || !tenantId || !eventType) return;
        await db.AppointmentEvent.create({
            appointmentId,
            tenantId,
            platformUserId: platformUserId || null,
            actorType: actorType || 'tenant',
            actorId: actorId || null,
            eventType,
            payload: payload || {},
            occurredAt: occurredAt || new Date()
        }, transaction ? { transaction } : undefined);
    } catch (error) {
        console.warn('Tenant appointment event logging warning:', error.message);
    }
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

function getDatePartsInTimeZone(date, timeZone = 'Asia/Riyadh') {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const map = {};
    parts.forEach((part) => {
        if (part.type !== 'literal') {
            map[part.type] = part.value;
        }
    });

    return {
        dateKey: `${map.year}-${map.month}-${map.day}`,
        timeKey: `${map.hour}:${map.minute}`
    };
}

async function ensureStaffSlotAvailable({ tenantId, serviceId, staffId, startTime }) {
    if (!tenantId || !serviceId || !staffId || !startTime) return false;
    const requestedStart = new Date(startTime);
    if (Number.isNaN(requestedStart.getTime())) return false;
    const tenantSettings = await db.TenantSettings.findOne({
        where: { tenantId },
        attributes: ['timezone']
    });
    const timezone = tenantSettings?.timezone || 'Asia/Riyadh';
    const requestedParts = getDatePartsInTimeZone(requestedStart, timezone);

    const availability = await availabilityService.getAvailableSlots(tenantId, {
        serviceId,
        staffId,
        date: requestedParts.dateKey
    });

    return (availability?.slots || []).some((slot) => {
        if (slot.available !== true) return false;
        const slotParts = getDatePartsInTimeZone(new Date(slot.startTime), timezone);
        return slotParts.dateKey === requestedParts.dateKey && slotParts.timeKey === requestedParts.timeKey;
    });
}

async function inspectStaffSlotAvailability({ tenantId, serviceId, staffId, startTime }) {
    const requestedStart = new Date(startTime);
    if (Number.isNaN(requestedStart.getTime())) {
        return {
            valid: false,
            reason: 'invalid_start_time'
        };
    }

    const tenantSettings = await db.TenantSettings.findOne({
        where: { tenantId },
        attributes: ['timezone']
    });
    const timezone = tenantSettings?.timezone || 'Asia/Riyadh';
    const requestedParts = getDatePartsInTimeZone(requestedStart, timezone);

    const availability = await availabilityService.getAvailableSlots(tenantId, {
        serviceId,
        staffId,
        date: requestedParts.dateKey
    });

    const slots = Array.isArray(availability?.slots) ? availability.slots : [];
    const slotSample = slots.slice(0, 20).map((slot) => {
        const slotParts = getDatePartsInTimeZone(new Date(slot.startTime), timezone);
        return {
            startTime: slot.startTime,
            endTime: slot.endTime,
            available: slot.available === true,
            localDate: slotParts.dateKey,
            localTime: slotParts.timeKey
        };
    });
    const matchingSlot = slotSample.find((slot) => slot.available && slot.localDate === requestedParts.dateKey && slot.localTime === requestedParts.timeKey) || null;

    return {
        valid: true,
        timezone,
        requested: {
            iso: requestedStart.toISOString(),
            localDate: requestedParts.dateKey,
            localTime: requestedParts.timeKey
        },
        availability: {
            totalSlots: availability?.metadata?.totalSlots ?? slots.length,
            availableSlots: availability?.metadata?.availableSlots ?? slots.filter((slot) => slot.available === true).length,
            staffName: availability?.metadata?.staffName || null,
            stepSize: availability?.metadata?.stepSize || null
        },
        matchingSlot,
        slotSample
    };
}

async function resolveAppointmentCustomer({ platformUserId, customer, transaction, tenantId }) {
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
    const isGuest = normalizedCustomer.isGuest === true;
    const rawFirstName = `${normalizedCustomer.firstName || ''}`.trim();
    const rawLastName = `${normalizedCustomer.lastName || ''}`.trim();
    const firstName = rawFirstName || (isGuest ? 'Customer' : '');
    const lastName = rawLastName || (isGuest ? '001' : '');
    let email = `${normalizedCustomer.email || ''}`.trim().toLowerCase();
    let phone = `${normalizedCustomer.phone || ''}`.trim();
    const password = `${normalizedCustomer.password || ''}`;

    // PlatformUser requires non-null unique email/phone in DB.
    // For quick appointment creation we allow missing input, then fill safe placeholders.
    if (!email) {
        const guestTag = `${Date.now()}${crypto.randomInt(1000, 9999)}`;
        email = `guest+${guestTag}@guest.refah.local`;
    }
    if (!phone) {
        const phoneSuffix = `${String(Date.now()).slice(-5)}${crypto.randomInt(100, 999)}`;
        phone = `+9665${phoneSuffix}`;
    }

    const isDefaultWalkInPlaceholder = isGuest && (
        (rawFirstName === '' && rawLastName === '') ||
        (rawFirstName === 'Customer' && (rawLastName === '' || rawLastName === '001')) ||
        (rawFirstName === 'عميل' && (rawLastName === '' || rawLastName === '001'))
    );

    const resolvedWalkInName = isDefaultWalkInPlaceholder && tenantId
        ? await getNextWalkInCustomerDisplayName({
            tenantId,
            transaction,
            placeholderFirstName: rawFirstName === 'عميل' ? 'عميل' : 'Customer'
        })
        : null;

    const finalFirstName = resolvedWalkInName?.firstName || firstName;
    const finalLastName = resolvedWalkInName?.lastName || lastName;

    if (!finalFirstName || !finalLastName) {
        throw new Error('Customer first and last name are required when no existing customer is selected');
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
        if (!existingUser.firstName && finalFirstName) updates.firstName = finalFirstName;
        if (!existingUser.lastName && finalLastName) updates.lastName = finalLastName;
        if (!existingUser.gender && normalizedCustomer.gender) updates.gender = normalizedCustomer.gender;
        if (!existingUser.dateOfBirth && normalizedCustomer.dateOfBirth) updates.dateOfBirth = normalizedCustomer.dateOfBirth;

        if (Object.keys(updates).length > 0) {
            await existingUser.update(updates, { transaction });
        }

        return existingUser;
    }

    const generatedPassword = password || crypto.randomBytes(24).toString('hex');

    return await db.PlatformUser.create({
        email,
        phone,
        password: generatedPassword,
        firstName: finalFirstName,
        lastName: finalLastName,
        gender: normalizedCustomer.gender || null,
        dateOfBirth: normalizedCustomer.dateOfBirth || null,
        emailVerified: false,
        phoneVerified: false,
        isActive: true
    }, { transaction });
}

async function getNextWalkInCustomerDisplayName({ tenantId, transaction, placeholderFirstName = 'Customer' }) {
    const placeholderArabicName = 'عميل';

    const appointments = await db.Appointment.findAll({
        include: [
            {
                model: db.Service,
                as: 'service',
                where: { tenantId },
                required: true,
                attributes: []
            },
            {
                model: db.PlatformUser,
                as: 'user',
                required: true,
                attributes: ['firstName', 'lastName']
            }
        ],
        attributes: ['id'],
        transaction
    });

    let maxSuffix = 0;
    appointments.forEach((appointment) => {
        const currentFirstName = `${appointment.user?.firstName || ''}`.trim();
        const currentLastName = `${appointment.user?.lastName || ''}`.trim();

        const isPlaceholderName =
            currentFirstName === 'Customer' ||
            currentFirstName === placeholderArabicName ||
            currentFirstName === placeholderFirstName;

        if (!isPlaceholderName) {
            return;
        }

        const suffix = parseInt(currentLastName, 10);
        if (Number.isFinite(suffix) && suffix > maxSuffix) {
            maxSuffix = suffix;
        }
    });

    const nextSuffix = String(maxSuffix + 1).padStart(3, '0');
    return {
        firstName: placeholderFirstName,
        lastName: nextSuffix
    };
}

async function sendAppointmentInviteEmail({ to, customerName, tenantName, inviteLink, startTime, serviceName, locale = 'en' }) {
    if (!to) {
        return;
    }

    if (`${to}`.toLowerCase().endsWith('@guest.refah.local')) {
        return;
    }

    const appointmentDate = new Date(startTime).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    await sendEmail({
        to,
        subject: locale === 'ar' ? 'دعوة لتأكيد موعدك في رفاه' : 'Confirm your Refah appointment',
        template: 'customer_appointment_invite',
        data: {
            customerName: customerName || (locale === 'ar' ? 'عميلنا العزيز' : 'Dear customer'),
            tenantName: tenantName || 'Refah',
            serviceName: serviceName || (locale === 'ar' ? 'الخدمة' : 'Service'),
            appointmentDate,
            inviteLink
        }
    });
}

async function sendAppointmentRescheduleEmail({
    to,
    customerName,
    tenantName,
    startTime,
    serviceName,
    oldStartTime,
    newStaffName,
    oldStaffName,
    bookingReference,
    locale = 'en'
}) {
    if (!to) {
        return;
    }

    if (`${to}`.toLowerCase().endsWith('@guest.refah.local')) {
        return;
    }

    const appointmentDate = new Date(startTime).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    const previousAppointmentDate = oldStartTime
        ? new Date(oldStartTime).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        })
        : '';

    await sendEmail({
        to,
        subject: locale === 'ar' ? 'تم تحديث موعدك في رفاه' : 'Your Refah appointment has been updated',
        template: 'customer_appointment_rescheduled',
        data: {
            customerName: customerName || (locale === 'ar' ? 'عميلنا العزيز' : 'Dear customer'),
            tenantName: tenantName || 'Refah',
            serviceName: serviceName || (locale === 'ar' ? 'الخدمة' : 'Service'),
            appointmentDate,
            previousAppointmentDate,
            newStaffName: newStaffName || (locale === 'ar' ? 'مقدم الخدمة الجديد' : 'New staff member'),
            oldStaffName: oldStaffName || (locale === 'ar' ? 'مقدم الخدمة السابق' : 'Previous staff member'),
            bookingReference: bookingReference || ''
        }
    });
}

function appendGroupGuestToNotes(notes, groupGuest) {
    if (!groupGuest || typeof groupGuest !== 'object') {
        return notes;
    }

    const firstName = `${groupGuest.firstName || ''}`.trim();
    const lastName = `${groupGuest.lastName || ''}`.trim();
    const phone = `${groupGuest.phone || ''}`.trim();
    const serviceId = `${groupGuest.serviceId || ''}`.trim();
    const serviceIds = normalizeGuestServiceIds(groupGuest);
    const serviceName = `${groupGuest.serviceName || ''}`.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) {
        return notes;
    }

    const marker = `[GROUP_GUEST] ${JSON.stringify({
        fullName,
        phone: phone || null,
        serviceId: serviceId || null,
        serviceIds: serviceIds.length > 0 ? serviceIds : null,
        serviceName: serviceName || null
    })}`;
    const base = `${notes || ''}`.trim();
    return base ? `${base}\n${marker}` : marker;
}

function normalizeBooleanFlag(value) {
    return value === true || `${value || ''}`.trim().toLowerCase() === 'true';
}

function normalizeGuestServiceIds(groupGuest) {
    if (!groupGuest || typeof groupGuest !== 'object') {
        return [];
    }

    const rawServiceIds = Array.isArray(groupGuest.serviceIds)
        ? groupGuest.serviceIds
        : groupGuest.serviceId
            ? [groupGuest.serviceId]
            : [];

    return rawServiceIds
        .map((serviceId) => `${serviceId || ''}`.trim())
        .filter(Boolean);
}

async function calculateGroupGuestPriceAdjustment({ tenantId, appointment, groupGuest, transaction }) {
    if (!groupGuest || typeof groupGuest !== 'object') {
        return null;
    }

    const requestedServiceIds = normalizeGuestServiceIds(groupGuest);
    if (!requestedServiceIds.length) {
        return null;
    }

    if (normalizeBooleanFlag(groupGuest.isFree)) {
        return {
            extraPrice: 0,
            extraRawPrice: 0,
            extraTaxAmount: 0,
            extraPlatformFee: 0,
            extraTenantRevenue: 0,
            extraEmployeeRevenue: 0,
            extraEmployeeCommissionRate: Number(appointment.employeeCommissionRate || 0),
            extraEmployeeCommission: 0,
            guestService: null
        };
    }

    const staff = await db.Staff.findByPk(appointment.staffId, {
        transaction,
        attributes: ['id', 'commissionRate']
    });

    const guestServices = await db.Service.findAll({
        where: {
            id: requestedServiceIds,
            tenantId
        },
        attributes: ['id', 'name_en', 'name_ar', 'rawPrice', 'taxRate', 'commissionRate', 'finalPrice'],
        transaction
    });

    if (guestServices.length !== requestedServiceIds.length) {
        throw new Error('Guest service not found');
    }

    const breakdown = guestServices.reduce((accumulator, guestService) => {
        const itemBreakdown = db.Appointment.calculateRevenueBreakdown(guestService, staff);
        return {
            price: Number(accumulator.price || 0) + Number(itemBreakdown.price || 0),
            rawPrice: Number(accumulator.rawPrice || 0) + Number(itemBreakdown.rawPrice || 0),
            taxAmount: Number(accumulator.taxAmount || 0) + Number(itemBreakdown.taxAmount || 0),
            platformFee: Number(accumulator.platformFee || 0) + Number(itemBreakdown.platformFee || 0),
            tenantRevenue: Number(accumulator.tenantRevenue || 0) + Number(itemBreakdown.tenantRevenue || 0),
            employeeRevenue: Number(accumulator.employeeRevenue || 0) + Number(itemBreakdown.employeeRevenue || 0),
            employeeCommissionRate: Number(itemBreakdown.employeeCommissionRate || accumulator.employeeCommissionRate || 0),
            employeeCommission: Number(accumulator.employeeCommission || 0) + Number(itemBreakdown.employeeCommission || 0)
        };
    }, {
        price: 0,
        rawPrice: 0,
        taxAmount: 0,
        platformFee: 0,
        tenantRevenue: 0,
        employeeRevenue: 0,
        employeeCommissionRate: Number(appointment.employeeCommissionRate || 0),
        employeeCommission: 0
    });
    return {
        extraPrice: Number(breakdown.price || 0),
        extraRawPrice: Number(breakdown.rawPrice || 0),
        extraTaxAmount: Number(breakdown.taxAmount || 0),
        extraPlatformFee: Number(breakdown.platformFee || 0),
        extraTenantRevenue: Number(breakdown.tenantRevenue || 0),
        extraEmployeeRevenue: Number(breakdown.employeeRevenue || 0),
        extraEmployeeCommissionRate: Number(breakdown.employeeCommissionRate || 0),
        extraEmployeeCommission: Number(breakdown.employeeCommission || 0),
        guestService: guestServices[0] || null,
        guestServices
    };
}

async function syncBookingSessionTotals(sessionId, transaction) {
    if (!sessionId) {
        return null;
    }

    const appointments = await db.Appointment.findAll({
        where: { bookingSessionId: sessionId },
        transaction
    });

    const subtotal = appointments.reduce((sum, appointment) => sum + Number(appointment.rawPrice || 0), 0);
    const taxAmount = appointments.reduce((sum, appointment) => sum + Number(appointment.taxAmount || 0), 0);
    const platformFee = appointments.reduce((sum, appointment) => sum + Number(appointment.platformFee || 0), 0);
    const totalAmount = appointments.reduce((sum, appointment) => sum + Number(appointment.price || 0), 0);

    await db.BookingSession.update({
        itemCount: appointments.length,
        subtotal: parseFloat(subtotal.toFixed(2)),
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        platformFee: parseFloat(platformFee.toFixed(2)),
        totalAmount: parseFloat(totalAmount.toFixed(2))
    }, {
        where: { id: sessionId },
        transaction
    });

    return db.BookingSession.findByPk(sessionId, { transaction });
}

/**
 * Create a new appointment from the tenant dashboard
 * POST /api/v1/tenant/appointments
 */
exports.createAppointment = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const dashboardOverridePaymentMethod = 'at-center';
        const {
            serviceId,
            variantId,
            staffId,
            requestedStaffId,
            startTime,
            notes,
            paymentMethod,
            paymentAllocations,
            platformUserId,
            customer,
            assignmentMode,
            groupGuest,
            items,
            bookingSessionId,
            bookingReference,
            bookingItemIndex
        } = req.body || {};

        if ((!serviceId || !startTime) && (!Array.isArray(items) || items.length === 0)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'serviceId and startTime are required'
            });
        }

        const customerUser = await resolveAppointmentCustomer({
            platformUserId,
            customer,
            transaction,
            tenantId
        });

        const bookingItems = Array.isArray(items) ? items : [];
        if (bookingItems.length > 0) {
            const normalizedItems = bookingItems.map((item, index) => {
                const itemServiceId = `${item?.serviceId || ''}`.trim();
                const rawStartTime = item?.startTime || null;
                const parsedStartTime = rawStartTime ? new Date(rawStartTime) : null;

                if (!itemServiceId) {
                    throw new Error(`serviceId is required for booking item ${index + 1}`);
                }

                if (!parsedStartTime || Number.isNaN(parsedStartTime.getTime())) {
                    throw new Error(`Invalid start time for booking item ${index + 1}`);
                }

                const itemPaymentMethod = dashboardOverridePaymentMethod;

                return {
                    serviceId: itemServiceId,
                    variantId: item?.variantId || null,
                    staffId: item?.staffId || null,
                    requestedStaffId: item?.requestedStaffId || item?.staffId || null,
                    startTime: parsedStartTime.toISOString(),
                    notes: item?.notes || notes || null,
                    paymentMethod: itemPaymentMethod,
                    assignmentMode: item?.assignmentMode || (item?.staffId ? 'tenant_reassigned' : 'auto_assigned'),
                    duration: item?.duration,
                    discountType: item?.discountType,
                    discountValue: item?.discountValue
                };
            });

            const { session, appointments, paymentSummary } = await bookingService.createBookingSession({
                tenantId,
                platformUserId: customerUser.id,
                items: normalizedItems,
                notes: notes || null,
                paymentMethod: dashboardOverridePaymentMethod,
                paymentAllocations,
                skipServicePaymentOptionValidation: true,
                bookingSessionId,
                bookingReference,
                bookingItemIndex
            }, { transaction });

            const fullAppointments = await db.Appointment.findAll({
                where: {
                    bookingSessionId: session.id
                },
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
                    },
                    {
                        model: db.Tenant,
                        as: 'tenant',
                        attributes: ['id', 'name', 'name_ar', 'name_en'],
                        required: false
                    },
                    {
                        model: db.BookingSession,
                        as: 'bookingSession',
                        required: false
                    }
                ],
                order: [['bookingItemIndex', 'ASC']],
                transaction
            });

            await transaction.commit();
            return res.status(201).json({
                success: true,
                message: 'Booking created successfully',
                bookingSession: {
                    id: session.id,
                    bookingReference: session.bookingReference,
                    paymentMethod: session.paymentMethod,
                    itemCount: session.itemCount,
                    subtotal: session.subtotal,
                    taxAmount: session.taxAmount,
                    platformFee: session.platformFee,
                    totalAmount: session.totalAmount,
                    paymentSummary
                },
                appointments: fullAppointments,
                appointment: fullAppointments[0] || null
            });
        }

        let existingSession = null;
        let resolvedBookingReference = bookingReference || null;
        let resolvedBookingItemIndex = Number.isInteger(bookingItemIndex) ? bookingItemIndex : null;
        if (bookingSessionId) {
            existingSession = await db.BookingSession.findByPk(bookingSessionId, {
                transaction
            });

            if (!existingSession) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Booking session not found'
                });
            }

            if (existingSession.tenantId !== tenantId) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized booking session'
                });
            }

            if (existingSession.platformUserId && existingSession.platformUserId !== customerUser.id) {
                await transaction.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Booking session does not belong to this customer'
                });
            }

            resolvedBookingReference = existingSession.bookingReference;
            if (!Number.isInteger(resolvedBookingItemIndex)) {
                resolvedBookingItemIndex = Number(existingSession.itemCount || 0);
            }
        }

        const explicitStaffId = staffId || requestedStaffId || null;
        if (explicitStaffId) {
            const slotAvailable = await ensureStaffSlotAvailable({
                tenantId,
                serviceId,
                staffId: explicitStaffId,
                startTime
            });
            if (!slotAvailable) {
                const debug = await inspectStaffSlotAvailability({
                    tenantId,
                    serviceId,
                    staffId: explicitStaffId,
                    startTime
                });
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    message: 'Selected staff is not available for this time slot',
                    debug
                });
            }
        }

        let normalizedGroupGuest = groupGuest || null;
        if (groupGuest && typeof groupGuest === 'object') {
            const requestedServiceIds = normalizeGuestServiceIds({
                ...groupGuest,
                serviceIds: Array.isArray(groupGuest.serviceIds) && groupGuest.serviceIds.length > 0
                    ? groupGuest.serviceIds
                    : groupGuest.serviceId
                        ? [groupGuest.serviceId]
                        : serviceId
                          ? [serviceId]
                          : []
            });
            const resolvedGuestServices = requestedServiceIds.length > 0
                ? await db.Service.findAll({
                    where: {
                        id: requestedServiceIds,
                        tenantId
                    },
                    attributes: ['id', 'name_en', 'name_ar'],
                    transaction
                })
                : [];

            normalizedGroupGuest = {
                ...groupGuest,
                serviceId: resolvedGuestServices[0]?.id || requestedServiceIds[0] || serviceId,
                serviceIds: resolvedGuestServices.map((guestService) => guestService.id),
                serviceName: resolvedGuestServices.length > 0
                    ? resolvedGuestServices
                        .map((guestService) => `${guestService.name_en || guestService.name_ar || ''}`.trim())
                        .filter(Boolean)
                        .join(' • ')
                    : `${groupGuest.serviceName || ''}`.trim() || null,
                isFree: normalizeBooleanFlag(groupGuest.isFree)
            };
        }

        const normalizedNotes = appendGroupGuestToNotes(notes, normalizedGroupGuest);

        const appointment = await bookingService.createBooking({
            serviceId,
            variantId: variantId || null,
            staffId: staffId || null,
            requestedStaffId: requestedStaffId || null,
            platformUserId: customerUser.id,
            tenantId,
            startTime,
            notes: normalizedNotes,
            paymentMethod: dashboardOverridePaymentMethod,
            paymentAllocations,
            assignmentMode: assignmentMode || (staffId ? 'tenant_reassigned' : undefined),
            skipServicePaymentOptionValidation: true,
            bookingSessionId: existingSession?.id || null,
            bookingReference: resolvedBookingReference || undefined,
            bookingItemIndex: resolvedBookingItemIndex
        }, { transaction });

        const groupGuestPrice = await calculateGroupGuestPriceAdjustment({
            tenantId,
            appointment,
            groupGuest: normalizedGroupGuest,
            transaction
        });
        if (groupGuestPrice && groupGuestPrice.extraPrice > 0) {
            const currentPrice = Number(appointment.price || 0);
            const currentRawPrice = Number(appointment.rawPrice || 0);
            const currentTaxAmount = Number(appointment.taxAmount || 0);
            const currentPlatformFee = Number(appointment.platformFee || 0);
            const currentTenantRevenue = Number(appointment.tenantRevenue || 0);
            const currentEmployeeRevenue = Number(appointment.employeeRevenue || 0);
            const currentEmployeeCommission = Number(appointment.employeeCommission || 0);
            const totalPrice = parseFloat((currentPrice + groupGuestPrice.extraPrice).toFixed(2));
            const totalRawPrice = parseFloat((currentRawPrice + groupGuestPrice.extraRawPrice).toFixed(2));
            const totalTaxAmount = parseFloat((currentTaxAmount + groupGuestPrice.extraTaxAmount).toFixed(2));
            const totalPlatformFee = parseFloat((currentPlatformFee + groupGuestPrice.extraPlatformFee).toFixed(2));
            const totalTenantRevenue = parseFloat((currentTenantRevenue + groupGuestPrice.extraTenantRevenue).toFixed(2));
            const totalEmployeeRevenue = parseFloat((currentEmployeeRevenue + groupGuestPrice.extraEmployeeRevenue).toFixed(2));
            const totalEmployeeCommission = parseFloat((currentEmployeeCommission + groupGuestPrice.extraEmployeeCommission).toFixed(2));
            const paymentMethodValue = `${paymentMethod || ''}`.trim().toLowerCase();
            const combinedSplit = paymentMethodValue === 'booking-fee'
                ? calculateSplitPayment(tenantId, totalPrice)
                : Promise.resolve({
                    depositAmount: 0,
                    remainderAmount: totalPrice
                });
            const bookingSplit = await combinedSplit;

            appointment.price = totalPrice;
            appointment.rawPrice = totalRawPrice;
            appointment.taxAmount = totalTaxAmount;
            appointment.platformFee = totalPlatformFee;
            appointment.tenantRevenue = totalTenantRevenue;
            appointment.employeeRevenue = totalEmployeeRevenue;
            appointment.employeeCommissionRate = groupGuestPrice.extraEmployeeCommissionRate || appointment.employeeCommissionRate;
            appointment.employeeCommission = totalEmployeeCommission;
            appointment.depositAmount = parseFloat(Number(bookingSplit.depositAmount || 0).toFixed(2));
            appointment.remainderAmount = parseFloat(Number(bookingSplit.remainderAmount || totalPrice).toFixed(2));
            appointment.totalPaid = 0;
            appointment.depositPaid = false;
            appointment.remainderPaid = false;

            await appointment.save({ transaction });
        }

        const inviteToken = generateInviteToken();
        const inviteExpiresAt = new Date(Date.now() + (INVITE_EXPIRY_HOURS * 60 * 60 * 1000));
        appointment.customerConfirmationRequired = true;
        appointment.customerConfirmationStatus = 'pending';
        // Tenant-created appointments that require customer action must remain unconfirmed
        // until the customer explicitly responds from the invite flow.
        appointment.status = 'pending';
        appointment.inviteToken = inviteToken;
        appointment.inviteExpiresAt = inviteExpiresAt;
        await appointment.save({ transaction });

        let bookingSession = existingSession;
        if (!bookingSession) {
            bookingSession = await db.BookingSession.create({
                bookingReference: appointment.bookingNumber || appointment.bookingReference || await db.BookingSession.generateBookingReference(),
                tenantId,
                platformUserId: customerUser.id,
                status: 'confirmed',
                itemCount: 1,
                subtotal: Number(appointment.rawPrice || 0),
                taxAmount: Number(appointment.taxAmount || 0),
                platformFee: Number(appointment.platformFee || 0),
                totalAmount: Number(appointment.price || 0),
                paymentMethod: appointment.paymentMethod || paymentMethod || null,
                notes: normalizedNotes || null
            }, { transaction });

            appointment.bookingSessionId = bookingSession.id;
            appointment.bookingReference = bookingSession.bookingReference;
            appointment.bookingItemIndex = 0;
            await appointment.save({ transaction });
        }

        bookingSession = await syncBookingSessionTotals(bookingSession.id, transaction);

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
                },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_ar', 'name_en'],
                    required: false
                },
                {
                    model: db.BookingSession,
                    as: 'bookingSession',
                    required: false
                }
            ],
            transaction
        });

        await transaction.commit();
        const inviteLink = buildAppointmentInviteLink(inviteToken);

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
                title: 'New appointment from your center',
                body: `Your ${serviceName} appointment for ${appointmentDate} needs your confirmation.`,
                data: {
                    type: 'booking_confirmation_required',
                    appointmentId: appointment.id,
                    tenantId,
                    staffId: appointment.staffId,
                    inviteToken
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

            await createStaffAppointmentMessage({
                tenantId,
                staffId: appointment.staffId,
                customerName,
                serviceName,
                appointmentDate,
                action: 'assigned'
            });

            await sendAppointmentInviteEmail({
                to: customerUser.email,
                customerName,
                tenantName: fullAppointment?.tenant?.name || 'Refah',
                inviteLink,
                startTime: appointment.startTime,
                serviceName
            });
        } catch (notificationError) {
            console.warn('Tenant appointment notification warning:', notificationError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Appointment created successfully',
            appointment: fullAppointment,
            appointmentInvite: {
                token: inviteToken,
                expiresAt: inviteExpiresAt.toISOString(),
                link: inviteLink
            },
            bookingSession
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
        const validationDetails = Array.isArray(error?.errors)
            ? error.errors.map((entry) => ({
                field: entry.path || null,
                message: entry.message || 'Invalid value',
                value: entry.value
            }))
            : [];

        let errorMessage = 'Failed to create appointment';
        if (error.name === 'SequelizeValidationError') {
            errorMessage = `Validation error: ${validationDetails.map((entry) => entry.message).join(', ')}`;
        } else if (error.name === 'SequelizeUniqueConstraintError') {
            errorMessage = `Validation error: ${validationDetails.map((entry) => entry.message).join(', ') || 'Duplicate value detected'}`;
        } else if (error.message) {
            errorMessage = error.message;
        }

        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message,
            errorName: error.name,
            errors: validationDetails
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
        // Add tolerance window to reduce timezone-edge misses between
        // booking source timezone and dashboard viewer timezone.
        const boardWindowStart = new Date(dayStart.getTime() - (12 * 60 * 60 * 1000));
        const boardWindowEnd = new Date(dayEnd.getTime() + (12 * 60 * 60 * 1000));
        const dayOfWeek = selectedDate.getDay();

        const appointmentWhere = {
            startTime: {
                [Op.between]: [boardWindowStart, boardWindowEnd]
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
        } else {
            // Keep the board focused on active flow; cancelled appointments remain available in list/history views.
            appointmentWhere.status = {
                [Op.ne]: 'cancelled'
            };
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
 * Global dashboard search.
 * GET /api/v1/tenant/dashboard/search?search=...
 */
exports.searchDashboard = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const search = `${req.query.search || ''}`.trim();
        const safeLimit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 10, 25));

        if (!search) {
            return res.status(400).json({
                success: false,
                message: 'Search text is required'
            });
        }

        const pattern = `%${search}%`;
        const appointmentWhere = {
            tenantId,
            [Op.or]: [
                { bookingNumber: { [Op.iLike]: pattern } },
                { bookingReference: { [Op.iLike]: pattern } },
                { notes: { [Op.iLike]: pattern } },
                { '$service.name_en$': { [Op.iLike]: pattern } },
                { '$service.name_ar$': { [Op.iLike]: pattern } },
                { '$staff.name$': { [Op.iLike]: pattern } },
                { '$user.firstName$': { [Op.iLike]: pattern } },
                { '$user.lastName$': { [Op.iLike]: pattern } },
                { '$user.email$': { [Op.iLike]: pattern } },
                { '$user.phone$': { [Op.iLike]: pattern } }
            ]
        };

        if (/^[0-9a-f-]{8,}$/i.test(search)) {
            appointmentWhere[Op.or].unshift({ id: { [Op.eq]: search } });
        }

        const [appointments, customers] = await Promise.all([
            db.Appointment.findAll({
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
                order: [['startTime', 'DESC']],
                limit: safeLimit
            }),
            db.PlatformUser.findAll({
                where: {
                    [Op.or]: [
                        { firstName: { [Op.iLike]: pattern } },
                        { lastName: { [Op.iLike]: pattern } },
                        { email: { [Op.iLike]: pattern } },
                        { phone: { [Op.iLike]: pattern } }
                    ]
                },
                include: [
                    {
                        model: db.Appointment,
                        as: 'appointments',
                        where: { tenantId },
                        required: true,
                        attributes: []
                    }
                ],
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage', 'walletBalance', 'loyaltyPoints', 'totalSpent', 'totalBookings'],
                distinct: true,
                order: [['createdAt', 'DESC']],
                limit: safeLimit
            })
        ]);

        return res.json({
            success: true,
            search,
            summary: {
                appointmentCount: appointments.length,
                customerCount: customers.length,
                totalResults: appointments.length + customers.length
            },
            appointments: appointments.map((appointment) => ({
                id: appointment.id,
                bookingNumber: appointment.bookingNumber || null,
                bookingReference: appointment.bookingReference || null,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                status: appointment.status,
                paymentStatus: appointment.paymentStatus,
                notes: appointment.notes || null,
                price: appointment.price,
                service: appointment.service ? {
                    id: appointment.service.id,
                    name_en: appointment.service.name_en,
                    name_ar: appointment.service.name_ar,
                    duration: appointment.service.duration,
                    category: appointment.service.category,
                    image: appointment.service.image
                } : null,
                staff: appointment.staff ? {
                    id: appointment.staff.id,
                    name: appointment.staff.name,
                    photo: appointment.staff.photo,
                    phone: appointment.staff.phone,
                    email: appointment.staff.email
                } : null,
                user: appointment.user ? {
                    id: appointment.user.id,
                    firstName: appointment.user.firstName,
                    lastName: appointment.user.lastName,
                    email: appointment.user.email,
                    phone: appointment.user.phone,
                    photo: appointment.user.photo || null
                } : null
            })),
            customers: customers.map((customer) => ({
                id: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phone: customer.phone,
                profileImage: customer.profileImage || null,
                walletBalance: customer.walletBalance || 0,
                loyaltyPoints: customer.loyaltyPoints || 0,
                totalSpent: customer.totalSpent || 0,
                totalBookings: customer.totalBookings || 0
            }))
        });
    } catch (error) {
        console.error('Search dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to search dashboard data',
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
                },
                {
                    model: db.AppointmentEvent,
                    as: 'events',
                    include: [
                        {
                            model: db.PlatformUser,
                            as: 'user',
                            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', ['profileImage', 'photo']],
                            required: false
                        }
                    ],
                    required: false
                },
                {
                    model: db.BookingSession,
                    as: 'bookingSession',
                    required: false,
                    include: [
                        {
                            model: db.Appointment,
                            as: 'appointments',
                            include: [
                                {
                                    model: db.Service,
                                    as: 'service',
                                    attributes: ['id', 'name_en', 'name_ar', 'duration'],
                                    required: true
                                },
                                {
                                    model: db.Staff,
                                    as: 'staff',
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
                            required: false
                        }
                    ]
                }
            ],
            order: [
                [{ model: db.BookingSession, as: 'bookingSession' }, { model: db.Appointment, as: 'appointments' }, 'bookingItemIndex', 'ASC']
            ]
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        const responseAppointment = appointment.toJSON();
        responseAppointment.events = Array.isArray(responseAppointment.events)
            ? responseAppointment.events
                .slice()
                .sort((a, b) => new Date(a.occurredAt || a.createdAt || 0) - new Date(b.occurredAt || b.createdAt || 0))
            : [];

        res.json({
            success: true,
            appointment: responseAppointment
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
                },
                {
                    model: db.BookingSession,
                    as: 'bookingSession',
                    required: false,
                    include: [
                        {
                            model: db.Appointment,
                            as: 'appointments',
                            required: false,
                            include: [
                                {
                                    model: db.Service,
                                    as: 'service',
                                    attributes: ['id', 'name_en', 'name_ar', 'duration'],
                                    required: true
                                },
                                {
                                    model: db.Staff,
                                    as: 'staff',
                                    attributes: ['id', 'name', 'photo'],
                                    required: false
                                },
                                {
                                    model: db.PlatformUser,
                                    as: 'user',
                                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', ['profileImage', 'photo']],
                                    required: false
                                }
                            ]
                        }
                    ]
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

        const totalPrice = parseFloat(appointment.price || 0);
        const totalPaid = parseFloat(appointment.totalPaid || 0);
        const isSettledByAmount = Number.isFinite(totalPrice) && totalPrice > 0 && Number.isFinite(totalPaid) && totalPaid >= totalPrice;
        const isSettledByStatus = isAppointmentFullyPaid(appointment.paymentStatus) || `${appointment.paymentStatus || ''}`.trim().toLowerCase() === 'paid';
        const previousStatus = appointment.status;

        if (normalizedStatus === 'completed' && appointment.status !== 'completed' && !isSettledByAmount && !isSettledByStatus) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                code: 'APPOINTMENT_PAYMENT_REQUIRED',
                message: 'You can not change to completed unless the booking amount is paid.'
            });
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
        if (normalizedStatus === 'no_show' && !appointment.noShowMarkedAt) {
            appointment.noShowMarkedAt = new Date();
        }

        await appointment.save({ transaction });
        await createAppointmentEventSafe({
            appointmentId: appointment.id,
            tenantId,
            platformUserId: appointment.platformUserId,
            actorType: 'tenant',
            actorId: req.userId || null,
            eventType: 'tenant_status_changed',
            payload: {
                fromStatus: previousStatus,
                toStatus: normalizedStatus,
                notes: notes || null
            },
            occurredAt: new Date(),
            transaction
        });
        await transaction.commit();

        try {
            const serviceName = appointment.service?.name_en || appointment.service?.name_ar || 'service';
            const appointmentDate = new Date(appointment.startTime).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
            let customerName = 'A customer';
            try {
                if (appointment.platformUserId) {
                    const customer = await db.PlatformUser.findByPk(appointment.platformUserId, {
                        attributes: ['firstName', 'lastName']
                    });
                    if (customer) {
                        customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customerName;
                    }
                }
            } catch (_lookupError) {
                // Keep generic fallback name if lookup fails.
            }

            if (normalizedStatus === 'checked_in') {
                await pushNotificationService.sendToStaff(appointment.staffId, {
                    title: 'Customer arrived',
                    body: `${customerName} arrived for ${serviceName}.`,
                    data: {
                        type: 'staff_appointment_arrived',
                        appointmentId: appointment.id,
                        tenantId,
                        status: normalizedStatus
                    }
                });

                await createStaffAppointmentMessage({
                    tenantId,
                    staffId: appointment.staffId,
                    customerName,
                    serviceName,
                    appointmentDate,
                    action: 'checked_in'
                });

                await pushNotificationService.sendToUser(appointment.platformUserId, {
                    title: 'Booking updated',
                    body: 'Your appointment is now marked as arrived.',
                    data: {
                        type: 'booking_status_updated',
                        appointmentId: appointment.id,
                        status: normalizedStatus
                    }
                });
            } else if (normalizedStatus === 'in_service') {
                await appointmentLifecycleService.notifyServiceStarted(appointment);
            } else if (normalizedStatus === 'completed') {
                await appointmentLifecycleService.notifyServiceCompleted(appointment);
            } else if (normalizedStatus === 'cancelled' || normalizedStatus === 'no_show') {
                await pushNotificationService.sendToStaff(appointment.staffId, {
                    title: normalizedStatus === 'cancelled' ? 'Appointment cancelled' : 'Marked as no-show',
                    body: normalizedStatus === 'cancelled'
                        ? `${customerName} appointment for ${serviceName} was cancelled.`
                        : `${customerName} was marked as no-show for ${serviceName}.`,
                    data: {
                        type: normalizedStatus === 'cancelled' ? 'staff_appointment_cancelled' : 'staff_appointment_no_show',
                        appointmentId: appointment.id,
                        tenantId,
                        status: normalizedStatus
                    }
                });

                await createStaffAppointmentMessage({
                    tenantId,
                    staffId: appointment.staffId,
                    customerName,
                    serviceName,
                    appointmentDate,
                    action: normalizedStatus === 'cancelled' ? 'cancelled' : 'no_show'
                });

                await pushNotificationService.sendToUser(appointment.platformUserId, {
                    title: 'Booking updated',
                    body: normalizedStatus === 'cancelled'
                        ? 'Your appointment has been cancelled.'
                        : 'Your appointment was marked as no-show.',
                    data: {
                        type: 'booking_status_updated',
                        appointmentId: appointment.id,
                        status: normalizedStatus
                    }
                });

                await customerNotificationService.sendCustomerInboxNotification(
                    tenantId,
                    appointment.platformUserId,
                    normalizedStatus === 'cancelled' ? 'Appointment cancelled' : 'Appointment marked as no-show',
                    normalizedStatus === 'cancelled'
                        ? `Your ${serviceName} appointment was cancelled.`
                        : `Your ${serviceName} appointment was marked as no-show.`,
                    {
                        type: normalizedStatus === 'cancelled' ? 'appointment_cancelled' : 'appointment_no_show',
                        appointmentId: appointment.id,
                        status: normalizedStatus
                    }
                );
            } else {
                await pushNotificationService.sendToUser(appointment.platformUserId, {
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
        const { paymentStatus, paymentMethod, amount, paymentAllocations, transactionRef, notes } = req.body;
        const requestId = `pay_${Date.now()}_${id}`;

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
                },
                {
                    model: db.BookingSession,
                    as: 'bookingSession',
                    required: false,
                    include: [{
                        model: db.Appointment,
                        as: 'appointments',
                        required: false,
                        include: [
                            {
                                model: db.Service,
                                as: 'service',
                                required: false
                            },
                            {
                                model: db.PaymentTransaction,
                                as: 'paymentTransactions',
                                required: false
                            }
                        ]
                    }]
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
        const previousPaymentMethod = appointment.paymentMethod || null;

        const roundMoney = (value) => Number.parseFloat(Number(value || 0).toFixed(2));
        const getAppointmentDueAmount = (targetAppointment) => {
            const paymentStatusValue = `${targetAppointment.paymentStatus || ''}`.trim().toLowerCase();
            if (paymentStatusValue === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID) {
                const remainder = roundMoney(targetAppointment.remainderAmount || 0);
                return remainder > 0 ? remainder : 0;
            }

            const totalPrice = roundMoney(targetAppointment.price || 0);
            const totalPaid = roundMoney(targetAppointment.totalPaid || 0);
            const dueAmount = roundMoney(totalPrice - totalPaid);
            return dueAmount > 0 ? dueAmount : 0;
        };

        const bookingSession = appointment.bookingSession || null;
        const sessionAppointments = Array.isArray(bookingSession?.appointments)
            ? bookingSession.appointments
                .filter((sessionAppointment) => sessionAppointment && `${sessionAppointment.status || ''}`.trim().toLowerCase() !== 'cancelled')
                .slice()
                .sort((left, right) => {
                    const leftIndex = Number.isFinite(Number(left.bookingItemIndex)) ? Number(left.bookingItemIndex) : 0;
                    const rightIndex = Number.isFinite(Number(right.bookingItemIndex)) ? Number(right.bookingItemIndex) : 0;
                    if (leftIndex !== rightIndex) {
                        return leftIndex - rightIndex;
                    }
                    return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
                })
            : [];
        const payableSessionAppointments = sessionAppointments
            .map((sessionAppointment) => ({
                appointment: sessionAppointment,
                dueAmount: getAppointmentDueAmount(sessionAppointment)
            }))
            .filter((entry) => entry.dueAmount > 0.009);
        const hasSessionCheckout = Boolean(bookingSession?.id && payableSessionAppointments.length > 1);

        if (hasSessionCheckout) {
            const sessionDueAmount = roundMoney(
                payableSessionAppointments.reduce((sum, entry) => sum + entry.dueAmount, 0)
            );
            const numericRequestedAmount = Number(amount);
            const normalizedRequestedAmount = Number.isFinite(numericRequestedAmount) && numericRequestedAmount > 0
                ? roundMoney(numericRequestedAmount)
                : null;
            const paymentAmount = normalizedRequestedAmount && Math.abs(normalizedRequestedAmount - sessionDueAmount) <= 0.5
                ? normalizedRequestedAmount
                : sessionDueAmount;
            const normalizedSessionPaymentAllocations = normalizePaymentAllocations({
                amount: paymentAmount,
                paymentMethod,
                paymentAllocations,
                fallbackSource: paymentMethod || bookingSession.paymentMethod || appointment.paymentMethod || 'cash'
            });
            const allocationBuckets = normalizedSessionPaymentAllocations.map((allocation) => ({
                ...allocation,
                remaining: roundMoney(allocation.amount)
            }));

            const allocateForAppointment = (targetAmount) => {
                let remainingTargetAmount = roundMoney(targetAmount);
                const assignedAllocations = [];

                for (const bucket of allocationBuckets) {
                    if (remainingTargetAmount <= 0.009) break;
                    if (bucket.remaining <= 0.009) continue;

                    const takeAmount = roundMoney(Math.min(bucket.remaining, remainingTargetAmount));
                    if (takeAmount <= 0) continue;

                    assignedAllocations.push({
                        paymentMethod: bucket.paymentMethod,
                        amount: takeAmount,
                        giftCardCode: bucket.giftCardCode || undefined,
                        notes: bucket.notes || undefined
                    });
                    bucket.remaining = roundMoney(bucket.remaining - takeAmount);
                    remainingTargetAmount = roundMoney(remainingTargetAmount - takeAmount);
                }

                if (remainingTargetAmount > 0.01) {
                    throw new Error('Payment allocations must add up to the payment amount');
                }

                return assignedAllocations;
            };

            const sessionTransactionRefBase = transactionRef || `APT-PAY-${bookingSession.bookingReference || appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`;

            for (let index = 0; index < payableSessionAppointments.length; index += 1) {
                const target = payableSessionAppointments[index];
                const targetAppointment = target.appointment;
                const targetAllocations = allocateForAppointment(target.dueAmount);
                const resolvedPaymentMethod = targetAllocations.length > 1
                    ? 'split'
                    : targetAllocations[0]?.paymentMethod || paymentMethod || targetAppointment.paymentMethod || bookingSession.paymentMethod || 'cash';
                const transactionType = `${targetAppointment.paymentStatus || ''}`.trim().toLowerCase() === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                    ? 'remainder'
                    : 'full';

                if (targetAllocations.some((allocation) => allocation.paymentMethod === 'wallet')) {
                    await createAppointmentPaymentTransactions({
                        appointment: targetAppointment,
                        type: transactionType,
                        amount: target.dueAmount,
                        paymentMethod: resolvedPaymentMethod,
                        paymentAllocations: targetAllocations,
                        processedBy: null,
                        transactionRef: payableSessionAppointments.length > 1
                            ? `${sessionTransactionRefBase}-${index + 1}`
                            : sessionTransactionRefBase,
                        notes: notes || (paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                            ? 'Deposit collected from tenant dashboard'
                            : 'Full payment collected from tenant dashboard'),
                        source: 'tenant_booking_session_payment_status_update',
                        transaction
                    });
                } else {
                    await createAppointmentPaymentTransactions({
                        appointment: targetAppointment,
                        type: transactionType,
                        amount: target.dueAmount,
                        paymentMethod: resolvedPaymentMethod,
                        paymentAllocations: targetAllocations,
                        processedBy: null,
                        transactionRef: payableSessionAppointments.length > 1
                            ? `${sessionTransactionRefBase}-${index + 1}`
                            : sessionTransactionRefBase,
                        notes: notes || (paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                            ? 'Deposit collected from tenant dashboard'
                            : 'Full payment collected from tenant dashboard'),
                        source: 'tenant_booking_session_payment_status_update',
                        transaction
                    });
                }

                const targetPreviousPaid = roundMoney(targetAppointment.totalPaid || 0);
                const targetTotalPrice = roundMoney(targetAppointment.price || 0);
                targetAppointment.paymentStatus = APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;
                targetAppointment.paidAt = targetAppointment.paidAt || new Date();
                targetAppointment.depositPaid = true;
                targetAppointment.remainderPaid = true;
                targetAppointment.remainderAmount = 0;
                targetAppointment.totalPaid = targetTotalPrice > 0 ? targetTotalPrice : roundMoney(targetPreviousPaid + target.dueAmount);
                targetAppointment.paymentMethod = resolvedPaymentMethod;
                if (targetAppointment.status === 'pending') {
                    targetAppointment.status = 'confirmed';
                }
                await targetAppointment.save({ transaction });
            }

            await syncBookingSessionTotals(bookingSession.id, transaction);

            if (appointment.platformUserId) {
                const sessionTotalPaidDelta = roundMoney(
                    payableSessionAppointments.reduce((sum, entry) => sum + entry.dueAmount, 0)
                );
                if (sessionTotalPaidDelta > 0) {
                    await db.PlatformUser.increment('totalSpent', {
                        by: sessionTotalPaidDelta,
                        where: { id: appointment.platformUserId },
                        transaction
                    });

                    await db.CustomerInsight.increment('totalSpent', {
                        by: sessionTotalPaidDelta,
                        where: { platformUserId: appointment.platformUserId, tenantId },
                        transaction
                    });
                }
            }

            await transaction.commit();

            try {
                const primaryInvoice = await ensureAppointmentInvoice(appointment.id, {
                    triggerSource: 'tenant_dashboard_booking_session_payment_update'
                });
                if (primaryInvoice?.id) {
                    await sendCustomerInvoiceLifecycleEmail(primaryInvoice.id);
                }
            } catch (invoiceError) {
                console.warn('Tenant booking payment invoice email warning:', invoiceError.message);
            }

            res.json({
                success: true,
                message: 'Payment status updated successfully',
                appointment
            });
            return;
        }

        logTenantAppointmentAudit('payment_update_requested', {
            requestId,
            tenantId,
            appointmentId: id,
            previousPaymentStatus,
            requestedPaymentStatus: paymentStatus,
            previousTotalPaid,
            requestedPaymentMethod: paymentMethod || null
        });

        appointment.paymentStatus = paymentStatus;
        if (paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID) {
            appointment.paidAt = new Date();
            appointment.depositAmount = 0;
            appointment.depositPaid = true;
            appointment.remainderAmount = 0;
            appointment.remainderPaid = true;
            appointment.totalPaid = appointment.price;
            if (appointment.status === 'pending') {
                appointment.status = 'confirmed';
            }
        } else if (paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID) {
            appointment.depositPaid = true;
            appointment.remainderPaid = false;
            if (!appointment.depositAmount || parseFloat(appointment.depositAmount) === 0) {
                const splitPayment = await calculateSplitPayment(tenantId, appointment.price || 0);
                appointment.depositAmount = splitPayment.depositAmount;
                appointment.remainderAmount = splitPayment.remainderAmount;
                appointment.totalPaid = splitPayment.depositAmount;
            }
            const totalPrice = parseFloat(appointment.price || 0);
            const totalPaid = parseFloat(appointment.totalPaid || 0);
            const fullyCovered = Number.isFinite(totalPrice) && Number.isFinite(totalPaid) && totalPrice > 0 && totalPaid >= totalPrice;
            if (fullyCovered) {
                appointment.paymentStatus = APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;
                appointment.remainderAmount = 0;
                appointment.remainderPaid = true;
            }
            appointment.paidAt = appointment.paidAt || new Date();
            if (appointment.status === 'pending') {
                appointment.status = 'confirmed';
            }
        } else if (paymentStatus === APPOINTMENT_PAYMENT_STATUS.PENDING) {
            appointment.paidAt = null;
            appointment.depositPaid = false;
            appointment.remainderPaid = false;
            appointment.totalPaid = 0;
        }

        const nextTotalPaid = parseFloat(appointment.totalPaid || 0);
        const paymentDelta = parseFloat((nextTotalPaid - previousTotalPaid).toFixed(2));
        const normalizedPaymentAllocations = paymentDelta > 0 && Array.isArray(paymentAllocations) && paymentAllocations.length > 0
            ? normalizePaymentAllocations({
                amount: paymentDelta,
                paymentMethod,
                paymentAllocations,
                fallbackSource: paymentMethod || appointment.paymentMethod || 'cash'
            })
            : null;
        const resolvedPaymentMethod = normalizedPaymentAllocations
            ? (normalizedPaymentAllocations.length > 1
                ? 'split'
                : normalizedPaymentAllocations[0]?.paymentMethod || paymentMethod || appointment.paymentMethod || null)
            : (paymentMethod || appointment.paymentMethod || null);
        if (resolvedPaymentMethod) {
            appointment.paymentMethod = resolvedPaymentMethod;
        }

        await appointment.save({ transaction });

        await createAppointmentEventSafe({
            appointmentId: appointment.id,
            tenantId,
            platformUserId: appointment.platformUserId,
            actorType: 'tenant',
            actorId: req.userId || null,
            eventType: 'tenant_payment_status_changed',
            payload: {
                fromPaymentStatus: previousPaymentStatus,
                toPaymentStatus: paymentStatus,
                previousTotalPaid,
                nextTotalPaid,
                paymentDelta,
                fromPaymentMethod: previousPaymentMethod,
                toPaymentMethod: appointment.paymentMethod || null,
                transactionRef: transactionRef || null,
                notes: notes || null
            },
            occurredAt: new Date(),
            transaction
        });

        if (paymentDelta > 0) {
            const transactionType = paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                ? 'deposit'
                : previousPaymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                    ? 'remainder'
                    : 'full';
            if (normalizedPaymentAllocations) {
                await createAppointmentPaymentTransactions({
                    appointment,
                    type: transactionType,
                    amount: paymentDelta,
                    paymentMethod: resolvedPaymentMethod || paymentMethod || appointment.paymentMethod || 'cash',
                    paymentAllocations: normalizedPaymentAllocations,
                    processedBy: null,
                    transactionRef: transactionRef || `APT-PAY-${appointment.bookingNumber || appointment.id.slice(0, 8).toUpperCase()}`,
                    notes: notes || (paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                        ? 'Deposit collected from tenant dashboard'
                        : 'Full payment collected from tenant dashboard'),
                    source: 'tenant_appointment_payment_status_update',
                    transaction
                });
            } else {
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
        logTenantAppointmentAudit('payment_update_committed', {
            requestId,
            tenantId,
            appointmentId: appointment.id,
            previousPaymentStatus,
            nextPaymentStatus: appointment.paymentStatus,
            previousTotalPaid,
            nextTotalPaid: parseFloat(appointment.totalPaid || 0),
            paymentDelta,
            paymentMethod: appointment.paymentMethod || null
        });

        try {
            await appointmentLifecycleService.notifyPaymentCollected(appointment, {
                paymentStatus,
                paymentDelta,
                paymentMethod: appointment.paymentMethod,
                transactionRef
            });
        } catch (notificationError) {
            console.warn('Tenant booking payment notification warning:', notificationError.message);
        }

        try {
            const invoice = await ensureAppointmentInvoice(appointment.id, {
                triggerSource: 'tenant_dashboard_payment_update'
            });
            if (invoice?.id) {
                await sendCustomerInvoiceLifecycleEmail(invoice.id);
            }
        } catch (invoiceError) {
            console.warn('Tenant booking payment invoice email warning:', invoiceError.message);
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
        const requestId = `reassign_${Date.now()}_${id}`;

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
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'preferredLanguage'],
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
            logTenantAppointmentAudit('reassign_noop', {
                requestId,
                tenantId,
                appointmentId: appointment.id,
                staffId
            });
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

        const slotAvailable = await ensureStaffSlotAvailable({
            tenantId,
            serviceId: appointment.serviceId,
            staffId,
            startTime: appointment.startTime
        });
        if (!slotAvailable) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: 'Selected staff is not available for this time slot'
            });
        }

        appointment.requestedStaffId = staffId;
        appointment.assignmentMode = 'tenant_reassigned';
        const previousStaffId = appointment.staffId;
        appointment.staffId = staffId;
        await appointment.save({ transaction });
        await createAppointmentEventSafe({
            appointmentId: appointment.id,
            tenantId,
            platformUserId: appointment.platformUserId,
            actorType: 'tenant',
            actorId: req.userId || null,
            eventType: 'tenant_reassigned',
            payload: {
                fromStaffId: previousStaffId || null,
                toStaffId: staffId
            },
            occurredAt: new Date(),
            transaction
        });

        await transaction.commit();
        logTenantAppointmentAudit('reassign_committed', {
            requestId,
            tenantId,
            appointmentId: appointment.id,
            previousStaffId,
            nextStaffId: staffId,
            startTime: appointment.startTime
        });

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

            await createStaffAppointmentMessage({
                tenantId,
                staffId,
                customerName,
                serviceName,
                appointmentDate,
                action: 'reassigned'
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
        const requestId = `reschedule_${Date.now()}_${id}`;

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
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'preferredLanguage'],
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

        const slotAvailable = await ensureStaffSlotAvailable({
            tenantId,
            serviceId: appointment.serviceId,
            staffId: requestedStaffId,
            startTime: requestedStart
        });
        if (!slotAvailable) {
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

        if (appointment.service?.allowReschedule !== true) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Rescheduling is not enabled for this service'
            });
        }

        const previousStaffId = appointment.staffId;
        const previousStartTime = appointment.startTime;
        const previousEndTime = appointment.endTime;
        appointment.staffId = requestedStaffId;
        appointment.startTime = requestedStart;
        appointment.endTime = requestedEnd;
        appointment.customerReminderSentAt = null;
        appointment.noShowMarkedAt = null;
        await appointment.save({ transaction });
        await createAppointmentEventSafe({
            appointmentId: appointment.id,
            tenantId,
            platformUserId: appointment.platformUserId,
            actorType: 'tenant',
            actorId: req.userId || null,
            eventType: 'tenant_rescheduled',
            payload: {
                fromStaffId: previousStaffId || null,
                toStaffId: requestedStaffId || null,
                fromStartTime: previousStartTime ? new Date(previousStartTime).toISOString() : null,
                fromEndTime: previousEndTime ? new Date(previousEndTime).toISOString() : null,
                toStartTime: requestedStart.toISOString(),
                toEndTime: requestedEnd.toISOString()
            },
            occurredAt: new Date(),
            transaction
        });
        await transaction.commit();
        logTenantAppointmentAudit('reschedule_committed', {
            requestId,
            tenantId,
            appointmentId: appointment.id,
            previousStaffId,
            nextStaffId: requestedStaffId,
            previousStartTime,
            nextStartTime: requestedStart.toISOString(),
            previousEndTime,
            nextEndTime: requestedEnd.toISOString()
        });

        try {
            const customerName = appointment.user
                ? `${appointment.user.firstName || ''} ${appointment.user.lastName || ''}`.trim()
                : 'A customer';
            const serviceName = appointment.service?.name_en || appointment.service?.name_ar || 'service';
            const customerLocale = appointment.user?.preferredLanguage === 'ar' ? 'ar' : 'en';
            const appointmentDate = requestedStart.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });

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

            await sendAppointmentRescheduleEmail({
                to: appointment.user?.email,
                customerName,
                tenantName: 'Refah',
                startTime: requestedStart,
                serviceName,
                oldStartTime: previousStartTime,
                newStaffName: assignedStaff?.name || '',
                oldStaffName: appointment.staff?.name || '',
                bookingReference: appointment.bookingNumber || appointment.bookingReference || '',
                locale: customerLocale
            });

            if (appointment.staffId) {
                await pushNotificationService.sendToStaff(appointment.staffId, {
                    title: 'Appointment rescheduled',
                    body: `${customerName} updated ${serviceName} for ${appointmentDate}.`,
                    data: {
                        type: 'staff_appointment_rescheduled',
                        appointmentId: appointment.id,
                        tenantId,
                        platformUserId: appointment.platformUserId
                    }
                });

                await createStaffAppointmentMessage({
                    tenantId,
                    staffId: appointment.staffId,
                    customerName,
                    serviceName,
                    appointmentDate,
                    action: 'assigned'
                });
            }
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
 * Reassign and/or reschedule appointment from board drag-drop in one atomic operation.
 * PATCH /api/v1/tenant/appointments/:id/reassign-reschedule
 */
exports.reassignRescheduleAppointment = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        if (!TENANT_APPOINTMENT_ADVANCED_DRAG_ENABLED) {
            await transaction.rollback();
            return res.status(403).json({
                success: false,
                message: 'Advanced drag and drop scheduling is currently disabled'
            });
        }

        const tenantId = req.tenantId;
        const { id } = req.params;
        const { staffId, startTime, notifyCustomer = false } = req.body || {};

        if (!staffId || !startTime) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'staffId and startTime are required'
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

        if (requestedStart.getTime() <= Date.now()) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'New appointment time must be in the future'
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
                message: 'Closed appointments cannot be changed'
            });
        }

        const assignedStaff = await db.Staff.findOne({
            where: { id: staffId, tenantId, isActive: true },
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

        const currentStart = new Date(appointment.startTime);
        const currentEnd = new Date(appointment.endTime);
        const durationMinutes = Math.max(15, Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000));
        const requestedEnd = new Date(requestedStart.getTime() + durationMinutes * 60000);

        const hasConflict = await bookingService.hasConflict(
            staffId,
            requestedStart,
            requestedEnd,
            appointment.id,
            transaction
        );

        if (hasConflict) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: 'Selected slot is not available'
            });
        }

        const slotAvailable = await ensureStaffSlotAvailable({
            tenantId,
            serviceId: appointment.serviceId,
            staffId,
            startTime: requestedStart
        });
        if (!slotAvailable) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: 'Selected slot is not available'
            });
        }

        const previousStaffId = appointment.staffId;
        const previousStartTime = currentStart;
        const previousEndTime = currentEnd;
        const changedStaff = previousStaffId !== staffId;
        const changedTime = previousStartTime.getTime() !== requestedStart.getTime();

        appointment.staffId = staffId;
        appointment.requestedStaffId = staffId;
        appointment.assignmentMode = 'tenant_reassigned';
        appointment.startTime = requestedStart;
        appointment.endTime = requestedEnd;
        appointment.customerReminderSentAt = null;
        appointment.noShowMarkedAt = null;
        await appointment.save({ transaction });
        await createAppointmentEventSafe({
            appointmentId: appointment.id,
            tenantId,
            platformUserId: appointment.platformUserId,
            actorType: 'tenant',
            actorId: req.userId || null,
            eventType: 'tenant_reassign_reschedule',
            payload: {
                changedStaff,
                changedTime,
                fromStaffId: previousStaffId || null,
                toStaffId: staffId,
                fromStartTime: previousStartTime.toISOString(),
                fromEndTime: previousEndTime.toISOString(),
                toStartTime: requestedStart.toISOString(),
                toEndTime: requestedEnd.toISOString()
            },
            occurredAt: new Date(),
            transaction
        });

        await transaction.commit();
        logTenantAppointmentAudit('reassign_reschedule_committed', {
            tenantId,
            appointmentId: appointment.id,
            changedStaff,
            changedTime,
            nextStaffId: staffId,
            nextStartTime: requestedStart.toISOString()
        });

        if (notifyCustomer && appointment.platformUserId) {
            try {
                const appointmentDate = requestedStart.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                });
                await pushNotificationService.sendToUser(appointment.platformUserId, {
                    title: 'Booking updated',
                    body: `Your appointment is now scheduled for ${appointmentDate}.`,
                    data: {
                        type: 'booking_rescheduled',
                        appointmentId: appointment.id,
                        startTime: requestedStart.toISOString(),
                        staffId
                    }
                });

                await sendAppointmentRescheduleEmail({
                    to: appointment.user?.email,
                    customerName: appointment.user
                        ? `${appointment.user.firstName || ''} ${appointment.user.lastName || ''}`.trim()
                        : 'A customer',
                    tenantName: 'Refah',
                    startTime: requestedStart,
                    serviceName: appointment.service?.name_en || appointment.service?.name_ar || 'service',
                    oldStartTime: previousStartTime,
                    newStaffName: assignedStaff?.name || '',
                    oldStaffName: appointment.staff?.name || '',
                    bookingReference: appointment.bookingNumber || appointment.bookingReference || '',
                    locale: appointment.user?.preferredLanguage === 'ar' ? 'ar' : 'en'
                });
            } catch (notificationError) {
                console.warn('Board drag-drop customer notification warning:', notificationError.message);
            }
        }

        return res.json({
            success: true,
            message: 'Appointment updated successfully',
            appointment,
            changedStaff,
            changedTime
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Reassign-reschedule appointment error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update appointment',
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

