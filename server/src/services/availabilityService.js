/**
 * Availability Service
 * Service-first availability calculation engine
 * Generates dynamic time slots based on service duration, buffers, and constraints
 */

const db = require('../models');
const { Op } = require('sequelize');
const {
    parseServiceVariants,
    resolveServiceVariant
} = require('../utils/serviceVariant');

class AvailabilityService {
    /**
     * Extract a stable YYYY-MM-DD / HH:MM view of a Date in a target timezone.
     * @private
     */
    _getDatePartsInTimeZone(date, timeZone = 'Asia/Riyadh') {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
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
            timeKey: `${map.hour}:${map.minute}`,
            year: map.year,
            month: map.month,
            day: map.day,
            hour: map.hour,
            minute: map.minute,
            second: map.second
        };
    }

    /**
     * Get timezone offset in milliseconds for a given instant.
     * @private
     */
    _getTimeZoneOffset(date, timeZone = 'Asia/Riyadh') {
        const parts = this._getDatePartsInTimeZone(date, timeZone);
        const asUTC = Date.UTC(
            Number(parts.year),
            Number(parts.month) - 1,
            Number(parts.day),
            Number(parts.hour),
            Number(parts.minute),
            Number(parts.second || 0)
        );
        return asUTC - date.getTime();
    }

    /**
     * Parse a YYYY-MM-DD date string as a calendar day in the tenant timezone.
     * @private
     */
    _getDayOfWeekForDate(date) {
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const fallback = new Date(`${date}T12:00:00Z`);
            return Number.isNaN(fallback.getTime()) ? null : fallback.getUTCDay();
        }

        const [year, month, day] = date.split('-').map((value) => Number(value));
        const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        return utcNoon.getUTCDay();
    }

    /**
     * Convert a local date/time pair in a timezone to an absolute Date.
     * @private
     */
    _combineDateAndTime(date, time, timeZone = 'Asia/Riyadh') {
        try {
            let dateStr;
            if (date instanceof Date) {
                dateStr = this._getDatePartsInTimeZone(date, timeZone).dateKey;
            } else if (typeof date === 'string') {
                dateStr = date.split('T')[0];
            } else {
                throw new Error(`Invalid date format: ${date}`);
            }

            let timeStr;
            if (!time) {
                throw new Error(`Time is required but got: ${time}`);
            } else if (time instanceof Date) {
                const timeParts = this._getDatePartsInTimeZone(time, timeZone);
                timeStr = `${timeParts.hour}:${timeParts.minute}`;
            } else if (typeof time === 'string') {
                timeStr = time.split('.')[0];
                if (!timeStr.includes(':')) {
                    throw new Error(`Invalid time format: ${time}`);
                }
                const parts = timeStr.split(':');
                if (parts.length >= 2) {
                    timeStr = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                } else {
                    throw new Error(`Invalid time format: ${time}`);
                }
            } else {
                throw new Error(`Invalid time type: ${typeof time}, value: ${time}`);
            }

            const [year, month, day] = dateStr.split('-').map((value) => Number(value));
            const [hour, minute] = timeStr.split(':').map((value) => Number(value));
            const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
            const offset = this._getTimeZoneOffset(utcGuess, timeZone);
            const result = new Date(utcGuess.getTime() - offset);

            if (Number.isNaN(result.getTime())) {
                throw new Error(`Invalid date/time combination: ${dateStr}T${timeStr}:00`);
            }

            return result;
        } catch (error) {
            console.error('Error in _combineDateAndTime:', { date, time, timeZone, error: error.message });
            throw new Error(`Failed to combine date and time: ${error.message}`);
        }
    }

    /**
     * Get the absolute start/end boundaries for a calendar day in a timezone.
     * @private
     */
    _getTimeZoneDayRange(date, timeZone = 'Asia/Riyadh') {
        const dateKey = typeof date === 'string' ? date.split('T')[0] : this._getDatePartsInTimeZone(date, timeZone).dateKey;
        const startOfDay = this._combineDateAndTime(dateKey, '00:00', timeZone);
        const nextDay = new Date(Date.UTC(
            Number(dateKey.slice(0, 4)),
            Number(dateKey.slice(5, 7)) - 1,
            Number(dateKey.slice(8, 10)) + 1,
            0,
            0,
            0,
            0
        ));
        const nextDateKey = this._getDatePartsInTimeZone(nextDay, timeZone).dateKey;
        const endOfDay = new Date(this._combineDateAndTime(nextDateKey, '00:00', timeZone).getTime() - 1);
        return { startOfDay, endOfDay, dateKey };
    }

    /**
     * Get available slots for a service
     * Service-first approach: slots are generated based on service duration + buffers
     * 
     * @param {string} tenantId - Tenant ID
     * @param {string} serviceId - Service ID (required)
     * @param {string} staffId - Staff ID (optional, null = any staff)
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Object>} Available slots with metadata
     */
    async getAvailableSlots(tenantId, { serviceId, staffId, date, variantId }) {
        if (!serviceId || !date) {
            throw new Error('serviceId and date are required');
        }

        // Get service (defines duration and buffers)
        const service = await db.Service.findByPk(serviceId);
        if (!service) throw new Error('Service not found');
        if (service.tenantId !== tenantId) {
            throw new Error('Service does not belong to this tenant');
        }

        const serviceVariant = resolveServiceVariant(
            parseServiceVariants(service.variants || []),
            variantId
        );

        if (variantId && !serviceVariant) {
            throw new Error('Service variant not found');
        }

        // Get tenant settings for booking configuration
        const tenantSettings = await this._getTenantSettings(tenantId);
        const stepSize = tenantSettings.booking?.slotInterval || 15; // Default 15 minutes
        const timezone = tenantSettings.timezone || 'Asia/Riyadh';

        // Service duration and buffers
        const duration = serviceVariant?.duration || service.duration || 30; // minutes
        const bufferBefore = service.bufferBefore || tenantSettings.booking?.defaultBufferBefore || 0;
        const bufferAfter = service.bufferAfter || tenantSettings.booking?.defaultBufferAfter || 0;
        const totalSlotLength = duration + bufferBefore + bufferAfter; // Total minutes

        // If staffId provided, get slots for that staff
        if (staffId) {
            return await this._getSlotsForStaff(
                tenantId,
                serviceId,
                staffId,
                date,
                duration,
                bufferBefore,
                bufferAfter,
                totalSlotLength,
                stepSize,
                timezone,
                serviceVariant?.id || null
            );
        }

        // If no staffId, get slots for all eligible staff
        return await this._getSlotsForAnyStaff(
            tenantId,
            serviceId,
            date,
            duration,
            bufferBefore,
            bufferAfter,
            totalSlotLength,
            stepSize,
            timezone,
            serviceVariant?.id || null
        );
    }

    /**
     * Get available slots for a specific staff member
     * @private
     */
    async _getSlotsForStaff(tenantId, serviceId, staffId, date, duration, bufferBefore, bufferAfter, totalSlotLength, stepSize, timezone = 'Asia/Riyadh', variantId = null) {
        // Validate staff exists and can perform service
        const staff = await db.Staff.findByPk(staffId);
        if (!staff) throw new Error('Staff not found');
        if (staff.tenantId !== tenantId) {
            throw new Error('Staff does not belong to this tenant');
        }
        if (!staff.isActive) throw new Error('Staff is not active');

        // Check if staff can perform this service
        const canPerform = await db.ServiceEmployee.findOne({
            where: { serviceId, staffId }
        });
        if (!canPerform) {
            throw new Error('Staff cannot perform this service');
        }

        // Calculate availability window
        const availabilityWindow = await this._calculateAvailabilityWindow(
            tenantId,
            staffId,
            date,
            timezone
        );

        if (!availabilityWindow || availabilityWindow.length === 0) {
            return {
                slots: [],
                metadata: {
                    date,
                    serviceId,
                    staffId,
                    serviceDuration: duration,
                    bufferBefore,
                    bufferAfter,
                    totalSlotLength,
                    stepSize,
                    timezone: timezone,
                    totalSlots: 0,
                    availableSlots: 0,
                    staffCount: 1
                }
            };
        }

        // Get existing appointments for the day
        const existingAppointments = await this._getExistingAppointments(staffId, date, timezone);

        // Generate slots for each availability window
        const allSlots = [];
        for (const window of availabilityWindow) {
            const slots = this._generateSlots(
                window.startTime,
                window.endTime,
                duration,
                bufferBefore,
                bufferAfter,
                totalSlotLength,
                stepSize,
                existingAppointments
            );
            allSlots.push(...slots);
        }

        // Sort slots by start time
        allSlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        return {
            slots: allSlots,
            metadata: {
                date,
                serviceId,
                staffId,
                staffName: staff.name,
                serviceDuration: duration,
                bufferBefore,
                bufferAfter,
                totalSlotLength,
                stepSize,
                timezone: timezone,
                totalSlots: allSlots.length,
                availableSlots: allSlots.filter(s => s.available).length,
                staffCount: 1
            }
        };
    }

    /**
     * Get available slots for any eligible staff (for "Any Staff" selection)
     * @private
     */
    async _getSlotsForAnyStaff(tenantId, serviceId, date, duration, bufferBefore, bufferAfter, totalSlotLength, stepSize, timezone = 'Asia/Riyadh', variantId = null) {
        // Get all staff who can perform this service
        const serviceEmployees = await db.ServiceEmployee.findAll({
            where: { serviceId }
        });

        if (serviceEmployees.length === 0) {
            return {
                slots: [],
                metadata: {
                    date,
                    serviceId,
                    staffId: null,
                    serviceDuration: duration,
                    bufferBefore,
                    bufferAfter,
                    totalSlotLength,
                    stepSize,
                    timezone: timezone,
                    totalSlots: 0,
                    availableSlots: 0,
                    staffCount: 0
                }
            };
        }

        const staffIds = serviceEmployees.map(se => se.staffId);
        const staffMembers = await db.Staff.findAll({
            where: {
                id: { [Op.in]: staffIds },
                tenantId,
                isActive: true
            }
        });

        // Get slots for each staff member
        const slotsByStaff = [];
        const staffWorkloads = new Map();

        for (const staff of staffMembers) {
            try {
                // Calculate workload for deterministic tie-breaking
                const appointments = await this._getExistingAppointments(staff.id, date);
                staffWorkloads.set(staff.id, appointments.length);

                const result = await this._getSlotsForStaff(
                    tenantId,
                    serviceId,
                    staff.id,
                    date,
                duration,
                bufferBefore,
                bufferAfter,
                totalSlotLength,
                stepSize,
                timezone,
                variantId
            );
                
                // Add staff info to each slot
                result.slots.forEach(slot => {
                    slot.staffId = staff.id;
                    slot.staffName = staff.name;
                });
                
                slotsByStaff.push(...result.slots);
            } catch (error) {
                // Skip staff if error (e.g., no schedule)
                console.warn(`Skipping staff ${staff.id}: ${error.message}`);
            }
        }

        // Group slots by exact start time
        const slotsByTime = new Map();
        for (const slot of slotsByStaff) {
            const timeKey = new Date(slot.startTime).toISOString();
            if (!slotsByTime.has(timeKey)) {
                slotsByTime.set(timeKey, []);
            }
            slotsByTime.get(timeKey).push(slot);
        }

        // Deduplicate and resolve conflicts per time block
        const uniqueSlots = [];
        for (const [timeKey, candidates] of slotsByTime.entries()) {
            const availableCandidates = candidates.filter(c => c.available);
            
            if (availableCandidates.length > 0) {
                // Determine winner using isolated scheduling policy
                const winner = this._applySchedulingPolicy(availableCandidates, staffWorkloads);
                uniqueSlots.push(winner);
            } else {
                // If no staff is available, arbitrarily push the first unavailable slot 
                uniqueSlots.push(candidates[0]);
            }
        }

        // Ensure chronological order for output
        uniqueSlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        return {
            slots: uniqueSlots,
            metadata: {
                date,
                serviceId,
                staffId: null,
                serviceDuration: duration,
                bufferBefore,
                bufferAfter,
                totalSlotLength,
                stepSize,
                timezone: timezone,
                totalSlots: uniqueSlots.length,
                availableSlots: uniqueSlots.filter(s => s.available).length,
                staffCount: staffMembers.length
            }
        };
    }

    /**
     * Determine which staff member gets the booking when multiple are available.
     * Sprint 1 Policy: Least Workload
     * @private
     */
    _applySchedulingPolicy(candidates, staffWorkloads) {
        if (candidates.length <= 1) return candidates[0];

        // Sort by least workload first, then use staffId as a stable fallback
        return candidates.sort((a, b) => {
            const workloadA = staffWorkloads.get(a.staffId) || 0;
            const workloadB = staffWorkloads.get(b.staffId) || 0;
            
            if (workloadA !== workloadB) {
                return workloadA - workloadB;
            }
            
            // Deterministic stable tie-breaker if workloads are identical
            return String(a.staffId).localeCompare(String(b.staffId));
        })[0];
    }

    /**
     * Calculate availability window for a staff member on a specific date
     * Considers: tenant business hours, staff schedule, breaks, time-off, overrides
     * @private
     */
    async _calculateAvailabilityWindow(tenantId, staffId, date, timezone = 'Asia/Riyadh') {
        try {
            const dateKey = typeof date === 'string' ? date.split('T')[0] : this._getDatePartsInTimeZone(date, timezone).dateKey;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                throw new Error(`Invalid date format: ${date}`);
            }
            const dayOfWeek = this._getDayOfWeekForDate(dateKey); // 0 = Sunday, 6 = Saturday

            // Layer A: Get tenant business hours
            const tenant = await db.Tenant.findByPk(tenantId);
            if (!tenant) {
                throw new Error(`Tenant not found: ${tenantId}`);
            }
            const tenantHours = this._parseBusinessHours(tenant.workingHours, dayOfWeek);

            // Layer B: Get staff shifts (new model - supports multiple shifts per day)
            // First check for date-specific shifts
            const dateSpecificShifts = await db.StaffShift.findAll({
                where: {
                    staffId,
                    specificDate: date,
                    isActive: true,
                    isRecurring: false
                }
            });

            // Then check for recurring shifts for this day of week
            const recurringShifts = await db.StaffShift.findAll({
                where: {
                    staffId,
                    dayOfWeek,
                    isRecurring: true,
                    isActive: true,
                    [Op.and]: [
                        {
                            [Op.or]: [
                                { startDate: null },
                                { startDate: { [Op.lte]: date } }
                            ]
                        },
                        {
                            [Op.or]: [
                                { endDate: null },
                                { endDate: { [Op.gte]: date } }
                            ]
                        }
                    ]
                }
            });

            // Combine all shifts
            const allShifts = [...dateSpecificShifts, ...recurringShifts];

            // Declare availableWindow variable
            let availableWindow = [];

            // If no shifts, fall back to legacy StaffSchedule
            if (allShifts.length === 0) {
                const legacySchedule = await db.StaffSchedule.findOne({
                    where: {
                        staffId,
                        dayOfWeek,
                        isAvailable: true
                    }
                });

                if (!legacySchedule) {
                    return []; // No schedule for this day
                }

                const scheduleStart = this._combineDateAndTime(dateKey, legacySchedule.startTime, timezone);
                const scheduleEnd = this._combineDateAndTime(dateKey, legacySchedule.endTime, timezone);

                availableWindow = [{
                    startTime: scheduleStart,
                    endTime: scheduleEnd
                }];
            } else {
                // Convert shifts to time windows
                availableWindow = allShifts.map(shift => ({
                    startTime: this._combineDateAndTime(dateKey, shift.startTime, timezone),
                    endTime: this._combineDateAndTime(dateKey, shift.endTime, timezone)
                }));
            }

            // Apply tenant business hours (intersect)
            if (tenantHours) {
                const tenantStart = this._combineDateAndTime(dateKey, tenantHours.start, timezone);
                const tenantEnd = this._combineDateAndTime(dateKey, tenantHours.end, timezone);
                
                availableWindow = this._intersectWindows(availableWindow, [{
                    startTime: tenantStart,
                    endTime: tenantEnd
                }]);
            }

            // Layer C - Subtract breaks
            const breaks = await this._getStaffBreaks(staffId, dateKey, timezone);
            availableWindow = this._subtractWindows(availableWindow, breaks);

            // Layer D - Subtract time-off
            const timeOff = await this._getStaffTimeOff(staffId, dateKey, timezone);
            availableWindow = this._subtractWindows(availableWindow, timeOff);

            // Apply schedule overrides
            const overrides = await this._getStaffOverrides(staffId, dateKey);
            availableWindow = this._applyOverrides(availableWindow, overrides, timezone);

            return availableWindow;
        } catch (error) {
            console.error('Error in _calculateAvailabilityWindow:', {
                tenantId,
                staffId,
                date,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Generate time slots within a time window
     * @private
     */
    _generateSlots(windowStart, windowEnd, duration, bufferBefore, bufferAfter, totalSlotLength, stepSize, existingAppointments) {
        const slots = [];
        let current = new Date(windowStart);

        while (current < windowEnd) {
            const slotStart = new Date(current);
            const slotEnd = new Date(current.getTime() + totalSlotLength * 60000);

            // Check if slot fits in window
            if (slotEnd > windowEnd) {
                break; // No more slots fit
            }

            // Check for conflicts with existing appointments
            const hasConflict = this._hasConflict(
                slotStart,
                slotEnd,
                duration,
                bufferBefore,
                bufferAfter,
                existingAppointments
            );

            slots.push({
                startTime: slotStart.toISOString(),
                endTime: slotEnd.toISOString(),
                available: !hasConflict,
                staffId: null, // Will be set by caller if needed
                staffName: null
            });

            // Move to next slot (by step size)
            current = new Date(current.getTime() + stepSize * 60000);
        }

        return slots;
    }

    /**
     * Check if a time slot conflicts with existing appointments
     * Enhanced conflict detection with buffer support
     * @private
     */
    _hasConflict(slotStart, slotEnd, duration, bufferBefore, bufferAfter, existingAppointments) {
        return existingAppointments.some(appt => {
            const apptStart = new Date(appt.startTime);
            const apptEnd = new Date(appt.endTime);

            // Apply buffers to appointment
            const apptStartWithBuffer = new Date(apptStart.getTime() - bufferBefore * 60000);
            const apptEndWithBuffer = new Date(apptEnd.getTime() + bufferAfter * 60000);

            // Check all overlap cases
            return (
                // Slot starts during appointment (with buffer)
                (slotStart >= apptStartWithBuffer && slotStart < apptEndWithBuffer) ||
                // Slot ends during appointment (with buffer)
                (slotEnd > apptStartWithBuffer && slotEnd <= apptEndWithBuffer) ||
                // Slot completely contains appointment
                (slotStart <= apptStartWithBuffer && slotEnd >= apptEndWithBuffer) ||
                // Appointment completely contains slot
                (apptStartWithBuffer <= slotStart && apptEndWithBuffer >= slotEnd)
            );
        });
    }

    /**
     * Get existing appointments for a staff member on a date
     * @private
     */
    async _getExistingAppointments(staffId, date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return await db.Appointment.findAll({
            where: {
                staffId,
                startTime: { [Op.between]: [startOfDay, endOfDay] },
                status: { [Op.notIn]: ['cancelled', 'no_show'] }
            },
            order: [['startTime', 'ASC']]
        });
    }

    /**
     * Get tenant settings (with defaults)
     * @private
     */
    async _getTenantSettings(tenantId) {
        try {
            const tenantSettings = await db.TenantSettings.findOne({
                where: { tenantId }
            });

            if (tenantSettings && tenantSettings.bookingSettings) {
                return {
                    booking: {
                        slotInterval: tenantSettings.bookingSettings.slotInterval || 15,
                        defaultBufferBefore: tenantSettings.bookingSettings.defaultBufferBefore || 5,
                        defaultBufferAfter: tenantSettings.bookingSettings.defaultBufferAfter || 5,
                        allowAnyStaff: tenantSettings.bookingSettings.allowAnyStaff !== false, // Default true
                        maxBookingsPerCustomerPerDay: tenantSettings.bookingSettings.maxBookingsPerCustomerPerDay || null
                    }
                };
            }
        } catch (error) {
            console.warn('Failed to load tenant settings, using defaults:', error.message);
        }

        // Return defaults if no settings found
        return {
            booking: {
                slotInterval: 15, // minutes
                defaultBufferBefore: 5,
                defaultBufferAfter: 5,
                allowAnyStaff: true,
                maxBookingsPerCustomerPerDay: null
            }
        };
    }

    /**
     * Parse business hours for a specific day of week
     * @private
     */
    _parseBusinessHours(workingHours, dayOfWeek) {
        if (!workingHours || typeof workingHours !== 'object') {
            return null;
        }

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];

        const dayHours = workingHours[dayName];
        if (!dayHours || !dayHours.isOpen) {
            return null;
        }

        return {
            start: dayHours.open || '09:00',
            end: dayHours.close || '18:00'
        };
    }

    /**
     * Combine date and time string into Date object
     * @private
     */
    /**
     * Intersect two sets of time windows
     * @private
     */
    _intersectWindows(windows1, windows2) {
        const result = [];
        for (const w1 of windows1) {
            for (const w2 of windows2) {
                const start = w1.startTime > w2.startTime ? w1.startTime : w2.startTime;
                const end = w1.endTime < w2.endTime ? w1.endTime : w2.endTime;
                if (start < end) {
                    result.push({ startTime: start, endTime: end });
                }
            }
        }
        return result;
    }

    /**
     * Get staff breaks for a specific date
     * @private
     */
    async _getStaffBreaks(staffId, date, timezone = 'Asia/Riyadh') {
        const dayOfWeek = this._getDayOfWeekForDate(date);
        
        // Get date-specific breaks
        const dateBreaks = await db.StaffBreak.findAll({
            where: {
                staffId,
                specificDate: date,
                isActive: true,
                isRecurring: false
            }
        });

        // Get recurring breaks for this day
        const recurringBreaks = await db.StaffBreak.findAll({
            where: {
                staffId,
                isRecurring: true,
                isActive: true,
                [Op.or]: [
                    { dayOfWeek },
                    { dayOfWeek: null }
                ]
                ,
                [Op.and]: [
                    {
                        [Op.or]: [
                            { startDate: null },
                            { startDate: { [Op.lte]: date } }
                        ]
                    },
                    {
                        [Op.or]: [
                            { endDate: null },
                            { endDate: { [Op.gte]: date } }
                        ]
                    }
                ]
            }
        });

        // Combine and convert to time windows
        const allBreaks = [...dateBreaks, ...recurringBreaks];
        return allBreaks.map(breakRecord => ({
            startTime: this._combineDateAndTime(date, breakRecord.startTime, timezone),
            endTime: this._combineDateAndTime(date, breakRecord.endTime, timezone)
        }));
    }

    /**
     * Get staff time-off for a specific date
     * @private
     */
    async _getStaffTimeOff(staffId, date, timezone = 'Asia/Riyadh') {
        const timeOffRecords = await db.StaffTimeOff.findAll({
            where: {
                staffId,
                isApproved: true,
                startDate: { [Op.lte]: date },
                endDate: { [Op.gte]: date }
            }
        });

        // Convert to full-day time windows
        return timeOffRecords.map(record => ({
            startTime: this._combineDateAndTime(record.startDate, '00:00', timezone),
            endTime: this._combineDateAndTime(record.endDate, '23:59', timezone)
        }));
    }

    /**
     * Get staff schedule overrides for a specific date
     * @private
     */
    async _getStaffOverrides(staffId, date) {
        return await db.StaffScheduleOverride.findAll({
            where: {
                staffId,
                date
            }
        });
    }

    /**
     * Subtract time windows (remove breaks/time-off from availability)
     * @private
     */
    _subtractWindows(availableWindows, subtractWindows) {
        if (subtractWindows.length === 0) return availableWindows;

        let result = [...availableWindows];

        for (const subtract of subtractWindows) {
            const newResult = [];
            for (const available of result) {
                // If subtract completely contains available, remove it
                if (subtract.startTime <= available.startTime && subtract.endTime >= available.endTime) {
                    continue; // Skip this window
                }
                // If subtract is completely inside available, split available
                else if (subtract.startTime > available.startTime && subtract.endTime < available.endTime) {
                    newResult.push({
                        startTime: available.startTime,
                        endTime: subtract.startTime
                    });
                    newResult.push({
                        startTime: subtract.endTime,
                        endTime: available.endTime
                    });
                }
                // If subtract overlaps start of available
                else if (subtract.startTime <= available.startTime && subtract.endTime > available.startTime) {
                    newResult.push({
                        startTime: subtract.endTime,
                        endTime: available.endTime
                    });
                }
                // If subtract overlaps end of available
                else if (subtract.startTime < available.endTime && subtract.endTime >= available.endTime) {
                    newResult.push({
                        startTime: available.startTime,
                        endTime: subtract.startTime
                    });
                }
                // No overlap, keep available window
                else {
                    newResult.push(available);
                }
            }
            result = newResult;
        }

        return result.filter(w => w.startTime < w.endTime); // Remove invalid windows
    }

    /**
     * Apply schedule overrides
     * Overrides can replace or add special hours
     * @private
     */
    _applyOverrides(availableWindows, overrides, timezone = 'Asia/Riyadh') {
        if (overrides.length === 0) return availableWindows;

        // For now, handle simple cases:
        // - If override.isAvailable = false, remove that date from windows
        // - If override.isAvailable = true with times, replace/add those hours
        
        // Group overrides by type
        const dayOffOverrides = overrides.filter(o => !o.isAvailable);
        const specialHoursOverrides = overrides.filter(o => o.isAvailable && o.startTime && o.endTime);

        let result = [...availableWindows];

        // Remove windows for day-off dates
        for (const dayOff of dayOffOverrides) {
            const overrideDate = `${dayOff.date}`;
            result = result.filter(w => {
                const windowDate = this._getDatePartsInTimeZone(w.startTime, timezone).dateKey;
                return windowDate !== overrideDate;
            });
        }

        // Add special hours
        for (const special of specialHoursOverrides) {
            const overrideDate = `${special.date}`;
            const specialStart = this._combineDateAndTime(special.date, special.startTime, timezone);
            const specialEnd = this._combineDateAndTime(special.date, special.endTime, timezone);

            // Remove existing windows for this date
            result = result.filter(w => {
                const windowDate = this._getDatePartsInTimeZone(w.startTime, timezone).dateKey;
                return windowDate !== overrideDate;
            });

            // Add special hours window
            result.push({
                startTime: specialStart,
                endTime: specialEnd
            });
        }

        return result;
    }
    /**
     * Get the next available slot for a service and staff
     * Searches up to daysToSearch days in the future
     * 
     * @param {string} tenantId - Tenant ID
     * @param {string} serviceId - Service ID (required)
     * @param {string} staffId - Staff ID (required)
     * @param {number} daysToSearch - Number of days to search ahead (default: 14)
     * @returns {Promise<Object>} Next available slot or null
     */
    async getNextAvailableSlot(tenantId, { serviceId, staffId, daysToSearch = 14 }) {
        if (!serviceId || !staffId) {
            throw new Error('serviceId and staffId are required');
        }

        const tenantSettings = await this._getTenantSettings(tenantId);
        const timezone = tenantSettings.timezone || 'Asia/Riyadh';
        const today = this._getDatePartsInTimeZone(new Date(), timezone).dateKey;

        // Search each day
        for (let i = 0; i < daysToSearch; i++) {
            const searchDate = new Date(Date.UTC(
                Number(today.slice(0, 4)),
                Number(today.slice(5, 7)) - 1,
                Number(today.slice(8, 10)) + i,
                12,
                0,
                0
            ));
            const dateString = this._getDatePartsInTimeZone(searchDate, timezone).dateKey; // YYYY-MM-DD

            try {
                // Get available slots for this date
                const result = await this.getAvailableSlots(tenantId, {
                    serviceId,
                    staffId,
                    date: dateString
                });

                // Find first available slot
                const availableSlot = result.slots.find(slot => slot.available);
                
                if (availableSlot) {
                    return {
                        success: true,
                        slot: availableSlot,
                        date: dateString,
                        daysAhead: i,
                        metadata: result.metadata
                    };
                }
            } catch (error) {
                console.error(`Error checking date ${dateString}:`, error.message);
                // Continue to next day
            }
        }

        // No available slots found
        return {
            success: false,
            slot: null,
            date: null,
            daysAhead: null,
            message: `No available slots found in the next ${daysToSearch} days`
        };
    }
}

module.exports = new AvailabilityService();

