const bookingService = require('../services/bookingService');
const db = require('../models');
const { Op } = require('sequelize');
const { SERVICE_PAYMENT_METHOD_RULES } = require('../utils/tenantPaymentSettings');
const { getServerPublicUrl } = require('../utils/url');
const crypto = require('crypto');

const INVITE_ACCOUNT_MISMATCH_CODE = 'INVITE_ACCOUNT_MISMATCH';

const maskEmail = (email) => {
    const value = `${email || ''}`.trim().toLowerCase();
    if (!value || !value.includes('@')) return null;
    const [local, domain] = value.split('@');
    if (!local || !domain) return null;
    const first = local.slice(0, 1);
    const last = local.length > 1 ? local.slice(-1) : '';
    const stars = '*'.repeat(Math.max(2, local.length - 2));
    return `${first}${stars}${last}@${domain}`;
};

const hashInviteToken = (token) => crypto.createHash('sha256').update(`${token || ''}`).digest('hex').slice(0, 16);

const logInviteAttempt = (payload) => {
    try {
        console.info('[invite-response-audit]', JSON.stringify({
            at: new Date().toISOString(),
            ...payload
        }));
    } catch (error) {
        console.info('[invite-response-audit]', payload);
    }
};

const appendGroupGuestToNotes = (notes, groupGuest) => {
    if (!groupGuest || typeof groupGuest !== 'object') {
        return notes;
    }

    const firstName = `${groupGuest.firstName || ''}`.trim();
    const lastName = `${groupGuest.lastName || ''}`.trim();
    const phone = `${groupGuest.phone || ''}`.trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (!fullName) {
        return notes;
    }

    const payload = {
        fullName,
        phone: phone || null
    };

    const base = `${notes || ''}`.trim();
    const marker = `[GROUP_GUEST] ${JSON.stringify(payload)}`;
    return base ? `${base}\n${marker}` : marker;
};

const normalizeBookingItemPaymentMethod = (value) => {
    const normalized = `${value || 'at-center'}`.trim().toLowerCase();
    return SERVICE_PAYMENT_METHOD_RULES[normalized] ? normalized : null;
};

const RESCHEDULE_AUDIT_MARKER = '[RESCHEDULE_AUDIT]';
const CANCELLATION_AUDIT_MARKER = '[CANCELLATION_AUDIT]';

const appendRescheduleAuditToNotes = (notes, payload) => {
    const serialized = `${RESCHEDULE_AUDIT_MARKER} ${JSON.stringify(payload)}`;
    const base = `${notes || ''}`.trim();
    return base ? `${base}\n${serialized}` : serialized;
};

const appendCancellationAuditToNotes = (notes, payload) => {
    const serialized = `${CANCELLATION_AUDIT_MARKER} ${JSON.stringify(payload)}`;
    const base = `${notes || ''}`.trim();
    return base ? `${base}\n${serialized}` : serialized;
};

const createAppointmentEventSafe = async ({
    appointmentId,
    tenantId,
    platformUserId,
    actorType,
    actorId,
    eventType,
    payload,
    occurredAt,
    transaction
}) => {
    try {
        if (!db.AppointmentEvent || !appointmentId || !tenantId || !eventType) return;
        await db.AppointmentEvent.create({
            appointmentId,
            tenantId,
            platformUserId: platformUserId || null,
            actorType: actorType || 'customer',
            actorId: actorId || null,
            eventType,
            payload: payload || {},
            occurredAt: occurredAt || new Date()
        }, transaction ? { transaction } : undefined);
    } catch (error) {
        console.warn('Appointment event logging warning:', error.message);
    }
};

/**
 * Search for available slots
 * POST /api/v1/bookings/search
 * Public endpoint - tenantId required in request body
 */
const searchAvailability = async (req, res) => {
    try {
        const { serviceId, staffId, date, tenantId, variantId } = req.body;

        if (!serviceId || !date) {
            return res.status(400).json({
                success: false,
                message: 'serviceId and date are required'
            });
        }

        // tenantId is optional for now (for backward compatibility)
        // In production, this should be required or come from context
        const finalTenantId = tenantId || req.tenantId;

        if (!finalTenantId) {
            return res.status(400).json({
                success: false,
                message: 'tenantId is required'
            });
        }

        // Use new AvailabilityService
        const availabilityService = require('../services/availabilityService');
        const result = await availabilityService.getAvailableSlots(finalTenantId, {
            serviceId,
            staffId: staffId || null, // null = any staff
            date,
            variantId: variantId || null
        });

        res.json({
            success: true,
            slots: result.slots,
            date,
            totalSlots: result.slots.length,
            availableSlots: result.metadata.availableSlots,
            metadata: result.metadata
        });

    } catch (error) {
        console.error('Search availability error:', error);
        
        let statusCode = 500;
        if (error.message.includes('required') || error.message.includes('not found')) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({ 
            success: false,
            message: error.message 
        });
    }
};

