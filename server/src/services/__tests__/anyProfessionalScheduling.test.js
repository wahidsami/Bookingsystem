'use strict';

/**
 * Focused regression tests for Any Professional scheduling feasibility and conflict rules:
 * 1. Any Professional + one busy / another free -> VALID.
 * 2. Any Professional + all staff free -> VALID.
 * 3. Any Professional + free staff + occupied resource -> RESOURCE conflict (no staff blamed).
 * 4. Explicit busy employee + another employee free -> selected employee conflict; NO silent substitution.
 * 5. Any Professional + no eligible staff -> STAFF conflict.
 * 6. Multiple staff + resource allocation -> complete feasible allocation.
 * 7. Non-grid-aligned requested timestamp + staff actually free -> VALID.
 * 8. Resource availableAgainAt remains correct.
 * 9. Existing human-readable conflict messages remain intact.
 */

jest.mock('../../models', () => ({
    Staff: { findByPk: jest.fn(), findAll: jest.fn() },
    Service: { findByPk: jest.fn() },
    ServiceEmployee: { findAll: jest.fn(), findOne: jest.fn() },
    Appointment: { findOne: jest.fn(), findAll: jest.fn(), count: jest.fn() },
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
    }),
    getAvailableSlots: jest.fn()
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

const db = require('../../models');
const availabilityService = require('../availabilityService');
const bookingService = require('../bookingService');
const { checkResourceAvailability } = require('../../utils/resourceRequirementResolver');

describe('Any Professional & Staff Availability Regression Tests', () => {
    const tenantId = 'tenant-1';
    const serviceId = 'svc-massage';
    const timezone = 'Asia/Riyadh';

    const staffFatima = { id: 'staff-fatima', name: 'Fatima Ali', name_ar: 'فاطمة علي', tenantId, isActive: true, rating: 4.8 };
    const staffSarah = { id: 'staff-sarah', name: 'Sarah Ahmed', name_ar: 'سارة أحمد', tenantId, isActive: true, rating: 4.9 };
    const staffTalia = { id: 'staff-talia', name: 'Talia Nour', name_ar: 'تاليا نور', tenantId, isActive: true, rating: 4.7 };

    beforeEach(() => {
        jest.clearAllMocks();

        db.TenantSettings.findOne.mockResolvedValue({ timezone });
        db.Appointment.count.mockResolvedValue(0);

        // Standard 9am - 9pm operating hours
        availabilityService._buildAvailabilityContext.mockImplementation(async (tId, sId, dateKey) => ({
            tenantHours: { start: '09:00', end: '21:00' },
            employeeDutyWindows: [
                {
                    startTime: new Date(`${dateKey}T06:00:00.000Z`).toISOString(), // 9am Riyadh
                    endTime: new Date(`${dateKey}T18:00:00.000Z`).toISOString()   // 9pm Riyadh
                }
            ],
            breaks: [],
            timeOff: []
        }));
    });

    // 1. Any Professional + one busy / another free -> VALID
    test('1. Any Professional + Fatima busy / Sarah & Talia free -> VALID (Sarah/Talia assigned)', async () => {
        db.ServiceEmployee.findAll.mockResolvedValue([
            { serviceId, staffId: 'staff-fatima' },
            { serviceId, staffId: 'staff-sarah' },
            { serviceId, staffId: 'staff-talia' }
        ]);
        db.Staff.findAll.mockResolvedValue([staffFatima, staffSarah, staffTalia]);
        db.Staff.findByPk.mockImplementation(async (id) => {
            if (id === 'staff-fatima') return staffFatima;
            if (id === 'staff-sarah') return staffSarah;
            if (id === 'staff-talia') return staffTalia;
            return null;
        });

        // Fatima is booked 3:00 - 4:00 PM (12:00 - 13:00 UTC)
        db.Appointment.findOne.mockImplementation(async ({ where }) => {
            if (where.staffId === 'staff-fatima') {
                return {
                    id: 'appt-fatima-conflict',
                    staffId: 'staff-fatima',
                    startTime: new Date('2026-09-22T12:00:00.000Z'),
                    endTime: new Date('2026-09-22T13:00:00.000Z')
                };
            }
            return null; // Sarah and Talia free
        });
        db.ServiceResourceRequirement.findAll.mockResolvedValue([]); // No resource constraints

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: null, // Any Professional
            startTime: '2026-09-22T12:00:00.000Z',
            duration: 60
        });

        expect(result.valid).toBe(true);
        expect(result.assignmentMode).toBe('auto_assigned');
        expect(['staff-sarah', 'staff-talia']).toContain(result.staffId);
        expect(result.staffId).not.toBe('staff-fatima');
    });

    // 2. Any Professional + all staff free -> VALID
    test('2. Any Professional + all staff free -> VALID', async () => {
        db.ServiceEmployee.findAll.mockResolvedValue([
            { serviceId, staffId: 'staff-fatima' },
            { serviceId, staffId: 'staff-sarah' },
            { serviceId, staffId: 'staff-talia' }
        ]);
        db.Staff.findAll.mockResolvedValue([staffFatima, staffSarah, staffTalia]);
        db.Staff.findByPk.mockImplementation(async (id) => {
            if (id === 'staff-fatima') return staffFatima;
            if (id === 'staff-sarah') return staffSarah;
            if (id === 'staff-talia') return staffTalia;
            return null;
        });
        db.Appointment.findOne.mockResolvedValue(null); // all free
        db.ServiceResourceRequirement.findAll.mockResolvedValue([]);

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: 'any',
            startTime: '2026-09-22T12:00:00.000Z',
            duration: 60
        });

        expect(result.valid).toBe(true);
        expect(result.assignmentMode).toBe('auto_assigned');
        expect(['staff-fatima', 'staff-sarah', 'staff-talia']).toContain(result.staffId);
    });

    // 3. Any Professional + free staff + occupied resource -> RESOURCE conflict (no staff blamed)
    test('3. Any Professional + staff free + Massage Room occupied -> RESOURCE conflict, no employee blamed', async () => {
        db.ServiceEmployee.findAll.mockResolvedValue([
            { serviceId, staffId: 'staff-fatima' },
            { serviceId, staffId: 'staff-sarah' }
        ]);
        db.Staff.findAll.mockResolvedValue([staffFatima, staffSarah]);
        db.Staff.findByPk.mockImplementation(async (id) => {
            if (id === 'staff-fatima') return staffFatima;
            if (id === 'staff-sarah') return staffSarah;
            return null;
        });
        db.Appointment.findOne.mockResolvedValue(null); // staff free

        // Resource constraint: Massage Room 1 occupied from 3:00 to 4:00 (12:00 to 13:00 UTC)
        db.ServiceResourceRequirement.findAll.mockResolvedValue([
            {
                id: 'req-1',
                serviceId,
                resourceTypeId: 'type-room',
                quantityRequired: 1,
                resourceType: { id: 'type-room', name: 'Massage Room', name_en: 'Massage Room', name_ar: 'غرفة المساج' }
            }
        ]);
        db.Resource.findAll.mockResolvedValue([
            { id: 'res-room-1', name: 'Massage Room 1', name_en: 'Massage Room 1', name_ar: 'غرفة المساج 1', resourceTypeId: 'type-room', is_active: true }
        ]);
        db.AppointmentResource.findAll.mockResolvedValue([
            {
                id: 'ar-1',
                resourceId: 'res-room-1',
                appointment: {
                    id: 'appt-other',
                    status: 'confirmed',
                    startTime: new Date('2026-09-22T12:00:00.000Z'),
                    endTime: new Date('2026-09-22T13:00:00.000Z')
                }
            }
        ]);

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: null, // Any Professional
            startTime: '2026-09-22T12:00:00.000Z',
            duration: 60
        });

        expect(result.valid).toBe(false);
        expect(result.conflictType).toBe('RESOURCE_OCCUPIED');
        expect(result.message).toContain('Massage Room 1 is currently occupied');
        expect(result.message).not.toContain('Fatima');
        expect(result.message).not.toContain('Sarah');
        expect(result.conflicts[0].entityType).toBe('resource');
    });

    // 4. Explicit busy employee + another employee free -> selected employee conflict; NO silent substitution
    test('4. Explicit selection of Fatima who is busy -> REJECT Fatima, do NOT silently substitute Sarah', async () => {
        db.Staff.findByPk.mockResolvedValue(staffFatima);
        // Fatima is booked 3:00 - 4:00 PM (12:00 - 13:00 UTC)
        db.Appointment.findOne.mockResolvedValue({
            id: 'appt-fatima-conflict',
            staffId: 'staff-fatima',
            startTime: new Date('2026-09-22T12:00:00.000Z'),
            endTime: new Date('2026-09-22T13:00:00.000Z')
        });
        db.ServiceResourceRequirement.findAll.mockResolvedValue([]); // No resource constraints

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: 'staff-fatima', // Explicitly Fatima
            startTime: '2026-09-22T12:00:00.000Z',
            duration: 60
        });

        expect(result.valid).toBe(false);
        expect(result.conflictType).toBe('STAFF_UNAVAILABLE');
        expect(result.conflicts[0].entityId).toBe('staff-fatima');
        expect(result.conflicts[0].entityName).toBe('Fatima Ali');
        expect(result.message).toContain('Fatima Ali is already booked');
        expect(result.message).not.toContain('Sarah');
    });

    // 5. Any Professional + no eligible staff -> STAFF conflict
    test('5. Any Professional + all staff unavailable -> STAFF conflict with clear actionable message', async () => {
        db.ServiceEmployee.findAll.mockResolvedValue([
            { serviceId, staffId: 'staff-fatima' },
            { serviceId, staffId: 'staff-sarah' }
        ]);
        db.Staff.findAll.mockResolvedValue([staffFatima, staffSarah]);
        db.Staff.findByPk.mockImplementation(async (id) => {
            if (id === 'staff-fatima') return staffFatima;
            if (id === 'staff-sarah') return staffSarah;
            return null;
        });
        // Both Fatima and Sarah have conflicts
        db.Appointment.findOne.mockImplementation(async ({ where }) => {
            return {
                id: `appt-${where.staffId}-conflict`,
                staffId: where.staffId,
                startTime: new Date('2026-09-22T12:00:00.000Z'),
                endTime: new Date('2026-09-22T13:00:00.000Z')
            };
        });
        db.ServiceResourceRequirement.findAll.mockResolvedValue([]);

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: null,
            startTime: '2026-09-22T12:00:00.000Z',
            duration: 60
        });

        expect(result.valid).toBe(false);
        expect(result.conflictType).toBe('STAFF_UNAVAILABLE');
        expect(result.reasonType).toBe('no_available_staff');
        expect(result.message).toContain('No qualified professionals are available at the requested time');
        expect(result.messageAr).toContain('لا يوجد موظفون مؤهلون متاحون');
    });

    // 6. Multiple staff + resource allocation -> complete feasible allocation
    test('6. Multiple staff + resource free -> allocates free candidate with complete allocation', async () => {
        db.ServiceEmployee.findAll.mockResolvedValue([
            { serviceId, staffId: 'staff-fatima' },
            { serviceId, staffId: 'staff-sarah' }
        ]);
        db.Staff.findAll.mockResolvedValue([staffFatima, staffSarah]);
        db.Staff.findByPk.mockImplementation(async (id) => {
            if (id === 'staff-fatima') return staffFatima;
            if (id === 'staff-sarah') return staffSarah;
            return null;
        });
        // Fatima busy, Sarah free
        db.Appointment.findOne.mockImplementation(async ({ where }) => {
            if (where.staffId === 'staff-fatima') {
                return {
                    id: 'appt-fatima',
                    staffId: 'staff-fatima',
                    startTime: new Date('2026-09-22T12:00:00.000Z'),
                    endTime: new Date('2026-09-22T13:00:00.000Z')
                };
            }
            return null;
        });
        // Resource is free
        db.ServiceResourceRequirement.findAll.mockResolvedValue([
            {
                id: 'req-1',
                serviceId,
                resourceTypeId: 'type-room',
                quantityRequired: 1,
                resourceType: { id: 'type-room', nameEn: 'Massage Room', nameAr: 'غرفة المساج' }
            }
        ]);
        db.Resource.findAll.mockResolvedValue([
            { id: 'res-room-1', nameEn: 'Massage Room 1', nameAr: 'غرفة المساج 1', resourceTypeId: 'type-room', isActive: true }
        ]);
        db.AppointmentResource.findAll.mockResolvedValue([]); // Room is completely free

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: 'auto',
            startTime: '2026-09-22T12:00:00.000Z',
            duration: 60
        });

        expect(result.valid).toBe(true);
        expect(result.staffId).toBe('staff-sarah');
        expect(result.assignmentMode).toBe('auto_assigned');
    });

    // 7. Non-grid-aligned requested timestamp + staff actually free -> VALID
    test('7. Non-grid-aligned timestamp (3:17 PM) + staff free within duty hours -> VALID', async () => {
        db.ServiceEmployee.findAll.mockResolvedValue([
            { serviceId, staffId: 'staff-sarah' }
        ]);
        db.Staff.findAll.mockResolvedValue([staffSarah]);
        db.Staff.findByPk.mockResolvedValue(staffSarah);
        db.Appointment.findOne.mockResolvedValue(null); // Free
        db.ServiceResourceRequirement.findAll.mockResolvedValue([]);

        // 3:17 PM Riyadh = 12:17 UTC
        const nonGridStart = '2026-09-22T12:17:00.000Z';
        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: null,
            startTime: nonGridStart,
            duration: 43 // 43 minutes
        });

        expect(result.valid).toBe(true);
        expect(result.staffId).toBe('staff-sarah');
    });

    // 8. Resource availableAgainAt remains correct
    test('8. Resource availableAgainAt remains correct in Any Professional evaluation', async () => {
        db.ServiceEmployee.findAll.mockResolvedValue([
            { serviceId, staffId: 'staff-sarah' }
        ]);
        db.Staff.findAll.mockResolvedValue([staffSarah]);
        db.Staff.findByPk.mockResolvedValue(staffSarah);
        db.Appointment.findOne.mockResolvedValue(null); // Staff free

        // Room occupied until 4:00 PM (13:00 UTC)
        db.ServiceResourceRequirement.findAll.mockResolvedValue([
            {
                id: 'req-1',
                serviceId,
                resourceTypeId: 'type-room',
                quantityRequired: 1,
                resourceType: { id: 'type-room', nameEn: 'Massage Room', nameAr: 'غرفة المساج' }
            }
        ]);
        db.Resource.findAll.mockResolvedValue([
            { id: 'res-room-1', nameEn: 'Massage Room 1', nameAr: 'غرفة المساج 1', resourceTypeId: 'type-room', isActive: true }
        ]);
        db.AppointmentResource.findAll.mockResolvedValue([
            {
                id: 'ar-1',
                resourceId: 'res-room-1',
                appointment: {
                    id: 'appt-other',
                    status: 'confirmed',
                    startTime: new Date('2026-09-22T12:00:00.000Z'),
                    endTime: new Date('2026-09-22T13:00:00.000Z')
                }
            }
        ]);

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: null,
            startTime: '2026-09-22T12:00:00.000Z',
            duration: 60
        });

        expect(result.valid).toBe(false);
        expect(result.conflictDetails.availableAgainAt).toBe('2026-09-22T13:00:00.000Z');
        expect(result.message).toContain('4:00 PM');
    });

    // 9. CASE 7: Both staff and resource constraints block -> MULTIPLE_CONFLICTS structured behavior
    test('9. Both staff and resource constraints block -> MULTIPLE_CONFLICTS with both reported', async () => {
        db.ServiceEmployee.findAll.mockResolvedValue([
            { serviceId, staffId: 'staff-fatima' }
        ]);
        db.Staff.findAll.mockResolvedValue([staffFatima]);
        db.Staff.findByPk.mockResolvedValue(staffFatima);
        // Fatima is booked
        db.Appointment.findOne.mockResolvedValue({
            id: 'appt-fatima',
            staffId: 'staff-fatima',
            startTime: new Date('2026-09-22T12:00:00.000Z'),
            endTime: new Date('2026-09-22T13:00:00.000Z')
        });

        // Room is also occupied
        db.ServiceResourceRequirement.findAll.mockResolvedValue([
            {
                id: 'req-1',
                serviceId,
                resourceTypeId: 'type-room',
                quantityRequired: 1,
                resourceType: { id: 'type-room', nameEn: 'Massage Room', nameAr: 'غرفة المساج' }
            }
        ]);
        db.Resource.findAll.mockResolvedValue([
            { id: 'res-room-1', nameEn: 'Massage Room 1', nameAr: 'غرفة المساج 1', resourceTypeId: 'type-room', isActive: true }
        ]);
        db.AppointmentResource.findAll.mockResolvedValue([
            {
                id: 'ar-1',
                resourceId: 'res-room-1',
                appointment: {
                    id: 'appt-other',
                    status: 'confirmed',
                    startTime: new Date('2026-09-22T12:00:00.000Z'),
                    endTime: new Date('2026-09-22T13:00:00.000Z')
                }
            }
        ]);

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId,
            serviceId,
            staffId: null,
            startTime: '2026-09-22T12:00:00.000Z',
            duration: 60
        });

        expect(result.valid).toBe(false);
        expect(result.conflictType).toBe('MULTIPLE_CONFLICTS');
        expect(result.conflicts).toHaveLength(2);
        expect(result.conflicts.some(c => c.entityType === 'staff')).toBe(true);
        expect(result.conflicts.some(c => c.entityType === 'resource')).toBe(true);
    });
});
