'use strict';

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Resolve effective resource requirements for a service and optional variant.
 * 
 * Deterministic Merging Rule:
 * 1. Parent requirements (variantId IS NULL) apply to the base service and all its variants.
 * 2. If a specific variantId is supplied, variant-specific requirements are merged:
 *    - If the variant specifies a requirement for a resourceTypeId that already exists at parent level,
 *      the variant's quantity takes precedence (override).
 *    - If the variant specifies a resourceTypeId not in parent requirements, it is included (additive).
 * 3. Only active resource types belonging to the specified tenant are returned.
 * 
 * @param {string} serviceId - UUID of the service
 * @param {string|null} variantId - Optional variant ID
 * @param {string} tenantId - Tenant UUID for isolation enforcement
 * @param {object|null} transaction - Optional Sequelize transaction
 * @returns {Promise<Array<{ resourceTypeId: string, quantity: number, resourceType: object }>>}
 */
async function resolveServiceResourceRequirements(serviceId, variantId = null, tenantId = null, transaction = null) {
    if (!serviceId) {
        return [];
    }

    const typeInclude = {
        model: db.ResourceType,
        as: 'resourceType',
        where: { is_active: true }
    };

    if (tenantId) {
        typeInclude.where.tenantId = tenantId;
    }

    const requirements = await db.ServiceResourceRequirement.findAll({
        where: {
            serviceId,
            [Op.or]: [
                { variantId: null },
                ...(variantId ? [{ variantId: String(variantId) }] : [])
            ]
        },
        include: [typeInclude],
        order: [['createdAt', 'ASC']],
        transaction
    });

    if (requirements.length === 0) {
        return [];
    }

    const parentMap = new Map();
    const variantMap = new Map();

    for (const req of requirements) {
        if (!req.resourceType) continue;

        const typeId = req.resourceTypeId;
        const item = {
            resourceTypeId: typeId,
            quantity: Math.max(1, parseInt(req.quantity, 10) || 1),
            resourceType: req.resourceType
        };

        if (req.variantId === null || req.variantId === undefined || req.variantId === '') {
            parentMap.set(typeId, item);
        } else if (variantId && String(req.variantId) === String(variantId)) {
            variantMap.set(typeId, item);
        }
    }

    // If no variantId was requested, return parent requirements directly
    if (!variantId) {
        return Array.from(parentMap.values());
    }

    // Merge: start with parent requirements
    const mergedMap = new Map(parentMap);

    // Override or add variant requirements
    for (const [typeId, varItem] of variantMap.entries()) {
        mergedMap.set(typeId, varItem);
    }

    return Array.from(mergedMap.values());
}

/**
 * Check if the tenant has enough physical resources free during [startTime, endTime).
 * 
 * @param {string} tenantId - Tenant UUID
 * @param {Array<{ resourceTypeId: string, quantity: number }>} requirements - Resolved requirements
 * @param {Date} startTime - Start of window
 * @param {Date} endTime - End of window
 * @param {string|null} excludeAppointmentId - Optional appointment ID to exclude
 * @param {object|null} transaction - Optional Sequelize transaction
 * @returns {Promise<{ available: boolean, reason?: string, message?: string, freeResourcesByType?: Map }>}
 */
/**
 * Format a time range in English (e.g. "3:00 PM to 4:00 PM")
 */
function formatTimeRangeEn(start, end, timezone = 'Asia/Riyadh') {
    const s = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(new Date(start));
    const e = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(new Date(end));
    return `${s} to ${e}`;
}

/**
 * Format a time range in Arabic (e.g. "3:00 م إلى 4:00 م")
 */
