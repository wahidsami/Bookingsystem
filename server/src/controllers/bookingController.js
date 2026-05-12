const bookingService = require('../services/bookingService');
const db = require('../models');
const { Op } = require('sequelize');
const { SERVICE_PAYMENT_METHOD_RULES } = require('../utils/tenantPaymentSettings');
const { getServerPublicUrl } = require('../utils/url');

const normalizeBookingItemPaymentMethod = (value) => {
    const normalized = `${value || 'at-center'}`.trim().toLowerCase();
    return SERVICE_PAYMENT_METHOD_RULES[normalized] ? normalized : null;
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
            variantId
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
                    notes: item.notes || notes || null,
                    paymentMethod: normalizedPaymentMethod,
                    assignmentMode: item.assignmentMode || (item.staffId ? 'tenant_reassigned' : undefined)
                };
            });

            const { session, appointments, paymentSummary } = await bookingService.createBookingSession({
                tenantId: finalTenantId,
                platformUserId,
                items: normalizedItems,
                notes: notes || null,
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
            notes,
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

        const appointment = await bookingService.cancelAppointment(id, platformUserId);

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
                { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'slug', 'logo'], required: false }
            ]
        });

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Invite not found' });
        }

        const isExpired = !!appointment.inviteExpiresAt && new Date(appointment.inviteExpiresAt).getTime() < Date.now();

        return res.json({
            success: true,
            invite: {
                token,
                isExpired,
                appointmentId: appointment.id,
                platformUserId: appointment.platformUserId,
                customerConfirmationRequired: !!appointment.customerConfirmationRequired,
                customerConfirmationStatus: appointment.customerConfirmationStatus || 'not_required',
                inviteExpiresAt: appointment.inviteExpiresAt,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                status: appointment.status,
                service: appointment.service || null,
                staff: appointment.staff || null,
                tenant: appointment.tenant || null
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
    const deepLink = `refah://appointment-invite/${encodeURIComponent(token || '')}`;
    const androidStore = process.env.ANDROID_APP_URL || 'https://play.google.com/store';
    const iosStore = process.env.IOS_APP_URL || 'https://apps.apple.com';
    const apiBase = `${(getServerPublicUrl() || 'http://localhost:5000').replace(/\/+$/, '')}/api/v1`;
    const inviteApiUrl = `${apiBase}/bookings/invites/${encodeURIComponent(token || '')}`;

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Refah Appointment Invite</title>
<style>body{font-family:Arial,sans-serif;padding:24px;max-width:520px;margin:0 auto;color:#111}a.button{display:inline-block;margin-top:8px;padding:10px 14px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px}small{display:block;margin-top:16px;color:#666}</style>
</head><body>
<h2>Refah Appointment Invite</h2>
<p>Opening Refah app to confirm your appointment.</p>
<a class="button" href="${deepLink}">Open Refah App</a>
<p>If you do not have the app yet, install it first:</p>
<a href="${androidStore}">Android</a> | <a href="${iosStore}">iOS</a>
<small>If the app did not open automatically, use the button above.</small>
<script>
setTimeout(function(){ window.location.href='${deepLink}'; }, 400);
setTimeout(function(){
fetch('${inviteApiUrl}').then(r=>r.json()).then(data=>{
if(data && data.success && data.invite && data.invite.platformUserId){
console.log('Invite is linked to an existing Refah user');
}
});
}, 1200);
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

        return res.json({
            success: true,
            message: response === 'confirm' ? 'Appointment confirmed' : 'Appointment declined',
            appointment
        });
    } catch (error) {
        console.error('Respond to invite error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to submit response' });
    }
};

module.exports = {
    searchAvailability,
    getRecommendations,
    createBooking,
    getBooking,
    cancelBooking,
    listBookings,
    getNextAvailableSlot,
    getInviteDetails,
    openInvite,
    respondToInvite
};
