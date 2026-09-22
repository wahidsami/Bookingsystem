'use strict';

/**
 * Focused unit tests for conflict classification in the booking engine.
 *
 * These tests mock the database layer entirely so they run without
 * Redis or PostgreSQL. They verify the shape, content, and correctness
 * of every conflict type produced by evaluateSchedulingRequest and
 * the resource availability functions.
 */

// ──── Mocks ────────────────────────────────────────────────────────
jest.mock('../../models', () => ({
    Staff: { findByPk: jest.fn() },
    Service: { findByPk: jest.fn() },
    Appointment: { findOne: jest.fn(), findAll: jest.fn() },
    TenantSettings: { findOne: jest.fn() },
    ServiceResourceRequirement: { findAll: jest.fn() },
    ResourceType: {},
    Resource: { findAll: jest.fn() },
    AppointmentResource: { findAll: jest.fn() },
    sequelize: { transaction: jest.fn() }
}));

jest.mock('../availabilityService', () => ({
    _buildAvailabilityContext: jest.fn(),
    _combineDateAndTime: jest.fn((dateKey, time) => {
        const [year, month, day] = dateKey.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
    })
}));

jest.mock('../redisService', () => ({
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
    getRedisClient: jest.fn().mockReturnValue(null),
    isRedisHealthy: jest.fn().mockResolvedValue(false)
}));

jest.mock('../notificationOrchestratorService', () => ({
    notifyCustomer: jest.fn().mockResolvedValue({ success: true }),
    notifyTenant: jest.fn().mockResolvedValue({ success: true }),
    notifyStaff: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../customerInvoiceEmailService', () => ({
    sendCustomerInvoiceLifecycleEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock' })
}));

// ──── Imports ──────────────────────────────────────────────────────
const db = require('../../models');
const availabilityService = require('../availabilityService');
const bookingService = require('../bookingService');
const {
    checkResourceAvailability,
    calculateEarliestFeasibleResourceTime
} = require('../../utils/resourceRequirementResolver');

// ──── Helpers ──────────────────────────────────────────────────────
const T = (hour, minute = 0) => new Date(Date.UTC(2026, 8, 22, hour - 3, minute)); // Asia/Riyadh = UTC+3

const TENANT_ID = 'tenant-test-1';

const STAFF_FATIMA = {
    id: 'staff-fatima',
    tenantId: TENANT_ID,
    name: 'Fatima Ali',
    name_ar: 'فاطمة علي'
};

const STAFF_SARAH = {
    id: 'staff-sarah',
    tenantId: TENANT_ID,
    name: 'Sarah Smith',
    name_ar: 'سارة سميث'
};

const setAvailabilityContext = ({
    dutyStart = T(9, 0),
    dutyEnd = T(22, 0),
    breaks = [],
    timeOff = []
} = {}) => {
    availabilityService._buildAvailabilityContext.mockResolvedValue({
        tenantHours: { start: '09:00', end: '22:00' },
        employeeDutyWindows: [{ startTime: dutyStart, endTime: dutyEnd }],
        rawWindows: [{ startTime: dutyStart, endTime: dutyEnd }],
        finalWindows: [{ startTime: dutyStart, endTime: dutyEnd }],
        breaks,
        timeOff
    });
};

const setupDefaultMocks = (staff = STAFF_FATIMA) => {
    jest.clearAllMocks();
    db.Staff.findByPk.mockResolvedValue(staff);
    db.Appointment.findOne.mockResolvedValue(null);
    db.TenantSettings.findOne.mockResolvedValue({ timezone: 'Asia/Riyadh' });
    // Default: no resource requirements
    db.ServiceResourceRequirement.findAll.mockResolvedValue([]);
    db.Resource.findAll.mockResolvedValue([]);
    db.AppointmentResource.findAll.mockResolvedValue([]);
    setAvailabilityContext();
};

// ──── TEST SUITE ───────────────────────────────────────────────────