function formatTimeRangeAr(start, end, timezone = 'Asia/Riyadh') {
    const s = new Intl.DateTimeFormat('ar-SA', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(new Date(start));
    const e = new Intl.DateTimeFormat('ar-SA', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(new Date(end));
    return `${s} إلى ${e}`;
}

/**
 * Format a single time in English (e.g. "4:00 PM")
 */
function formatClockEn(time, timezone = 'Asia/Riyadh') {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(new Date(time));
}

/**
 * Format a single time in Arabic (e.g. "4:00 م")
 */
function formatClockAr(time, timezone = 'Asia/Riyadh') {
    return new Intl.DateTimeFormat('ar-SA', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(new Date(time));
}

/**
 * Calculate the earliest future time at which the complete resource requirement
 * can be simultaneously satisfied across all required resource types and quantities.
 *
 * @param {object} params
 * @param {string} params.tenantId - Tenant UUID
 * @param {Array<{ resourceTypeId: string, quantity: number, resourceType: object }>} params.requirements - Resolved requirements
 * @param {Date} params.requestedStartTime - Start of window
 * @param {number} params.durationMs - Duration in milliseconds
 * @param {string|null} params.excludeAppointmentId - Optional appointment to exclude
 * @param {object|null} params.transaction - Sequelize transaction
 * @returns {Promise<Date|null>}
 */
async function calculateEarliestFeasibleResourceTime({
    tenantId,
    requirements,
    requestedStartTime,
    durationMs,
    excludeAppointmentId = null,
    transaction = null
}) {
    if (!requirements || requirements.length === 0) {
        return requestedStartTime instanceof Date ? requestedStartTime : new Date(requestedStartTime);
    }

    const start = requestedStartTime instanceof Date ? requestedStartTime : new Date(requestedStartTime);
    const duration = Math.max(60000, Number(durationMs) || 60000);

    // 1. Verify that every required resource type has enough total active instances configured
    const activeResourcesByType = new Map();
    for (const req of requirements) {
        const active = await db.Resource.findAll({
            where: {
                tenantId,
                resourceTypeId: req.resourceTypeId,
                is_active: true
            },
            order: [['createdAt', 'ASC']],
            transaction
        });
        if (active.length < req.quantity) {
            // Cannot ever be satisfied because salon does not have enough physical resources configured
            return null;
        }
        activeResourcesByType.set(req.resourceTypeId, active);
    }

    // 2. Fetch all overlapping and upcoming non-cancelled appointments for all active resources
    const allActiveResourceIds = [];
    for (const resources of activeResourcesByType.values()) {
        for (const r of resources) {
            allActiveResourceIds.push(r.id);
        }
    }

    // Look ahead up to 48 hours from requested start time
    const horizonEnd = new Date(start.getTime() + 48 * 3600000);

    const appointmentWhere = {
        status: { [Op.notIn]: ['cancelled', 'no_show'] },
        startTime: { [Op.lt]: horizonEnd },
        endTime: { [Op.gt]: start }
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
                required: true
            }
        ],
        transaction
    });

    // Group appointment intervals by resourceId
    const intervalsByResource = new Map();
    for (const alloc of occupiedAllocations) {
        const rId = String(alloc.resourceId);
        if (!intervalsByResource.has(rId)) {
            intervalsByResource.set(rId, []);
        }
        const appt = alloc.appointment;
        intervalsByResource.get(rId).push({
            start: new Date(appt.startTime).getTime(),
            end: new Date(appt.endTime).getTime()
        });
    }

    // Collect all candidate start times:
    // Any candidate start time is an appointment endTime >= start.getTime()
    const candidateTimestamps = new Set();
    for (const intervals of intervalsByResource.values()) {
        for (const iv of intervals) {
            if (iv.end >= start.getTime() && iv.end < horizonEnd.getTime()) {
                candidateTimestamps.add(iv.end);
            }
        }
    }

    const sortedCandidates = Array.from(candidateTimestamps).sort((a, b) => a - b);

    // Helper: test if window [candStart, candStart + duration] satisfies all requirements
    const isWindowFeasible = (candStart) => {
        const candEnd = candStart + duration;
        for (const req of requirements) {
            const resources = activeResourcesByType.get(req.resourceTypeId) || [];
            let freeCount = 0;
            for (const r of resources) {
                const rIntervals = intervalsByResource.get(String(r.id)) || [];
                const hasOverlap = rIntervals.some(iv => candStart < iv.end && candEnd > iv.start);
                if (!hasOverlap) {
                    freeCount++;
                }
            }
            if (freeCount < req.quantity) {
                return false;
            }
        }
        return true;
    };

    for (const candTime of sortedCandidates) {
        if (candTime > start.getTime() && isWindowFeasible(candTime)) {
            return new Date(candTime);
        }
    }

    return null;
}

/**
 * Check if the tenant has enough physical resources free during [startTime, endTime).
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Array<{ resourceTypeId: string, quantity: number, resourceType: object }>} requirements - Resolved requirements
 * @param {Date} startTime - Start of window
 * @param {Date} endTime - End of window
 * @param {string|null} excludeAppointmentId - Optional appointment ID to exclude
 * @param {object|null} transaction - Optional Sequelize transaction
 * @returns {Promise<{ available: boolean, reason?: string, message?: string, messageAr?: string, conflictDetails?: object, freeResourcesByType?: Map }>}
 */
