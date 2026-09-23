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
const {
    resolveServiceResourceRequirements
} = require('../utils/resourceRequirementResolver');

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
            hour12: false,
            hourCycle: 'h23'
        });

        const parts = formatter.formatToParts(date);
        const map = {};
        parts.forEach((part) => {
            if (part.type !== 'literal') {
                map[part.type] = part.value;
            }
        });

        if (map.hour === '24') {
            map.hour = '00';
        }

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
     * @param {string} excludeAppointmentId - Appointment ID to exclude from availability calculation
     * @returns {Promise<Object>} Available slots with metadata
     */
    async getAvailableSlots(tenantId, { serviceId, staffId, date, variantId, excludeAppointmentId, includeAllCandidates = false }) {
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
        const stepSize = tenantSettings.booking?.slotInterval || 5; // Default 5 minutes to match UI
        const timezone = tenantSettings.timezone || 'Asia/Riyadh';

        // Service duration and buffers
        const duration = serviceVariant?.duration || service.duration || 30; // minutes
        const bufferBefore = service.bufferBefore || tenantSettings.booking?.defaultBufferBefore || 0;
        const bufferAfter = service.bufferAfter || tenantSettings.booking?.defaultBufferAfter || 0;
        const totalSlotLength = duration + bufferBefore + bufferAfter; // Total minutes

        const resourceContext = await this._buildResourceAvailabilityContext(
            tenantId,
            serviceId,
            serviceVariant?.id || null,
            date,
            timezone,
            excludeAppointmentId
        );

        if (resourceContext && resourceContext.hasRequirements && !resourceContext.hasTotalCapacity) {
            return {
                slots: [],
                diagnostics: [{ code: 'INSUFFICIENT_RESOURCE_CAPACITY', message: 'Salon lacks total capacity for required service resources' }],
                metadata: {
                    date,
                    serviceId,
                    staffId: staffId || null,
                    serviceDuration: duration,
                    bufferBefore,
                    bufferAfter,
                    totalSlotLength,
                    stepSize,
                    timezone,
                    totalSlots: 0,
                    availableSlots: 0,
                    staffCount: staffId ? 1 : 0
                }
            };
        }

        // If staffId provided, get slots for that staff
        if (staffId) {
            const result = await this._getSlotsForStaff(
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
                serviceVariant?.id || null,
                excludeAppointmentId,
                resourceContext
            );

            if (includeAllCandidates && !result.allCandidatesByTime) {
                const allCandidatesByTime = {};
                (result.slots || []).filter(s => s.available).forEach(s => {
                    const k = new Date(s.startTime).toISOString();
                    if (!allCandidatesByTime[k]) allCandidatesByTime[k] = [];
                    allCandidatesByTime[k].push(s);
                });
                result.allCandidatesByTime = allCandidatesByTime;
            }

            return result;
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
            serviceVariant?.id || null,
            excludeAppointmentId,
            resourceContext,
            includeAllCandidates
        );
    }

    /**
     * Resolves the effective staff ID for a package child item.
     * Enforces:
     * 1. Preserves explicit child assignment (including null for Any Professional).
     * 2. Rejects conflicting inputs between staffAssignments and packageItems with HTTP 400.
     * 3. Prevents explicit null from falling through to defaultStaffId.
     * 4. Falls back to package-level staffId if supplied.
     * 5. Falls back to pItem.defaultStaffId only when no explicit preference was provided.
     */
    _resolveChildStepStaff(pItem, { staffAssignments, packageItems, staffId } = {}) {
        let hasPackageItemPref = false;
        let packageItemStaff = null;

        if (Array.isArray(packageItems)) {
            // Prioritize canonical packageItemId / id matching
            let matched = packageItems.find(it =>
                (it.packageItemId && (it.packageItemId === pItem.id)) ||
                (it.id && (it.id === pItem.id))
            );
            // Fall back to serviceId only if not matched by item ID
            if (!matched) {
                matched = packageItems.find(it => it.serviceId && (it.serviceId === pItem.serviceId));
            }
            if (matched) {
                if (matched.requestedStaffId !== undefined) {
                    hasPackageItemPref = true;
                    packageItemStaff = (matched.requestedStaffId === 'any' || matched.requestedStaffId === 'auto' || matched.requestedStaffId === '') ? null : matched.requestedStaffId;
                } else if (matched.staffId !== undefined) {
                    hasPackageItemPref = true;
                    packageItemStaff = (matched.staffId === 'any' || matched.staffId === 'auto' || matched.staffId === '') ? null : matched.staffId;
                } else if (matched.staff !== undefined) {
                    hasPackageItemPref = true;
                    packageItemStaff = matched.staff ? matched.staff.id : null;
                }
            }
        }

        let hasStaffAssignment = false;
        let staffAssignmentVal = null;

        if (staffAssignments && typeof staffAssignments === 'object') {
            if (pItem.id && staffAssignments[pItem.id] !== undefined) {
                hasStaffAssignment = true;
                const rawVal = staffAssignments[pItem.id];
                staffAssignmentVal = (rawVal === 'any' || rawVal === 'auto' || rawVal === '') ? null : rawVal;
            } else if (pItem.serviceId && staffAssignments[pItem.serviceId] !== undefined) {
                hasStaffAssignment = true;
                const rawVal = staffAssignments[pItem.serviceId];
                staffAssignmentVal = (rawVal === 'any' || rawVal === 'auto' || rawVal === '') ? null : rawVal;
            }
        }

        // Validate consistency if both specify the same child item
        if (hasPackageItemPref && hasStaffAssignment) {
            const pVal = packageItemStaff ? String(packageItemStaff) : null;
            const aVal = staffAssignmentVal ? String(staffAssignmentVal) : null;
            if (pVal !== aVal) {
                const err = new Error(`Conflicting staff assignments for child service: ${pItem.service?.name_en || pItem.serviceId}`);
                err.code = 'CONFLICTING_STAFF_ASSIGNMENTS';
                err.statusCode = 400;
                err.messageAr = 'تعارض في تعيينات الموظفين المحددة للباقة';
                throw err;
            }
        }

        // 1. Explicit child assignment exists: use it exactly (including explicit null for Any Professional)
        if (hasPackageItemPref) {
            return packageItemStaff;
        }
        if (hasStaffAssignment) {
            return staffAssignmentVal;
        }

        // 2. Package-level staffId if supplied (and not empty)
        if (staffId !== undefined && staffId !== null && staffId !== '') {
            return (staffId === 'any' || staffId === 'auto') ? null : staffId;
        }

        // 3. Fallback to defaultStaffId on the package item
        return pItem.defaultStaffId || null;
    }

    /**
     * Get available slots for a package (bundle)
     * Backend-authoritative package availability engine for both sequence and parallel bundles
     *
     * @param {string} tenantId - Tenant ID
     * @param {Object} options
     * @param {string} options.packageId - Package ID (required)
     * @param {string} options.date - Date in YYYY-MM-DD format
     * @param {string} [options.staffId] - Preferred staff ID (optional, null = any staff)
     * @param {string} [options.variantId] - Variant ID (optional)
     * @param {string} [options.excludeAppointmentId] - Appointment to exclude (optional)
     * @param {Object} [options.staffAssignments] - Map of child itemId or serviceId to staffId | null
     * @param {Array} [options.packageItems] - Array of child package items with staffId / requestedStaffId
     * @returns {Promise<Object>} Available package slots with metadata
     */
    async getPackageAvailableSlots(tenantId, { packageId, date, staffId, variantId, excludeAppointmentId, staffAssignments, packageItems }) {
        if (!packageId || !date) {
            throw new Error('packageId and date are required');
        }

        const ServicePackage = db.ServicePackage || db.Package;
        const ServicePackageItem = db.ServicePackageItem || db.PackageItem;

        const servicePackage = await ServicePackage.findOne({
            where: { id: packageId, tenantId },
            include: [{
                model: ServicePackageItem,
                as: 'items',
                where: { isActive: true },
                required: false,
                include: [{
                    model: db.Service,
                    as: 'service'
                }]
            }],
            order: [[{ model: ServicePackageItem, as: 'items' }, 'sequenceOrder', 'ASC']]
        });

        if (!servicePackage) {
            const err = new Error('Package not found');
            err.code = 'PACKAGE_NOT_FOUND';
            err.messageAr = 'الباقة غير موجودة';
            throw err;
        }

        if (!servicePackage.isActive) {
            return {
                slots: [],
                diagnostics: [{ code: 'PACKAGE_INACTIVE', message: 'Package is currently inactive' }],
                totalSlots: 0,
                availableSlots: 0,
                date,
                package: {
                    id: servicePackage.id,
                    name_en: servicePackage.name_en || servicePackage.nameEn,
                    name_ar: servicePackage.name_ar || servicePackage.nameAr,
                    scheduleType: servicePackage.scheduleType || 'sequence',
                    totalDuration: servicePackage.totalDuration || 60
                }
            };
        }

        const activeItems = (servicePackage.items || []).filter(item => Boolean(item.serviceId && item.service));
        if (activeItems.length === 0) {
            return {
                slots: [],
                diagnostics: [{ code: 'NO_ACTIVE_SERVICES', message: 'Package has no active services' }],
                totalSlots: 0,
                availableSlots: 0,
                date,
                package: {
                    id: servicePackage.id,
                    name_en: servicePackage.name_en || servicePackage.nameEn,
                    name_ar: servicePackage.name_ar || servicePackage.nameAr,
                    scheduleType: servicePackage.scheduleType || 'sequence',
                    totalDuration: servicePackage.totalDuration || 60
                }
            };
        }

        const tenantSettings = await this._getTenantSettings(tenantId);
        const dayOfWeek = this._getDayOfWeekForDate(date);
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];

        // Check if tenant is closed on this weekday
        const tenant = await db.Tenant.findByPk(tenantId, { attributes: ['id', 'workingHours'] });
        if (tenant?.workingHours && tenant.workingHours[dayName]?.isOpen === false) {
            return {
                slots: [],
                diagnostics: [{ code: 'TENANT_CLOSED', message: 'Salon is closed on this day' }],
                totalSlots: 0,
                availableSlots: 0,
                date,
                package: {
                    id: servicePackage.id,
                    name_en: servicePackage.name_en || servicePackage.nameEn,
                    name_ar: servicePackage.name_ar || servicePackage.nameAr,
                    scheduleType: servicePackage.scheduleType || 'sequence',
                    totalDuration: servicePackage.totalDuration || 60
                },
                metadata: { date, status: 'day-off' }
            };
        }

        const scheduleType = servicePackage.scheduleType || 'sequence';

        // 1. Fetch available slots for each child item using core getAvailableSlots
        const childSlotsResults = await Promise.all(
            activeItems.map(async (pItem) => {
                const stepStaffId = this._resolveChildStepStaff(pItem, { staffAssignments, packageItems, staffId });
                const stepVariantId = pItem.variantId || variantId || null;
                try {
                    return await this.getAvailableSlots(tenantId, {
                        serviceId: pItem.serviceId,
                        staffId: stepStaffId,
                        date,
                        variantId: stepVariantId,
                        excludeAppointmentId,
                        includeAllCandidates: (scheduleType === 'parallel')
                    });
                } catch (err) {
                    if (err.message && (
                        err.message.includes('cannot perform') ||
                        err.message.includes('not active') ||
                        err.message.includes('Staff not found') ||
                        err.message.includes('does not belong')
                    )) {
                        return { slots: [], allCandidatesByTime: {} };
                    }
                    throw err;
                }
            })
        );

        // Extract available slots per step
        const childLayers = childSlotsResults.map(res => (res.slots || []).filter(s => s.available));

        // If any step has zero available slots, the complete bundle cannot fit on this day
        if (childLayers.some(layer => layer.length === 0)) {
            return {
                slots: [],
                diagnostics: [{ code: 'CHILD_STEP_UNAVAILABLE', message: 'One or more bundle services are not available on this date' }],
                totalSlots: 0,
                availableSlots: 0,
                date,
                package: {
                    id: servicePackage.id,
                    name_en: servicePackage.name_en || servicePackage.nameEn,
                    name_ar: servicePackage.name_ar || servicePackage.nameAr,
                    scheduleType,
                    totalDuration: servicePackage.totalDuration || 60
                }
            };
        }

        const packageSlots = [];

        if (scheduleType === 'parallel') {
            // ==========================================
            // PARALLEL BUNDLE SCHEDULING
            // All child services must run concurrently at the same startTime
            // ==========================================
            const firstLayer = childLayers[0];
            const maxDuration = Math.max(...activeItems.map(it => Number(it.duration || it.service?.duration || 30)));

            for (const firstSlot of firstLayer) {
                const startTimeStr = firstSlot.startTime;
                const startTimeIso = new Date(startTimeStr).toISOString();

                // 1. Gather qualified available staff candidates for each concurrent child service at this startTime
                const candidateLists = activeItems.map((_, idx) => {
                    const res = childSlotsResults[idx];
                    if (res?.allCandidatesByTime) {
                        return res.allCandidatesByTime[startTimeIso] || res.allCandidatesByTime[startTimeStr] || [];
                    }
                    return (res?.slots || []).filter(
                        s => s.available && (s.startTime === startTimeStr || new Date(s.startTime).toISOString() === startTimeIso)
                    );
                });

                // If any step has 0 available candidates at this startTime, this start time is not feasible
                if (candidateLists.some(list => list.length === 0)) {
                    continue;
                }

                // 2. Coordinated Parallel Staff Distinctness: find valid distinct staff assignment across all steps
                const assignedSlots = this._findParallelDistinctStaffAssignment(candidateLists);
                if (!assignedSlots) {
                    continue;
                }

                // 3. Coordinated Resource Concurrency: enforce active resource capacity
                const resourcesAvailable = await this._verifyParallelResourceConcurrency(tenantId, activeItems, startTimeStr, maxDuration, excludeAppointmentId);
                if (!resourcesAvailable) {
                    continue;
                }

                const startMs = new Date(startTimeStr).getTime();
                const endIso = new Date(startMs + maxDuration * 60000).toISOString();

                packageSlots.push({
                    startTime: startTimeStr,
                    endTime: endIso,
                    available: true,
                    duration: maxDuration,
                    scheduleType: 'parallel',
                    staffId: assignedSlots[0]?.staffId || null,
                    staffName: assignedSlots[0]?.staffName || null,
                    steps: activeItems.map((it, idx) => ({
                        serviceId: it.serviceId,
                        serviceName: it.service?.name_en || it.service?.name_ar,
                        startTime: startTimeStr,
                        endTime: new Date(startMs + Number(it.duration || it.service?.duration || 30) * 60000).toISOString(),
                        staffId: assignedSlots[idx]?.staffId || null,
                        staffName: assignedSlots[idx]?.staffName || null
                    }))
                });
            }
        } else {
            // ==========================================
            // SEQUENTIAL BUNDLE SCHEDULING
            // Child services run sequentially end-to-start (buffer 0 to 5 minutes)
            // ==========================================
            let chains = childLayers[0].map(slot => [slot]);

            for (let i = 1; i < childLayers.length; i++) {
                const nextLayer = childLayers[i];
                const nextChains = [];

                for (const chain of chains) {
                    const lastSlot = chain[chain.length - 1];
                    const lastEndMs = new Date(lastSlot.endTime).getTime();

                    for (const nextSlot of nextLayer) {
                        const nextStartMs = new Date(nextSlot.startTime).getTime();
                        const gap = nextStartMs - lastEndMs;
                        // Strictly contiguous: 0 to 5 minutes buffer
                        if (gap >= 0 && gap <= 5 * 60000) {
                            nextChains.push([...chain, nextSlot]);
                        }
                    }
                }
                chains = nextChains;
            }

            const totalDuration = activeItems.reduce((acc, it) => acc + Number(it.duration || it.service?.duration || 30), 0);

            for (const chain of chains) {
                const startIso = chain[0].startTime;
                const endIso = chain[chain.length - 1].endTime;

                packageSlots.push({
                    startTime: startIso,
                    endTime: endIso,
                    available: true,
                    duration: totalDuration,
                    scheduleType: 'sequence',
                    staffId: chain[0].staffId || null,
                    staffName: chain[0].staffName || null,
                    steps: activeItems.map((it, idx) => ({
                        serviceId: it.serviceId,
                        serviceName: it.service?.name_en || it.service?.name_ar,
                        startTime: chain[idx].startTime,
                        endTime: chain[idx].endTime,
                        staffId: chain[idx].staffId || null,
                        staffName: chain[idx].staffName || null
                    }))
                });
            }
        }

        // Deduplicate slots by startTime and sort chronologically
        const uniqueSlotsMap = new Map();
        for (const slot of packageSlots) {
            if (!uniqueSlotsMap.has(slot.startTime)) {
                uniqueSlotsMap.set(slot.startTime, slot);
            }
        }

        const sortedSlots = Array.from(uniqueSlotsMap.values()).sort(
            (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

        return {
            slots: sortedSlots,
            diagnostics: [],
            totalSlots: sortedSlots.length,
            availableSlots: sortedSlots.filter(s => s.available).length,
            date,
            package: {
                id: servicePackage.id,
                name_en: servicePackage.name_en || servicePackage.nameEn,
                name_ar: servicePackage.name_ar || servicePackage.nameAr,
                scheduleType,
                totalDuration: servicePackage.totalDuration || 60
            }
        };
    }

    /**
     * Check simultaneous resource capacity for parallel bundle steps
     * @private
     */
    async _verifyParallelResourceConcurrency(tenantId, activeItems, startTimeStr, maxDuration, excludeAppointmentId) {
        try {
            const typeRequirements = new Map();
            for (const item of activeItems) {
                const reqs = await resolveServiceResourceRequirements(item.serviceId, item.variantId || null, tenantId);
                if (Array.isArray(reqs)) {
                    for (const req of reqs) {
                        const existing = typeRequirements.get(req.resourceTypeId) || 0;
                        typeRequirements.set(req.resourceTypeId, existing + (req.quantity || 1));
                    }
                }
            }

            if (typeRequirements.size === 0) return true;

            for (const [resourceTypeId, neededCount] of typeRequirements.entries()) {
                const totalActive = await db.Resource.count({
                    where: {
                        tenantId,
                        resourceTypeId,
                        is_active: true
                    }
                });

                if (totalActive < neededCount) {
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Find a combination of distinct staff across parallel child steps
     * @private
     * @param {Array<Array<Object>>} candidateLists - Array of candidate slot arrays per step
     * @returns {Array<Object>|null} Array of selected candidate slots per step or null if impossible
     */
    _findParallelDistinctStaffAssignment(candidateLists) {
        if (!candidateLists || candidateLists.length === 0) return null;
        if (candidateLists.length === 1) {
            return candidateLists[0].length > 0 ? [candidateLists[0][0]] : null;
        }

        const assignStep = (stepIdx, usedStaffIds, currentAssignment) => {
            if (stepIdx === candidateLists.length) {
                return currentAssignment;
            }

            const candidates = candidateLists[stepIdx];
            for (const cand of candidates) {
                const sId = cand.staffId;
                if (!sId || !usedStaffIds.has(sId)) {
                    const nextUsed = new Set(usedStaffIds);
                    if (sId) nextUsed.add(sId);

                    const match = assignStep(stepIdx + 1, nextUsed, [...currentAssignment, cand]);
                    if (match) return match;
                }
            }
            return null;
        };

        return assignStep(0, new Set(), []);
    }

    /**
     * Check if distinct staff can be assigned across parallel bundle steps
     * @private
     */
    _verifyParallelStaffDistinctness(matchingSlots, childSlotsResults, activeItems) {
        if (matchingSlots.length <= 1) return true;

        const staffIds = matchingSlots.map(s => s.staffId).filter(Boolean);
        const uniqueStaff = new Set(staffIds);

        if (uniqueStaff.size === staffIds.length) {
            return true;
        }

        // Check if any duplicate staff can be swapped with another staff candidate available at the same time
        for (let i = 0; i < matchingSlots.length; i++) {
            for (let j = i + 1; j < matchingSlots.length; j++) {
                if (matchingSlots[i].staffId && matchingSlots[i].staffId === matchingSlots[j].staffId) {
                    const duplicateId = matchingSlots[i].staffId;
                    const startTimeStr = matchingSlots[i].startTime;
                    const startTimeIso = new Date(startTimeStr).toISOString();

                    const candidateSource = childSlotsResults[j]?.allCandidatesByTime?.[startTimeIso]
                        || childSlotsResults[j]?.allCandidatesByTime?.[startTimeStr]
                        || childSlotsResults[j]?.slots
                        || [];

                    const alternates = candidateSource.filter(
                        s => s.available && (s.startTime === startTimeStr || new Date(s.startTime).toISOString() === startTimeIso) && s.staffId && s.staffId !== duplicateId
                    );

                    if (alternates.length === 0) {
                        return false;
                    }
                    matchingSlots[j] = alternates[0];
                }
            }
        }

        const recheckedStaff = matchingSlots.map(s => s.staffId).filter(Boolean);
        return new Set(recheckedStaff).size === recheckedStaff.length;
    }

    /**
     * Get available slots for a specific staff member
     * @private
     */
    async _getSlotsForStaff(tenantId, serviceId, staffId, date, duration, bufferBefore, bufferAfter, totalSlotLength, stepSize, timezone = 'Asia/Riyadh', variantId = null, excludeAppointmentId = null, resourceContext = null) {
        if (!resourceContext) {
            resourceContext = await this._buildResourceAvailabilityContext(
                tenantId,
                serviceId,
                variantId,
                date,
                timezone,
                excludeAppointmentId
            );
        }

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

        // Calculate availability window and retain the intermediate layers for diagnostics
        const availabilityContext = await this._buildAvailabilityContext(
            tenantId,
            staffId,
            date,
            timezone
        );
        const availabilityWindow = availabilityContext.finalWindows;

        if (!availabilityWindow || availabilityWindow.length === 0) {
            const diagnostics = this._buildAvailabilityDiagnostics({
                staffId,
                staffName: staff.name,
                date,
                timezone,
                duration,
                bufferBefore,
                bufferAfter,
                totalSlotLength,
                stepSize,
                tenantHours: availabilityContext.tenantHours,
                rawWindows: availabilityContext.rawWindows,
                finalWindows: availabilityContext.finalWindows,
                breaks: availabilityContext.breaks,
                timeOff: availabilityContext.timeOff,
                overrides: availabilityContext.overrides,
                existingAppointments: []
            });

            return {
                slots: [],
                diagnostics,
                scheduleContext: {
                    tenantHours: availabilityContext.tenantHours || null,
                    employeeDutyWindows: (availabilityContext.employeeDutyWindows || availabilityContext.rawWindows || []).map(w => ({
                        startTime: w.startTime instanceof Date ? w.startTime.toISOString() : new Date(w.startTime).toISOString(),
                        endTime: w.endTime instanceof Date ? w.endTime.toISOString() : new Date(w.endTime).toISOString()
                    })),
                    breaks: (availabilityContext.breaks || []).map(b => ({
                        startTime: b.startTime instanceof Date ? b.startTime.toISOString() : new Date(b.startTime).toISOString(),
                        endTime: b.endTime instanceof Date ? b.endTime.toISOString() : new Date(b.endTime).toISOString(),
                        type: b.type || null,
                        label: b.label || null
                    })),
                    timeOff: (availabilityContext.timeOff || []).map(t => ({
                        startTime: t.startTime instanceof Date ? t.startTime.toISOString() : new Date(t.startTime).toISOString(),
                        endTime: t.endTime instanceof Date ? t.endTime.toISOString() : new Date(t.endTime).toISOString()
                    })),
                    existingAppointments: [],
                    bufferBefore,
                    bufferAfter,
                    duration,
                    timezone
                },
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
        const existingAppointments = await this._getExistingAppointments(staffId, date, excludeAppointmentId);
        const diagnostics = this._buildAvailabilityDiagnostics({
            staffId,
            staffName: staff.name,
            date,
            timezone,
            duration,
            bufferBefore,
            bufferAfter,
            totalSlotLength,
            stepSize,
            tenantHours: availabilityContext.tenantHours,
            rawWindows: availabilityContext.rawWindows,
            finalWindows: availabilityWindow,
            breaks: availabilityContext.breaks,
            timeOff: availabilityContext.timeOff,
            overrides: availabilityContext.overrides,
            existingAppointments
        });

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
                existingAppointments,
                resourceContext
            );
            allSlots.push(...slots);
        }

        allSlots.forEach(slot => {
            slot.staffId = staffId;
            slot.staffName = staff.name;
        });

        // Sort slots by start time
        allSlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        return {
            slots: allSlots,
            diagnostics,
            scheduleContext: {
                tenantHours: availabilityContext.tenantHours || null,
                employeeDutyWindows: (availabilityContext.employeeDutyWindows || availabilityContext.rawWindows || []).map(w => ({
                    startTime: w.startTime instanceof Date ? w.startTime.toISOString() : new Date(w.startTime).toISOString(),
                    endTime: w.endTime instanceof Date ? w.endTime.toISOString() : new Date(w.endTime).toISOString()
                })),
                breaks: (availabilityContext.breaks || []).map(b => ({
                    startTime: b.startTime instanceof Date ? b.startTime.toISOString() : new Date(b.startTime).toISOString(),
                    endTime: b.endTime instanceof Date ? b.endTime.toISOString() : new Date(b.endTime).toISOString(),
                    type: b.type || null,
                    label: b.label || null
                })),
                timeOff: (availabilityContext.timeOff || []).map(t => ({
                    startTime: t.startTime instanceof Date ? t.startTime.toISOString() : new Date(t.startTime).toISOString(),
                    endTime: t.endTime instanceof Date ? t.endTime.toISOString() : new Date(t.endTime).toISOString()
                })),
                existingAppointments: existingAppointments.map(appt => ({
                    id: appt.id,
                    startTime: appt.startTime instanceof Date ? appt.startTime.toISOString() : new Date(appt.startTime).toISOString(),
                    endTime: appt.endTime instanceof Date ? appt.endTime.toISOString() : new Date(appt.endTime).toISOString()
                })),
                bufferBefore,
                bufferAfter,
                duration,
                timezone
            },
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
    async _getSlotsForAnyStaff(tenantId, serviceId, date, duration, bufferBefore, bufferAfter, totalSlotLength, stepSize, timezone = 'Asia/Riyadh', variantId = null, excludeAppointmentId = null, resourceContext = null, includeAllCandidates = false) {
        if (!resourceContext) {
            resourceContext = await this._buildResourceAvailabilityContext(
                tenantId,
                serviceId,
                variantId,
                date,
                timezone,
                excludeAppointmentId
            );
        }

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
        const diagnostics = [];

        for (const staff of staffMembers) {
            try {
                // Calculate workload for deterministic tie-breaking
                const appointments = await this._getExistingAppointments(staff.id, date, excludeAppointmentId);
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
                    variantId,
                    excludeAppointmentId,
                    resourceContext
                );
                
                // Add staff info to each slot
                result.slots.forEach(slot => {
                    slot.staffId = staff.id;
                    slot.staffName = staff.name;
                });

                if (Array.isArray(result.diagnostics)) {
                    result.diagnostics.forEach((diag) => {
                        diagnostics.push({
                            ...diag,
                            staffId: diag.staffId || staff.id,
                            staffName: diag.staffName || staff.name
                        });
                    });
                }
                
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
        const allCandidatesByTime = includeAllCandidates ? {} : undefined;

        for (const [timeKey, candidates] of slotsByTime.entries()) {
            const availableCandidates = candidates.filter(c => c.available);
            
            if (availableCandidates.length > 0) {
                // Determine winner using isolated scheduling policy
                const winner = this._applySchedulingPolicy(availableCandidates, staffWorkloads);
                uniqueSlots.push(winner);

                if (includeAllCandidates) {
                    // Sort candidates by workload so the optimal candidate is evaluated first
                    const sortedCandidates = [...availableCandidates].sort((a, b) => {
                        const wA = staffWorkloads.get(a.staffId) || 0;
                        const wB = staffWorkloads.get(b.staffId) || 0;
                        return wA - wB;
                    });
                    allCandidatesByTime[timeKey] = sortedCandidates;
                }
            } else {
                // If no staff is available, arbitrarily push the first unavailable slot 
                uniqueSlots.push(candidates[0]);
            }
        }

        // Ensure chronological order for output
        uniqueSlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        return {
            slots: uniqueSlots,
            ...(includeAllCandidates ? { allCandidatesByTime } : {}),
            diagnostics,
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
    async _buildAvailabilityContext(tenantId, staffId, date, timezone = 'Asia/Riyadh') {
        const dateKey = typeof date === 'string' ? date.split('T')[0] : this._getDatePartsInTimeZone(date, timezone).dateKey;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
            throw new Error(`Invalid date format: ${date}`);
        }
        const dayOfWeek = this._getDayOfWeekForDate(dateKey);

        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }
        const tenantHours = this._parseBusinessHours(tenant.workingHours, dayOfWeek);

        const { dateSpecificShifts, recurringShifts, allShifts } = await this._getStaffShiftWindows(staffId, dateKey, dayOfWeek);

        let rawWindows = [];
        let legacySchedule = null;

        if (allShifts.length === 0) {
            legacySchedule = await db.StaffSchedule.findOne({
                where: {
                    staffId,
                    dayOfWeek,
                    isAvailable: true
                }
            });

            if (legacySchedule) {
                const scheduleStart = this._combineDateAndTime(dateKey, legacySchedule.startTime, timezone);
                const scheduleEnd = this._combineDateAndTime(dateKey, legacySchedule.endTime, timezone);
                rawWindows = [{
                    startTime: scheduleStart,
                    endTime: scheduleEnd
                }];
            }
        } else {
            rawWindows = allShifts.map(shift => ({
                startTime: this._combineDateAndTime(dateKey, shift.startTime, timezone),
                endTime: this._combineDateAndTime(dateKey, shift.endTime, timezone)
            }));
        }

        const employeeDutyWindows = rawWindows.map((window) => ({ ...window }));

        if (tenantHours) {
            const tenantStart = this._combineDateAndTime(dateKey, tenantHours.start, timezone);
            const tenantEnd = this._combineDateAndTime(dateKey, tenantHours.end, timezone);

            rawWindows = this._intersectWindows(rawWindows, [{
                startTime: tenantStart,
                endTime: tenantEnd
            }]);
        }

        const breaks = await this._getStaffBreaks(staffId, dateKey, timezone);
        const timeOff = await this._getStaffTimeOff(staffId, dateKey, timezone);
        const overrides = await this._getStaffOverrides(staffId, dateKey);

        let finalWindows = this._subtractWindows(rawWindows, breaks);
        finalWindows = this._subtractWindows(finalWindows, timeOff);
        finalWindows = this._applyOverrides(finalWindows, overrides, timezone);

        return {
            dateKey,
            dayOfWeek,
            tenant,
            tenantHours,
            dateSpecificShifts,
            recurringShifts,
            allShifts,
            legacySchedule,
            employeeDutyWindows,
            rawWindows,
            finalWindows,
            breaks,
            timeOff,
            overrides
        };
    }

    /**
     * Calculate availability window for a staff member on a specific date
     * Considers: tenant business hours, staff schedule, breaks, time-off, overrides
     * @private
     */
    async _calculateAvailabilityWindow(tenantId, staffId, date, timezone = 'Asia/Riyadh') {
        try {
            const context = await this._buildAvailabilityContext(tenantId, staffId, date, timezone);
            return context.finalWindows;
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
     * Build structured diagnostics for a staff availability evaluation.
     * @private
     */
    _buildAvailabilityDiagnostics({
        staffId,
        staffName,
        date,
        timezone = 'Asia/Riyadh',
        duration,
        bufferBefore,
        bufferAfter,
        totalSlotLength,
        stepSize,
        tenantHours,
        rawWindows = [],
        finalWindows = [],
        breaks = [],
        timeOff = [],
        overrides = [],
        existingAppointments = []
    }) {
        const diagnostics = [];
        const seen = new Set();
        const dateKey = typeof date === 'string' ? date.split('T')[0] : this._getDatePartsInTimeZone(date, timezone).dateKey;
        const fallbackStaffName = staffName || 'Unknown';

        const pushDiagnostic = (diagnostic) => {
            if (!diagnostic || !diagnostic.reasonType) return;
            const startKey = diagnostic.reasonStartTime || diagnostic.startTime || '';
            const endKey = diagnostic.reasonEndTime || diagnostic.endTime || '';
            const key = [
                diagnostic.staffId || staffId || '',
                diagnostic.reasonType,
                startKey,
                endKey
            ].join('|');
            if (seen.has(key)) {
                return;
            }
            seen.add(key);
            diagnostics.push({
                staffId: diagnostic.staffId || staffId || '',
                staffName: diagnostic.staffName || fallbackStaffName,
                startTime: diagnostic.startTime || diagnostic.reasonStartTime || null,
                endTime: diagnostic.endTime || diagnostic.reasonEndTime || null,
                reasonType: diagnostic.reasonType,
                reasonStartTime: diagnostic.reasonStartTime || diagnostic.startTime || null,
                reasonEndTime: diagnostic.reasonEndTime || diagnostic.endTime || null,
                workingHoursEnd: diagnostic.workingHoursEnd || null
            });
        };

        existingAppointments.forEach((appointment) => {
            const start = new Date(appointment.startTime);
            const end = new Date(appointment.endTime);
            const bufferedStart = new Date(start.getTime() - (bufferBefore || 0) * 60000);
            const bufferedEnd = new Date(end.getTime() + (bufferAfter || 0) * 60000);

            pushDiagnostic({
                staffId,
                staffName: fallbackStaffName,
                startTime: bufferedStart.toISOString(),
                endTime: bufferedEnd.toISOString(),
                reasonType: 'existing_booking',
                reasonStartTime: bufferedStart.toISOString(),
                reasonEndTime: bufferedEnd.toISOString()
            });
        });

        breaks.forEach((breakRecord) => {
            const rawType = `${breakRecord?.type || ''}`.trim().toLowerCase();
            const reasonType = rawType === 'other' || rawType === 'meeting' ? 'blocked_time' : 'staff_break';
            const startTime = breakRecord.startTime instanceof Date
                ? breakRecord.startTime.toISOString()
                : new Date(breakRecord.startTime).toISOString();
            const endTime = breakRecord.endTime instanceof Date
                ? breakRecord.endTime.toISOString()
                : new Date(breakRecord.endTime).toISOString();

            pushDiagnostic({
                staffId,
                staffName: fallbackStaffName,
                startTime,
                endTime,
                reasonType,
                reasonStartTime: startTime,
                reasonEndTime: endTime
            });
        });

        timeOff.forEach((timeOffRecord) => {
            const startTime = timeOffRecord.startTime instanceof Date
                ? timeOffRecord.startTime.toISOString()
                : new Date(timeOffRecord.startTime).toISOString();
            const endTime = timeOffRecord.endTime instanceof Date
                ? timeOffRecord.endTime.toISOString()
                : new Date(timeOffRecord.endTime).toISOString();

            pushDiagnostic({
                staffId,
                staffName: fallbackStaffName,
                startTime,
                endTime,
                reasonType: 'time_off',
                reasonStartTime: startTime,
                reasonEndTime: endTime
            });
        });

        overrides.forEach((override) => {
            if (!override || override.isAvailable !== false) {
                return;
            }

            const startTime = this._combineDateAndTime(dateKey, '00:00', timezone).toISOString();
            const endTime = this._combineDateAndTime(dateKey, '23:59', timezone).toISOString();
            pushDiagnostic({
                staffId,
                staffName: fallbackStaffName,
                startTime,
                endTime,
                reasonType: 'unavailable',
                reasonStartTime: startTime,
                reasonEndTime: endTime
            });
        });

        finalWindows.forEach((window) => {
            const windowStartMs = new Date(window.startTime).getTime();
            const windowEndMs = new Date(window.endTime).getTime();
            const latestValidStartMs = windowEndMs - (totalSlotLength * 60000);

            if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) {
                return;
            }

            if (latestValidStartMs < windowStartMs) {
                const startTime = new Date(windowStartMs).toISOString();
                const endTime = new Date(windowEndMs).toISOString();
                pushDiagnostic({
                    staffId,
                    staffName: fallbackStaffName,
                    startTime,
                    endTime,
                    reasonType: 'outside_working_hours',
                    reasonStartTime: startTime,
                    reasonEndTime: endTime,
                    workingHoursEnd: endTime
                });
                return;
            }

            const firstInvalidStartMs = latestValidStartMs + (stepSize * 60000);
            if (firstInvalidStartMs < windowEndMs) {
                const startTime = new Date(firstInvalidStartMs).toISOString();
                const endTime = new Date(windowEndMs).toISOString();
                pushDiagnostic({
                    staffId,
                    staffName: fallbackStaffName,
                    startTime,
                    endTime,
                    reasonType: 'outside_working_hours',
                    reasonStartTime: startTime,
                    reasonEndTime: endTime,
                    workingHoursEnd: endTime
                });
            }
        });

        if (diagnostics.length === 0) {
            const dayStart = this._combineDateAndTime(dateKey, '00:00', timezone).toISOString();
            const dayEnd = this._combineDateAndTime(dateKey, '23:59', timezone).toISOString();
            pushDiagnostic({
                staffId,
                staffName: fallbackStaffName,
                startTime: dayStart,
                endTime: dayEnd,
                reasonType: tenantHours ? 'unavailable' : 'outside_working_hours',
                reasonStartTime: dayStart,
                reasonEndTime: dayEnd,
                workingHoursEnd: tenantHours
                    ? this._combineDateAndTime(dateKey, tenantHours.end, timezone).toISOString()
                    : undefined
            });
        }

        // TEMP UAT DEBUG — REMOVE AFTER AVAILABILITY ROOT CAUSE IS CONFIRMED
        console.info('availabilityDiagnostic', {
            staffId,
            staffName: fallbackStaffName,
            requestedDate: dateKey,
            tenantTimezone: timezone,
            serverCurrentTime: new Date().toISOString(),
            rawWindowsLength: rawWindows.length,
            finalWindowsLength: finalWindows.length,
            breaksLength: breaks.length,
            timeOffLength: timeOff.length,
            overridesLength: overrides.length,
            diagnosticsLength: diagnostics.length
        });

        return diagnostics;
    }

    /**
     * Build resource availability context for slot generation.
     * Pre-fetches active resources and day appointments to perform fast in-memory availability checks per slot.
     * @private
     */
    async _buildResourceAvailabilityContext(tenantId, serviceId, variantId, date, timezone = 'Asia/Riyadh', excludeAppointmentId = null) {
        const requirements = await resolveServiceResourceRequirements(serviceId, variantId, tenantId);
        if (!requirements || requirements.length === 0) {
            return { hasRequirements: false };
        }

        const activeResourcesByType = new Map();
        for (const req of requirements) {
            const activeResources = await db.Resource.findAll({
                where: {
                    tenantId,
                    resourceTypeId: req.resourceTypeId,
                    is_active: true
                },
                order: [['name_en', 'ASC'], ['id', 'ASC']]
            });

            if (activeResources.length < req.quantity) {
                return {
                    hasRequirements: true,
                    hasTotalCapacity: false,
                    reason: 'INSUFFICIENT_TOTAL_CAPACITY',
                    requirements
                };
            }

            activeResourcesByType.set(req.resourceTypeId, activeResources);
        }

        const dayRange = this._getTimeZoneDayRange(date, timezone);
        const allActiveResourceIds = [];
        for (const list of activeResourcesByType.values()) {
            for (const r of list) {
                allActiveResourceIds.push(r.id);
            }
        }

        const appointmentWhere = {
            status: { [Op.notIn]: ['cancelled', 'no_show'] },
            startTime: { [Op.lt]: dayRange.endOfDay },
            endTime: { [Op.gt]: dayRange.startOfDay }
        };
        if (excludeAppointmentId) {
            appointmentWhere.id = { [Op.ne]: excludeAppointmentId };
        }

        const occupiedAllocations = await db.AppointmentResource.findAll({
            where: {
                resourceId: { [Op.in]: allActiveResourceIds }
            },
            include: [
                {
                    model: db.Appointment,
                    as: 'appointment',
                    where: appointmentWhere,
                    attributes: ['id', 'startTime', 'endTime', 'status'],
                    required: true
                }
            ]
        });

        const allocationsByResource = new Map();
        for (const alloc of occupiedAllocations) {
            if (!alloc.appointment) continue;
            const rId = String(alloc.resourceId);
            if (!allocationsByResource.has(rId)) {
                allocationsByResource.set(rId, []);
            }
            allocationsByResource.get(rId).push({
                appointmentId: alloc.appointment.id,
                startTime: new Date(alloc.appointment.startTime).getTime(),
                endTime: new Date(alloc.appointment.endTime).getTime()
            });
        }

        return {
            hasRequirements: true,
            hasTotalCapacity: true,
            requirements,
            activeResourcesByType,
            isSlotResourceAvailable(slotStart, slotEnd) {
                const sStart = slotStart instanceof Date ? slotStart.getTime() : new Date(slotStart).getTime();
                const sEnd = slotEnd instanceof Date ? slotEnd.getTime() : new Date(slotEnd).getTime();

                for (const req of requirements) {
                    const activeList = activeResourcesByType.get(req.resourceTypeId) || [];
                    let freeCount = 0;

                    for (const resource of activeList) {
                        const intervals = allocationsByResource.get(String(resource.id)) || [];
                        const isOccupied = intervals.some(interval => interval.startTime < sEnd && interval.endTime > sStart);
                        if (!isOccupied) {
                            freeCount++;
                        }
                    }

                    if (freeCount < req.quantity) {
                        return false;
                    }
                }

                return true;
            }
        };
    }

    /**
     * Generate time slots within a time window
     * @private
     */
    _generateSlots(windowStart, windowEnd, duration, bufferBefore, bufferAfter, totalSlotLength, stepSize, existingAppointments, resourceContext = null) {
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

            let available = !hasConflict;
            let unavailableReason = hasConflict ? 'staff_conflict' : null;

            if (available && resourceContext && resourceContext.hasRequirements) {
                if (!resourceContext.hasTotalCapacity || !resourceContext.isSlotResourceAvailable(slotStart, slotEnd)) {
                    available = false;
                    unavailableReason = 'resource_unavailable';
                }
            }

            slots.push({
                startTime: slotStart.toISOString(),
                endTime: slotEnd.toISOString(),
                available,
                unavailableReason,
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
    async _getExistingAppointments(staffId, date, excludeAppointmentId = null) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const where = {
            staffId,
            startTime: { [Op.between]: [startOfDay, endOfDay] },
            status: { [Op.notIn]: ['cancelled', 'no_show'] }
        };

        if (excludeAppointmentId) {
            where.id = { [Op.ne]: excludeAppointmentId };
        }

        return await db.Appointment.findAll({
            where,
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
                        slotInterval: tenantSettings.bookingSettings.slotInterval || 5,
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
                slotInterval: 5, // minutes
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

        const normalizeTime = (value) => {
            const raw = `${value || ''}`.trim();
            const match = raw.match(/^(\d{1,2}):(\d{2})$/);
            if (!match) {
                return null;
            }
            const hours = Math.max(0, Math.min(23, Number(match[1]) || 0));
            const minutes = Math.max(0, Math.min(59, Number(match[2]) || 0));
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        };

        const normalClose = normalizeTime(dayHours.close) || '18:00';
        const extendedClose = normalizeTime(dayHours.extendedClose);
        const effectiveClose = dayHours.extendedHoursEnabled && extendedClose
            ? (extendedClose > normalClose ? extendedClose : normalClose)
            : normalClose;

        return {
            start: normalizeTime(dayHours.open) || '09:00',
            end: effectiveClose,
            normalEnd: normalClose,
            extendedEnd: dayHours.extendedHoursEnabled ? extendedClose || null : null
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
    async _getStaffBreaks(staffIds, date, timezone = 'Asia/Riyadh') {
        const staffIdList = Array.isArray(staffIds) ? staffIds : [staffIds];
        const dayOfWeek = this._getDayOfWeekForDate(date);
        
        // Get date-specific breaks
        const dateBreaks = await db.StaffBreak.findAll({
            where: {
                staffId: { [Op.in]: staffIdList },
                specificDate: date,
                isActive: true,
                isRecurring: false
            }
        });

        // Get recurring breaks for this day
        const recurringBreaks = await db.StaffBreak.findAll({
            where: {
                staffId: { [Op.in]: staffIdList },
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
            staffId: breakRecord.staffId,
            startTime: this._combineDateAndTime(date, breakRecord.startTime, timezone),
            endTime: this._combineDateAndTime(date, breakRecord.endTime, timezone)
        }));
    }

    /**
     * Get staff time-off for a specific date
     * @private
     */
    async _getStaffTimeOff(staffIds, date, timezone = 'Asia/Riyadh') {
        const staffIdList = Array.isArray(staffIds) ? staffIds : [staffIds];
        const timeOffRecords = await db.StaffTimeOff.findAll({
            where: {
                staffId: { [Op.in]: staffIdList },
                isApproved: true,
                startDate: { [Op.lte]: date },
                endDate: { [Op.gte]: date }
            }
        });

        // Convert to full-day time windows
        return timeOffRecords.map(record => ({
            staffId: record.staffId,
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

    /**
     * Get staff shift windows for one or multiple staff members
     * @private
     */
    async _getStaffShiftWindows(staffIds, date, dayOfWeek) {
        const staffIdList = Array.isArray(staffIds) ? staffIds : [staffIds];

        const dateSpecificShifts = await db.StaffShift.findAll({
            where: {
                staffId: { [Op.in]: staffIdList },
                specificDate: date,
                isActive: true,
                isRecurring: false
            }
        });

        const recurringShifts = await db.StaffShift.findAll({
            where: {
                staffId: { [Op.in]: staffIdList },
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

        return {
            dateSpecificShifts,
            recurringShifts,
            allShifts: [...dateSpecificShifts, ...recurringShifts]
        };
    }

    /**
     * Compute live staff statuses for a given board date.
     * @param {string} tenantId
     * @param {Array<string|number>} staffIds
     * @param {string} dateKey - YYYY-MM-DD
     * @param {string} timezone - tenant timezone
     * @param {Date} now - current time
     * @returns {Promise<Object>} status map of staffId -> status string
     */
    async computeStaffStatuses(tenantId, staffIds, dateKey, timezone, now) {
        const statusMap = {};
        // Default off
        staffIds.forEach(id => statusMap[id] = 'off');

        const todayKey = this._getDatePartsInTimeZone(now, timezone).dateKey;
        const isToday = todayKey === dateKey;
        if (!isToday) {
            return statusMap;
        }

        const dayOfWeek = this._getDayOfWeekForDate(dateKey);
        const [shiftsResult, timeOffRecords, breaks, appointments] = await Promise.all([
            this._getStaffShiftWindows(staffIds, dateKey, dayOfWeek),
            this._getStaffTimeOff(staffIds, dateKey, timezone),
            this._getStaffBreaks(staffIds, dateKey, timezone),
            this._getStaffAppointmentsBatch(staffIds, dateKey, timezone)
        ]);

        const allShifts = shiftsResult.allShifts;
        // Active base (only if currently inside the shift)
        allShifts.forEach(shift => {
            const start = this._combineDateAndTime(dateKey, shift.startTime, timezone);
            const end = this._combineDateAndTime(dateKey, shift.endTime, timezone);
            if (now >= start && now < end) {
                statusMap[shift.staffId] = 'active';
            }
        });

        // Busy overrides active (but not break or time_off)
        appointments.forEach(app => {
            const start = new Date(app.startTime);
            const end = new Date(app.endTime);
            if (now >= start && now < end) {
                if (statusMap[app.staffId] === 'active') {
                    statusMap[app.staffId] = 'busy';
                }
            }
        });

        // Time-off overrides everything
        timeOffRecords.forEach(rec => {
            const start = new Date(rec.startTime);
            const end = new Date(rec.endTime);
            if (now >= start && now < end) {
                statusMap[rec.staffId] = 'time_off';
            }
        });

        // Breaks override active/busy but not time_off
        breaks.forEach(brk => {
            const start = new Date(brk.startTime);
            const end = new Date(brk.endTime);
            if (now >= start && now < end) {
                if (statusMap[brk.staffId] !== 'time_off') {
                    statusMap[brk.staffId] = 'break';
                }
            }
        });

        return statusMap;
    }

    /**
     * Batch fetch appointments for multiple staff on a given date.
     * @private
     */
    async _getStaffAppointmentsBatch(staffIds, dateKey, timezone) {
        const staffIdList = Array.isArray(staffIds) ? staffIds : [staffIds];
        const { startOfDay, endOfDay } = this._getTimeZoneDayRange(dateKey, timezone);
        const nextDayStart = new Date(endOfDay.getTime() + 1);

        return await db.Appointment.findAll({
            where: {
                staffId: { [Op.in]: staffIdList },
                status: { [Op.notIn]: ['cancelled', 'no_show'] },
                startTime: { [Op.lt]: nextDayStart },
                endTime: { [Op.gt]: startOfDay }
            }
        });
    }
}

module.exports = new AvailabilityService();
