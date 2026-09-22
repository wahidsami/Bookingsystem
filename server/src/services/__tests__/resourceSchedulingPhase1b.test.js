'use strict';

jest.mock('../notificationOrchestratorService', () => ({
    notifyCustomer: jest.fn().mockResolvedValue({ success: true }),
    notifyTenant: jest.fn().mockResolvedValue({ success: true }),
    notifyStaff: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../customerInvoiceEmailService', () => ({
    sendCustomerInvoiceLifecycleEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../redisService', () => ({
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
    getRedisClient: jest.fn().mockReturnValue(null),
    isRedisHealthy: jest.fn().mockResolvedValue(false)
}));

jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock-msg-id' }),
    sendCustomerInvoiceLifecycleEmail: jest.fn().mockResolvedValue({ success: true }),
    sendCustomerPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
    sendPaymentExpiredEmail: jest.fn().mockResolvedValue({ success: true }),
    sendPaymentSuccessEmail: jest.fn().mockResolvedValue({ success: true })
}));

const db = require('../../models');
const { Op } = require('sequelize');
const bookingService = require('../bookingService');
const availabilityService = require('../availabilityService');
const {
    resolveServiceResourceRequirements,
    checkResourceAvailability,
    allocateServiceResources
} = require('../../utils/resourceRequirementResolver');
const tenantAppointmentController = require('../../controllers/tenantAppointmentController');

// Helper to mock express req/res
function createMockReqRes(options = {}) {
    const req = {
        tenantId: options.tenantId,
        userId: options.userId !== undefined ? options.userId : null,
        tenant: options.tenant || (options.tenantId ? { id: options.tenantId } : null),
        body: options.body || {},
        params: options.params || {},
        query: options.query || {},
        headers: options.headers || {}
    };

    const res = {
        statusCode: 200,
        data: null,
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(payload) {
            this.data = payload;
            return this;
        }
    };

    return { req, res };
}