async function checkResourceAvailability(tenantId, requirements, startTime, endTime, excludeAppointmentId = null, transaction = null) {
    if (!requirements || requirements.length === 0) {
        return { available: true, freeResourcesByType: new Map() };
    }

    const start = startTime instanceof Date ? startTime : new Date(startTime);
    const end = endTime instanceof Date ? endTime : new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const freeResourcesByType = new Map();

    for (const req of requirements) {
        const { resourceTypeId, quantity, resourceType } = req;
        const typeNameEn = resourceType?.name_en || resourceType?.name || 'Resource';
        const typeNameAr = resourceType?.name_ar || typeNameEn;

        // 1. Find all active resource instances of this type for the tenant
        const activeResources = await db.Resource.findAll({
            where: {
                tenantId,
                resourceTypeId,
                is_active: true
            },
            order: [['name_en', 'ASC'], ['createdAt', 'ASC']],
            transaction
        });

        if (activeResources.length === 0) {
            const messageEn = `Service requires "${typeNameEn}", but no active instances are configured in the system. Please configure resources or contact the administrator.`;
            const messageAr = `الخدمة تتطلب "${typeNameAr}"، ولكن لا توجد موارد نشطة مهيأة في النظام. يرجى تهيئة الموارد أو التواصل مع المسؤول.`;
            const actionableGuidanceEn = 'Please configure resources in settings or choose another service.';
            const actionableGuidanceAr = 'يرجى تهيئة الموارد في الإعدادات أو اختيار خدمة أخرى.';

            return {
                available: false,
                reason: 'RESOURCE_TYPE_UNCONFIGURED',
                resourceTypeId,
                resourceTypeName: typeNameEn,
                resourceTypeNameAr: typeNameAr,
                requiredQuantity: quantity,
                availableQuantity: 0,
                totalActive: 0,
                availableAgainAt: null,
                message: messageEn,
                messageAr,
                actionableGuidance: actionableGuidanceEn,
                actionableGuidanceAr,
                conflictDetails: {
                    type: 'RESOURCE_UNCONFIGURED',
                    entityType: 'resource',
                    entityId: resourceTypeId,
                    entityName: typeNameEn,
                    entityNameAr: typeNameAr,
                    requiredQuantity: quantity,
                    availableQuantity: 0,
                    availableAgainAt: null
                }
            };
        }

        if (activeResources.length < quantity) {
            const messageEn = `Salon has ${activeResources.length} active instance(s) of "${typeNameEn}", but ${quantity} are required.`;
            const messageAr = `يتوفر في المركز ${activeResources.length} فقط من "${typeNameAr}"، بينما تتطلب الخدمة ${quantity}.`;
            const actionableGuidanceEn = 'Please adjust the service resource requirement or add more physical resources.';
            const actionableGuidanceAr = 'يرجى تعديل متطلبات الخدمة أو إضافة موارد فعلية إضافية.';

            return {
                available: false,
                reason: 'INSUFFICIENT_TOTAL_CAPACITY',
                resourceTypeId,
                resourceTypeName: typeNameEn,
                resourceTypeNameAr: typeNameAr,
                requiredQuantity: quantity,
                availableQuantity: activeResources.length,
                totalActive: activeResources.length,
                availableAgainAt: null,
                message: messageEn,
                messageAr,
                actionableGuidance: actionableGuidanceEn,
                actionableGuidanceAr,
                conflictDetails: {
                    type: 'INSUFFICIENT_TOTAL_CAPACITY',
                    entityType: 'resource',
                    entityId: resourceTypeId,
                    entityName: typeNameEn,
                    entityNameAr: typeNameAr,
                    requiredQuantity: quantity,
                    availableQuantity: activeResources.length,
                    totalActive: activeResources.length,
                    availableAgainAt: null
                }
            };
        }

        const activeResourceIds = activeResources.map(r => r.id);

        // 2. Find which of these resources are currently booked in overlapping active appointments
        const appointmentWhere = {
            status: { [Op.notIn]: ['cancelled', 'no_show'] },
            startTime: { [Op.lt]: end },
            endTime: { [Op.gt]: start }
        };

        if (excludeAppointmentId) {
            appointmentWhere.id = { [Op.ne]: excludeAppointmentId };
        }

        const occupiedAllocations = await db.AppointmentResource.findAll({
            where: {
                resourceId: { [Op.in]: activeResourceIds }
            },
            include: [
                {
                    model: db.Appointment,
                    as: 'appointment',
                    where: appointmentWhere,
                    required: true
                }
            ],
            transaction
        });

        const occupiedResourceIds = new Set(occupiedAllocations.map(a => String(a.resourceId)));
        const freeResources = activeResources.filter(r => !occupiedResourceIds.has(String(r.id)));

        if (freeResources.length < quantity) {
            const availableAgainAt = await calculateEarliestFeasibleResourceTime({
                tenantId,
                requirements,
                requestedStartTime: start,
                durationMs,
                excludeAppointmentId,
                transaction
            });

            const occupiedResources = activeResources.filter(r => occupiedResourceIds.has(String(r.id)));
            const occupiedNamesEn = occupiedResources.map(r => r.name_en || r.name || typeNameEn);
            const occupiedNamesAr = occupiedResources.map(r => r.name_ar || r.name || typeNameAr);
            const isPoolExhausted = activeResources.length > 1 && freeResources.length === 0;

            let earliestOccStart = null;
            let latestOccEnd = null;
            for (const alloc of occupiedAllocations) {
                const a = alloc.appointment;
                if (a) {
                    const aStart = new Date(a.startTime);
                    const aEnd = new Date(a.endTime);
                    if (!earliestOccStart || aStart < earliestOccStart) earliestOccStart = aStart;
                    if (!latestOccEnd || aEnd > latestOccEnd) latestOccEnd = aEnd;
                }
            }

            const intervalStart = earliestOccStart || start;
            const intervalEnd = latestOccEnd || end;
            const timeRangeEn = formatTimeRangeEn(intervalStart, intervalEnd);
            const timeRangeAr = formatTimeRangeAr(intervalStart, intervalEnd);

            const availableTimeStrEn = availableAgainAt ? formatClockEn(availableAgainAt) : null;
            const availableTimeStrAr = availableAgainAt ? formatClockAr(availableAgainAt) : null;

            let messageEn = '';
            let messageAr = '';

            if (isPoolExhausted) {
                // Rule 5: Resource pool exhausted
                messageEn = `All ${activeResources.length} ${typeNameEn}s are currently occupied from ${timeRangeEn}.${availableTimeStrEn ? ` A resource will be available again at ${availableTimeStrEn}.` : ''} Please choose another time.`;
                messageAr = `جميع ${typeNameAr} (${activeResources.length}) مشغولة حالياً من ${timeRangeAr}.${availableTimeStrAr ? ` ستكون متاحة مرة أخرى في ${availableTimeStrAr}.` : ''} يرجى اختيار وقت آخر.`;
            } else {
                // Rule 3: Single or specific resource conflict
                const primaryResourceNameEn = occupiedNamesEn[0] || typeNameEn;
                const primaryResourceNameAr = occupiedNamesAr[0] || typeNameAr;
                messageEn = `${primaryResourceNameEn} is currently occupied by another appointment from ${timeRangeEn}.${availableTimeStrEn ? ` The resource will be available again at ${availableTimeStrEn}.` : ''} Please choose another time.`;
                messageAr = `${primaryResourceNameAr} مشغولة حالياً بموعد آخر من ${timeRangeAr}.${availableTimeStrAr ? ` ستكون متاحة مرة أخرى في ${availableTimeStrAr}.` : ''} يرجى اختيار وقت آخر.`;
            }

            const actionableGuidanceEn = availableTimeStrEn ? `Please choose a time at or after ${availableTimeStrEn}.` : 'Please choose a different time.';
            const actionableGuidanceAr = availableTimeStrAr ? `يرجى اختيار وقت في أو بعد ${availableTimeStrAr}.` : 'يرجى اختيار وقت مختلف.';

            return {
                available: false,
                reason: isPoolExhausted ? 'RESOURCE_POOL_EXHAUSTED' : 'RESOURCE_OCCUPIED',
                resourceTypeId,
                resourceTypeName: typeNameEn,
                resourceTypeNameAr: typeNameAr,
                requiredQuantity: quantity,
                availableQuantity: freeResources.length,
                totalActive: activeResources.length,
                conflictingResourceNames: occupiedNamesEn,
                conflictingResourceNamesAr: occupiedNamesAr,
                occupiedInterval: {
                    startTime: intervalStart.toISOString(),
                    endTime: intervalEnd.toISOString()
                },
                availableAgainAt: availableAgainAt ? availableAgainAt.toISOString() : null,
                message: messageEn,
                messageAr,
                actionableGuidance: actionableGuidanceEn,
                actionableGuidanceAr,
                conflictDetails: {
                    type: isPoolExhausted ? 'RESOURCE_POOL_EXHAUSTED' : 'RESOURCE_OCCUPIED',
                    entityType: 'resource',
                    entityId: resourceTypeId,
                    entityName: isPoolExhausted ? typeNameEn : (occupiedNamesEn[0] || typeNameEn),
                    entityNameAr: isPoolExhausted ? typeNameAr : (occupiedNamesAr[0] || typeNameAr),
                    conflictingResourceNames: occupiedNamesEn,
                    conflictingResourceNamesAr: occupiedNamesAr,
                    startTime: intervalStart.toISOString(),
                    endTime: intervalEnd.toISOString(),
                    availableAgainAt: availableAgainAt ? availableAgainAt.toISOString() : null,
                    requiredQuantity: quantity,
                    availableQuantity: freeResources.length,
                    totalActive: activeResources.length
                }
            };
        }

        freeResourcesByType.set(resourceTypeId, freeResources);
    }

    return {
        available: true,
        freeResourcesByType
    };
}

