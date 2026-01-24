const bookingService = require('../services/bookingService');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Search for available slots
 * POST /api/v1/bookings/search
 * Public endpoint - tenantId required in request body
 */
const searchAvailability = async (req, res) => {
    try {
        const { serviceId, staffId, date, tenantId } = req.body;

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
            date
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
        const { serviceId, staffId, startTime, tenantId } = req.body;
        const platformUserId = req.userId; // From auth middleware

        // Validation
        if (!serviceId || !startTime) {
            return res.status(400).json({
                success: false,
                message: 'serviceId and startTime are required. staffId is optional (for "Any Staff" selection).'
            });
        }

        // Get tenantId from request body or use default
        let finalTenantId = tenantId || req.tenantId;
        
        // If no tenantId provided, try to get from service
        if (!finalTenantId) {
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

        // Use unified booking service
        // staffId is optional - if not provided, system will auto-assign best available staff
        const appointment = await bookingService.createBooking({
            serviceId,
            staffId: staffId || null, // null = "Any Staff"
            platformUserId,
            tenantId: finalTenantId,
            startTime
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
        if (error.message.includes('required') || error.message.includes('not found')) {
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

module.exports = {
    searchAvailability,
    getRecommendations,
    createBooking,
    getBooking,
    cancelBooking,
    listBookings,
    getNextAvailableSlot
};
