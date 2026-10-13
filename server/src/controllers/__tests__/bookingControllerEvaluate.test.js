'use strict';

/**
 * Unit tests for evaluateScheduling 409 standardized response
 * Verifies that bookingController.evaluateScheduling returns:
 * - HTTP 409 with top-level structured conflict fields: conflict, code, message, messageAr, actionableGuidance, actionableGuidanceAr, conflicts, conflictDetails
 * - Backward compatibility by preserving decision
 * - Proper isolation: different staff + occupied resource blames the room, not the employee
 */

jest.mock('../../models', () => ({
    Staff: { findByPk: jest.fn() },
    Service: { findByPk: jest.fn() },
    Appointment: { findOne: jest.fn(), findAll: jest.fn() },
    TenantSettings: { findOne: jest.fn() },
    ServiceResourceRequirement: { findAll: jest.fn() },
    Resource: { findAll: jest.fn() },
    AppointmentResource: { findAll: jest.fn() },
    sequelize: { transaction: jest.fn() }
}));

jest.mock('../../services/bookingService', () => ({
    evaluateSchedulingRequest: jest.fn()
}));

const db = require('../../models');
const bookingService = require('../../services/bookingService');
const { evaluateScheduling } = require('../bookingController');

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('POST /api/v1/bookings/evaluate — 409 Standardization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1. RESOURCE_OCCUPIED returns specific English message and top-level structured fields', async () => {
        db.Service.findByPk.mockResolvedValue({
            id: 'svc-moroccan',
            tenantId: 'tenant-1',
            duration: 60
        });

        const mockDecision = {
            valid: false,
            code: 'RESOURCE_CONFLICT',
            conflictType: 'resource_occupied',
            message: 'Massage Room 1 is currently occupied by another appointment from 3:00 PM to 4:00 PM. The resource will be available again at 4:00 PM. Please choose another time.',
            messageAr: 'غرفة المساج 1 مشغولة حالياً بموعد آخر من 3:00 م إلى 4:00 م. ستكون المورد متاحة مرة أخرى في 4:00 م. يرجى اختيار وقت آخر.',
            actionableGuidance: 'Please select a different time or choose an alternative resource.',
            actionableGuidanceAr: 'يرجى اختيار وقت آخر أو استخدام مورد بديل.',
            conflicts: [{ type: 'resource_occupied', resourceName: 'Massage Room 1' }],
            conflictDetails: { resourceId: 'res-room-1', availableAgainAt: '16:00' }
        };

        bookingService.evaluateSchedulingRequest.mockResolvedValue(mockDecision);

        const req = {
            body: {
                tenantId: 'tenant-1',
                serviceId: 'svc-moroccan',
                staffId: 'staff-sarah',
                startTime: '2026-09-22T15:00:00.000Z',
                duration: 60
            },
            headers: {}
        };
        const res = mockResponse();

        await evaluateScheduling(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        const payload = res.json.mock.calls[0][0];

        // Verify top-level fields
        expect(payload.success).toBe(false);
        expect(payload.conflict).toBe(true);
        expect(payload.code).toBe('RESOURCE_CONFLICT');
        expect(payload.message).toContain('Massage Room 1 is currently occupied');
        expect(payload.messageAr).toContain('غرفة المساج 1 مشغولة حالياً');
        expect(payload.actionableGuidance).toBe('Please select a different time or choose an alternative resource.');
        expect(payload.actionableGuidanceAr).toBe('يرجى اختيار وقت آخر أو استخدام مورد بديل.');
        expect(payload.conflicts).toHaveLength(1);
        expect(payload.conflictDetails).toBeDefined();

        // Verify backward compatibility
        expect(payload.decision).toEqual(mockDecision);
    });

    test('2. STAFF_UNAVAILABLE returns employee-specific message and does not blame room', async () => {
        db.Service.findByPk.mockResolvedValue({
            id: 'svc-haircut',
            tenantId: 'tenant-1',
            duration: 30
        });

        const mockDecision = {
            valid: false,
            code: 'STAFF_CONFLICT',
            conflictType: 'staff_unavailable',
            message: 'Fatima Ali is not available at this time due to an existing booking (2:00 PM - 3:00 PM).',
            messageAr: 'فاطمة علي غير متاحة في هذا الوقت بسبب حجز آخر (2:00 م - 3:00 م).',
            actionableGuidance: 'Please select a different professional or pick another time.',
            actionableGuidanceAr: 'يرجى اختيار موظف آخر أو تحديد وقت بديل.',
            conflicts: [{ type: 'staff_unavailable', staffName: 'Fatima Ali' }],
            conflictDetails: { staffId: 'staff-fatima' }
        };

        bookingService.evaluateSchedulingRequest.mockResolvedValue(mockDecision);

        const req = {
            body: {
                tenantId: 'tenant-1',
                serviceId: 'svc-haircut',
                staffId: 'staff-fatima',
                startTime: '2026-09-22T14:30:00.000Z'
            },
            headers: {}
        };
        const res = mockResponse();

        await evaluateScheduling(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        const payload = res.json.mock.calls[0][0];

        expect(payload.message).toContain('Fatima Ali is not available');
        expect(payload.messageAr).toContain('فاطمة علي غير متاحة');
        expect(payload.decision).toBeDefined();
    });

    test('3. Different employee + occupied resource: resource is reported, selected employee is NOT blamed', async () => {
        db.Service.findByPk.mockResolvedValue({
            id: 'svc-moroccan',
            tenantId: 'tenant-1',
            duration: 60
        });

        // Staff Sarah is available, but Massage Room 1 is occupied by Fatima's appointment
        const mockDecision = {
            valid: false,
            code: 'RESOURCE_CONFLICT',
            conflictType: 'resource_occupied',
            message: 'Massage Room 1 is currently occupied by another appointment from 3:00 PM to 4:00 PM. The resource will be available again at 4:00 PM. Please choose another time.',
            messageAr: 'غرفة المساج 1 مشغولة حالياً بموعد آخر من 3:00 م إلى 4:00 م. ستكون المورد متاحة مرة أخرى في 4:00 م. يرجى اختيار وقت آخر.',
            conflicts: [{ type: 'resource_occupied', resourceName: 'Massage Room 1' }]
        };

        bookingService.evaluateSchedulingRequest.mockResolvedValue(mockDecision);

        const req = {
            body: {
                tenantId: 'tenant-1',
                serviceId: 'svc-moroccan',
                staffId: 'staff-sarah',
                startTime: '2026-09-22T15:00:00.000Z'
            },
            headers: {}
        };
        const res = mockResponse();

        await evaluateScheduling(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.message).toContain('Massage Room 1');
        expect(payload.message).not.toContain('Sarah Smith is not available');
        expect(payload.messageAr).not.toContain('سارة سميث غير متاحة');
    });

    test('4. MULTIPLE conflicts: both staff and resource constraints reported', async () => {
        db.Service.findByPk.mockResolvedValue({
            id: 'svc-moroccan',
            tenantId: 'tenant-1',
            duration: 60
        });

        const mockDecision = {
            valid: false,
            code: 'MULTIPLE_CONFLICTS',
            conflictType: 'multiple_conflicts',
            message: 'Multiple conflicts prevent booking: Fatima Ali has an existing booking and Massage Room 1 is occupied.',
            messageAr: 'توجد تعارضات متعددة تمنع الحجز: فاطمة علي لديها حجز آخر وغرفة المساج 1 مشغولة.',
            conflicts: [
                { type: 'staff_unavailable', staffName: 'Fatima Ali' },
                { type: 'resource_occupied', resourceName: 'Massage Room 1' }
            ]
        };

        bookingService.evaluateSchedulingRequest.mockResolvedValue(mockDecision);

        const req = {
            body: {
                tenantId: 'tenant-1',
                serviceId: 'svc-moroccan',
                staffId: 'staff-fatima',
                startTime: '2026-09-22T15:00:00.000Z'
            },
            headers: {}
        };
        const res = mockResponse();

        await evaluateScheduling(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.conflicts).toHaveLength(2);
        expect(payload.message).toContain('Multiple conflicts');
    });

    describe('Tenant Identity & Authentication Context Contract', () => {
        test('5. Valid evaluation succeeds when tenantId is provided via authenticated req.tenantId (omitted from body)', async () => {
            db.Service.findByPk.mockResolvedValue({
                id: 'svc-facial',
                tenantId: 'tenant-auth-123',
                duration: 45
            });

            bookingService.evaluateSchedulingRequest.mockResolvedValue({
                valid: true,
                code: 'SCHEDULING_VALID',
                message: 'Available'
            });

            const req = {
                tenantId: 'tenant-auth-123',
                body: {
                    // tenantId omitted from body
                    serviceId: 'svc-facial',
                    staffId: 'staff-1',
                    startTime: '2026-12-16T10:00:00.000Z',
                    duration: 45
                },
                headers: {}
            };
            const res = mockResponse();

            await evaluateScheduling(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(bookingService.evaluateSchedulingRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-auth-123',
                    serviceId: 'svc-facial',
                    startTime: '2026-12-16T10:00:00.000Z'
                })
            );
        });

        test('6. Rejects with 403 if req.tenantId does not match body tenantId (cross-tenant spoofing prevention)', async () => {
            const req = {
                tenantId: 'tenant-real',
                body: {
                    tenantId: 'tenant-attacker',
                    serviceId: 'svc-facial',
                    startTime: '2026-12-16T10:00:00.000Z'
                },
                headers: {}
            };
            const res = mockResponse();

            await evaluateScheduling(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Unauthorized tenant access'
                })
            );
        });

        test('7. Fallback resolves tenantId from service if omitted from both token and body', async () => {
            db.Service.findByPk.mockResolvedValue({
                id: 'svc-fallback',
                tenantId: 'tenant-from-service',
                duration: 30
            });

            bookingService.evaluateSchedulingRequest.mockResolvedValue({
                valid: true,
                code: 'SCHEDULING_VALID',
                message: 'Available'
            });

            const req = {
                body: {
                    serviceId: 'svc-fallback',
                    startTime: '2026-12-16T14:00:00.000Z'
                },
                headers: {}
            };
            const res = mockResponse();

            await evaluateScheduling(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(bookingService.evaluateSchedulingRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-from-service',
                    serviceId: 'svc-fallback'
                })
            );
        });

        test('8. Rejects with 400 if service/package or startTime is missing', async () => {
            const reqMissingTime = {
                tenantId: 'tenant-1',
                body: {
                    serviceId: 'svc-1'
                    // startTime missing
                },
                headers: {}
            };
            const res1 = mockResponse();
            await evaluateScheduling(reqMissingTime, res1);
            expect(res1.status).toHaveBeenCalledWith(400);

            const reqMissingService = {
                tenantId: 'tenant-1',
                body: {
                    startTime: '2026-12-16T10:00:00.000Z'
                    // serviceId and packageId missing
                },
                headers: {}
            };
            const res2 = mockResponse();
            await evaluateScheduling(reqMissingService, res2);
            expect(res2.status).toHaveBeenCalledWith(400);
        });

        test('9. Rejects with 400 if tenantId cannot be determined (unauthenticated and service not found)', async () => {
            db.Service.findByPk.mockResolvedValue(null);

            const req = {
                body: {
                    serviceId: 'svc-nonexistent',
                    startTime: '2026-12-16T10:00:00.000Z'
                },
                headers: {}
            };
            const res = mockResponse();

            await evaluateScheduling(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'tenantId, serviceId or packageId, and startTime are required'
                })
            );
        });
    });
});

