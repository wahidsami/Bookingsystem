const db = require('../models');
const { Op } = require('sequelize');
const userService = require('./userService');
const notificationOrchestrator = require('./notificationOrchestratorService');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const { ensureAppointmentInvoice } = require('./customerInvoiceService');
const { sendCustomerInvoiceLifecycleEmail } = require('./customerInvoiceEmailService');
const {
    getTenantPaymentSettings,
    assertServicePaymentMethodAllowed,
    calculateServiceDeposit
} = require('../utils/tenantPaymentSettings');
const {
    calculateRawPriceFromFinalPrice,
    parseServiceVariants,
    resolveServiceVariant
} = require('../utils/serviceVariant');

const formatNotificationDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? `${value}`
        : date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
};

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
        const { serviceId, variantId, staffId, requestedStaffId, platformUserId, tenantId, startTime, notes, paymentMethod, assignmentMode, bookingSessionId, bookingReference, bookingItemIndex, skipAdvanceValidation } = data;
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

        const normalizedNotes = typeof notes === 'string' ? notes.trim() : '';
        if (normalizedNotes.length > 1000) {
            throw new Error('Booking notes must be 1000 characters or less');
        }
        const normalizedPaymentMethod = paymentMethod || 'at-center';

        // Validate tenant exists and is active
        const tenant = await db.Tenant.findByPk(tenantId, { transaction: finalTransaction });
        if (!tenant) throw new Error('Tenant not found');
        if (tenant.status !== 'active') {
            throw new Error(`Tenant account is ${tenant.status}. Please contact support.`);
        }

        // Validate service exists and belongs to tenant
        const service = await db.Service.findByPk(serviceId, { transaction: finalTransaction });
        if (!service) throw new Error('Service not found');
        if (service.tenantId !== tenantId) {
            throw new Error('Service does not belong to this tenant');
        }
        if (!service.isActive) throw new Error('Service is not active');

        const serviceVariant = resolveServiceVariant(
            parseServiceVariants(service.variants || []),
            variantId
        );
        if (variantId && !serviceVariant) {
            throw new Error('Service variant not found');
        }

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
        const tenantPaymentSettings = await getTenantPaymentSettings(tenantId, { transaction: finalTransaction });
        assertServicePaymentMethodAllowed(normalizedPaymentMethod, tenantPaymentSettings, service.paymentOptions);

        const bookingSettings = tenantSettings?.bookingSettings || {};
        const allowAnyStaff = bookingSettings.allowAnyStaff !== false; // Default true
        const maxBookingsPerCustomerPerDay = bookingSettings.maxBookingsPerCustomerPerDay || null;

        // Handle "Any Staff" selection
        const normalizedRequestedStaffId = requestedStaffId || null;
        const customerSelectedSpecificStaff = Boolean(normalizedRequestedStaffId);
        let finalStaffId = staffId || normalizedRequestedStaffId;

        const finalAssignmentMode = assignmentMode
            || (customerSelectedSpecificStaff ? 'customer_selected' : 'auto_assigned');

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

        const duration = serviceVariant?.duration || service.duration || 30; // Default 30 minutes
        const end = new Date(start.getTime() + duration * 60000);

        // Validate start time is in the future for customer/self-service bookings.
        // Tenant dashboard bookings can intentionally bypass this rule so admins can
        // backfill or create immediate appointments from the board.
        if (!skipAdvanceValidation) {
            const now = new Date();
            const oneHourFromNow = new Date(now.getTime() + 60 * 60000);
            if (start < oneHourFromNow) {
                throw new Error('Booking must be at least 1 hour in advance');
            }
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
        const pricingSource = serviceVariant
            ? {
                ...service.toJSON(),
                rawPrice: calculateRawPriceFromFinalPrice(
                    serviceVariant.finalPrice,
                    service.taxRate,
                    service.commissionRate
                ),
                finalPrice: serviceVariant.finalPrice,
                duration
            }
            : service;
        const pricing = db.Appointment.calculateRevenueBreakdown(pricingSource, staff);
        const bookingSplit = normalizedPaymentMethod === 'booking-fee'
            ? calculateServiceDeposit(pricing.price, tenantPaymentSettings)
            : {
                depositAmount: 0,
                remainderAmount: pricing.price
            };
        const initialDepositAmount = parseFloat((bookingSplit.depositAmount || 0).toFixed(2));
        const initialRemainderAmount = parseFloat((bookingSplit.remainderAmount || pricing.price).toFixed(2));

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
            const requiresArrivalPayment = ['at-center', 'at_center', 'pay_on_visit', 'cash_on_delivery', 'cash']
                .includes(`${normalizedPaymentMethod}`.trim().toLowerCase());
            const initialAppointmentStatus = requiresArrivalPayment ? 'pending' : 'confirmed';
            const appointment = await db.Appointment.create({
                serviceId,
                staffId: finalStaffId,
                requestedStaffId: customerSelectedSpecificStaff ? normalizedRequestedStaffId : null,
                platformUserId,
                tenantId, // Store tenantId for faster queries
                startTime: start,
                endTime: end,
                assignmentMode: finalAssignmentMode,
                price: pricing.price,
                rawPrice: pricing.rawPrice,
                taxAmount: pricing.taxAmount,
                platformFee: pricing.platformFee,
                tenantRevenue: pricing.tenantRevenue,
                employeeRevenue: pricing.employeeRevenue,
                employeeCommissionRate: pricing.employeeCommissionRate,
                employeeCommission: pricing.employeeCommission,
                notes: normalizedNotes || null,
                serviceVariantId: serviceVariant?.id || null,
                serviceVariantName: serviceVariant?.description || null,
                serviceVariantDescription: serviceVariant?.description || null,
                serviceVariantDuration: serviceVariant?.duration || null,
                bookingSessionId: bookingSessionId || null,
                bookingReference: bookingReference || null,
                bookingItemIndex: Number.isInteger(bookingItemIndex) ? bookingItemIndex : 0,
                status: initialAppointmentStatus,
                paymentStatus: APPOINTMENT_PAYMENT_STATUS.PENDING,
                paymentMethod: normalizedPaymentMethod,
                depositAmount: initialDepositAmount,
                depositPaid: false,
                remainderAmount: initialRemainderAmount,
                remainderPaid: false,
                totalPaid: 0
            }, { transaction: finalTransaction });

            const invoice = await ensureAppointmentInvoice(appointment.id, {
                transaction: finalTransaction,
                triggerSource: 'booking_created'
            });

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

            // Update CustomerInsight
            await this._updateCustomerInsight(
                platformUserId,
                tenantId,
                serviceId,
                finalStaffId,
                0,
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

            if (shouldCommit) {
                try {
                    if (invoice?.id) {
                        sendCustomerInvoiceLifecycleEmail(invoice.id).catch((error) => {
                            console.warn('Booking created invoice email warning:', error.message);
                        });
                    }

                    const serviceName = service.name_en || service.name_ar || 'service';
                    const customerName = `${platformUser.firstName || ''} ${platformUser.lastName || ''}`.trim() || 'A customer';
                    const appointmentDate = formatNotificationDate(start);

                    await notificationOrchestrator.notifyCustomer({
                        tenantId,
                        platformUserId,
                        eventType: 'booking_created',
                        title: 'Booking confirmed',
                        body: `Your ${serviceName} booking for ${appointmentDate} is confirmed.`,
                        data: {
                            type: 'booking_created',
                            appointmentId: appointment.id,
                            tenantId,
                            staffId: finalStaffId
                        }
                    });

                    await notificationOrchestrator.notifyStaff({
                        tenantId,
                        staffId: finalStaffId,
                        eventType: 'staff_appointment_assigned',
                        title: 'New appointment assigned',
                        body: `${customerName} booked ${serviceName} for ${appointmentDate}.`,
                        data: {
                            type: 'staff_appointment_assigned',
                            appointmentId: appointment.id,
                            tenantId,
                            platformUserId
                        }
                    });
                } catch (notificationError) {
                    console.warn('Booking notification warning:', notificationError.message);
                }
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
     * Create a grouped booking session with multiple appointment items.
     * Each item is still persisted as a normal appointment row.
     */
    async createBookingSession(data, options = {}) {
        const { tenantId, platformUserId, items, notes, paymentMethod } = data;
        const transaction = options.transaction;
        const shouldCommit = !transaction;
        const finalTransaction = transaction || await db.sequelize.transaction();

        try {
            if (!tenantId) throw new Error('Tenant ID is required');
            if (!platformUserId) throw new Error('Platform User ID is required');
            if (!Array.isArray(items) || items.length === 0) {
                throw new Error('At least one booking item is required');
            }

            const platformUser = await db.PlatformUser.findByPk(platformUserId, { transaction: finalTransaction });
            if (!platformUser) throw new Error('Platform user not found');
            if (!platformUser.isActive) throw new Error('User account is inactive');
            if (platformUser.isBanned) throw new Error('User account is banned');

            const normalizedNotes = typeof notes === 'string' ? notes.trim() : '';
            const normalizedMethods = items
                .map((item) => `${item?.paymentMethod || paymentMethod || 'at-center'}`.trim().toLowerCase())
                .filter(Boolean);
            const distinctMethods = Array.from(new Set(normalizedMethods));
            const sessionPaymentMethod = distinctMethods.length > 1
                ? 'mixed'
                : (distinctMethods[0] || `${paymentMethod || 'at-center'}`.trim().toLowerCase());

            const session = await db.BookingSession.create({
                tenantId,
                platformUserId,
                status: 'confirmed',
                itemCount: items.length,
                subtotal: 0,
                taxAmount: 0,
                platformFee: 0,
                totalAmount: 0,
                paymentMethod: sessionPaymentMethod,
                notes: normalizedNotes || null
            }, { transaction: finalTransaction });

            const appointments = [];
            let subtotal = 0;
            let taxAmount = 0;
            let platformFee = 0;
            let totalAmount = 0;
            let atCenterAmount = 0;
            let onlineFullAmount = 0;
            let bookingFeeAmount = 0;

            for (let index = 0; index < items.length; index += 1) {
                const item = items[index] || {};
                const appointment = await this.createBooking({
                    serviceId: item.serviceId,
                    variantId: item.variantId || null,
                    staffId: item.staffId || null,
                    requestedStaffId: item.requestedStaffId || null,
                    platformUserId,
                    tenantId,
                    startTime: item.startTime,
                    notes: item.notes || normalizedNotes || null,
                    paymentMethod: item.paymentMethod || paymentMethod || 'at-center',
                    assignmentMode: item.assignmentMode,
                    bookingSessionId: session.id,
                    bookingReference: session.bookingReference,
                    bookingItemIndex: index
                }, { transaction: finalTransaction });

                appointments.push(appointment);
                subtotal += parseFloat(appointment.rawPrice || 0);
                taxAmount += parseFloat(appointment.taxAmount || 0);
                platformFee += parseFloat(appointment.platformFee || 0);
                totalAmount += parseFloat(appointment.price || 0);

                const itemPaymentMethod = `${item.paymentMethod || paymentMethod || 'at-center'}`.trim().toLowerCase();
                if (itemPaymentMethod === 'online-full') {
                    onlineFullAmount += parseFloat(appointment.price || 0);
                } else if (itemPaymentMethod === 'booking-fee') {
                    bookingFeeAmount += parseFloat(appointment.depositAmount || 0);
                } else {
                    atCenterAmount += parseFloat(appointment.price || 0);
                }
            }

            await session.update({
                itemCount: appointments.length,
                subtotal: parseFloat(subtotal.toFixed(2)),
                taxAmount: parseFloat(taxAmount.toFixed(2)),
                platformFee: parseFloat(platformFee.toFixed(2)),
                totalAmount: parseFloat(totalAmount.toFixed(2))
            }, { transaction: finalTransaction });

            const paymentSummary = {
                atCenterAmount: parseFloat(atCenterAmount.toFixed(2)),
                onlineFullAmount: parseFloat(onlineFullAmount.toFixed(2)),
                bookingFeeAmount: parseFloat(bookingFeeAmount.toFixed(2)),
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                itemCount: appointments.length
            };

            if (shouldCommit) {
                await finalTransaction.commit();

                try {
                    const customerName = `${platformUser.firstName || ''} ${platformUser.lastName || ''}`.trim() || 'A customer';
                    const serviceCount = appointments.length;
                    const serviceLabel = serviceCount === 1 ? 'service' : 'services';
                    await notificationOrchestrator.notifyCustomer({
                        tenantId,
                        platformUserId,
                        eventType: 'booking_session_created',
                        title: 'Booking confirmed',
                        body: `Your booking for ${serviceCount} ${serviceLabel} has been confirmed.`,
                        data: {
                            type: 'booking_session_created',
                            bookingSessionId: session.id,
                            bookingReference: session.bookingReference,
                            tenantId,
                            platformUserId,
                            customerName
                        }
                    });

                    for (const appointment of appointments) {
                        const serviceName = appointment?.service?.name_en || appointment?.service?.name_ar || 'service';
                        const appointmentDate = formatNotificationDate(appointment.startTime);
                        const customerName = `${platformUser.firstName || ''} ${platformUser.lastName || ''}`.trim() || 'A customer';
                        if (appointment.staffId) {
                            await notificationOrchestrator.notifyStaff({
                                tenantId,
                                staffId: appointment.staffId,
                                eventType: 'staff_appointment_assigned',
                                title: 'New appointment assigned',
                                body: `${customerName} booked ${serviceName} for ${appointmentDate}.`,
                                data: {
                                    type: 'staff_appointment_assigned',
                                    appointmentId: appointment.id,
                                    tenantId,
                                    platformUserId
                                }
                            });
                        }
                    }
                } catch (notificationError) {
                    console.warn('Booking session notification warning:', notificationError.message);
                }
            }

            return {
                session,
                appointments,
                paymentSummary
            };
        } catch (error) {
            if (shouldCommit && finalTransaction && !finalTransaction.finished) {
                try {
                    await finalTransaction.rollback();
                } catch (rollbackError) {
                    console.warn('Booking session rollback warning:', rollbackError.message);
                }
            }
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
        if (Number.isNaN(start.getTime())) {
            return null;
        }

        const availabilityService = require('./availabilityService');
        const date = start.toISOString().split('T')[0];
        const requestedTimestamp = start.getTime();

        const candidateResults = await Promise.all(staffMembers.map(async (staff) => {
            try {
                const result = await availabilityService.getAvailableSlots(tenantId, {
                    serviceId,
                    staffId: staff.id,
                    date
                });

                const matchingSlot = (result.slots || []).find((slot) => {
                    const slotStart = new Date(slot.startTime);
                    return slot.available && !Number.isNaN(slotStart.getTime()) && slotStart.getTime() === requestedTimestamp;
                });

                if (!matchingSlot) {
                    return null;
                }

                const dayStart = new Date(start);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(start);
                dayEnd.setHours(23, 59, 59, 999);

                const workload = await db.Appointment.count({
                    where: {
                        staffId: staff.id,
                        status: { [Op.notIn]: ['cancelled', 'no_show'] },
                        startTime: { [Op.between]: [dayStart, dayEnd] }
                    },
                    transaction
                });

                return {
                    staff,
                    workload
                };
            } catch (error) {
                return null;
            }
        }));

        const candidates = candidateResults.filter(Boolean);

        if (candidates.length === 0) {
            return null;
        }

        candidates.sort((a, b) => {
            if (a.workload !== b.workload) {
                return a.workload - b.workload;
            }

            return (b.staff.rating || 0) - (a.staff.rating || 0);
        });

        return candidates[0].staff.id;
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
    async _updateCustomerInsight(platformUserId, tenantId, serviceId, staffId, amountSpent, visitDate, transaction = null) {
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
        if (amountSpent > 0) {
            await customerInsight.increment('totalSpent', { by: amountSpent, transaction: transaction });
        }
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
                { model: db.Service, as: 'service', required: false },
                { model: db.Staff, as: 'staff', required: false },
                { model: db.PlatformUser, as: 'user', required: false }
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

        try {
            const serviceName = appointment.service?.name_en || appointment.service?.name_ar || 'service';
            const customerName = `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}`.trim() || 'A customer';
            await notificationOrchestrator.notifyStaff({
                tenantId: appointment.tenantId,
                staffId: appointment.staffId,
                eventType: 'staff_appointment_cancelled',
                title: 'Appointment cancelled',
                body: `${customerName} cancelled the ${serviceName} booking.`,
                data: {
                    type: 'staff_appointment_cancelled',
                    appointmentId: appointment.id,
                    tenantId: appointment.tenantId,
                    platformUserId: appointment.platformUserId
                }
            });
        } catch (notificationError) {
            console.warn('Booking cancellation notification warning:', notificationError.message);
        }

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
