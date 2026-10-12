const availabilityService = require('../availabilityService');
const bookingController = require('../../controllers/bookingController');
const db = require('../../models');

jest.mock('../../models', () => {
    return {
        Tenant: { findByPk: jest.fn() },
        TenantSettings: { findOne: jest.fn() },
        ServicePackage: { findOne: jest.fn() },
        ServicePackageItem: {},
        Service: { findByPk: jest.fn() },
        Staff: { findAll: jest.fn() }
    };
});

describe('Smart Availability: getNextAvailableSlot Tests', () => {
    const tenantId = 'tenant-test-1';

    beforeEach(() => {
        jest.restoreAllMocks();
        db.TenantSettings.findOne.mockResolvedValue({
            tenantId,
            timezone: 'Asia/Riyadh'
        });
    });

    test('Scenario 1: Find next available slot for single service with Any Staff', async () => {
        jest.spyOn(availabilityService, 'getAvailableSlots').mockImplementation(async (tid, opts) => {
            if (opts.date === '2026-10-15') {
                return { slots: [{ startTime: '2026-10-15T10:00:00Z', available: false }] };
            }
            if (opts.date === '2026-10-16') {
                return {
                    slots: [
                        { startTime: '2026-10-16T11:00:00Z', available: true, staffId: 'staff-1', staffName: 'Amal' },
                        { startTime: '2026-10-16T14:00:00Z', available: true, staffId: 'staff-2', staffName: 'Sara' }
                    ]
                };
            }
            return { slots: [] };
        });

        const result = await availabilityService.getNextAvailableSlot(tenantId, {
            serviceId: 'srv-haircut',
            startDate: '2026-10-15',
            daysToSearch: 5
        });

        expect(result.success).toBe(true);
        expect(result.date).toBe('2026-10-16');
        expect(result.daysAhead).toBe(1);
        expect(result.slot.startTime).toBe('2026-10-16T11:00:00Z');
        expect(result.slots).toHaveLength(2);
    });

    test('Scenario 2: Find next available slot for package bundle with startDate', async () => {
        jest.spyOn(availabilityService, 'getPackageAvailableSlots').mockImplementation(async (tid, opts) => {
            if (opts.date === '2026-10-20') {
                return { slots: [{ startTime: '2026-10-20T10:00:00Z', available: false }] };
            }
            if (opts.date === '2026-10-21') {
                return {
                    slots: [
                        { startTime: '2026-10-21T15:00:00Z', available: true, scheduleType: 'sequence' }
                    ],
                    package: { id: 'pkg-student', name_en: 'Perfect student bundle' }
                };
            }
            return { slots: [] };
        });

        const result = await availabilityService.getNextAvailableSlot(tenantId, {
            packageId: 'pkg-student',
            startDate: '2026-10-20',
            daysToSearch: 7
        });

        expect(result.success).toBe(true);
        expect(result.date).toBe('2026-10-21');
        expect(result.daysAhead).toBe(1);
        expect(result.slot.startTime).toBe('2026-10-21T15:00:00Z');
        expect(result.package.name_en).toBe('Perfect student bundle');
    });

    test('Scenario 3: bookingController.getNextAvailableSlot handles request without staffId and passes startDate', async () => {
        jest.spyOn(availabilityService, 'getNextAvailableSlot').mockResolvedValue({
            success: true,
            date: '2026-10-18',
            slot: { startTime: '2026-10-18T09:00:00Z', available: true },
            slots: [{ startTime: '2026-10-18T09:00:00Z', available: true }]
        });

        const req = {
            query: {
                tenantId: 'tenant-123',
                serviceId: 'srv-massage',
                startDate: '2026-10-17',
                daysToSearch: '10'
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await bookingController.getNextAvailableSlot(req, res);

        expect(availabilityService.getNextAvailableSlot).toHaveBeenCalledWith('tenant-123', {
            serviceId: 'srv-massage',
            packageId: undefined,
            staffId: null,
            startDate: '2026-10-17',
            variantId: undefined,
            daysToSearch: 10
        });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            date: '2026-10-18'
        }));
    });
});
