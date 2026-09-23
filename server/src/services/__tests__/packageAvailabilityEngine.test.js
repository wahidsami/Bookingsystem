const availabilityService = require('../availabilityService');
const db = require('../../models');

jest.mock('../../models', () => {
    return {
        ServicePackage: {
            findOne: jest.fn(),
            findByPk: jest.fn()
        },
        ServicePackageItem: {},
        Package: {
            findOne: jest.fn(),
            findByPk: jest.fn()
        },
        PackageItem: {},
        Tenant: {
            findByPk: jest.fn()
        },
        TenantSettings: {
            findOne: jest.fn()
        },
        Resource: {
            count: jest.fn()
        },
        Service: {
            findByPk: jest.fn()
        }
    };
});

// Mock resource requirement resolver
jest.mock('../../utils/resourceRequirementResolver', () => ({
    resolveServiceResourceRequirements: jest.fn()
}));

const { resolveServiceResourceRequirements } = require('../../utils/resourceRequirementResolver');

describe('Authoritative Package Availability Engine Tests', () => {
    const tenantId = 'tenant-test-1';
    const packageId = 'pkg-bundle-123';
    const date = '2026-09-24';

    beforeEach(() => {
        jest.clearAllMocks();
        // Default tenant: open every day
        db.Tenant.findByPk.mockResolvedValue({
            id: tenantId,
            workingHours: {
                thursday: { isOpen: true, open: '09:00', close: '22:00' }
            }
        });

        // Default tenant settings
        db.TenantSettings.findOne.mockResolvedValue({
            tenantId,
            bookingSettings: { slotInterval: 30, allowAnyStaff: true }
        });
    });

    describe('A. Sequence Bundle Tests', () => {
        test('Full sequence bundle fits when contiguous child slots exist (Any Professional)', async () => {
            const mockPackage = {
                id: packageId,
                name_en: 'Bridal Sequence Package',
                name_ar: 'باقة العروس التتابعية',
                isActive: true,
                scheduleType: 'sequence',
                totalDuration: 60,
                items: [
                    {
                        serviceId: 'srv-1',
                        duration: 30,
                        sequenceOrder: 1,
                        service: { id: 'srv-1', name_en: 'Hair Styling', duration: 30 }
                    },
                    {
                        serviceId: 'srv-2',
                        duration: 30,
                        sequenceOrder: 2,
                        service: { id: 'srv-2', name_en: 'Makeup', duration: 30 }
                    }
                ]
            };

            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            // Mock getAvailableSlots for child services:
            // Srv-1 at 10:00-10:30 and 11:00-11:30
            // Srv-2 at 10:30-11:00 and 12:00-12:30
            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId }) => {
                if (serviceId === 'srv-1') {
                    return {
                        slots: [
                            { startTime: '2026-09-24T10:00:00.000Z', endTime: '2026-09-24T10:30:00.000Z', available: true, staffId: 'staff-1', staffName: 'Sara' },
                            { startTime: '2026-09-24T11:00:00.000Z', endTime: '2026-09-24T11:30:00.000Z', available: true, staffId: 'staff-1', staffName: 'Sara' }
                        ]
                    };
                }
                if (serviceId === 'srv-2') {
                    return {
                        slots: [
                            { startTime: '2026-09-24T10:30:00.000Z', endTime: '2026-09-24T11:00:00.000Z', available: true, staffId: 'staff-2', staffName: 'Mona' },
                            { startTime: '2026-09-24T12:00:00.000Z', endTime: '2026-09-24T12:30:00.000Z', available: true, staffId: 'staff-2', staffName: 'Mona' }
                        ]
                    };
                }
                return { slots: [] };
            });

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId,
                date,
                staffId: null
            });

            expect(result.slots).toBeDefined();
            expect(result.slots.length).toBe(1);
            expect(result.slots[0].startTime).toBe('2026-09-24T10:00:00.000Z');
            expect(result.slots[0].endTime).toBe('2026-09-24T11:00:00.000Z');
            expect(result.slots[0].scheduleType).toBe('sequence');
            expect(result.slots[0].steps).toHaveLength(2);
            expect(result.slots[0].steps[0].staffId).toBe('staff-1');
            expect(result.slots[0].steps[1].staffId).toBe('staff-2');
            expect(result.availableSlots).toBe(1);
        });

        test('Explicit preferred professional: requests child service slots with selected staffId', async () => {
            const mockPackage = {
                id: packageId,
                isActive: true,
                scheduleType: 'sequence',
                totalDuration: 60,
                items: [
                    { serviceId: 'srv-1', duration: 30, service: { id: 'srv-1', duration: 30 } },
                    { serviceId: 'srv-2', duration: 30, service: { id: 'srv-2', duration: 30 } }
                ]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const requestedStaffId = 'staff-vip-99';
            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId, staffId }) => {
                expect(staffId).toBe(requestedStaffId);
                return {
                    slots: [
                        {
                            startTime: serviceId === 'srv-1' ? '2026-09-24T10:00:00.000Z' : '2026-09-24T10:30:00.000Z',
                            endTime: serviceId === 'srv-1' ? '2026-09-24T10:30:00.000Z' : '2026-09-24T11:00:00.000Z',
                            available: true,
                            staffId: requestedStaffId,
                            staffName: 'VIP Specialist'
                        }
                    ]
                };
            });

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId,
                date,
                staffId: requestedStaffId
            });

            expect(result.slots).toHaveLength(1);
            expect(result.slots[0].staffId).toBe(requestedStaffId);
            expect(result.slots[0].steps[0].staffId).toBe(requestedStaffId);
            expect(result.slots[0].steps[1].staffId).toBe(requestedStaffId);
        });

        test('Returns 0 slots if child steps are separated and cannot form a contiguous chain (package cannot fit)', async () => {
            const mockPackage = {
                id: packageId,
                isActive: true,
                scheduleType: 'sequence',
                totalDuration: 60,
                items: [
                    { serviceId: 'srv-1', duration: 30, service: { id: 'srv-1', duration: 30 } },
                    { serviceId: 'srv-2', duration: 30, service: { id: 'srv-2', duration: 30 } }
                ]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId }) => {
                if (serviceId === 'srv-1') {
                    return {
                        slots: [
                            { startTime: '2026-09-24T10:00:00.000Z', endTime: '2026-09-24T10:30:00.000Z', available: true }
                        ]
                    };
                }
                if (serviceId === 'srv-2') {
                    // Srv-2 starts at 11:30 (1 hour gap -> exceeds 5 minute buffer)
                    return {
                        slots: [
                            { startTime: '2026-09-24T11:30:00.000Z', endTime: '2026-09-24T12:00:00.000Z', available: true }
                        ]
                    };
                }
                return { slots: [] };
            });

            const result = await availabilityService.getPackageAvailableSlots(tenantId, { packageId, date });
            expect(result.slots).toHaveLength(0);
            expect(result.availableSlots).toBe(0);
        });

        test('Returns 0 slots when one child service has zero available slots (child step unavailable)', async () => {
            const mockPackage = {
                id: packageId,
                isActive: true,
                scheduleType: 'sequence',
                items: [
                    { serviceId: 'srv-1', service: { id: 'srv-1' } },
                    { serviceId: 'srv-2', service: { id: 'srv-2' } }
                ]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId }) => {
                if (serviceId === 'srv-1') {
                    return { slots: [{ startTime: '2026-09-24T10:00:00.000Z', endTime: '2026-09-24T10:30:00.000Z', available: true }] };
                }
                return { slots: [] }; // srv-2 unavailable
            });

            const result = await availabilityService.getPackageAvailableSlots(tenantId, { packageId, date });
            expect(result.slots).toHaveLength(0);
            expect(result.availableSlots).toBe(0);
            expect(result.diagnostics[0].code).toBe('CHILD_STEP_UNAVAILABLE');
        });
    });

    describe('B. Parallel Bundle Tests', () => {
        test('Parallel bundle fits when all child services are available at the same startTime with distinct staff', async () => {
            const mockPackage = {
                id: 'pkg-parallel-1',
                isActive: true,
                scheduleType: 'parallel',
                totalDuration: 45,
                items: [
                    { serviceId: 'srv-p1', duration: 45, service: { id: 'srv-p1', name_en: 'Express Manicure', duration: 45 } },
                    { serviceId: 'srv-p2', duration: 45, service: { id: 'srv-p2', name_en: 'Express Pedicure', duration: 45 } }
                ]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId }) => {
                if (serviceId === 'srv-p1') {
                    return {
                        slots: [
                            { startTime: '2026-09-24T14:00:00.000Z', endTime: '2026-09-24T14:45:00.000Z', available: true, staffId: 'staff-tech-1', staffName: 'Noura' }
                        ]
                    };
                }
                if (serviceId === 'srv-p2') {
                    return {
                        slots: [
                            { startTime: '2026-09-24T14:00:00.000Z', endTime: '2026-09-24T14:45:00.000Z', available: true, staffId: 'staff-tech-2', staffName: 'Reem' }
                        ]
                    };
                }
                return { slots: [] };
            });

            // No resource requirements
            resolveServiceResourceRequirements.mockResolvedValue([]);

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId: 'pkg-parallel-1',
                date
            });

            expect(result.slots).toHaveLength(1);
            expect(result.slots[0].startTime).toBe('2026-09-24T14:00:00.000Z');
            expect(result.slots[0].scheduleType).toBe('parallel');
            expect(result.slots[0].steps).toHaveLength(2);
            expect(result.slots[0].steps[0].staffId).toBe('staff-tech-1');
            expect(result.slots[0].steps[1].staffId).toBe('staff-tech-2');
        });

        test('Rejects parallel bundle slot if the same staff member is assigned to both concurrent steps and no alternative exists', async () => {
            const mockPackage = {
                id: 'pkg-parallel-conflict',
                isActive: true,
                scheduleType: 'parallel',
                totalDuration: 45,
                items: [
                    { serviceId: 'srv-p1', duration: 45, service: { id: 'srv-p1', duration: 45 } },
                    { serviceId: 'srv-p2', duration: 45, service: { id: 'srv-p2', duration: 45 } }
                ]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId }) => {
                // Both steps only have staff-only-1 available at 14:00
                return {
                    slots: [
                        { startTime: '2026-09-24T14:00:00.000Z', endTime: '2026-09-24T14:45:00.000Z', available: true, staffId: 'staff-only-1' }
                    ]
                };
            });

            resolveServiceResourceRequirements.mockResolvedValue([]);

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId: 'pkg-parallel-conflict',
                date
            });

            expect(result.slots).toHaveLength(0);
            expect(result.availableSlots).toBe(0);
        });

        test('Rejects parallel bundle slot if concurrent resource requirement exceeds active capacity', async () => {
            const mockPackage = {
                id: 'pkg-parallel-res',
                isActive: true,
                scheduleType: 'parallel',
                totalDuration: 45,
                items: [
                    { serviceId: 'srv-p1', duration: 45, service: { id: 'srv-p1', duration: 45 } },
                    { serviceId: 'srv-p2', duration: 45, service: { id: 'srv-p2', duration: 45 } }
                ]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId }) => {
                return {
                    slots: [
                        {
                            startTime: '2026-09-24T14:00:00.000Z',
                            endTime: '2026-09-24T14:45:00.000Z',
                            available: true,
                            staffId: serviceId === 'srv-p1' ? 'staff-1' : 'staff-2'
                        }
                    ]
                };
            });

            // Each service requires 1 Spa Bed (resourceTypeId: 'res-type-bed') -> total 2 needed simultaneously
            resolveServiceResourceRequirements.mockImplementation(async (sId) => [
                { resourceTypeId: 'res-type-bed', quantity: 1 }
            ]);

            // But salon only has 1 active Bed in total
            db.Resource.count.mockResolvedValue(1);

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId: 'pkg-parallel-res',
                date
            });

            // Should reject the slot because total 2 beds are needed concurrently
            expect(result.slots).toHaveLength(0);
            expect(result.availableSlots).toBe(0);
        });

        test('Scenario A: Parallel + Any Professional + two overlapping qualified staff -> assigns distinct staff and returns valid slot', async () => {
            const mockPackage = {
                id: 'pkg-parallel-overlap',
                isActive: true,
                scheduleType: 'parallel',
                totalDuration: 45,
                items: [
                    { serviceId: 'srv-p1', duration: 45, service: { id: 'srv-p1', name_en: 'Service 1', duration: 45 } },
                    { serviceId: 'srv-p2', duration: 45, service: { id: 'srv-p2', name_en: 'Service 2', duration: 45 } }
                ]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId, includeAllCandidates }) => {
                expect(includeAllCandidates).toBe(true);
                // Both services have both Staff Alpha and Staff Gamma available at 14:00
                return {
                    slots: [
                        { startTime: '2026-09-24T14:00:00.000Z', endTime: '2026-09-24T14:45:00.000Z', available: true, staffId: 'staff-alpha', staffName: 'Staff Alpha' }
                    ],
                    allCandidatesByTime: {
                        '2026-09-24T14:00:00.000Z': [
                            { startTime: '2026-09-24T14:00:00.000Z', endTime: '2026-09-24T14:45:00.000Z', available: true, staffId: 'staff-alpha', staffName: 'Staff Alpha' },
                            { startTime: '2026-09-24T14:00:00.000Z', endTime: '2026-09-24T14:45:00.000Z', available: true, staffId: 'staff-gamma', staffName: 'Staff Gamma' }
                        ]
                    }
                };
            });

            resolveServiceResourceRequirements.mockResolvedValue([]);

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId: 'pkg-parallel-overlap',
                date,
                staffId: null
            });

            expect(result.slots).toHaveLength(1);
            expect(result.slots[0].steps).toHaveLength(2);
            expect(result.slots[0].steps[0].staffId).toBeTruthy();
            expect(result.slots[0].steps[1].staffId).toBeTruthy();
            expect(result.slots[0].steps[0].staffId).not.toBe(result.slots[0].steps[1].staffId);
            const assigned = [result.slots[0].steps[0].staffId, result.slots[0].steps[1].staffId];
            expect(assigned).toContain('staff-alpha');
            expect(assigned).toContain('staff-gamma');
        });

        test('Scenario D: Parallel + explicit single staff selection -> returns 0 slots if single staff cannot do concurrent services', async () => {
            const mockPackage = {
                id: 'pkg-parallel-explicit',
                isActive: true,
                scheduleType: 'parallel',
                totalDuration: 45,
                items: [
                    { serviceId: 'srv-p1', duration: 45, service: { id: 'srv-p1', duration: 45 } },
                    { serviceId: 'srv-p2', duration: 45, service: { id: 'srv-p2', duration: 45 } }
                ]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const explicitStaff = 'staff-single-solo';
            const spyGetSlots = jest.spyOn(availabilityService, 'getAvailableSlots');
            spyGetSlots.mockImplementation(async (tId, { serviceId, staffId }) => {
                expect(staffId).toBe(explicitStaff);
                return {
                    slots: [
                        { startTime: '2026-09-24T14:00:00.000Z', endTime: '2026-09-24T14:45:00.000Z', available: true, staffId: explicitStaff, staffName: 'Solo Specialist' }
                    ]
                };
            });

            resolveServiceResourceRequirements.mockResolvedValue([]);

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId: 'pkg-parallel-explicit',
                date,
                staffId: explicitStaff
            });

            expect(result.slots).toHaveLength(0);
            expect(result.availableSlots).toBe(0);
        });
    });

    describe('C. Day Status Tests', () => {
        test('Tenant closed day returns 0 slots and status "day-off"', async () => {
            // Configure tenant as closed on Thursday
            db.Tenant.findByPk.mockResolvedValue({
                id: tenantId,
                workingHours: {
                    thursday: { isOpen: false }
                }
            });

            const mockPackage = {
                id: packageId,
                isActive: true,
                scheduleType: 'sequence',
                items: [{ serviceId: 'srv-1', service: { id: 'srv-1' } }]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId,
                date
            });

            expect(result.slots).toHaveLength(0);
            expect(result.metadata.status).toBe('day-off');
            expect(result.diagnostics[0].code).toBe('TENANT_CLOSED');
        });

        test('Tenant open but zero feasible bundle slots -> 0 slots and status "full"', async () => {
            db.Tenant.findByPk.mockResolvedValue({
                id: tenantId,
                workingHours: {
                    thursday: { isOpen: true, open: '09:00', close: '22:00' }
                }
            });

            const mockPackage = {
                id: packageId,
                isActive: true,
                scheduleType: 'sequence',
                items: [{ serviceId: 'srv-1', service: { id: 'srv-1' } }]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            // Child service has 0 slots
            jest.spyOn(availabilityService, 'getAvailableSlots').mockResolvedValue({ slots: [] });

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId,
                date
            });

            expect(result.slots).toHaveLength(0);
            expect(result.availableSlots).toBe(0);
            // Day status is NOT day-off (tenant is open)
            expect(result.metadata?.status).not.toBe('day-off');
        });

        test('Tenant open with feasible bundle slots -> availableSlots > 0', async () => {
            db.Tenant.findByPk.mockResolvedValue({
                id: tenantId,
                workingHours: {
                    thursday: { isOpen: true, open: '09:00', close: '22:00' }
                }
            });

            const mockPackage = {
                id: packageId,
                isActive: true,
                scheduleType: 'sequence',
                totalDuration: 30,
                items: [{ serviceId: 'srv-1', duration: 30, service: { id: 'srv-1', duration: 30 } }]
            };
            db.ServicePackage.findOne.mockResolvedValue(mockPackage);

            jest.spyOn(availabilityService, 'getAvailableSlots').mockResolvedValue({
                slots: [
                    { startTime: '2026-09-24T10:00:00.000Z', endTime: '2026-09-24T10:30:00.000Z', available: true, staffId: 's-1' }
                ]
            });

            const result = await availabilityService.getPackageAvailableSlots(tenantId, {
                packageId,
                date
            });

            expect(result.slots).toHaveLength(1);
            expect(result.availableSlots).toBe(1);
        });
    });

    describe('D. Controller Endpoints and Fallback Handling', () => {
        const bookingController = require('../../controllers/bookingController');

        test('searchAvailability delegates to getPackageAvailableSlots when packageId is passed', async () => {
            const req = {
                body: { tenantId, packageId, date }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            const spyGetPkgSlots = jest.spyOn(availabilityService, 'getPackageAvailableSlots').mockResolvedValue({
                slots: [{ startTime: '2026-09-24T10:00:00.000Z', endTime: '2026-09-24T11:00:00.000Z', available: true }],
                totalSlots: 1,
                availableSlots: 1,
                date,
                package: { id: packageId, scheduleType: 'sequence' }
            });

            await bookingController.searchAvailability(req, res);

            expect(spyGetPkgSlots).toHaveBeenCalledWith(tenantId, expect.objectContaining({ packageId, date }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                slots: expect.any(Array),
                availableSlots: 1
            }));
        });

        test('searchAvailability falls back to package lookup when serviceId is not a service but a package UUID', async () => {
            const req = {
                body: { tenantId, serviceId: packageId, date }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            db.Service.findByPk.mockResolvedValue(null);
            db.ServicePackage.findByPk.mockResolvedValue({ id: packageId, tenantId });

            const spyGetPkgSlots = jest.spyOn(availabilityService, 'getPackageAvailableSlots').mockResolvedValue({
                slots: [{ startTime: '2026-09-24T10:00:00.000Z', endTime: '2026-09-24T11:00:00.000Z', available: true }],
                totalSlots: 1,
                availableSlots: 1,
                date,
                package: { id: packageId, scheduleType: 'sequence' }
            });

            await bookingController.searchAvailability(req, res);

            expect(spyGetPkgSlots).toHaveBeenCalledWith(tenantId, expect.objectContaining({ packageId, date }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                slots: expect.any(Array)
            }));
        });

        test('searchPackageAvailability accepts packageId directly and returns slots', async () => {
            const req = {
                body: { tenantId, packageId, date }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            jest.spyOn(availabilityService, 'getPackageAvailableSlots').mockResolvedValue({
                slots: [{ startTime: '2026-09-24T10:00:00.000Z', endTime: '2026-09-24T11:00:00.000Z', available: true }],
                totalSlots: 1,
                availableSlots: 1,
                date,
                package: { id: packageId, scheduleType: 'sequence' }
            });

            await bookingController.searchPackageAvailability(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                totalSlots: 1
            }));
        });
    });

    describe('E. Single-Service & Regression Invariants', () => {
        test('Scenario F: Ordinary single-service Any Professional does not return allCandidatesByTime when includeAllCandidates is omitted', async () => {
            if (availabilityService.getAvailableSlots.mockRestore) {
                availabilityService.getAvailableSlots.mockRestore();
            }

            const mockService = { id: 'srv-single-1', tenantId, duration: 30 };
            db.Service.findByPk.mockResolvedValue(mockService);
            resolveServiceResourceRequirements.mockResolvedValue([]);

            // Mock _getSlotsForAnyStaff directly to check parameter pass-through
            const spyAnyStaff = jest.spyOn(availabilityService, '_getSlotsForAnyStaff').mockResolvedValue({
                slots: [{ startTime: '2026-09-24T10:00:00.000Z', endTime: '2026-09-24T10:30:00.000Z', available: true, staffId: 'staff-1' }],
                metadata: { totalSlots: 1, availableSlots: 1 }
            });

            const res = await availabilityService.getAvailableSlots(tenantId, {
                serviceId: 'srv-single-1',
                staffId: null,
                date
            });

            expect(spyAnyStaff).toHaveBeenCalledWith(
                tenantId,
                'srv-single-1',
                date,
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                expect.any(String),
                null,
                undefined,
                expect.anything(),
                false // includeAllCandidates defaults to false!
            );
            expect(res.allCandidatesByTime).toBeUndefined();
            expect(res.slots).toHaveLength(1);
        });
    });
});
