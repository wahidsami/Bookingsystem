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
async function checkResourceAvailability(tenantId, requirements, startTime, endTime, excludeAppointmentId = null, transaction = null) {
    if (!requirements || requirements.length === 0) {
        return { available: true, freeResourcesByType: new Map() };
    }

    const freeResourcesByType = new Map();

    for (const req of requirements) {
        const { resourceTypeId, quantity, resourceType } = req;
        const typeName = resourceType?.name_en || resourceType?.name_ar || resourceTypeId;

        // 1. Find all active resource instances of this type for the tenant
        const activeResources = await db.Resource.findAll({
            where: {
                tenantId,
                resourceTypeId,
                is_active: true
            },
            order: [['createdAt', 'ASC']],
            transaction
        });

        if (activeResources.length < quantity) {
            return {
                available: false,
                reason: 'INSUFFICIENT_TOTAL_CAPACITY',
                message: `Salon has ${activeResources.length} active instance(s) of "${typeName}", but ${quantity} are required.`
            };
        }

        const activeResourceIds = activeResources.map(r => r.id);

        // 2. Find which of these resources are currently booked in overlapping active appointments
        const appointmentWhere = {
            status: { [Op.notIn]: ['cancelled', 'no_show'] },
            startTime: { [Op.lt]: endTime },
            endTime: { [Op.gt]: startTime }
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

        const occupiedResourceIds = new Set(occupiedAllocations.map(a => a.resourceId));
        const freeResources = activeResources.filter(r => !occupiedResourceIds.has(r.id));

        if (freeResources.length < quantity) {
            return {
                available: false,
                reason: 'RESOURCE_OCCUPIED',
                message: `All available instances of "${typeName}" are occupied at this time.`,
                occupiedCount: occupiedResourceIds.size,
                totalActive: activeResources.length
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
    const allocated = [];
    const reservedResourceIds = new Set((alreadyAllocatedResourceIds || []).map(String));

    for (const req of requirements) {
        const { resourceTypeId, quantity, resourceType } = req;
        const typeName = resourceType?.name_en || resourceType?.name_ar || 'Resource';

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

        if (activeResources.length < quantity) {
            const err = new Error(`Salon has ${activeResources.length} active instance(s) of "${typeName}", but ${quantity} are required.`);
            err.code = 'INSUFFICIENT_TOTAL_CAPACITY';
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
            const err = new Error(`Required resource "${typeName}" is unavailable at the selected time.`);
            err.code = 'RESOURCE_OCCUPIED';
            throw err;
        }

        const chosen = available.slice(0, quantity);
        for (const res of chosen) {
            reservedResourceIds.add(String(res.id));
            allocated.push({
                resourceId: res.id,
                resourceTypeId: res.resourceTypeId,
                resource: res
            });
        }
    }

    return {
        required: true,
        allocations: allocated
    };
}

module.exports = {
    resolveServiceResourceRequirements,
    checkResourceAvailability,
    allocateServiceResources
};