/**
 * Get staff recommendations with AI scoring
 * GET /api/v1/bookings/recommendations
 * Optional auth - better recommendations if logged in
 */
const getRecommendations = async (req, res) => {
    try {
        const { serviceId, preferredTime } = req.query;
        const platformUserId = req.userId || null; // From optional auth

        if (!serviceId) {
            return res.status(400).json({ message: 'serviceId is required' });
        }

        const recommendations = await bookingService.getStaffRecommendations(
            platformUserId,
            serviceId,
            preferredTime ? new Date(preferredTime) : new Date()
        );

        res.json({
            recommendations,
            count: recommendations.length
        });

    } catch (error) {
        console.error('Get recommendations error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new booking
 * POST /api/v1/bookings/create
 * Requires authentication - uses platformUserId from JWT
 * Uses unified BookingService
 */
const createBooking = async (req, res) => {
    try {
        const {
            serviceId,
            staffId,
            requestedStaffId,
            startTime,
            tenantId,
            notes,
            paymentMethod,
            variantId,
            groupGuest
        } = req.body;
        const platformUserId = req.userId; // From auth middleware
        const bookingItems = Array.isArray(req.body.items) ? req.body.items : [];

        let finalTenantId = tenantId || req.tenantId;
        
        if (!finalTenantId) {
            const firstBookingServiceId = bookingItems[0]?.serviceId || serviceId;
            if (firstBookingServiceId) {
                const service = await db.Service.findByPk(firstBookingServiceId);
                if (service && service.tenantId) {
                    finalTenantId = service.tenantId;
                }
            }
        }

        if (!finalTenantId) {
            // If no tenantId provided, try to get from service
            const service = await db.Service.findByPk(serviceId);
            if (service && service.tenantId) {
                finalTenantId = service.tenantId;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'tenantId is required. Please specify which salon you are booking at.'
                });
            }
        }

        const normalizedNotes = appendGroupGuestToNotes(notes, groupGuest);

        if (bookingItems.length > 0) {
            const normalizedItems = bookingItems.map((item, index) => {
                const rawStartTime = item.startTime
                    || (item.date && item.time ? new Date(`${item.date}T${item.time}`).toISOString() : null)
                    || null;
                const parsedStartTime = rawStartTime ? new Date(rawStartTime) : null;

                if (!parsedStartTime || Number.isNaN(parsedStartTime.getTime())) {
                    throw new Error(`Invalid start time for booking item ${index + 1}`);
                }

                const normalizedPaymentMethod = normalizeBookingItemPaymentMethod(item.paymentMethod || paymentMethod);
                if (!normalizedPaymentMethod) {
                    throw new Error(`Invalid payment method for booking item ${index + 1}`);
                }

                return {
                    serviceId: item.serviceId,
                    variantId: item.variantId || null,
                    staffId: item.staffId || null,
                    requestedStaffId: item.requestedStaffId || item.staffId || null,
                    startTime: parsedStartTime.toISOString(),
                    notes: item.notes || normalizedNotes || null,
                    paymentMethod: normalizedPaymentMethod,
                    assignmentMode: item.assignmentMode || (item.staffId ? 'tenant_reassigned' : undefined)
                };
            });

            const { session, appointments, paymentSummary } = await bookingService.createBookingSession({
                tenantId: finalTenantId,
                platformUserId,
                items: normalizedItems,
                notes: normalizedNotes || null,
                paymentMethod: normalizedItems[0]?.paymentMethod || 'at-center'
            });

            const fullAppointments = await db.Appointment.findAll({
                where: {
                    bookingSessionId: session.id
                },
                include: [
                    { model: db.Service, as: 'service' },
                    { model: db.Staff, as: 'staff' },
                    {
                        model: db.PlatformUser,
                        as: 'user',
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
                    }
                ],
                order: [['bookingItemIndex', 'ASC']]
            });

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

        // Validation
        if (!serviceId || !startTime) {
            return res.status(400).json({
                success: false,
                message: 'serviceId and startTime are required. staffId is optional (for "Any Staff" selection).'
            });
        }

        if (paymentMethod && !SERVICE_PAYMENT_METHOD_RULES[paymentMethod]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method selected for this booking'
            });
        }

        // Use unified booking service
        // staffId is optional - if not provided, system will auto-assign best available staff
        const appointment = await bookingService.createBooking({
            serviceId,
            variantId: variantId || null,
            staffId: staffId || null, // null = "Any Staff"
            requestedStaffId: requestedStaffId || null,
            platformUserId,
            tenantId: finalTenantId,
            startTime,
            notes: normalizedNotes,
            paymentMethod
        });

        // Load related data with platform user
        const fullAppointment = await db.Appointment.findByPk(appointment.id, {
            include: [
                { model: db.Service, as: 'service' },
                { model: db.Staff, as: 'staff' },
                { 
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            appointment: fullAppointment
        });

    } catch (error) {
        console.error('Create booking error:', error);
        
        // Determine appropriate status code
        let statusCode = 500;
        if (error.message.includes('required')
            || error.message.includes('not found')
            || error.message.includes('payment option')
            || error.message.includes('Pay at')
            || error.message.includes('Cash on delivery')
            || error.message.includes('Online product payment')) {
            statusCode = 400;
        } else if (error.message.includes('conflict') || error.message.includes('not available')) {
            statusCode = 409; // Conflict
        } else if (error.message.includes('inactive') || error.message.includes('banned')) {
            statusCode = 403; // Forbidden
        }
        
        res.status(statusCode).json({ 
            success: false,
            message: error.message 
        });
    }
};

/**
 * Get booking details
 * GET /api/v1/bookings/:id
 * Optional auth - returns more details if user owns the booking
 */
const getBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const platformUserId = req.userId; // Optional from optionalAuth

        const appointment = await db.Appointment.findByPk(id, {
            include: [
                { model: db.Service, as: 'service' },
                { model: db.Staff, as: 'staff' },
                { model: db.Tenant, as: 'tenant', required: false },
                { 
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
                },
                // Keep legacy customer for backward compatibility
                { 
                    model: db.Customer,
                    as: 'legacyCustomer',
                    required: false
                }
            ]
        });

        if (!appointment) {
            return res.status(404).json({ 
                success: false,
                message: 'Booking not found' 
            });
        }

        // If user is authenticated and owns the booking, return full details
        // Otherwise, return limited details
        if (platformUserId && appointment.platformUserId === platformUserId) {
            res.json({ 
                success: true,
                appointment 
            });
        } else {
            // Return limited details for non-owners
            const limitedAppointment = {
                id: appointment.id,
                service: appointment.Service,
                staff: appointment.Staff,
                serviceVariantId: appointment.serviceVariantId,
                serviceVariantName: appointment.serviceVariantName,
                serviceVariantDescription: appointment.serviceVariantDescription,
                serviceVariantDuration: appointment.serviceVariantDuration,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                status: appointment.status,
                price: appointment.price
            };
            res.json({ 
                success: true,
                appointment: limitedAppointment 
            });
        }

    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

/**
 * Cancel a booking
 * PATCH /api/v1/bookings/:id/cancel
 * Requires authentication - users can only cancel their own bookings
 */
const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const platformUserId = req.userId; // From auth middleware
        const { reasonCode, reasonText } = req.body || {};

        const normalizedReasonCode = typeof reasonCode === 'string' ? reasonCode.trim().toLowerCase() : '';
        const normalizedReasonText = typeof reasonText === 'string' ? reasonText.trim() : '';
        const cancellationAudit = (normalizedReasonCode || normalizedReasonText)
            ? {
                reasonCode: normalizedReasonCode || null,
                reasonText: normalizedReasonText || null,
                source: 'customer_app',
                at: new Date().toISOString()
            }
            : null;

        const appointment = await bookingService.cancelAppointment(id, platformUserId, cancellationAudit
            ? {
                noteTransform: (existingNotes) => appendCancellationAuditToNotes(existingNotes, cancellationAudit)
            }
            : undefined);

        await createAppointmentEventSafe({
            appointmentId: appointment.id,
            tenantId: appointment.tenantId,
            platformUserId: appointment.platformUserId,
            actorType: 'customer',
            actorId: platformUserId,
            eventType: 'customer_cancelled',
            payload: {
                reasonCode: cancellationAudit?.reasonCode || null,
                reasonText: cancellationAudit?.reasonText || null
            },
            occurredAt: new Date()
        });

        res.json({
            success: true,
            message: 'Booking cancelled successfully',
            appointment
        });

    } catch (error) {
        console.error('Cancel booking error:', error);
        const statusCode = error.message.includes('Unauthorized') ? 403 : 
                          error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ 
            success: false,
            message: error.message 
        });
    }
};