/**
 * Atomically allocate concrete physical resource instances for a service booking.
 * 
 * @param {object} params
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.serviceId - Service UUID
 * @param {string|null} params.variantId - Optional variant UUID
 * @param {Date} params.startTime - Appointment start time
 * @param {Date} params.endTime - Appointment end time
 * @param {string|null} params.excludeAppointmentId - Optional appointment to exclude
 * @param {Array<string>} params.alreadyAllocatedResourceIds - IDs already assigned in this batch (e.g. parallel bundle)
 * @param {object|null} params.transaction - Sequelize transaction
 * @param {boolean} params.lockRows - Whether to lock resource rows with SELECT FOR UPDATE
 * @returns {Promise<{ required: boolean, allocations: Array<{ resourceId: string, resource: object, resourceTypeId: string }> }>}
 */
async function allocateServiceResources({
    tenantId,
    serviceId,
    variantId = null,
    startTime,
    endTime,
    excludeAppointmentId = null,
    alreadyAllocatedResourceIds = [],
    transaction = null,
    lockRows = true
}) {
    const requirements = await resolveServiceResourceRequirements(serviceId, variantId, tenantId, transaction);
    if (!requirements || requirements.length === 0) {
        return { required: false, allocations: [] };
    }

    const start = startTime instanceof Date ? startTime : new Date(startTime);
    const end = endTime instanceof Date ? endTime : new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const allocated = [];
    const reservedResourceIds = new Set();
    for (const item of (alreadyAllocatedResourceIds || [])) {
        if (typeof item === 'object' && item !== null) {
            const allocStartMs = item.startMs ?? (item.startTime ? new Date(item.startTime).getTime() : null);
            const allocEndMs = item.endMs ?? (item.endTime ? new Date(item.endTime).getTime() : null);
            if (allocStartMs !== null && allocEndMs !== null) {
                // Strict interval overlap: allocStart < end && allocEnd > start
                if (allocStartMs < end.getTime() && allocEndMs > start.getTime()) {
                    reservedResourceIds.add(String(item.resourceId));
                }
            } else if (item.resourceId) {
                reservedResourceIds.add(String(item.resourceId));
            }
        } else if (item) {
            reservedResourceIds.add(String(item));
        }
    }

    for (const req of requirements) {
        const { resourceTypeId, quantity, resourceType } = req;
        const typeNameEn = resourceType?.name_en || resourceType?.name || 'Resource';
        const typeNameAr = resourceType?.name_ar || typeNameEn;

        const queryOptions = {
            where: {
                tenantId,
                resourceTypeId,
                is_active: true
            },
            order: [['name_en', 'ASC'], ['id', 'ASC']],
            transaction
        };

        if (lockRows && transaction && transaction.LOCK) {
            queryOptions.lock = transaction.LOCK.UPDATE;
        }

        const activeResources = await db.Resource.findAll(queryOptions);

        if (activeResources.length === 0) {
            const messageEn = `Service requires "${typeNameEn}", but no active instances are configured in the system.`;
            const messageAr = `الخدمة تتطلب "${typeNameAr}"، ولكن لا توجد موارد نشطة مهيأة في النظام.`;
            const err = new Error(messageEn);
            err.code = 'RESOURCE_TYPE_UNCONFIGURED';
            err.conflict = true;
            err.conflictDetails = {
                success: false,
                conflict: true,
                code: 'BOOKING_CONFLICT',
                message: messageEn,
                messageAr,
                actionableGuidance: 'Please configure resources in settings or choose another service.',
                actionableGuidanceAr: 'يرجى تهيئة الموارد في الإعدادات أو اختيار خدمة أخرى.',
                conflicts: [{
                    type: 'RESOURCE_UNCONFIGURED',
                    entityType: 'resource',
                    entityId: resourceTypeId,
                    entityName: typeNameEn,
                    entityNameAr: typeNameAr,
                    requiredQuantity: quantity,
                    availableQuantity: 0,
                    availableAgainAt: null
                }]
            };
            throw err;
        }

        if (activeResources.length < quantity) {
            const messageEn = `Salon has ${activeResources.length} active instance(s) of "${typeNameEn}", but ${quantity} are required.`;
            const messageAr = `يتوفر في المركز ${activeResources.length} فقط من "${typeNameAr}"، بينما تتطلب الخدمة ${quantity}.`;
            const err = new Error(messageEn);
            err.code = 'INSUFFICIENT_TOTAL_CAPACITY';
            err.conflict = true;
            err.conflictDetails = {
                success: false,
                conflict: true,
                code: 'BOOKING_CONFLICT',
                message: messageEn,
                messageAr,
                actionableGuidance: 'Please adjust the service resource requirement or add more physical resources.',
                actionableGuidanceAr: 'يرجى تعديل متطلبات الخدمة أو إضافة موارد فعلية إضافية.',
                conflicts: [{
                    type: 'INSUFFICIENT_TOTAL_CAPACITY',
                    entityType: 'resource',
                    entityId: resourceTypeId,
                    entityName: typeNameEn,
                    entityNameAr: typeNameAr,
                    requiredQuantity: quantity,
                    availableQuantity: activeResources.length,
                    totalActive: activeResources.length,
                    availableAgainAt: null
                }]
            };
            throw err;
        }

        const activeResourceIds = activeResources.map(r => r.id);

        const appointmentWhere = {
            status: { [Op.notIn]: ['cancelled', 'no_show'] },
            startTime: { [Op.lt]: end },
            endTime: { [Op.gt]: start }
        };

        if (excludeAppointmentId) {
            appointmentWhere.id = { [Op.ne]: excludeAppointmentId };
        }

        const occupiedAllocations = await db.AppointmentResource.findAll({
            where: {
                resourceId: { [Op.in]: activeResourceIds }
            },
            include: [
                {
                    model: db.Appointment,
                    as: 'appointment',
                    where: appointmentWhere,
                    required: true
                }
            ],
            transaction
        });

        const occupiedResourceIds = new Set(occupiedAllocations.map(a => String(a.resourceId)));

        const available = activeResources.filter(r =>
            !occupiedResourceIds.has(String(r.id)) && !reservedResourceIds.has(String(r.id))
        );

        if (available.length < quantity) {
            const availableAgainAt = await calculateEarliestFeasibleResourceTime({
                tenantId,
                requirements,
                requestedStartTime: start,
                durationMs,
                excludeAppointmentId,
                transaction
            });

            const occupiedResources = activeResources.filter(r => occupiedResourceIds.has(String(r.id)));
            const occupiedNamesEn = occupiedResources.map(r => r.name_en || r.name || typeNameEn);
            const occupiedNamesAr = occupiedResources.map(r => r.name_ar || r.name || typeNameAr);
            const isPoolExhausted = activeResources.length > 1 && available.length === 0;

            let earliestOccStart = null;
            let latestOccEnd = null;
            for (const alloc of occupiedAllocations) {
                const a = alloc.appointment;
                if (a) {
                    const aStart = new Date(a.startTime);
                    const aEnd = new Date(a.endTime);
                    if (!earliestOccStart || aStart < earliestOccStart) earliestOccStart = aStart;
                    if (!latestOccEnd || aEnd > latestOccEnd) latestOccEnd = aEnd;
                }
            }

            const intervalStart = earliestOccStart || start;
            const intervalEnd = latestOccEnd || end;
            const timeRangeEn = formatTimeRangeEn(intervalStart, intervalEnd);
            const timeRangeAr = formatTimeRangeAr(intervalStart, intervalEnd);
            const availableTimeStrEn = availableAgainAt ? formatClockEn(availableAgainAt) : null;
            const availableTimeStrAr = availableAgainAt ? formatClockAr(availableAgainAt) : null;

            let messageEn = '';
            let messageAr = '';

            if (isPoolExhausted) {
                messageEn = `All ${activeResources.length} ${typeNameEn}s are currently occupied from ${timeRangeEn}.${availableTimeStrEn ? ` A resource will be available again at ${availableTimeStrEn}.` : ''} Please choose another time.`;
                messageAr = `جميع ${typeNameAr} (${activeResources.length}) مشغولة حالياً من ${timeRangeAr}.${availableTimeStrAr ? ` ستكون متاحة مرة أخرى في ${availableTimeStrAr}.` : ''} يرجى اختيار وقت آخر.`;
            } else {
                const primaryResourceNameEn = occupiedNamesEn[0] || typeNameEn;
                const primaryResourceNameAr = occupiedNamesAr[0] || typeNameAr;
                messageEn = `${primaryResourceNameEn} is currently occupied by another appointment from ${timeRangeEn}.${availableTimeStrEn ? ` The resource will be available again at ${availableTimeStrEn}.` : ''} Please choose another time.`;
                messageAr = `${primaryResourceNameAr} مشغولة حالياً بموعد آخر من ${timeRangeAr}.${availableTimeStrAr ? ` ستكون متاحة مرة أخرى في ${availableTimeStrAr}.` : ''} يرجى اختيار وقت آخر.`;
            }

            const guidanceEn = availableTimeStrEn ? `Please choose a time at or after ${availableTimeStrEn}.` : 'Please choose a different time.';
            const guidanceAr = availableTimeStrAr ? `يرجى اختيار وقت في أو بعد ${availableTimeStrAr}.` : 'يرجى اختيار وقت مختلف.';

            const err = new Error(messageEn);
            err.code = isPoolExhausted ? 'RESOURCE_POOL_EXHAUSTED' : 'RESOURCE_OCCUPIED';
            err.conflict = true;
            err.conflictDetails = {
                success: false,
                conflict: true,
                code: 'BOOKING_CONFLICT',
                message: messageEn,
                messageAr,
                actionableGuidance: guidanceEn,
                actionableGuidanceAr: guidanceAr,
                conflicts: [{
                    type: isPoolExhausted ? 'RESOURCE_POOL_EXHAUSTED' : 'RESOURCE_OCCUPIED',
                    entityType: 'resource',
                    entityId: resourceTypeId,
                    entityName: isPoolExhausted ? typeNameEn : (occupiedNamesEn[0] || typeNameEn),
                    entityNameAr: isPoolExhausted ? typeNameAr : (occupiedNamesAr[0] || typeNameAr),
                    conflictingResourceNames: occupiedNamesEn,
                    conflictingResourceNamesAr: occupiedNamesAr,
                    startTime: intervalStart.toISOString(),
                    endTime: intervalEnd.toISOString(),
                    availableAgainAt: availableAgainAt ? availableAgainAt.toISOString() : null,
                    requiredQuantity: quantity,
                    availableQuantity: available.length,
                    totalActive: activeResources.length
                }]
            };
            throw err;
        }

        const chosen = available.slice(0, quantity);
        for (const res of chosen) {
            reservedResourceIds.add(String(res.id));
            allocated.push({
                resourceId: res.id,
                resourceTypeId: res.resourceTypeId,
                resource: res,
                startMs: start.getTime(),
                endMs: end.getTime()
            });
        }
    }

    return {
        required: true,
        allocations: allocated
    };
}