describe('Phase 1B: Resource-Aware Scheduling & Allocation Tests', () => {
    jest.setTimeout(60000);

    let tenant;
    let category;
    let customerUser;
    let staffSara;
    let staffMona;
    let staffNadia;
    let roomType;
    let room1;
    let room2;
    let warmerType;
    let warmer1;
    let massageService;
    let multiResourceService;
    let plainService;
    let testDate; // YYYY-MM-DD

    beforeAll(async () => {
        await db.sequelize.authenticate();

        const ts = Date.now();
        // 1. Create Tenant
        tenant = await db.Tenant.create({
            name: 'Phase 1B Test Salon',
            name_en: 'Phase 1B Test Salon',
            name_ar: 'صالون المرحلة 1ب التجريبي',
            slug: `phase-1b-salon-${ts}`,
            dbSchema: `tenant_p1b_${ts}`,
            email: `tenant_p1b_${ts}@refah.test`,
            phone: `+96650${Math.floor(1000000 + Math.random() * 9000000)}`,
            status: 'active'
        });

        // Tenant Settings (Operating hours: 09:00 to 22:00)
        await db.TenantSettings.create({
            tenantId: tenant.id,
            timezone: 'Asia/Riyadh',
            businessHours: {
                sunday: { open: '09:00', close: '22:00', closed: false },
                monday: { open: '09:00', close: '22:00', closed: false },
                tuesday: { open: '09:00', close: '22:00', closed: false },
                wednesday: { open: '09:00', close: '22:00', closed: false },
                thursday: { open: '09:00', close: '22:00', closed: false },
                friday: { open: '09:00', close: '22:00', closed: false },
                saturday: { open: '09:00', close: '22:00', closed: false }
            },
            bookingSettings: {
                allowAnyStaff: true,
                slotInterval: 30,
                minimumAdvanceBookingMinutes: 0
            }
        });

        // 2. Platform User (Customer)
        customerUser = await db.PlatformUser.create({
            firstName: 'Amina',
            lastName: 'Al-Harbi',
            email: `customer_p1b_${ts}@test.com`,
            phone: `+96655${Math.floor(1000000 + Math.random() * 9000000)}`,
            passwordHash: 'dummy-hash',
            isActive: true
        });

        // 3. Category
        category = await db.TenantServiceCategory.create({
            tenantId: tenant.id,
            name_en: 'Spa & Massage',
            name_ar: 'سبا ومساج',
            isActive: true
        });

        // 4. Staff members (Sara, Mona, Nadia)
        const staffSchedule = {
            sunday: { isWorking: true, shifts: [{ startTime: '09:00', endTime: '21:00' }] },
            monday: { isWorking: true, shifts: [{ startTime: '09:00', endTime: '21:00' }] },
            tuesday: { isWorking: true, shifts: [{ startTime: '09:00', endTime: '21:00' }] },
            wednesday: { isWorking: true, shifts: [{ startTime: '09:00', endTime: '21:00' }] },
            thursday: { isWorking: true, shifts: [{ startTime: '09:00', endTime: '21:00' }] },
            friday: { isWorking: true, shifts: [{ startTime: '09:00', endTime: '21:00' }] },
            saturday: { isWorking: true, shifts: [{ startTime: '09:00', endTime: '21:00' }] }
        };

        staffSara = await db.Staff.create({
            tenantId: tenant.id,
            name: 'Sara Al-Ghamdi',
            email: `sara_p1b_${ts}@test.com`,
            phone: `+96654${Math.floor(1000000 + Math.random() * 9000000)}`,
            schedule: staffSchedule,
            isActive: true
        });

        staffMona = await db.Staff.create({
            tenantId: tenant.id,
            name: 'Mona Al-Otaibi',
            email: `mona_p1b_${ts}@test.com`,
            phone: `+96654${Math.floor(1000000 + Math.random() * 9000000)}`,
            schedule: staffSchedule,
            isActive: true
        });

        staffNadia = await db.Staff.create({
            tenantId: tenant.id,
            name: 'Nadia Salem',
            email: `nadia_p1b_${ts}@test.com`,
            phone: `+96654${Math.floor(1000000 + Math.random() * 9000000)}`,
            schedule: staffSchedule,
            isActive: true
        });

        for (const s of [staffSara, staffMona, staffNadia]) {
            for (let day = 0; day <= 6; day++) {
                await db.StaffSchedule.create({
                    staffId: s.id,
                    dayOfWeek: day,
                    startTime: '09:00',
                    endTime: '21:00',
                    isAvailable: true
                });
            }
        }

        // 5. Services
        // A. Massage (duration 60 min, price 200)
        massageService = await db.Service.create({
            tenantId: tenant.id,
            tenantServiceCategoryId: category.id,
            name_en: 'Swedish Massage',
            name_ar: 'مساج سويدي',
            duration: 60,
            basePrice: 200,
            rawPrice: 200,
            finalPrice: 200,
            isActive: true,
            variants: [
                {
                    id: 'var-90min',
                    description: '90 Minutes Deluxe',
                    duration: 90,
                    finalPrice: 300,
                    isActive: true
                }
            ]
        });

        // B. Multi-resource service (duration 60 min)
        multiResourceService = await db.Service.create({
            tenantId: tenant.id,
            tenantServiceCategoryId: category.id,
            name_en: 'Hot Stone Therapy',
            name_ar: 'علاج بالأحجار الساخنة',
            duration: 60,
            basePrice: 250,
            rawPrice: 250,
            finalPrice: 250,
            isActive: true
        });

        // C. Plain service without resource requirements
        plainService = await db.Service.create({
            tenantId: tenant.id,
            tenantServiceCategoryId: category.id,
            name_en: 'Consultation',
            name_ar: 'استشارة',
            duration: 30,
            basePrice: 50,
            rawPrice: 50,
            finalPrice: 50,
            isActive: true
        });

        // Link staff to services
        for (const s of [staffSara, staffMona, staffNadia]) {
            await db.ServiceEmployee.create({ serviceId: massageService.id, staffId: s.id });
            await db.ServiceEmployee.create({ serviceId: multiResourceService.id, staffId: s.id });
            await db.ServiceEmployee.create({ serviceId: plainService.id, staffId: s.id });
        }

        // 6. Resource Foundation
        // A. Massage Room
        roomType = await db.ResourceType.create({
            tenantId: tenant.id,
            name_en: 'Massage Room',
            name_ar: 'غرفة مساج',
            is_active: true
        });

        // Room 1 (Active)
        room1 = await db.Resource.create({
            tenantId: tenant.id,
            resourceTypeId: roomType.id,
            name_en: 'Massage Room 1',
            name_ar: 'غرفة مساج 1',
            is_active: true
        });

        // B. Hot Stone Warmer
        warmerType = await db.ResourceType.create({
            tenantId: tenant.id,
            name_en: 'Stone Warmer',
            name_ar: 'سخان الأحجار',
            is_active: true
        });

        warmer1 = await db.Resource.create({
            tenantId: tenant.id,
            resourceTypeId: warmerType.id,
            name_en: 'Stone Warmer 1',
            name_ar: 'سخان الأحجار 1',
            is_active: true
        });

        // 7. Attach Resource Requirements
        // Swedish Massage requires Massage Room x 1
        await db.ServiceResourceRequirement.create({
            serviceId: massageService.id,
            resourceTypeId: roomType.id,
            quantity: 1
        });

        // Hot Stone Therapy requires Massage Room x 1 AND Stone Warmer x 1
        await db.ServiceResourceRequirement.create({
            serviceId: multiResourceService.id,
            resourceTypeId: roomType.id,
            quantity: 1
        });
        await db.ServiceResourceRequirement.create({
            serviceId: multiResourceService.id,
            resourceTypeId: warmerType.id,
            quantity: 1
        });

        // Target Date in the future (e.g. 2026-10-15)
        testDate = '2026-10-15';
    });

    afterAll(async () => {
        console.log('>>> entering afterAll');
        try {
            if (tenant) {
                console.log('>>> teardown appts');
                const appointments = await db.Appointment.findAll({ where: { tenantId: tenant.id } });
                const apptIds = appointments.map(a => a.id);
                if (apptIds.length > 0) {
                    await db.AppointmentResource.destroy({ where: { appointmentId: { [Op.in]: apptIds } } }).catch(() => {});
                    await db.AppointmentEvent.destroy({ where: { appointmentId: { [Op.in]: apptIds } } }).catch(() => {});
                    await db.PaymentTransaction.destroy({ where: { appointmentId: { [Op.in]: apptIds } } }).catch(() => {});
                    await db.Appointment.destroy({ where: { id: { [Op.in]: apptIds } } }).catch(() => {});
                }
                console.log('>>> teardown resources');
                await db.ServiceResourceRequirement.destroy({
                    where: { serviceId: { [Op.in]: [massageService.id, multiResourceService.id, plainService.id] } }
                }).catch(() => {});
                await db.Resource.destroy({ where: { tenantId: tenant.id } }).catch(() => {});
                await db.ResourceType.destroy({ where: { tenantId: tenant.id } }).catch(() => {});
                console.log('>>> teardown staff');
                await db.ServiceEmployee.destroy({
                    where: { serviceId: { [Op.in]: [massageService.id, multiResourceService.id, plainService.id] } }
                }).catch(() => {});
                await db.StaffSchedule.destroy({
                    where: { staffId: { [Op.in]: [staffSara.id, staffMona.id, staffNadia.id] } }
                }).catch(() => {});
                console.log('>>> teardown packages');
                const packages = await db.ServicePackage.findAll({ where: { tenantId: tenant.id } }).catch(() => []);
                const pkgIds = packages.map(p => p.id);
                if (pkgIds.length > 0) {
                    await db.ServicePackageItem.destroy({ where: { packageId: { [Op.in]: pkgIds } } }).catch(() => {});
                    await db.ServicePackage.destroy({ where: { id: { [Op.in]: pkgIds } } }).catch(() => {});
                }
                console.log('>>> teardown tenant services and settings');
                await db.Service.destroy({ where: { tenantId: tenant.id } }).catch(() => {});
                await db.TenantServiceCategory.destroy({ where: { tenantId: tenant.id } }).catch(() => {});
                await db.Staff.destroy({ where: { tenantId: tenant.id } }).catch(() => {});
                await db.TenantSettings.destroy({ where: { tenantId: tenant.id } }).catch(() => {});
                await db.Tenant.destroy({ where: { id: tenant.id } }).catch(() => {});
            }
            if (customerUser) {
                console.log('>>> teardown customerUser');
                await db.PlatformUser.destroy({ where: { id: customerUser.id } }).catch(() => {});
            }
            console.log('>>> afterAll teardown complete');
        } catch (e) {
            console.warn('Teardown warning:', e.message);
        }
    });

    // ==========================================
    // SCENARIO A: Single Service Booking Allocates Physical Resource
    // ==========================================
    test('Scenario A: Customer A books Massage with Staff Sara (15:00-16:00) -> Allocates Massage Room 1', async () => {
        const startTime = `${testDate}T12:00:00.000Z`; // 15:00 Riyadh (UTC+3)

        const appointment = await bookingService.createBooking({
            serviceId: massageService.id,
            staffId: staffSara.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        });

        expect(appointment).toBeDefined();
        expect(appointment.id).toBeDefined();

        // Check appointment_resources table
        const allocations = await db.AppointmentResource.findAll({
            where: { appointmentId: appointment.id }
        });

        expect(allocations).toHaveLength(1);
        expect(allocations[0].resourceId).toBe(room1.id);
    });

    // ==========================================
    // SCENARIO B: Individual Service Availability Respects Physical Resource (The User's Core Example)
    // ==========================================
    test('Scenario B: Only Room 1 exists. Sara is booked 15:00-16:00. For Mona, 15:30 slot is unavailable due to resource conflict', async () => {
        const result = await availabilityService.getAvailableSlots(tenant.id, {
            serviceId: massageService.id,
            staffId: staffMona.id,
            date: testDate
        });

        expect(result.slots).toBeDefined();
        expect(result.slots.length).toBeGreaterThan(0);

        // Sara is booked 15:00-16:00 (12:00-13:00 UTC).
        // 15:30 Riyadh = 12:30 UTC.
        // Mona is free from 15:30-16:30, but Room 1 is occupied until 16:00!
        const slot1530 = result.slots.find(s => {
            const d = new Date(s.startTime);
            return d.getUTCHours() === 12 && d.getUTCMinutes() === 30;
        });

        expect(slot1530).toBeDefined();
        expect(slot1530.available).toBe(false);
        expect(slot1530.unavailableReason).toBe('resource_unavailable');

        // 16:00 Riyadh = 13:00 UTC. Room 1 is freed at 16:00.
        const slot1600 = result.slots.find(s => {
            const d = new Date(s.startTime);
            return d.getUTCHours() === 13 && d.getUTCMinutes() === 0;
        });

        expect(slot1600).toBeDefined();
        expect(slot1600.available).toBe(true);
    });

    // ==========================================
    // SCENARIO C: Double Booking Prevention on Individual Service
    // ==========================================
    test('Scenario C: Customer B attempts to book at 15:30-16:30 with Mona -> Rejected (0 free rooms)', async () => {
        const startTime = `${testDate}T12:30:00.000Z`; // 15:30 Riyadh

        await expect(bookingService.createBooking({
            serviceId: massageService.id,
            staffId: staffMona.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        })).rejects.toThrow(/unavailable|occupied/i);
    });

    // ==========================================
    // SCENARIO D: Multiple Physical Resource Instances Support
    // ==========================================
    test('Scenario D: Add Room 2 -> Mona can now be booked at 15:30 and gets Room 2', async () => {
        // Create Room 2
        room2 = await db.Resource.create({
            tenantId: tenant.id,
            resourceTypeId: roomType.id,
            name_en: 'Massage Room 2',
            name_ar: 'غرفة مساج 2',
            is_active: true
        });

        // 1. Availability check: 15:30 slot for Mona should now be AVAILABLE
        const result = await availabilityService.getAvailableSlots(tenant.id, {
            serviceId: massageService.id,
            staffId: staffMona.id,
            date: testDate
        });

        const slot1530 = result.slots.find(s => {
            const d = new Date(s.startTime);
            return d.getUTCHours() === 12 && d.getUTCMinutes() === 30;
        });
        expect(slot1530.available).toBe(true);

        // 2. Booking Customer B at 15:30-16:30 with Mona
        const startTime = `${testDate}T12:30:00.000Z`;
        const appointmentB = await bookingService.createBooking({
            serviceId: massageService.id,
            staffId: staffMona.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        });

        expect(appointmentB).toBeDefined();

        const allocationsB = await db.AppointmentResource.findAll({
            where: { appointmentId: appointmentB.id }
        });
        expect(allocationsB).toHaveLength(1);
        expect(allocationsB[0].resourceId).toBe(room2.id); // Allocated Room 2!
    });

    // ==========================================
    // SCENARIO E: Inactive Resource Excluded From Capacity
    // ==========================================
    test('Scenario E: Deactivating Room 2 -> Nadia cannot book at 15:45 when Room 1 is occupied', async () => {
        // Deactivate Room 2
        await room2.update({ is_active: false });

        const startTime = `${testDate}T12:45:00.000Z`; // 15:45 Riyadh

        await expect(bookingService.createBooking({
            serviceId: massageService.id,
            staffId: staffNadia.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        })).rejects.toThrow(/unavailable|occupied/i);

        // Reactivate Room 2 for subsequent tests
        await room2.update({ is_active: true });
    });

    // ==========================================
    // SCENARIO F: Multi-Resource Service Booking
    // ==========================================
    test('Scenario F: Hot Stone Therapy requires Massage Room AND Stone Warmer -> Both allocated', async () => {
        // Book at 17:00 Riyadh (14:00 UTC) with Sara
        const startTime = `${testDate}T14:00:00.000Z`;

        const appointment = await bookingService.createBooking({
            serviceId: multiResourceService.id,
            staffId: staffSara.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        });

        expect(appointment).toBeDefined();

        const allocations = await db.AppointmentResource.findAll({
            where: { appointmentId: appointment.id }
        });

        expect(allocations).toHaveLength(2);
        const resourceIds = allocations.map(a => a.resourceId);
        expect(resourceIds).toContain(warmer1.id);
        expect(resourceIds.includes(room1.id) || resourceIds.includes(room2.id)).toBe(true);
    });

    // ==========================================
    // SCENARIO G: Variant Requirement Resolution & Merging
    // ==========================================
    test('Scenario G: Parent requirement applies to variant automatically', async () => {
        const reqs = await resolveServiceResourceRequirements(
            massageService.id,
            'var-90min',
            tenant.id
        );

        expect(reqs).toHaveLength(1);
        expect(reqs[0].resourceTypeId).toBe(roomType.id);
        expect(reqs[0].quantity).toBe(1);
    });

    // ==========================================
    // SCENARIO H: Sequential Bundle Resource Reuse
    // ==========================================
    test('Scenario H: Sequential services reuse the same physical room across consecutive windows', async () => {
        // Deactivate Room 2 so only Room 1 is available
        await room2.update({ is_active: false });

        // Customer books 10:00-11:00 with Sara (Massage)
        const start1 = `${testDate}T07:00:00.000Z`;
        const appt1 = await bookingService.createBooking({
            serviceId: massageService.id,
            staffId: staffSara.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime: start1,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        });

        expect(appt1).toBeDefined();

        // Customer books 11:00-12:00 with Mona (Massage)
        const start2 = `${testDate}T08:00:00.000Z`;
        const appt2 = await bookingService.createBooking({
            serviceId: massageService.id,
            staffId: staffMona.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime: start2,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        });

        expect(appt2).toBeDefined();

        const alloc1 = await db.AppointmentResource.findAll({ where: { appointmentId: appt1.id } });
        const alloc2 = await db.AppointmentResource.findAll({ where: { appointmentId: appt2.id } });

        // Both successfully allocated Room 1 because their time windows are sequential and non-overlapping!
        expect(alloc1[0].resourceId).toBe(room1.id);
        expect(alloc2[0].resourceId).toBe(room1.id);

        // Reactivate Room 2
        await room2.update({ is_active: true });
    });

    // ==========================================
    // SCENARIO I: Parallel Bundle Resource Coordination
    // ==========================================
    test('Scenario I: Parallel bundle requires distinct rooms simultaneously for overlapping steps', async () => {
        // Create parallel package
        const parallelPackage = await db.ServicePackage.create({
            tenantId: tenant.id,
            name_en: 'Duo Relax Package',
            name_ar: 'باقة الاسترخاء المزدوج',
            price: 350,
            duration: 60,
            scheduleType: 'parallel',
            isActive: true
        });

        const pItem1 = await db.ServicePackageItem.create({
            packageId: parallelPackage.id,
            serviceId: massageService.id,
            sequenceOrder: 1,
            duration: 60,
            basePrice: 200
        });

        const pItem2 = await db.ServicePackageItem.create({
            packageId: parallelPackage.id,
            serviceId: massageService.id,
            sequenceOrder: 2,
            duration: 60,
            basePrice: 200
        });

        // Case 1: Deactivate Room 2 so only 1 room exists.
        // Parallel bundle requires 2 rooms simultaneously -> Must fail!
        await room2.update({ is_active: false });

        const parallelStart = `${testDate}T09:30:00.000Z`; // 12:30 Riyadh

        await expect(bookingService.createBookingSession({
            tenantId: tenant.id,
            platformUserId: customerUser.id,
            paymentMethod: 'at-center',
            packageId: parallelPackage.id,
            items: [
                {
                    packageItemId: pItem1.id,
                    serviceId: massageService.id,
                    staffId: staffSara.id,
                    startTime: parallelStart,
                    duration: 60
                },
                {
                    packageItemId: pItem2.id,
                    serviceId: massageService.id,
                    staffId: staffMona.id,
                    startTime: parallelStart,
                    duration: 60
                }
            ]
        })).rejects.toThrow(/occupied|unavailable|parallel bundle|insufficient/i);

        // Case 2: Reactivate Room 2 so 2 rooms exist.
        // Parallel bundle now succeeds and allocates distinct rooms to both steps!
        await room2.update({ is_active: true });

        const sessionResult = await bookingService.createBookingSession({
            tenantId: tenant.id,
            platformUserId: customerUser.id,
            paymentMethod: 'at-center',
            packageId: parallelPackage.id,
            items: [
                {
                    packageItemId: pItem1.id,
                    serviceId: massageService.id,
                    staffId: staffSara.id,
                    startTime: parallelStart,
                    duration: 60
                },
                {
                    packageItemId: pItem2.id,
                    serviceId: massageService.id,
                    staffId: staffMona.id,
                    startTime: parallelStart,
                    duration: 60
                }
            ]
        });

        expect(sessionResult.appointments).toHaveLength(2);

        const stepAlloc1 = await db.AppointmentResource.findAll({
            where: { appointmentId: sessionResult.appointments[0].id }
        });
        const stepAlloc2 = await db.AppointmentResource.findAll({
            where: { appointmentId: sessionResult.appointments[1].id }
        });

        expect(stepAlloc1).toHaveLength(1);
        expect(stepAlloc2).toHaveLength(1);

        // The two parallel steps received DISTINCT physical rooms!
        expect(stepAlloc1[0].resourceId).not.toBe(stepAlloc2[0].resourceId);
        const allocatedIds = [stepAlloc1[0].resourceId, stepAlloc2[0].resourceId];
        expect(allocatedIds).toContain(room1.id);
        expect(allocatedIds).toContain(room2.id);

        // Cleanup package
        await db.ServicePackageItem.destroy({ where: { packageId: parallelPackage.id } });
        await db.ServicePackage.destroy({ where: { id: parallelPackage.id } });
    });

    // ==========================================
    // SCENARIO J: Rescheduling Re-Validation and Re-Allocation
    // ==========================================
    test('Scenario J: Rescheduling validates resources and re-allocates on move', async () => {
        // Book an appointment at 18:00 Riyadh (15:00 UTC) with Sara
        const initialStart = `${testDate}T15:00:00.000Z`;
        const appt = await bookingService.createBooking({
            serviceId: massageService.id,
            staffId: staffSara.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime: initialStart,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        });

        // 1. Attempt to reschedule to 15:15 Riyadh (12:15 UTC) where all rooms are occupied
        // Note: From earlier tests, Scenario A (Room 1) and Scenario D (Room 2) both run between 15:00 and 16:30!
        const conflictStart = `${testDate}T12:15:00.000Z`;
        const { req: reqConflict, res: resConflict } = createMockReqRes({
            tenantId: tenant.id,
            params: { id: appt.id },
            body: {
                staffId: staffSara.id,
                startTime: conflictStart
            }
        });

        await tenantAppointmentController.reassignRescheduleAppointment(reqConflict, resConflict);
        expect(resConflict.statusCode).toBe(409);

        // 2. Reschedule to open slot at 19:00 Riyadh (16:00 UTC)
        const openStart = `${testDate}T16:00:00.000Z`;
        const { req: reqOpen, res: resOpen } = createMockReqRes({
            tenantId: tenant.id,
            params: { id: appt.id },
            body: {
                staffId: staffMona.id,
                startTime: openStart
            }
        });

        await tenantAppointmentController.reassignRescheduleAppointment(reqOpen, resOpen);
        expect(resOpen.statusCode).toBe(200);

        const reloaded = await db.Appointment.findByPk(appt.id);
        expect(new Date(reloaded.startTime).toISOString()).toBe(new Date(openStart).toISOString());

        const newAlloc = await db.AppointmentResource.findAll({ where: { appointmentId: appt.id } });
        expect(newAlloc).toHaveLength(1);
    });

    // ==========================================
    // SCENARIO K: Backward Compatibility (Services with no resource requirements)
    // ==========================================
    test('Scenario K: Plain service with no resource requirements books cleanly with 0 allocations', async () => {
        const startTime = `${testDate}T08:00:00.000Z`; // 11:00 Riyadh

        const appointment = await bookingService.createBooking({
            serviceId: plainService.id,
            staffId: staffSara.id,
            platformUserId: customerUser.id,
            tenantId: tenant.id,
            startTime,
            paymentMethod: 'at-center',
            skipAdvanceValidation: true
        });

        expect(appointment).toBeDefined();

        const allocations = await db.AppointmentResource.findAll({
            where: { appointmentId: appointment.id }
        });
        expect(allocations).toHaveLength(0); // 0 resource requirements = 0 rows in appointment_resources
    });
});