/**
 * List all bookings (with filters)
 * GET /api/v1/bookings
 * If authenticated, returns user's bookings. Otherwise, requires filters.
 */
const listBookings = async (req, res) => {
    try {
        const { staffId, platformUserId, status, startDate, endDate, tenantId } = req.query;
        const authenticatedUserId = req.userId; // From optional auth

        const where = {};

        // If user is authenticated, default to their bookings
        if (authenticatedUserId) {
            where.platformUserId = authenticatedUserId;
        } else if (platformUserId) {
            // Allow explicit platformUserId for admin/tenant views
            where.platformUserId = platformUserId;
        }

        // Legacy support - filter by customerId if provided
        if (req.query.customerId) {
            where.customerId = req.query.customerId;
        }

        if (staffId) where.staffId = staffId;
        if (status) where.status = status;

        if (startDate || endDate) {
            where.startTime = {};
            if (startDate) where.startTime[Op.gte] = new Date(startDate);
            if (endDate) where.startTime[Op.lte] = new Date(endDate);
        }

        const appointments = await db.Appointment.findAll({
            where,
            include: [
                { model: db.Service, as: 'service' },
                { model: db.Staff, as: 'staff' },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    required: false,
                    attributes: ['id', 'name', 'slug', 'logo']
                },
                { 
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                },
                // Legacy customer support
                { 
                    model: db.Customer,
                    as: 'legacyCustomer',
                    required: false
                }
            ],
            order: [['startTime', 'DESC']] // Most recent first
        });

        res.json({
            success: true,
            appointments,
            count: appointments.length
        });

    } catch (error) {
        console.error('List bookings error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

/**
 * Get next available slot for a service and staff
 * GET /api/v1/bookings/next-available
 * Query params: tenantId, serviceId, staffId, daysToSearch (optional)
 */
const getNextAvailableSlot = async (req, res) => {
    try {
        const { tenantId, serviceId, staffId, daysToSearch } = req.query;

        if (!tenantId || !serviceId || !staffId) {
            return res.status(400).json({
                success: false,
                message: 'tenantId, serviceId, and staffId are required'
            });
        }

        const availabilityService = require('../services/availabilityService');
        const result = await availabilityService.getNextAvailableSlot(tenantId, {
            serviceId,
            staffId,
            daysToSearch: daysToSearch ? parseInt(daysToSearch) : 14
        });

        res.json(result);

    } catch (error) {
        console.error('Get next available slot error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to find next available slot'
        });
    }
};

/**
 * Reschedule a booking (customer app)
 * PATCH /api/v1/bookings/:id/reschedule
 */
const rescheduleBooking = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { id } = req.params;
        const platformUserId = req.userId;
        const { startTime, staffId } = req.body || {};

        if (!startTime) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'startTime is required' });
        }

        const requestedStart = new Date(startTime);
        if (Number.isNaN(requestedStart.getTime())) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Invalid startTime' });
        }

        const appointment = await db.Appointment.findOne({
            where: { id, platformUserId },
            include: [
                { model: db.Service, as: 'service', required: true },
                { model: db.Staff, as: 'staff', required: true }
            ],
            transaction
        });

        if (!appointment) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (!['pending', 'confirmed'].includes(appointment.status)) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Only pending or confirmed bookings can be rescheduled' });
        }

        if (appointment.service?.allowReschedule !== true) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Reschedule is not enabled for this service' });
        }

        const hoursUntilCurrentStart = (new Date(appointment.startTime).getTime() - Date.now()) / (60 * 60 * 1000);
        if (hoursUntilCurrentStart <= 24) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Bookings can only be rescheduled more than 24 hours before the original start time'
            });
        }

        if (requestedStart.getTime() <= Date.now()) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'New booking time must be in the future' });
        }

        const requestedStaffId = staffId || appointment.staffId;
        const previousStaffId = appointment.staffId;
        const previousStartTime = appointment.startTime;
        const previousEndTime = appointment.endTime;
        const assignedStaff = await db.Staff.findOne({
            where: {
                id: requestedStaffId,
                tenantId: appointment.staff?.tenantId || appointment.tenantId,
                isActive: true
            },
            transaction
        });

        if (!assignedStaff) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Staff member not found' });
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
            return res.status(409).json({ success: false, message: 'Selected time slot is no longer available' });
        }

        appointment.staffId = requestedStaffId;
        appointment.startTime = requestedStart;
        appointment.endTime = requestedEnd;
        appointment.notes = appendRescheduleAuditToNotes(appointment.notes, {
            at: new Date().toISOString(),
            actor: 'customer',
            fromStartTime: new Date(previousStartTime).toISOString(),
            fromEndTime: new Date(previousEndTime).toISOString(),
            toStartTime: requestedStart.toISOString(),
            toEndTime: requestedEnd.toISOString(),
            fromStaffId: previousStaffId || null,
            toStaffId: requestedStaffId || null
        });
        appointment.customerReminderSentAt = null;
        appointment.noShowMarkedAt = null;
        await createAppointmentEventSafe({
            appointmentId: appointment.id,
            tenantId: appointment.tenantId,
            platformUserId: appointment.platformUserId,
            actorType: 'customer',
            actorId: platformUserId,
            eventType: 'customer_rescheduled',
            payload: {
                fromStartTime: new Date(previousStartTime).toISOString(),
                fromEndTime: new Date(previousEndTime).toISOString(),
                toStartTime: requestedStart.toISOString(),
                toEndTime: requestedEnd.toISOString(),
                fromStaffId: previousStaffId || null,
                toStaffId: requestedStaffId || null
            },
            occurredAt: new Date(),
            transaction
        });
        await appointment.save({ transaction });
        await transaction.commit();

        const refreshed = await db.Appointment.findByPk(appointment.id, {
            include: [
                { model: db.Service, as: 'service' },
                { model: db.Staff, as: 'staff' },
                { model: db.Tenant, as: 'tenant', required: false, attributes: ['id', 'name', 'slug', 'logo'] }
            ]
        });

        return res.json({
            success: true,
            message: 'Booking rescheduled successfully',
            appointment: refreshed || appointment
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        console.error('Reschedule booking error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to reschedule booking' });
    }
};

