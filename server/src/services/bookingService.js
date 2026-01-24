const db = require('../models');
const { Op } = require('sequelize');
const userService = require('./userService');

class BookingService {

    /**
     * Unified booking creation method
     * This is the single source of truth for all booking creation
     * Used by both authenticated and public booking endpoints
     * 
     * @param {Object} data - Booking data
     * @param {string} data.serviceId - Service ID (required)
     * @param {string} data.staffId - Staff ID (optional, for "Any Staff" support)
     * @param {string} data.platformUserId - Platform User ID (required)
     * @param {string} data.tenantId - Tenant ID (required)
     * @param {Date|string} data.startTime - Start time (required)
     * @param {Object} options - Additional options
     * @param {Object} options.transaction - Database transaction (optional)
     * @returns {Promise<Appointment>}
     */
    async createBooking(data, options = {}) {
        const { serviceId, staffId, platformUserId, tenantId, startTime } = data;
        const transaction = options.transaction;
        
        // Use transaction if provided, otherwise create one
        const shouldCommit = !transaction;
        const finalTransaction = transaction || await db.sequelize.transaction();
        
        try {

        // ========== VALIDATION ==========
        if (!serviceId) throw new Error('Service ID is required');
        if (!platformUserId) throw new Error('Platform User ID is required');
        if (!tenantId) throw new Error('Tenant ID is required');
        if (!startTime) throw new Error('Start time is required');

        // Validate tenant exists and is active
        const tenant = await db.Tenant.findByPk(tenantId, { transaction: finalTransaction });
        if (!tenant) throw new Error('Tenant not found');
        if (tenant.status !== 'approved') {
            throw new Error(`Tenant account is ${tenant.status}. Please contact support.`);
        }

        // Validate service exists and belongs to tenant
        const service = await db.Service.findByPk(serviceId, { transaction: finalTransaction });
        if (!service) throw new Error('Service not found');
        if (service.tenantId !== tenantId) {
            throw new Error('Service does not belong to this tenant');
        }
        if (!service.isActive) throw new Error('Service is not active');

        // Validate platform user exists and is active
        const platformUser = await db.PlatformUser.findByPk(platformUserId, { transaction: finalTransaction });
        if (!platformUser) throw new Error('Platform user not found');
        if (!platformUser.isActive) throw new Error('User account is inactive');
        if (platformUser.isBanned) throw new Error('User account is banned');

        // Get tenant booking settings for policy enforcement
        const tenantSettings = await db.TenantSettings.findOne({
            where: { tenantId },
            transaction: finalTransaction
        });

        const bookingSettings = tenantSettings?.bookingSettings || {};
        const allowAnyStaff = bookingSettings.allowAnyStaff !== false; // Default true
        const maxBookingsPerCustomerPerDay = bookingSettings.maxBookingsPerCustomerPerDay || null;

        // Handle "Any Staff" selection
        let finalStaffId = staffId;
        if (!finalStaffId) {
            // Check if "Any Staff" is allowed
            if (!allowAnyStaff) {
                throw new Error('Staff selection is required. Please select a staff member.');
            }
            // Auto-assign best available staff
            finalStaffId = await this._selectBestAvailableStaff(tenantId, serviceId, startTime, finalTransaction);
            if (!finalStaffId) {
                throw new Error('No available staff for this service at the selected time');
            }
        }

        // Validate staff exists, is active, and can perform service
        const staff = await db.Staff.findByPk(finalStaffId, { transaction: finalTransaction });
        if (!staff) throw new Error('Staff not found');
        if (staff.tenantId !== tenantId) {
            throw new Error('Staff does not belong to this tenant');
        }
        if (!staff.isActive) throw new Error('Staff is not active');

        // Check if staff can perform this service
        const canPerform = await db.ServiceEmployee.findOne({
            where: { serviceId, staffId: finalStaffId },
            transaction: finalTransaction
        });
        if (!canPerform) {
            throw new Error('Selected staff cannot perform this service');
        }

        // ========== TIME CALCULATION ==========
        const start = new Date(startTime);
        if (isNaN(start.getTime())) {
            throw new Error('Invalid start time format');
        }

        const duration = service.duration || 30; // Default 30 minutes
        const end = new Date(start.getTime() + duration * 60000);

        // Validate start time is in the future (allow 1 hour buffer for same-day bookings)
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60000);
        if (start < oneHourFromNow) {
            throw new Error('Booking must be at least 1 hour in advance');
        }

        // ========== POLICY ENFORCEMENT ==========
        // Check max bookings per customer per day
        if (maxBookingsPerCustomerPerDay !== null && maxBookingsPerCustomerPerDay > 0) {
            const startOfDay = new Date(start);
        startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(start);
        endOfDay.setHours(23, 59, 59, 999);

            const todayBookings = await db.Appointment.count({
            where: {
                    platformUserId,
                    tenantId,
                startTime: { [Op.between]: [startOfDay, endOfDay] },
                status: { [Op.notIn]: ['cancelled', 'no_show'] }
            },
                transaction: finalTransaction
            });

            if (todayBookings >= maxBookingsPerCustomerPerDay) {
                throw new Error(`Maximum ${maxBookingsPerCustomerPerDay} booking${maxBookingsPerCustomerPerDay > 1 ? 's' : ''} per day allowed. You have already booked ${todayBookings} appointment${todayBookings > 1 ? 's' : ''} today.`);
            }
        }

        // ========== CONFLICT DETECTION ==========
        const hasConflict = await this.hasConflict(finalStaffId, start, end, null, finalTransaction);
        if (hasConflict) {
            throw new Error('Time slot not available - conflict detected');
        }

        // ========== PRICING CALCULATION ==========
        const pricing = db.Appointment.calculateRevenueBreakdown(service, staff);

        // ========== REDIS LOCK (Phase 6.2) ==========
        // Acquire short-term lock to prevent concurrent bookings of same slot
        const lockKey = `booking:${finalStaffId}:${start.toISOString()}`;
        const redisService = require('./redisService');
        const lockAcquired = await redisService.acquireLock(lockKey, 300); // 5 minutes

        if (!lockAcquired) {
            throw new Error('This time slot is currently being booked by another customer. Please try again in a moment.');
        }

        try {
            // ========== FINAL CONFLICT CHECK (Transaction-level protection) ==========
            // Re-check conflict right before creation to prevent race conditions
            const finalConflictCheck = await this.hasConflict(finalStaffId, start, end, null, finalTransaction);
            if (finalConflictCheck) {
                throw new Error('Time slot is no longer available. Please select another time.');
            }

            // ========== CREATE APPOINTMENT ==========
            const appointment = await db.Appointment.create({
                serviceId,
                staffId: finalStaffId,
                platformUserId,
                tenantId, // Store tenantId for faster queries
                startTime: start,
                endTime: end,
                price: pricing.price,
                rawPrice: pricing.rawPrice,
                taxAmount: pricing.taxAmount,
                platformFee: pricing.platformFee,
                tenantRevenue: pricing.tenantRevenue,
                employeeRevenue: pricing.employeeRevenue,
                employeeCommissionRate: pricing.employeeCommissionRate,
                employeeCommission: pricing.employeeCommission,
                status: 'confirmed',
                paymentStatus: 'pending'
            }, { transaction: finalTransaction });

            // ========== UPDATE RELATED RECORDS ==========
            // Update staff stats
            await db.Staff.increment('totalBookings', {
                where: { id: finalStaffId },
                transaction: finalTransaction
            });

            // Update platform user stats
            await db.PlatformUser.increment('totalBookings', {
                where: { id: platformUserId },
                transaction: finalTransaction
            });
            await db.PlatformUser.increment('totalSpent', {
                by: pricing.price,
                where: { id: platformUserId },
                transaction: finalTransaction
            });

            // Update CustomerInsight
            await this._updateCustomerInsight(
                platformUserId,
                tenantId,
                serviceId,
                finalStaffId,
                pricing.price,
                start,
                finalTransaction
            );

            // Update tenant usage for subscription tracking
            try {
                const { updateUsage } = require('../middleware/checkSubscription');
                await updateUsage(tenantId, 'booking', true);
            } catch (usageError) {
                console.error('Failed to update usage:', usageError);
                // Don't fail booking if usage tracking fails
            }

            // Commit transaction if we created it
            if (shouldCommit) {
                await finalTransaction.commit();
            }

            // Release lock on success
            await redisService.releaseLock(lockKey);

            return appointment;
        } catch (innerError) {
            // Inner catch - handles errors during appointment creation
            // Release lock on error
            try {
                await redisService.releaseLock(lockKey);
            } catch (lockError) {
                // Ignore lock release errors
            }
            
            // Rollback transaction if we created it
            if (shouldCommit && finalTransaction && !finalTransaction.finished) {
                try {
                    await finalTransaction.rollback();
                } catch (rollbackError) {
                    console.warn('Transaction rollback warning:', rollbackError.message);
                }
            }
            throw innerError;
        }
        
        } catch (error) {
            // Outer catch - handles validation errors before lock acquisition
            throw error;
        }
    }

    /**
     * Select best available staff for "Any Staff" bookings
     * @private
     */
    async _selectBestAvailableStaff(tenantId, serviceId, startTime, transaction) {
        // Get all staff who can perform this service
        const serviceEmployees = await db.ServiceEmployee.findAll({
            where: { serviceId },
            transaction: transaction
        });

        if (serviceEmployees.length === 0) {
            return null;
        }

        // Get staff IDs and fetch staff records
        const staffIds = serviceEmployees.map(se => se.staffId);
        const staffMembers = await db.Staff.findAll({
            where: {
                id: { [Op.in]: staffIds },
                tenantId,
                isActive: true
            },
            transaction: transaction
        });

        if (staffMembers.length === 0) {
            return null;
        }

        const start = new Date(startTime);
        const service = await db.Service.findByPk(serviceId, { transaction: transaction });
        const duration = service.duration || 30;
        const end = new Date(start.getTime() + duration * 60000);

        // Check availability for each staff member
        // Sort by rating (best first) for better assignment
        const sortedStaff = staffMembers.sort((a, b) => (b.rating || 0) - (a.rating || 0));

        for (const staff of sortedStaff) {
            const hasConflict = await this.hasConflict(staff.id, start, end, null, transaction);
            if (!hasConflict) {
                // Return first available staff (sorted by rating)
                // TODO: Enhance with workload balance, customer history, etc.
                return staff.id;
            }
        }

        return null;
    }

    /**
     * Check for booking conflicts
     * Enhanced conflict detection with buffer support
     * 
     * @param {string} staffId - Staff ID
     * @param {Date} startTime - Appointment start time
     * @param {Date} endTime - Appointment end time
     * @param {string} excludeAppointmentId - Appointment ID to exclude from check (for updates)
     * @param {Object} transaction - Database transaction
     * @returns {Promise<boolean>} - true if conflict exists
     */
    async hasConflict(staffId, startTime, endTime, excludeAppointmentId = null, transaction = null) {
        const where = {
            staffId,
            status: { [Op.notIn]: ['cancelled', 'no_show'] },
            [Op.or]: [
                // New appointment starts during existing appointment
                {
                    [Op.and]: [
                        { startTime: { [Op.lte]: startTime } },
                        { endTime: { [Op.gt]: startTime } }
                    ]
                },
                // New appointment ends during existing appointment
                {
                    [Op.and]: [
                        { startTime: { [Op.lt]: endTime } },
                        { endTime: { [Op.gte]: endTime } }
                    ]
                },
                // New appointment completely contains existing appointment
                {
                    [Op.and]: [
                        { startTime: { [Op.gte]: startTime } },
                        { endTime: { [Op.lte]: endTime } }
                    ]
                },
                // Existing appointment completely contains new appointment
                {
                    [Op.and]: [
                        { startTime: { [Op.lte]: startTime } },
                        { endTime: { [Op.gte]: endTime } }
                    ]
                }
            ]
        };

        if (excludeAppointmentId) {
            where.id = { [Op.ne]: excludeAppointmentId };
        }

        const conflicts = await db.Appointment.findAll({
            where,
            transaction: transaction
        });

        return conflicts.length > 0;
    }

    /**
     * Calculate pricing breakdown
     * Uses Appointment model's static method
     * 
     * @param {Service} service - Service model instance
     * @param {Staff} staff - Staff model instance
     * @returns {Object} Pricing breakdown
     */
    calculatePricing(service, staff) {
        return db.Appointment.calculateRevenueBreakdown(service, staff);
    }

    /**
     * Get available slots (delegates to AvailabilityService)
     * Kept for backward compatibility
     */
    async getAvailableSlots(tenantId, { serviceId, staffId, date }) {
        const availabilityService = require('./availabilityService');
        const result = await availabilityService.getAvailableSlots(tenantId, {
            serviceId,
            staffId: staffId || null,
            date
        });
        return result.slots; // Return just slots for backward compatibility
    }

    _generateTimeSlots(startTime, endTime, duration, bookedSlots, date) {
        const slots = [];
        const [startHour, startMinute] = startTime.split(':');
        const [endHour, endMinute] = endTime.split(':');

        let current = new Date(date);
        current.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

        const endDateTime = new Date(date);
        endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

        while (current < endDateTime) {
            const slotEnd = new Date(current.getTime() + duration * 60000);

            const hasConflict = bookedSlots.some(appointment => {
                const apptStart = new Date(appointment.startTime);
                const apptEnd = new Date(appointment.endTime);
                return (current >= apptStart && current < apptEnd) ||
                    (slotEnd > apptStart && slotEnd <= apptEnd) ||
                    (current <= apptStart && slotEnd >= apptEnd);
            });

            if (!hasConflict && slotEnd <= endDateTime) {
                slots.push({
                    startTime: new Date(current),
                    endTime: new Date(slotEnd),
                    available: true
                });
            }

            current = new Date(current.getTime() + 15 * 60000);
        }

        return slots;
    }

    async getStaffRecommendations(platformUserId, serviceId, preferredTime) {
        // Get all active staff
        const staff = await db.Staff.findAll({
            where: { isActive: true }
        });

        if (!staff || staff.length === 0) return [];

        // Get user booking history if platformUserId provided
        const userHistory = platformUserId ? await db.Appointment.findAll({
            where: { 
                platformUserId,
                status: 'completed'
            }
        }) : [];

        // Score each staff member
        const recommendations = await Promise.all(
            staff.map(async (staffMember) => {
                const score = await this._calculateAIScore(
                    staffMember,
                    platformUserId,
                    userHistory,
                    preferredTime
                );

                return {
                    ...staffMember.toJSON(),
                    aiScore: score,
                    recommended: score > 75
                };
            })
        );

        return recommendations.sort((a, b) => b.aiScore - a.aiScore);
    }

    async _calculateAIScore(staff, platformUserId, userHistory, preferredTime) {
        let score = 0;

        // User History Score (40 points)
        const previousBookings = userHistory.filter(
            appt => appt.staffId === staff.id
        );
        if (previousBookings.length > 0) {
            score += Math.min(40, previousBookings.length * 10);
        }

        // Staff Rating Score (30 points)
        const ratingScore = (parseFloat(staff.rating) / 5.0) * 30;
        score += ratingScore;

        // Time Preference Score (20 points)
        const hour = new Date(preferredTime).getHours();
        const isPeakHour = hour >= 10 && hour <= 18;
        score += isPeakHour ? 20 : 10;

        // Current Demand Score (10 points)
        const upcomingBookings = await db.Appointment.count({
            where: {
                staffId: staff.id,
                startTime: { [Op.gte]: new Date() },
                status: { [Op.notIn]: ['cancelled', 'no_show'] }
            }
        });

        const demandScore = Math.max(0, 10 - upcomingBookings);
        score += demandScore;

        return Math.round(score);
    }

    async createAppointment(data) {
        const { serviceId, staffId, platformUserId, tenantId, startTime } = data;

        if (!platformUserId) {
            throw new Error('platformUserId is required');
        }

        if (!tenantId) {
            throw new Error('tenantId is required');
        }

        const service = await db.Service.findByPk(serviceId);
        if (!service) throw new Error('Service not found');

        // Verify platform user exists
        const platformUser = await db.PlatformUser.findByPk(platformUserId);
        if (!platformUser) throw new Error('Platform user not found');
        if (!platformUser.isActive) throw new Error('User account is inactive');
        if (platformUser.isBanned) throw new Error('User account is banned');

        const start = new Date(startTime);
        const end = new Date(start.getTime() + service.duration * 60000);

        // Check for conflicts
        const conflicts = await db.Appointment.findAll({
            where: {
                staffId,
                status: { [Op.notIn]: ['cancelled', 'no_show'] },
                [Op.or]: [
                    { startTime: { [Op.between]: [start, end] } },
                    { endTime: { [Op.between]: [start, end] } },
                    {
                        [Op.and]: [
                            { startTime: { [Op.lte]: start } },
                            { endTime: { [Op.gte]: end } }
                        ]
                    }
                ]
            }
        });

        if (conflicts.length > 0) {
            throw new Error('Time slot not available - conflict detected');
        }

        // Legacy method - now calls unified createBooking
        // Kept for backward compatibility
        return await this.createBooking({
            serviceId,
            staffId,
            platformUserId,
            tenantId,
            startTime
        });
    }

    /**
     * Create or update CustomerInsight for a platform user at a specific tenant
     * @private
     */
    async _updateCustomerInsight(platformUserId, tenantId, serviceId, staffId, amount, visitDate, transaction = null) {
        const [customerInsight, created] = await db.CustomerInsight.findOrCreate({
            where: {
                platformUserId,
                tenantId
            },
            defaults: {
                platformUserId,
                tenantId,
                totalBookings: 0,
                totalSpent: 0.00,
                firstVisit: visitDate,
                lastVisit: visitDate,
                loyaltyTier: 'bronze'
            },
            transaction: transaction
        });

        // Update stats
        await customerInsight.increment('totalBookings', { transaction: transaction });
        await customerInsight.increment('totalSpent', { by: amount, transaction: transaction });
        await customerInsight.update({ lastVisit: visitDate }, { transaction: transaction });

        // Update favorite services
        const favoriteServices = customerInsight.favoriteServices || [];
        if (!favoriteServices.includes(serviceId)) {
            favoriteServices.push(serviceId);
            await customerInsight.update({ 
                favoriteServices: favoriteServices.slice(-10) // Keep last 10
            }, { transaction: transaction });
        }

        // Update favorite staff
        const favoriteStaff = customerInsight.favoriteStaff || [];
        if (!favoriteStaff.includes(staffId)) {
            favoriteStaff.push(staffId);
            await customerInsight.update({ 
                favoriteStaff: favoriteStaff.slice(-10) // Keep last 10
            }, { transaction: transaction });
        }

        // Update preferred times
        const hour = visitDate.getHours();
        const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
        const preferredTimes = customerInsight.preferredTimes || [];
        if (!preferredTimes.includes(timeSlot)) {
            preferredTimes.push(timeSlot);
            await customerInsight.update({ 
                preferredTimes: preferredTimes.slice(-3) // Keep last 3
            }, { transaction: transaction });
        }

        // Update loyalty tier based on total spent
        const updatedInsight = await db.CustomerInsight.findByPk(customerInsight.id, { transaction: transaction });
        let loyaltyTier = 'bronze';
        if (updatedInsight.totalSpent >= 5000) loyaltyTier = 'platinum';
        else if (updatedInsight.totalSpent >= 2000) loyaltyTier = 'gold';
        else if (updatedInsight.totalSpent >= 500) loyaltyTier = 'silver';

        if (updatedInsight.loyaltyTier !== loyaltyTier) {
            await updatedInsight.update({ loyaltyTier }, { transaction: transaction });
        }
    }

    async cancelAppointment(appointmentId, platformUserId = null) {
        const appointment = await db.Appointment.findByPk(appointmentId, {
            include: [
                { model: db.Service },
                { model: db.Staff }
            ]
        });

        if (!appointment) {
            throw new Error('Appointment not found');
        }

        // Verify ownership if platformUserId provided
        if (platformUserId && appointment.platformUserId !== platformUserId) {
            throw new Error('Unauthorized: You can only cancel your own appointments');
        }

        if (appointment.status === 'cancelled') {
            throw new Error('Appointment already cancelled');
        }

        await appointment.update({ status: 'cancelled' });

        // Update CustomerInsight cancellation count if platform user
        if (appointment.platformUserId) {
            // Get tenantId from staff or service (we need to add this to the appointment or get from context)
            // For now, we'll update the cancellation count when we have tenant context
            // This will be handled in the controller where we have tenantId
        }

        return appointment;
    }
}

module.exports = new BookingService();
