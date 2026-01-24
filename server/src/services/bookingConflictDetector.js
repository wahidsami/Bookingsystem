/**
 * Booking Conflict Detection Service
 * Prevents double-booking by detecting overlapping appointments
 * Handles race conditions with proper database locking
 */

const db = require('../models');
const { Op, sequelize } = require('sequelize');
const logger = require('./productionLogger');

class BookingConflictDetector {
    /**
     * Check if a time slot conflicts with existing appointments
     * Uses database-level locking to prevent race conditions
     */
    async checkForConflicts(staffId, startTime, endTime, excludeAppointmentId = null) {
        try {
            const where = {
                staffId,
                status: { [Op.in]: ['confirmed', 'tentative', 'in_progress'] },
                [Op.or]: [
                    // New appointment starts during existing appointment
                    {
                        startTime: { [Op.lte]: startTime },
                        endTime: { [Op.gt]: startTime }
                    },
                    // New appointment ends during existing appointment
                    {
                        startTime: { [Op.lt]: endTime },
                        endTime: { [Op.gte]: endTime }
                    },
                    // New appointment completely overlaps existing
                    {
                        startTime: { [Op.gte]: startTime },
                        endTime: { [Op.lte]: endTime }
                    }
                ]
            };

            // Exclude current appointment from check
            if (excludeAppointmentId) {
                where.id = { [Op.ne]: excludeAppointmentId };
            }

            // Use raw query with FOR UPDATE lock to prevent race conditions
            const conflicts = await sequelize.query(
                `SELECT id, "startTime", "endTime", status 
                 FROM "appointments" 
                 WHERE "staffId" = :staffId 
                 AND status IN ('confirmed', 'tentative', 'in_progress')
                 AND (
                    ("startTime" <= :startTime AND "endTime" > :startTime) OR
                    ("startTime" < :endTime AND "endTime" >= :endTime) OR
                    ("startTime" >= :startTime AND "endTime" <= :endTime)
                 )
                 ${excludeAppointmentId ? 'AND id != :excludeId' : ''}
                 FOR UPDATE
                 LIMIT 10`,
                {
                    replacements: {
                        staffId,
                        startTime,
                        endTime,
                        ...(excludeAppointmentId && { excludeId: excludeAppointmentId })
                    },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            return {
                hasConflicts: conflicts.length > 0,
                conflicts: conflicts
            };
        } catch (error) {
            logger.error('Error checking booking conflicts', error, {
                staffId,
                startTime,
                endTime
            });
            throw error;
        }
    }

    /**
     * Check for service availability conflicts
     * Accounts for service duration and staff availability
     */
    async checkServiceAvailability(serviceId, staffId, startTime, duration) {
        try {
            const endTime = new Date(new Date(startTime).getTime() + duration * 60000);

            // Check staff availability
            const staffConflict = await this.checkForConflicts(staffId, startTime, endTime);
            if (staffConflict.hasConflicts) {
                return {
                    available: false,
                    reason: 'STAFF_NOT_AVAILABLE',
                    conflicts: staffConflict.conflicts,
                    suggestedTimes: await this.findNextAvailableSlots(staffId, startTime, duration)
                };
            }

            // Check if staff is on break during this time
            const breakConflict = await sequelize.query(
                `SELECT id, "startTime", "endTime" 
                 FROM "staff_breaks"
                 WHERE "staffId" = :staffId
                 AND "isActive" = true
                 AND (
                    ("startTime" <= :startTime AND "endTime" > :startTime) OR
                    ("startTime" < :endTime AND "endTime" >= :endTime)
                 )`,
                {
                    replacements: {
                        staffId,
                        startTime,
                        endTime
                    },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (breakConflict.length > 0) {
                return {
                    available: false,
                    reason: 'STAFF_ON_BREAK',
                    breaks: breakConflict,
                    suggestedTimes: await this.findNextAvailableSlots(staffId, startTime, duration)
                };
            }

            // Check if staff is on time off
            const timeOffConflict = await sequelize.query(
                `SELECT id, "startDate", "endDate" 
                 FROM "staff_time_offs"
                 WHERE "staffId" = :staffId
                 AND (
                    ("startDate" <= :startDate AND "endDate" >= :endDate)
                 )`,
                {
                    replacements: {
                        staffId,
                        startDate: startTime,
                        endDate: endTime
                    },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (timeOffConflict.length > 0) {
                return {
                    available: false,
                    reason: 'STAFF_ON_TIME_OFF',
                    timeOffs: timeOffConflict,
                    suggestedTimes: await this.findNextAvailableSlots(staffId, startTime, duration)
                };
            }

            return {
                available: true,
                reason: 'AVAILABLE'
            };
        } catch (error) {
            logger.error('Error checking service availability', error, {
                serviceId,
                staffId,
                startTime,
                duration
            });
            throw error;
        }
    }

    /**
     * Find next available time slots for a staff member
     */
    async findNextAvailableSlots(staffId, afterTime, duration, count = 3) {
        try {
            const slots = [];
            let currentSlot = new Date(afterTime);
            currentSlot.setMinutes(currentSlot.getMinutes() + 30); // Start 30 mins later

            // Check next 7 days
            for (let i = 0; i < 7 && slots.length < count; i++) {
                // Skip past appointments for today
                if (currentSlot.toDateString() === afterTime.toDateString() && currentSlot <= afterTime) {
                    currentSlot = new Date(afterTime);
                    currentSlot.setDate(currentSlot.getDate() + 1);
                    currentSlot.setHours(9, 0, 0, 0); // Start at 9 AM next day
                    continue;
                }

                // Check if this slot is available
                const slotEnd = new Date(currentSlot.getTime() + duration * 60000);
                const availability = await this.checkForConflicts(staffId, currentSlot, slotEnd);

                if (!availability.hasConflicts) {
                    slots.push({
                        startTime: new Date(currentSlot),
                        endTime: new Date(slotEnd)
                    });
                }

                // Move to next 30-minute slot
                currentSlot.setMinutes(currentSlot.getMinutes() + 30);

                // Skip to next day at 9 AM if past business hours (6 PM)
                if (currentSlot.getHours() >= 18) {
                    currentSlot = new Date(currentSlot);
                    currentSlot.setDate(currentSlot.getDate() + 1);
                    currentSlot.setHours(9, 0, 0, 0);
                }
            }

            return slots;
        } catch (error) {
            logger.error('Error finding available slots', error, {
                staffId,
                afterTime,
                duration
            });
            return [];
        }
    }

    /**
     * Create booking with transaction to prevent race conditions
     */
    async createBookingWithConflictCheck(appointmentData) {
        const transaction = await sequelize.transaction({
            isolationLevel: sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
        });

        try {
            // Check for conflicts within transaction (locked)
            const { hasConflicts, conflicts } = await this.checkForConflicts(
                appointmentData.staffId,
                appointmentData.startTime,
                appointmentData.endTime
            );

            if (hasConflicts) {
                await transaction.rollback();
                return {
                    success: false,
                    reason: 'BOOKING_CONFLICT',
                    conflicts,
                    suggestedTimes: await this.findNextAvailableSlots(
                        appointmentData.staffId,
                        appointmentData.startTime,
                        (new Date(appointmentData.endTime) - new Date(appointmentData.startTime)) / 60000
                    )
                };
            }

            // Create appointment within transaction
            const appointment = await db.Appointment.create(appointmentData, { transaction });

            await transaction.commit();

            logger.info('Booking created successfully', {
                appointmentId: appointment.id,
                staffId: appointmentData.staffId
            });

            return {
                success: true,
                appointment
            };
        } catch (error) {
            await transaction.rollback();
            logger.error('Error creating booking with conflict check', error, {
                staffId: appointmentData.staffId
            });
            throw error;
        }
    }

    /**
     * Log booking attempt for analytics
     */
    logBookingAttempt(appointmentData, result, userId) {
        const logData = {
            timestamp: new Date(),
            userId,
            staffId: appointmentData.staffId,
            startTime: appointmentData.startTime,
            success: result.success,
            reason: result.reason || 'SUCCESS'
        };

        if (result.success) {
            logger.info('Booking successful', logData);
        } else {
            logger.warn('Booking failed', logData);
        }
    }
}

module.exports = new BookingConflictDetector();