/**
 * Public invite details endpoint (token-based).
 * GET /api/v1/bookings/invites/:token
 */
const getInviteDetails = async (req, res) => {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Invite token is required' });
        }

        const appointment = await db.Appointment.findOne({
            where: { inviteToken: token },
            include: [
                { model: db.Service, as: 'service', attributes: ['id', 'name_en', 'name_ar', 'duration'] },
                { model: db.Staff, as: 'staff', attributes: ['id', 'name'] },
                { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'slug', 'logo'], required: false },
                { model: db.PlatformUser, as: 'user', attributes: ['id', 'email'], required: false }
            ]
        });

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Invite not found' });
        }

        const isExpired = !!appointment.inviteExpiresAt && new Date(appointment.inviteExpiresAt).getTime() < Date.now();

        const requestUserId = req.userId || null;
        const canRespondWhileAuthenticated = !requestUserId || !appointment.platformUserId || requestUserId === appointment.platformUserId;

        return res.json({
            success: true,
            invite: {
                token,
                isExpired,
                appointmentId: appointment.id,
                platformUserId: appointment.platformUserId,
                recipientMaskedEmail: maskEmail(appointment.user?.email),
                canRespondWhileAuthenticated,
                customerConfirmationRequired: !!appointment.customerConfirmationRequired,
                customerConfirmationStatus: appointment.customerConfirmationStatus || 'not_required',
                inviteExpiresAt: appointment.inviteExpiresAt,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                status: appointment.status,
                service: appointment.service || null,
                staff: appointment.staff || null,
                tenant: appointment.tenant || null,
                openUrl: `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1/bookings/invites/${encodeURIComponent(token)}/open`
            }
        });
    } catch (error) {
        console.error('Get invite details error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to load invite details' });
    }
};