/**
 * Authoritatively check resource availability for a batch of items (staged items or catalogue queries).
 * Simulates concurrent resource assignment across staged items so subsequent items accurately
 * reflect remaining resource capacity without conflict.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {Array<object>} [params.stagedItems]
 * @param {Array<object>} [params.catalogueItems]
 * @param {Array<object>} [params.items]
 * @param {string|null} [params.excludeAppointmentId]
 * @param {object|null} [params.transaction]
 * @returns {Promise<{ results: Record<string, object> }>} 
 */
async function batchCheckResourceAvailability({
    tenantId,
    stagedItems = [],
    catalogueItems = [],
    items = [],
    excludeAppointmentId = null,
    transaction = null
}) {
    if (!tenantId) {
        throw new Error('tenantId is required for batch resource check');
    }

    const stagedList = [...(stagedItems || [])];
    const probeList = [...(catalogueItems || [])];

    if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
            if (item.isProbe || item.type === 'catalogue') {
                probeList.push(item);
            } else {
                stagedList.push(item);
            }
        }
    }

    const allActiveResources = await db.Resource.findAll({
        where: {
            tenantId,
            is_active: true
        },
        include: [
            {
                model: db.ResourceType,
                as: 'resourceType',
                attributes: ['id', 'name_en', 'name_ar', 'is_active']
            }
        ],
        order: [['name_en', 'ASC'], ['id', 'ASC']],
        transaction
    });

    const resourcesByType = new Map();
    for (const r of allActiveResources) {
        const typeId = String(r.resourceTypeId);
        if (!resourcesByType.has(typeId)) {
            resourcesByType.set(typeId, []);
        }
        resourcesByType.get(typeId).push(r);
    }

    // PASS 1: Pre-simulate staged allocations sequentially across stagedList
    const simulatedAllocations = []; // Array<{ itemId: string, resourceId: string, startMs: number, endMs: number, resourceTypeId: string }>

    for (let idx = 0; idx < stagedList.length; idx++) {
        const item = stagedList[idx];
        if (!item.id) {
            item.id = `stg_item_${idx}_${Math.random().toString(36).slice(2, 7)}`;
        }
        const itemId = item.id;
        const serviceId = item.serviceId;
        const variantId = item.variantId || null;
        if (!serviceId) continue;

        const start = item.startTime instanceof Date ? item.startTime : new Date(item.startTime);
        const durationMinutes = Math.max(1, parseInt(item.duration, 10) || 30);
        const end = item.endTime
            ? (item.endTime instanceof Date ? item.endTime : new Date(item.endTime))
            : new Date(start.getTime() + durationMinutes * 60000);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

        const startMs = start.getTime();
        const endMs = end.getTime();

        const requirements = await resolveServiceResourceRequirements(serviceId, variantId, tenantId, transaction);
        if (!requirements || requirements.length === 0) continue;

        let canAllocateAll = true;
        const thisItemAllocations = [];

        for (const req of requirements) {
            const { resourceTypeId, quantity } = req;
            const activeResources = resourcesByType.get(String(resourceTypeId)) || [];
            if (activeResources.length < quantity) {
                canAllocateAll = false;
                break;
            }

            const activeResourceIds = activeResources.map(r => r.id);
            const appointmentWhere = {
                status: { [db.Sequelize.Op.notIn]: ['cancelled', 'no_show'] },
                startTime: { [db.Sequelize.Op.lt]: end },
                endTime: { [db.Sequelize.Op.gt]: start }
            };
            if (excludeAppointmentId) {
                appointmentWhere.id = { [db.Sequelize.Op.ne]: excludeAppointmentId };
            }

            const dbOccupied = await db.AppointmentResource.findAll({
                where: {
                    resourceId: { [db.Sequelize.Op.in]: activeResourceIds }
                },
                include: [
                    {
                        model: db.Appointment,
                        as: 'appointment',
                        where: appointmentWhere,
                        required: true
                    }
                ],
                transaction
            });
            const dbOccupiedSet = new Set(dbOccupied.map(o => String(o.resourceId)));

            // Check draft allocations committed by prior staged items
            const draftOccupiedSet = new Set();
            for (const sim of simulatedAllocations) {
                if (sim.startMs < endMs && sim.endMs > startMs) {
                    draftOccupiedSet.add(String(sim.resourceId));
                }
            }

            const freeResources = activeResources.filter(r =>
                !dbOccupiedSet.has(String(r.id)) && !draftOccupiedSet.has(String(r.id))
            );

            if (freeResources.length < quantity) {
                canAllocateAll = false;
                break;
            }

            for (let q = 0; q < quantity; q++) {
                thisItemAllocations.push({
                    itemId,
                    resourceId: String(freeResources[q].id),
                    startMs,
                    endMs,
                    resourceTypeId: String(resourceTypeId)
                });
            }
        }

        if (canAllocateAll) {
            simulatedAllocations.push(...thisItemAllocations);
        }
    }

    // PASS 2: Evaluate availability for each item
    // - For staged item: exclude its OWN simulated allocation (sim.itemId !== itemId)
    // - For probe/catalogue item: include ALL simulated allocations
    const results = {};

    async function evaluateItem(item, isStagedItem) {
        const itemId = item.id || `item_${Math.random().toString(36).slice(2, 9)}`;
        const serviceId = item.serviceId;
        const variantId = item.variantId || null;

        if (!serviceId) {
            results[itemId] = {
                id: itemId,
                hasRequirements: false,
                isAvailable: true,
                requirements: []
            };
            return;
        }

        const start = item.startTime instanceof Date ? item.startTime : new Date(item.startTime);
        const durationMinutes = Math.max(1, parseInt(item.duration, 10) || 30);
        const end = item.endTime
            ? (item.endTime instanceof Date ? item.endTime : new Date(item.endTime))
            : new Date(start.getTime() + durationMinutes * 60000);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            results[itemId] = {
                id: itemId,
                hasRequirements: false,
                isAvailable: false,
                reason: 'INVALID_TIME',
                requirements: []
            };
            return;
        }

        const startMs = start.getTime();
        const endMs = end.getTime();
        const durationMs = endMs - startMs;

        const requirements = await resolveServiceResourceRequirements(serviceId, variantId, tenantId, transaction);

        if (!requirements || requirements.length === 0) {
            results[itemId] = {
                id: itemId,
                hasRequirements: false,
                isAvailable: true,
                requirements: []
            };
            return;
        }

        const reqResults = [];
        let itemIsAvailable = true;
        let primaryConflict = null;

        for (const req of requirements) {
            const { resourceTypeId, quantity, resourceType } = req;
            const typeNameEn = resourceType?.name_en || resourceType?.name || 'Resource';
            const typeNameAr = resourceType?.name_ar || typeNameEn;

            const activeResources = resourcesByType.get(String(resourceTypeId)) || [];
            const totalActive = activeResources.length;

            if (totalActive === 0) {
                itemIsAvailable = false;
                const reason = 'RESOURCE_TYPE_UNCONFIGURED';
                const messageEn = `Service requires "${typeNameEn}", but no active instances are configured in the system.`;
                const messageAr = `الخدمة تتطلب "${typeNameAr}"، ولكن لا توجد موارد نشطة مهيأة في النظام.`;
                const guidanceEn = 'Please configure resources in settings or choose another service.';
                const guidanceAr = 'يرجى تهيئة الموارد في الإعدادات أو اختيار خدمة أخرى.';

                const conf = {
                    resourceTypeId,
                    resourceTypeName: typeNameEn,
                    resourceTypeNameAr: typeNameAr,
                    quantity,
                    available: false,
                    reason,
                    totalActive: 0,
                    availableQuantity: 0,
                    availableAgainAt: null,
                    messageEn,
                    messageAr,
                    actionableGuidanceEn: guidanceEn,
                    actionableGuidanceAr: guidanceAr
                };
                reqResults.push(conf);
                if (!primaryConflict) primaryConflict = conf;
                continue;
            }

            if (totalActive < quantity) {
                itemIsAvailable = false;
                const reason = 'INSUFFICIENT_TOTAL_CAPACITY';
                const messageEn = `Salon has ${totalActive} active instance(s) of "${typeNameEn}", but ${quantity} are required.`;
                const messageAr = `يتوفر في المركز ${totalActive} فقط من "${typeNameAr}"، بينما تتطلب الخدمة ${quantity}.`;
                const guidanceEn = 'Please adjust the service resource requirement or add more physical resources.';
                const guidanceAr = 'يرجى تعديل متطلبات الخدمة أو إضافة موارد فعلية إضافية.';

                const conf = {
                    resourceTypeId,
                    resourceTypeName: typeNameEn,
                    resourceTypeNameAr: typeNameAr,
                    quantity,
                    available: false,
                    reason,
                    totalActive,
                    availableQuantity: totalActive,
                    availableAgainAt: null,
                    messageEn,
                    messageAr,
                    actionableGuidanceEn: guidanceEn,
                    actionableGuidanceAr: guidanceAr
                };
                reqResults.push(conf);
                if (!primaryConflict) primaryConflict = conf;
                continue;
            }

            const activeResourceIds = activeResources.map(r => r.id);
            const appointmentWhere = {
                status: { [db.Sequelize.Op.notIn]: ['cancelled', 'no_show'] },
                startTime: { [db.Sequelize.Op.lt]: end },
                endTime: { [db.Sequelize.Op.gt]: start }
            };
            if (excludeAppointmentId) {
                appointmentWhere.id = { [db.Sequelize.Op.ne]: excludeAppointmentId };
            }

            const dbOccupied = await db.AppointmentResource.findAll({
                where: {
                    resourceId: { [db.Sequelize.Op.in]: activeResourceIds }
                },
                include: [
                    {
                        model: db.Appointment,
                        as: 'appointment',
                        where: appointmentWhere,
                        required: true
                    }
                ],
                transaction
            });

            const dbOccupiedSet = new Set(dbOccupied.map(o => String(o.resourceId)));

            // Draft allocations:
            // - If evaluating a staged item, exclude its own simulated allocation (self-conflict exclusion)
            // - Include all other staged allocations whose interval strictly overlaps: allocStart < end && allocEnd > start
            const draftOccupiedSet = new Set();
            for (const sim of simulatedAllocations) {
                if (isStagedItem && sim.itemId === itemId) {
                    continue; // Exclude own staged allocation!
                }
                if (sim.startMs < endMs && sim.endMs > startMs) {
                    draftOccupiedSet.add(String(sim.resourceId));
                }
            }

            const freeResources = activeResources.filter(r =>
                !dbOccupiedSet.has(String(r.id)) && !draftOccupiedSet.has(String(r.id))
            );

            if (freeResources.length < quantity) {
                itemIsAvailable = false;
                const reason = 'RESOURCE_OCCUPIED';

                const availableAgainAt = await calculateEarliestFeasibleResourceTime({
                    tenantId,
                    requirements: [req],
                    requestedStartTime: start,
                    durationMs,
                    excludeAppointmentId,
                    transaction
                });

                const timeRangeEn = formatTimeRangeEn(start, end);
                const timeRangeAr = formatTimeRangeAr(start, end);
                const availableTimeStrEn = availableAgainAt ? formatClockEn(availableAgainAt) : null;
                const availableTimeStrAr = availableAgainAt ? formatClockAr(availableAgainAt) : null;

                const isPoolExhausted = totalActive > 1 && freeResources.length === 0;
                let messageEn = '';
                let messageAr = '';

                if (isPoolExhausted) {
                    messageEn = `All ${totalActive} ${typeNameEn}s are currently occupied from ${timeRangeEn}.${availableTimeStrEn ? ` A resource will be available again at ${availableTimeStrEn}.` : ''} Please choose another time.`;
                    messageAr = `جميع ${typeNameAr} (${totalActive}) مشغولة حالياً من ${timeRangeAr}.${availableTimeStrAr ? ` ستكون متاحة مرة أخرى في ${availableTimeStrAr}.` : ''} يرجى اختيار وقت آخر.`;
                } else {
                    const occupiedResource = activeResources.find(r => dbOccupiedSet.has(String(r.id)) || draftOccupiedSet.has(String(r.id)));
                    const resNameEn = occupiedResource?.name_en || typeNameEn;
                    const resNameAr = occupiedResource?.name_ar || typeNameAr;
                    messageEn = `${resNameEn} is currently occupied from ${timeRangeEn}.${availableTimeStrEn ? ` The resource will be available again at ${availableTimeStrEn}.` : ''} Please choose another time.`;
                    messageAr = `${resNameAr} مشغولة حالياً من ${timeRangeAr}.${availableTimeStrAr ? ` ستكون متاحة مرة أخرى في ${availableTimeStrAr}.` : ''} يرجى اختيار وقت آخر.`;
                }

                const guidanceEn = availableTimeStrEn ? `Please choose a time at or after ${availableTimeStrEn}.` : 'Please choose a different time.';
                const guidanceAr = availableTimeStrAr ? `يرجى اختيار وقت في أو بعد ${availableTimeStrAr}.` : 'يرجى اختيار وقت مختلف.';

                const conf = {
                    resourceTypeId,
                    resourceTypeName: typeNameEn,
                    resourceTypeNameAr: typeNameAr,
                    quantity,
                    available: false,
                    reason,
                    totalActive,
                    availableQuantity: freeResources.length,
                    availableAgainAt,
                    messageEn,
                    messageAr,
                    actionableGuidanceEn: guidanceEn,
                    actionableGuidanceAr: guidanceAr
                };
                reqResults.push(conf);
                if (!primaryConflict) primaryConflict = conf;
            } else {
                reqResults.push({
                    resourceTypeId,
                    resourceTypeName: typeNameEn,
                    resourceTypeNameAr: typeNameAr,
                    quantity,
                    available: true,
                    totalActive,
                    availableQuantity: freeResources.length
                });
            }
        }

        results[itemId] = {
            id: itemId,
            hasRequirements: true,
            isAvailable: itemIsAvailable,
            requirements: reqResults,
            primaryConflict
        };
    }

    for (const stagedItem of stagedList) {
        await evaluateItem(stagedItem, true);
    }

    for (const probeItem of probeList) {
        await evaluateItem(probeItem, false);
    }

    return { results };
}

module.exports = {
    resolveServiceResourceRequirements,
    calculateEarliestFeasibleResourceTime,
    checkResourceAvailability,
    batchCheckResourceAvailability,
    allocateServiceResources,
    formatTimeRangeEn,
    formatTimeRangeAr,
    formatClockEn,
    formatClockAr
};