describe('Conflict Classification Engine', () => {
    jest.setTimeout(30000);

    // ================================================================
    // A. STAFF_UNAVAILABLE
    // ================================================================
    describe('A. STAFF_UNAVAILABLE', () => {
        beforeEach(() => setupDefaultMocks(STAFF_FATIMA));

        test('reports employee name and conflicting start/end times', async () => {
            const conflictingAppt = {
                id: 'existing-appt-1',
                startTime: T(15, 0),
                endTime: T(16, 0),
                staffId: STAFF_FATIMA.id,
                status: 'confirmed'
            };
            db.Appointment.findOne.mockResolvedValue(conflictingAppt);

            const result = await bookingService.evaluateSchedulingRequest({
                tenantId: TENANT_ID,
                serviceId: 'service-1',
                staffId: STAFF_FATIMA.id,
                startTime: T(15, 0),
                duration: 60
            });

            expect(result.valid).toBe(false);
            expect(result.conflicts).toBeDefined();
            expect(result.conflicts.length).toBeGreaterThanOrEqual(1);

            const staffConflict = result.conflicts.find(c => c.type === 'STAFF_UNAVAILABLE');
            expect(staffConflict).toBeDefined();
            expect(staffConflict.entityName).toBe('Fatima Ali');
            expect(staffConflict.entityNameAr).toBe('فاطمة علي');
            expect(staffConflict.entityType).toBe('staff');
            expect(staffConflict.startTime).toBeDefined();
            expect(staffConflict.endTime).toBeDefined();

            // Message must name the employee
            expect(result.message).toMatch(/Fatima Ali/);
            expect(result.messageAr).toMatch(/فاطمة علي/);

            // Actionable guidance
            expect(result.actionableGuidance).toBeTruthy();
            expect(result.actionableGuidanceAr).toBeTruthy();

            // conflictDetails shape for API response
            expect(result.conflictDetails).toBeDefined();
            expect(result.conflictDetails.success).toBe(false);
            expect(result.conflictDetails.conflict).toBe(true);
            expect(result.conflictDetails.code).toBe('BOOKING_CONFLICT');
        });
    });

    // ================================================================
    // B. RESOURCE_OCCUPIED
    // ================================================================
    describe('B. RESOURCE_OCCUPIED (via checkResourceAvailability)', () => {
        beforeEach(() => setupDefaultMocks(STAFF_SARAH));

        test('returns resource name, conflicting interval, and availableAgainAt', async () => {
            const roomTypeId = 'rt-massage-room';
            const room1Id = 'res-room-1';

            // One massage room, occupied by another appointment
            db.Resource.findAll.mockResolvedValue([{
                id: room1Id,
                tenantId: TENANT_ID,
                resourceTypeId: roomTypeId,
                is_active: true,
                name_en: 'Massage Room 1',
                name_ar: 'غرفة المساج 1',
                name: 'Massage Room 1',
                createdAt: new Date()
            }]);

            // The room is occupied from 3:00 PM to 4:00 PM
            db.AppointmentResource.findAll.mockResolvedValue([{
                resourceId: room1Id,
                appointment: {
                    id: 'blocking-appt-1',
                    startTime: T(15, 0),
                    endTime: T(16, 0),
                    status: 'confirmed'
                }
            }]);

            const requirements = [{
                resourceTypeId: roomTypeId,
                quantity: 1,
                resourceType: {
                    name_en: 'Massage Room',
                    name_ar: 'غرفة المساج',
                    name: 'Massage Room'
                }
            }];

            const result = await checkResourceAvailability(
                TENANT_ID,
                requirements,
                T(15, 0),   // 3:00 PM
                T(16, 0),   // 4:00 PM
                null,
                null
            );

            expect(result.available).toBe(false);
            expect(result.reason).toBe('RESOURCE_OCCUPIED');
            expect(result.resourceTypeName).toBe('Massage Room');
            expect(result.message).toMatch(/Massage Room 1/);
            expect(result.message).toMatch(/occupied/i);
            expect(result.messageAr).toMatch(/غرفة المساج 1/);
            expect(result.messageAr).toMatch(/مشغولة/);

            // conflictDetails for API
            expect(result.conflictDetails).toBeDefined();
            expect(result.conflictDetails.type).toBe('RESOURCE_OCCUPIED');
            expect(result.conflictDetails.entityName).toBe('Massage Room 1');
            expect(result.conflictDetails.startTime).toBeDefined();
            expect(result.conflictDetails.endTime).toBeDefined();
        });
    });

    // ================================================================
    // C. DIFFERENT SELECTED STAFF + RESOURCE OCCUPIED
    // ================================================================
    describe('C. Different staff selected + resource occupied', () => {
        beforeEach(() => setupDefaultMocks(STAFF_SARAH));

        test('resource conflict reported, selected employee NOT blamed', async () => {
            // Sarah is the selected staff (no staff conflict)
            db.Appointment.findOne.mockResolvedValue(null); // Sarah has no conflicting appointment

            // Mock resource requirement for this service
            db.ServiceResourceRequirement.findAll.mockResolvedValue([{
                resourceTypeId: 'rt-massage-room',
                quantity: 1,
                variantId: null,
                resourceType: {
                    id: 'rt-massage-room',
                    name_en: 'Massage Room',
                    name_ar: 'غرفة المساج',
                    is_active: true,
                    tenantId: TENANT_ID
                }
            }]);

            // Only 1 massage room, occupied by Fatima's appointment
            db.Resource.findAll.mockResolvedValue([{
                id: 'res-room-1',
                tenantId: TENANT_ID,
                resourceTypeId: 'rt-massage-room',
                is_active: true,
                name_en: 'Massage Room 1',
                name_ar: 'غرفة المساج 1',
                name: 'Massage Room 1',
                createdAt: new Date()
            }]);

            db.AppointmentResource.findAll.mockResolvedValue([{
                resourceId: 'res-room-1',
                appointment: {
                    id: 'fatima-appt-1',
                    startTime: T(15, 0),
                    endTime: T(16, 0),
                    status: 'confirmed'
                }
            }]);

            const result = await bookingService.evaluateSchedulingRequest({
                tenantId: TENANT_ID,
                serviceId: 'service-massage',
                variantId: null,
                staffId: STAFF_SARAH.id,
                startTime: T(15, 0),
                duration: 60
            });

            expect(result.valid).toBe(false);
            expect(result.conflicts).toBeDefined();
            expect(result.conflicts.length).toBeGreaterThanOrEqual(1);

            // No STAFF_UNAVAILABLE conflict — Sarah is free
            const staffConflict = result.conflicts.find(c => c.type === 'STAFF_UNAVAILABLE');
            expect(staffConflict).toBeUndefined();

            // Resource conflict is present
            const resourceConflict = result.conflicts.find(c => c.entityType === 'resource');
            expect(resourceConflict).toBeDefined();
            expect(resourceConflict.entityName).toMatch(/Massage Room/);

            // Message must NOT mention Fatima (she's not the selected staff)
            expect(result.message).not.toMatch(/Fatima/i);
            // Message must mention the resource
            expect(result.message).toMatch(/Massage Room/i);
        });
    });

    // ================================================================
    // D. STAFF + RESOURCE BOTH CONFLICT
    // ================================================================
    describe('D. Both staff and resource conflict simultaneously', () => {
        beforeEach(() => setupDefaultMocks(STAFF_FATIMA));

        test('returns both conflicts, neither is discarded', async () => {
            // Fatima has a conflicting appointment
            db.Appointment.findOne.mockResolvedValue({
                id: 'fatima-appt-1',
                startTime: T(15, 0),
                endTime: T(16, 0),
                staffId: STAFF_FATIMA.id,
                status: 'confirmed'
            });

            // Resource requirement
            db.ServiceResourceRequirement.findAll.mockResolvedValue([{
                resourceTypeId: 'rt-massage-room',
                quantity: 1,
                variantId: null,
                resourceType: {
                    id: 'rt-massage-room',
                    name_en: 'Massage Room',
                    name_ar: 'غرفة المساج',
                    is_active: true,
                    tenantId: TENANT_ID
                }
            }]);

            // Room also occupied
            db.Resource.findAll.mockResolvedValue([{
                id: 'res-room-1',
                tenantId: TENANT_ID,
                resourceTypeId: 'rt-massage-room',
                is_active: true,
                name_en: 'Massage Room 1',
                name_ar: 'غرفة المساج 1',
                name: 'Massage Room 1',
                createdAt: new Date()
            }]);

            db.AppointmentResource.findAll.mockResolvedValue([{
                resourceId: 'res-room-1',
                appointment: {
                    id: 'other-appt-1',
                    startTime: T(15, 0),
                    endTime: T(16, 0),
                    status: 'confirmed'
                }
            }]);

            const result = await bookingService.evaluateSchedulingRequest({
                tenantId: TENANT_ID,
                serviceId: 'service-massage',
                variantId: null,
                staffId: STAFF_FATIMA.id,
                startTime: T(15, 0),
                duration: 60
            });

            expect(result.valid).toBe(false);
            expect(result.conflicts.length).toBeGreaterThanOrEqual(2);

            const staffConflict = result.conflicts.find(c => c.entityType === 'staff');
            const resourceConflict = result.conflicts.find(c => c.entityType === 'resource');

            expect(staffConflict).toBeDefined();
            expect(resourceConflict).toBeDefined();

            // Message must mention both
            expect(result.message).toMatch(/Fatima Ali/);
            expect(result.message).toMatch(/Massage Room/i);

            // Rule 4: combined message
            expect(result.conflictDetails.conflicts.length).toBeGreaterThanOrEqual(2);
        });
    });

    // ================================================================
    // E. RESOURCE_POOL_EXHAUSTED
    // ================================================================
    describe('E. RESOURCE_POOL_EXHAUSTED', () => {
        test('reports when all instances are occupied', async () => {
            const roomTypeId = 'rt-massage-room';

            db.Resource.findAll.mockResolvedValue([
                {
                    id: 'res-room-1', tenantId: TENANT_ID, resourceTypeId: roomTypeId,
                    is_active: true, name_en: 'Room A', name_ar: 'غرفة أ', name: 'Room A',
                    createdAt: new Date('2026-01-01')
                },
                {
                    id: 'res-room-2', tenantId: TENANT_ID, resourceTypeId: roomTypeId,
                    is_active: true, name_en: 'Room B', name_ar: 'غرفة ب', name: 'Room B',
                    createdAt: new Date('2026-01-02')
                }
            ]);

            // Both rooms occupied
            db.AppointmentResource.findAll.mockResolvedValue([
                {
                    resourceId: 'res-room-1',
                    appointment: {
                        id: 'appt-1', startTime: T(15, 0), endTime: T(16, 0), status: 'confirmed'
                    }
                },
                {
                    resourceId: 'res-room-2',
                    appointment: {
                        id: 'appt-2', startTime: T(15, 0), endTime: T(17, 0), status: 'confirmed'
                    }
                }
            ]);

            const requirements = [{
                resourceTypeId: roomTypeId,
                quantity: 1,
                resourceType: { name_en: 'Massage Room', name_ar: 'غرفة المساج', name: 'Massage Room' }
            }];

            const result = await checkResourceAvailability(
                TENANT_ID, requirements, T(15, 0), T(16, 0), null, null
            );

            expect(result.available).toBe(false);
            expect(result.reason).toBe('RESOURCE_POOL_EXHAUSTED');
            expect(result.message).toMatch(/All 2/);
            expect(result.messageAr).toMatch(/جميع/);
            expect(result.conflictDetails.type).toBe('RESOURCE_POOL_EXHAUSTED');
        });
    });

    // ================================================================
    // F. RESOURCE_UNCONFIGURED
    // ================================================================
    describe('F. RESOURCE_UNCONFIGURED', () => {
        test('returns configuration error when zero active resources exist', async () => {
            db.Resource.findAll.mockResolvedValue([]); // No resources at all

            const requirements = [{
                resourceTypeId: 'rt-massage-room',
                quantity: 1,
                resourceType: { name_en: 'Massage Room', name_ar: 'غرفة المساج', name: 'Massage Room' }
            }];

            const result = await checkResourceAvailability(
                TENANT_ID, requirements, T(15, 0), T(16, 0), null, null
            );

            expect(result.available).toBe(false);
            expect(result.reason).toBe('RESOURCE_TYPE_UNCONFIGURED');
            expect(result.message).toMatch(/no active instances/i);
            expect(result.message).toMatch(/Massage Room/);
            expect(result.messageAr).toMatch(/لا توجد موارد نشطة/);
            expect(result.conflictDetails.type).toBe('RESOURCE_UNCONFIGURED');
            expect(result.conflictDetails.availableAgainAt).toBeNull();
        });
    });

    // ================================================================
    // G. MULTIPLE RESOURCE QUANTITY
    // ================================================================
    describe('G. Multiple resource quantity — availableAgainAt calculation', () => {
        test('availableAgainAt is the time both rooms are free (latest of the two)', async () => {
            const roomTypeId = 'rt-massage-room';

            // 2 rooms exist, service requires 2
            db.Resource.findAll.mockResolvedValue([
                {
                    id: 'res-room-1', tenantId: TENANT_ID, resourceTypeId: roomTypeId,
                    is_active: true, name_en: 'Room 1', name_ar: 'غرفة 1',
                    createdAt: new Date('2026-01-01')
                },
                {
                    id: 'res-room-2', tenantId: TENANT_ID, resourceTypeId: roomTypeId,
                    is_active: true, name_en: 'Room 2', name_ar: 'غرفة 2',
                    createdAt: new Date('2026-01-02')
                }
            ]);

            // Room 1 free at 4:00 PM, Room 2 free at 5:00 PM
            db.AppointmentResource.findAll.mockResolvedValue([
                {
                    resourceId: 'res-room-1',
                    appointment: {
                        id: 'appt-1', startTime: T(14, 0), endTime: T(16, 0), status: 'confirmed'
                    }
                },
                {
                    resourceId: 'res-room-2',
                    appointment: {
                        id: 'appt-2', startTime: T(14, 0), endTime: T(17, 0), status: 'confirmed'
                    }
                }
            ]);

            const requirements = [{
                resourceTypeId: roomTypeId,
                quantity: 2,
                resourceType: { name_en: 'Massage Room', name_ar: 'غرفة المساج' }
            }];

            // calculateEarliestFeasibleResourceTime should return 5:00 PM
            const earliest = await calculateEarliestFeasibleResourceTime({
                tenantId: TENANT_ID,
                requirements,
                requestedStartTime: T(15, 0),
                durationMs: 60 * 60000,
                excludeAppointmentId: null,
                transaction: null
            });

            // Both rooms must be free simultaneously for 60 minutes
            // Room 1 free at 4:00 PM, Room 2 free at 5:00 PM
            // So the earliest is 5:00 PM
            expect(earliest).not.toBeNull();
            expect(earliest.getTime()).toBe(T(17, 0).getTime());
        });
    });

    // ================================================================
    // H. MULTIPLE RESOURCE TYPES
    // ================================================================
    describe('H. Multiple resource types — earliest feasible for BOTH', () => {
        test('availableAgainAt satisfies both Massage Room AND Treatment Bed', async () => {
            const roomTypeId = 'rt-massage-room';
            const bedTypeId = 'rt-treatment-bed';

            // Resource.findAll is called per-type; we use mockImplementation
            db.Resource.findAll.mockImplementation(({ where }) => {
                if (where.resourceTypeId === roomTypeId) {
                    return Promise.resolve([{
                        id: 'res-room-1', tenantId: TENANT_ID, resourceTypeId: roomTypeId,
                        is_active: true, name_en: 'Room 1', createdAt: new Date('2026-01-01')
                    }]);
                }
                if (where.resourceTypeId === bedTypeId) {
                    return Promise.resolve([{
                        id: 'res-bed-1', tenantId: TENANT_ID, resourceTypeId: bedTypeId,
                        is_active: true, name_en: 'Bed 1', createdAt: new Date('2026-01-01')
                    }]);
                }
                return Promise.resolve([]);
            });

            // Room free at 4:00 PM, Bed free at 5:30 PM
            db.AppointmentResource.findAll.mockResolvedValue([
                {
                    resourceId: 'res-room-1',
                    appointment: {
                        id: 'appt-1', startTime: T(14, 0), endTime: T(16, 0), status: 'confirmed'
                    }
                },
                {
                    resourceId: 'res-bed-1',
                    appointment: {
                        id: 'appt-2', startTime: T(14, 0), endTime: T(17, 30), status: 'confirmed'
                    }
                }
            ]);

            const requirements = [
                {
                    resourceTypeId: roomTypeId,
                    quantity: 1,
                    resourceType: { name_en: 'Massage Room', name_ar: 'غرفة المساج' }
                },
                {
                    resourceTypeId: bedTypeId,
                    quantity: 1,
                    resourceType: { name_en: 'Treatment Bed', name_ar: 'سرير العلاج' }
                }
            ];

            const earliest = await calculateEarliestFeasibleResourceTime({
                tenantId: TENANT_ID,
                requirements,
                requestedStartTime: T(15, 0),
                durationMs: 60 * 60000,
                excludeAppointmentId: null,
                transaction: null
            });

            // Room free at 4:00, Bed free at 5:30
            // Both must be free simultaneously → earliest feasible = 5:30 PM
            expect(earliest).not.toBeNull();
            expect(earliest.getTime()).toBe(T(17, 30).getTime());
        });
    });

    // ================================================================
    // HTTP STATUS / API SHAPE VERIFICATION
    // ================================================================
    describe('API response shape verification', () => {
        beforeEach(() => setupDefaultMocks(STAFF_FATIMA));

        test('conflictDetails has all required fields for 409 response', async () => {
            db.Appointment.findOne.mockResolvedValue({
                id: 'appt-1',
                startTime: T(15, 0),
                endTime: T(16, 0),
                staffId: STAFF_FATIMA.id,
                status: 'confirmed'
            });

            const result = await bookingService.evaluateSchedulingRequest({
                tenantId: TENANT_ID,
                serviceId: 'service-1',
                staffId: STAFF_FATIMA.id,
                startTime: T(15, 0),
                duration: 60
            });

            expect(result.valid).toBe(false);
            const cd = result.conflictDetails;

            // Required fields for structured 409 response
            expect(cd).toHaveProperty('success', false);
            expect(cd).toHaveProperty('conflict', true);
            expect(cd).toHaveProperty('code', 'BOOKING_CONFLICT');
            expect(cd).toHaveProperty('message');
            expect(cd).toHaveProperty('messageAr');
            expect(cd).toHaveProperty('actionableGuidance');
            expect(cd).toHaveProperty('actionableGuidanceAr');
            expect(cd).toHaveProperty('conflicts');
            expect(Array.isArray(cd.conflicts)).toBe(true);

            // Must NOT contain internal identifiers or stack traces
            expect(cd.message).not.toMatch(/sequelize/i);
            expect(cd.message).not.toMatch(/Error:/);
            expect(cd.message).not.toMatch(/postgres/i);
        });
    });

    // ================================================================
    // BILINGUAL MESSAGE VERIFICATION
    // ================================================================
    describe('Bilingual message verification', () => {
        beforeEach(() => setupDefaultMocks(STAFF_FATIMA));

        test('English staff conflict message is human-readable', async () => {
            db.Appointment.findOne.mockResolvedValue({
                id: 'appt-1',
                startTime: T(15, 0),
                endTime: T(16, 0),
                staffId: STAFF_FATIMA.id,
                status: 'confirmed'
            });

            const result = await bookingService.evaluateSchedulingRequest({
                tenantId: TENANT_ID,
                serviceId: 'service-1',
                staffId: STAFF_FATIMA.id,
                startTime: T(15, 0),
                duration: 60
            });

            expect(result.message).toMatch(/Fatima Ali/);
            expect(result.message).toMatch(/booked|occupied/i);
            expect(result.message).toMatch(/PM/);
            expect(result.message).toMatch(/choose/i);
        });

        test('Arabic staff conflict message is human-readable', async () => {
            db.Appointment.findOne.mockResolvedValue({
                id: 'appt-1',
                startTime: T(15, 0),
                endTime: T(16, 0),
                staffId: STAFF_FATIMA.id,
                status: 'confirmed'
            });

            const result = await bookingService.evaluateSchedulingRequest({
                tenantId: TENANT_ID,
                serviceId: 'service-1',
                staffId: STAFF_FATIMA.id,
                startTime: T(15, 0),
                duration: 60
            });

            expect(result.messageAr).toMatch(/فاطمة علي/);
            expect(result.messageAr).toMatch(/محجوز/);
            expect(result.messageAr).toMatch(/اختيار/);
        });

        test('English resource conflict message is human-readable', async () => {
            db.Resource.findAll.mockResolvedValue([{
                id: 'res-room-1', tenantId: TENANT_ID, resourceTypeId: 'rt-room',
                is_active: true, name_en: 'Massage Room 1', name_ar: 'غرفة المساج 1',
                name: 'Massage Room 1', createdAt: new Date()
            }]);

            db.AppointmentResource.findAll.mockResolvedValue([{
                resourceId: 'res-room-1',
                appointment: {
                    id: 'appt-1', startTime: T(15, 0), endTime: T(16, 0), status: 'confirmed'
                }
            }]);

            const result = await checkResourceAvailability(
                TENANT_ID,
                [{
                    resourceTypeId: 'rt-room', quantity: 1,
                    resourceType: { name_en: 'Massage Room', name_ar: 'غرفة المساج' }
                }],
                T(15, 0), T(16, 0), null, null
            );

            expect(result.message).toMatch(/Massage Room 1/);
            expect(result.message).toMatch(/occupied/i);
            expect(result.message).toMatch(/PM/);
        });

        test('Arabic resource conflict message is human-readable', async () => {
            db.Resource.findAll.mockResolvedValue([{
                id: 'res-room-1', tenantId: TENANT_ID, resourceTypeId: 'rt-room',
                is_active: true, name_en: 'Massage Room 1', name_ar: 'غرفة المساج 1',
                name: 'Massage Room 1', createdAt: new Date()
            }]);

            db.AppointmentResource.findAll.mockResolvedValue([{
                resourceId: 'res-room-1',
                appointment: {
                    id: 'appt-1', startTime: T(15, 0), endTime: T(16, 0), status: 'confirmed'
                }
            }]);

            const result = await checkResourceAvailability(
                TENANT_ID,
                [{
                    resourceTypeId: 'rt-room', quantity: 1,
                    resourceType: { name_en: 'Massage Room', name_ar: 'غرفة المساج' }
                }],
                T(15, 0), T(16, 0), null, null
            );

            expect(result.messageAr).toMatch(/غرفة المساج 1/);
            expect(result.messageAr).toMatch(/مشغولة/);
        });
    });

    // ================================================================
    // BREAK / TIME OFF CONFLICTS
    // ================================================================
    describe('Staff break and time-off conflicts', () => {
        beforeEach(() => setupDefaultMocks(STAFF_FATIMA));

        test('BREAK_CONFLICT names the employee and break window', async () => {
            setAvailabilityContext({
                breaks: [{ startTime: T(14, 0), endTime: T(14, 30) }]
            });

            const result = await bookingService.evaluateSchedulingRequest({
                tenantId: TENANT_ID,
                serviceId: 'service-1',
                staffId: STAFF_FATIMA.id,
                startTime: T(14, 0),
                duration: 60
            });

            expect(result.valid).toBe(false);
            const breakConflict = result.conflicts.find(c => c.type === 'BREAK_CONFLICT');
            expect(breakConflict).toBeDefined();
            expect(breakConflict.entityName).toBe('Fatima Ali');
            expect(result.message).toMatch(/Fatima Ali/);
            expect(result.message).toMatch(/break/i);
        });

        test('TIME_OFF_CONFLICT names the employee and time-off window', async () => {
            setAvailabilityContext({
                timeOff: [{ startTime: T(9, 0), endTime: T(22, 0) }]
            });

            const result = await bookingService.evaluateSchedulingRequest({
                tenantId: TENANT_ID,
                serviceId: 'service-1',
                staffId: STAFF_FATIMA.id,
                startTime: T(14, 0),
                duration: 60
            });

            expect(result.valid).toBe(false);
            const offConflict = result.conflicts.find(c => c.type === 'TIME_OFF_CONFLICT');
            expect(offConflict).toBeDefined();
            expect(result.message).toMatch(/Fatima Ali/);
            expect(result.message).toMatch(/time off/i);
        });
    });
});