/**
 * Public invite landing page to open app deep-link.
 * GET /api/v1/bookings/invites/:token/open
 */
const openInvite = async (req, res) => {
    const { token } = req.params;
    const normalizedToken = encodeURIComponent(token || '');
    const deepLinkPrimary = `com.refah.mobile://appointment-invite/${normalizedToken}`;
    const deepLinkLegacy = `refah://appointment-invite/${normalizedToken}`;
    const androidStore = process.env.ANDROID_APP_URL || 'https://play.google.com/store';
    const iosStore = process.env.IOS_APP_URL || 'https://apps.apple.com';
    const apiBase = `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1`;
    const inviteApiUrl = `${apiBase}/bookings/invites/${encodeURIComponent(token || '')}`;
    const inviteRespondUrl = `${apiBase}/bookings/invites/${encodeURIComponent(token || '')}/respond`;

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Refah Appointment Invite</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;max-width:560px;margin:0 auto;color:#111;background:#f7f7fb}
.card{background:#fff;border-radius:14px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
.row{margin:8px 0;font-size:14px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
button,a.button{display:inline-block;padding:10px 14px;border-radius:10px;border:0;cursor:pointer;text-decoration:none;font-weight:600}
.primary{background:#7c3aed;color:#fff}
.danger{background:#ef4444;color:#fff}
.ghost{background:#fff;color:#7c3aed;border:1px solid #c4b5fd}
.muted{color:#666;font-size:12px;margin-top:12px}
.status{margin-top:10px;font-size:13px}
</style>
</head><body>
<div class="card">
<h2 style="margin:0 0 10px 0;">Refah Appointment Confirmation</h2>
<p style="margin:0 0 12px 0;">Review and confirm your appointment.</p>
<div id="details" class="row">Loading appointment details...</div>
<div class="actions">
  <button class="primary" id="confirmBtn">Confirm Appointment</button>
  <button class="danger" id="declineBtn">Decline Appointment</button>
  <a class="button ghost" href="${deepLinkPrimary}">Open in Refah App</a>
</div>
<p class="status" id="status"></p>
<p class="muted">No app installed? You can confirm directly on this page. Install app: <a href="${androidStore}">Android</a> | <a href="${iosStore}">iOS</a></p>
</div>
<script>
const detailsEl = document.getElementById('details');
const statusEl = document.getElementById('status');
const confirmBtn = document.getElementById('confirmBtn');
const declineBtn = document.getElementById('declineBtn');

function setStatus(message, isError) {
  statusEl.textContent = message || '';
  statusEl.style.color = isError ? '#dc2626' : '#16a34a';
}

function humanDate(value) {
  try { return new Date(value).toLocaleString(); } catch { return value || '-'; }
}

async function loadInvite() {
  try {
    const response = await fetch('${inviteApiUrl}');
    const data = await response.json();
    if (!data || !data.success || !data.invite) {
      detailsEl.textContent = 'Invite not found.';
      confirmBtn.disabled = true;
      declineBtn.disabled = true;
      return;
    }
    const invite = data.invite;
    if (invite.isExpired) {
      detailsEl.textContent = 'This invite has expired.';
      confirmBtn.disabled = true;
      declineBtn.disabled = true;
      return;
    }
    if (invite.customerConfirmationStatus !== 'pending') {
      detailsEl.textContent = 'This invite was already handled.';
      confirmBtn.disabled = true;
      declineBtn.disabled = true;
      return;
    }
    const serviceName = (invite.service && (invite.service.name_en || invite.service.name_ar)) || 'Service';
    const staffName = invite.staff && invite.staff.name ? invite.staff.name : 'Provider';
    const tenantName = invite.tenant && invite.tenant.name ? invite.tenant.name : 'Refah';
    detailsEl.innerHTML =
      '<strong>Center:</strong> ' + tenantName + '<br/>' +
      '<strong>Service:</strong> ' + serviceName + '<br/>' +
      '<strong>Provider:</strong> ' + staffName + '<br/>' +
      '<strong>Date:</strong> ' + humanDate(invite.startTime);
  } catch (error) {
    detailsEl.textContent = 'Failed to load appointment details.';
    confirmBtn.disabled = true;
    declineBtn.disabled = true;
  }
}

async function respond(responseValue) {
  try {
    setStatus('Submitting...', false);
    confirmBtn.disabled = true;
    declineBtn.disabled = true;
    const response = await fetch('${inviteRespondUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: responseValue })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setStatus((data && data.message) ? data.message : 'Failed to submit response.', true);
      confirmBtn.disabled = false;
      declineBtn.disabled = false;
      return;
    }
    setStatus(responseValue === 'confirm' ? 'Appointment confirmed successfully.' : 'Appointment declined successfully.', false);
  } catch (error) {
    setStatus('Failed to submit response.', true);
    confirmBtn.disabled = false;
    declineBtn.disabled = false;
  }
}

confirmBtn.addEventListener('click', function(){ respond('confirm'); });
declineBtn.addEventListener('click', function(){ respond('decline'); });
loadInvite();
setTimeout(function(){ window.location.href='${deepLinkPrimary}'; setTimeout(function(){ window.location.href='${deepLinkLegacy}'; }, 450); }, 400);
</script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
};

/**
 * Public review landing page to open app deep-link.
 * GET /api/v1/bookings/:id/review/open
 */
const openReviewLink = async (req, res) => {
    const { id } = req.params;
    const normalizedId = encodeURIComponent(id || '');
    const deepLinkPrimary = `com.refah.mobile://review?appointmentId=${normalizedId}`;
    const deepLinkLegacy = `refah://review?appointmentId=${normalizedId}`;
    const androidStore = process.env.ANDROID_APP_URL || 'https://play.google.com/store';
    const iosStore = process.env.IOS_APP_URL || 'https://apps.apple.com';

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Refah Review</title>
<style>body{font-family:Arial,sans-serif;padding:24px;max-width:520px;margin:0 auto;color:#111}a.button{display:inline-block;margin-top:8px;padding:10px 14px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px}small{display:block;margin-top:16px;color:#666}</style>
</head><body>
<h2>Rate Your Appointment</h2>
<p>Open Refah app to leave your review.</p>
<a class="button" href="${deepLinkPrimary}">Open Refah App</a>
<p>If you do not have the app yet, install it first:</p>
<a href="${androidStore}">Android</a> | <a href="${iosStore}">iOS</a>
<small>If the app did not open automatically, use the button above.</small>
<script>
function tryOpenRefahApp() {
  window.location.href='${deepLinkPrimary}';
  setTimeout(function(){ window.location.href='${deepLinkLegacy}'; }, 450);
}
setTimeout(tryOpenRefahApp, 300);
</script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
};

/**
 * Authenticated customer response to tenant-created invite.
 * POST /api/v1/bookings/:id/respond
 */
const respondToInvite = async (req, res) => {
    try {
        const { id } = req.params;
        const { response } = req.body || {};
        const platformUserId = req.userId;

        if (!['confirm', 'decline'].includes(`${response || ''}`)) {
            return res.status(400).json({ success: false, message: 'response must be confirm or decline' });
        }

        const appointment = await db.Appointment.findByPk(id);
        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }
        if (appointment.platformUserId !== platformUserId) {
            return res.status(403).json({ success: false, message: 'You are not authorized for this appointment' });
        }
        if (!appointment.customerConfirmationRequired) {
            return res.status(400).json({ success: false, message: 'This appointment does not require confirmation' });
        }
        if (appointment.customerConfirmationStatus !== 'pending') {
            return res.status(400).json({ success: false, message: 'This invite has already been handled' });
        }

        appointment.customerConfirmationStatus = response === 'confirm' ? 'confirmed' : 'declined';
        appointment.customerConfirmedAt = new Date();
        if (response === 'confirm') {
            appointment.status = 'confirmed';
        } else {
            appointment.status = 'cancelled';
        }
        await appointment.save();

        const appointmentWithContext = await db.Appointment.findByPk(appointment.id, {
            include: [
                { model: db.Service, as: 'service', attributes: ['id', 'name_en', 'name_ar'], required: false },
                { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName'], required: false }
            ]
        });

        const customerName = `${appointmentWithContext?.user?.firstName || ''} ${appointmentWithContext?.user?.lastName || ''}`.trim() || 'Customer';
        const serviceName = appointmentWithContext?.service?.name_en || appointmentWithContext?.service?.name_ar || 'service';
        const when = new Date(appointment.startTime).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        try {
            await db.StaffMessage.create({
                tenantId: appointment.tenantId,
                senderType: 'admin',
                senderId: appointment.tenantId,
                recipientType: null,
                recipientId: null,
                subject: response === 'confirm' ? 'Customer confirmed appointment' : 'Customer declined appointment',
                body: response === 'confirm'
                    ? `${customerName} confirmed ${serviceName} on ${when}.`
                    : `${customerName} declined ${serviceName} on ${when}.`,
                isPinned: false,
                readBy: []
            });
        } catch (messageError) {
            console.warn('Failed to create tenant dashboard message for invite response:', messageError.message);
        }

        return res.json({
            success: true,
            message: response === 'confirm' ? 'Appointment confirmed' : 'Appointment cancelled',
            appointment
        });
    } catch (error) {
        console.error('Respond to invite error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to submit response' });
    }
};

/**
 * Token-based customer response to tenant-created invite (works without login).
 * POST /api/v1/bookings/invites/:token/respond
 */
const respondToInviteByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const { response } = req.body || {};
        const platformUserId = req.userId || null;

        if (!['confirm', 'decline'].includes(`${response || ''}`)) {
            return res.status(400).json({ success: false, message: 'response must be confirm or decline' });
        }

        const appointment = await db.Appointment.findOne({
            where: { inviteToken: token }
        });
        const inviteTokenHash = hashInviteToken(token);

        if (!appointment) {
            logInviteAttempt({
                inviteTokenHash,
                appointmentId: null,
                platformUserId,
                decision: 'blocked',
                reason: 'invite_not_found'
            });
            return res.status(404).json({ success: false, message: 'Invite not found' });
        }

        const isExpired = !!appointment.inviteExpiresAt && new Date(appointment.inviteExpiresAt).getTime() < Date.now();
        if (isExpired) {
            logInviteAttempt({
                inviteTokenHash,
                appointmentId: appointment.id,
                platformUserId,
                decision: 'blocked',
                reason: 'invite_expired'
            });
            return res.status(410).json({ success: false, message: 'Invite link has expired' });
        }

        if (!appointment.customerConfirmationRequired) {
            logInviteAttempt({
                inviteTokenHash,
                appointmentId: appointment.id,
                platformUserId,
                decision: 'blocked',
                reason: 'confirmation_not_required'
            });
            return res.status(400).json({ success: false, message: 'This appointment does not require confirmation' });
        }

        if (appointment.customerConfirmationStatus !== 'pending') {
            logInviteAttempt({
                inviteTokenHash,
                appointmentId: appointment.id,
                platformUserId,
                decision: 'blocked',
                reason: 'invite_already_handled'
            });
            return res.status(400).json({ success: false, message: 'This invite has already been handled' });
        }

        // If an authenticated user is present, enforce strict owner match.
        // Logged-out users can still respond through secure token web flow.
        if (platformUserId && appointment.platformUserId && appointment.platformUserId !== platformUserId) {
            logInviteAttempt({
                inviteTokenHash,
                appointmentId: appointment.id,
                platformUserId,
                appointmentOwnerId: appointment.platformUserId,
                decision: 'blocked',
                reason: 'authenticated_user_mismatch'
            });
            return res.status(403).json({
                success: false,
                code: INVITE_ACCOUNT_MISMATCH_CODE,
                message: 'This invite belongs to another account. Please switch account or continue in browser.'
            });
        }

        appointment.customerConfirmationStatus = response === 'confirm' ? 'confirmed' : 'declined';
        appointment.customerConfirmedAt = new Date();
        appointment.status = response === 'confirm' ? 'confirmed' : 'cancelled';
        await appointment.save();
        logInviteAttempt({
            inviteTokenHash,
            appointmentId: appointment.id,
            platformUserId,
            appointmentOwnerId: appointment.platformUserId,
            decision: 'allowed',
            reason: response === 'confirm' ? 'confirmed' : 'declined'
        });

        return res.json({
            success: true,
            message: response === 'confirm' ? 'Appointment confirmed' : 'Appointment cancelled',
            appointment
        });
    } catch (error) {
        console.error('Respond to invite by token error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to submit response' });
    }
};

module.exports = {
    searchAvailability,
    getRecommendations,
    createBooking,
    getBooking,
    cancelBooking,
    rescheduleBooking,
    listBookings,
    getNextAvailableSlot,
    getInviteDetails,
    openInvite,
    openReviewLink,
    respondToInvite,
    respondToInviteByToken
};
