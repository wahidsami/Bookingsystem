const tenantBundleController = require('../tenantBundleController');
const bookingService = require('../../services/bookingService');
const db = require('../../models');

jest.mock('../../models', () => {
    return {
        sequelize: {
            transaction: jest.fn()
        },
        ServicePackage: {
            findOne: jest.fn(),
            findAll: jest.fn()
        },
        ServicePackageItem: {
            findAll: jest.fn(),
            create: jest.fn()
        },
        Service: {
            findAll: jest.fn(),
            findByPk: jest.fn()
        },
        Staff: {},
        TenantServiceCategory: {
            findOne: jest.fn()
        },
        Appointment: {
            count: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn().mockResolvedValue([])
        },
        PlatformUser: {
            findByPk: jest.fn()
        },
        BookingSession: {
            create: jest.fn().mockResolvedValue({
                id: 'sess-1',
                bookingReference: 'BKG-TEST-1',
                itemCount: 0,
                subtotal: 0,
                taxAmount: 0,
                platformFee: 0,
                totalAmount: 0,
                save: jest.fn().mockResolvedValue(true)
            }),
            findByPk: jest.fn().mockResolvedValue({
                id: 'sess-1',
                bookingReference: 'BKG-TEST-1',
                itemCount: 1,
                subtotal: 150,
                taxAmount: 0,
                platformFee: 0,
                totalAmount: 150,
                save: jest.fn().mockResolvedValue(true),
                update: jest.fn().mockResolvedValue(true)
            }),
            generateBookingReference: jest.fn().mockResolvedValue('BKG-TEST-1')
        }
    };
});

describe('Bundle Safe Editing & Historical Integrity (9 Safety Tests)', () => {
    let req, res, mockTransaction, mockBundle, mockService1, mockService2;

    beforeEach(() => {
        jest.clearAllMocks();

        mockTransaction = {
            commit: jest.fn().mockResolvedValue(null),
            rollback: jest.fn().mockResolvedValue(null),
            finished: false
        };
        db.sequelize.transaction.mockResolvedValue(mockTransaction);

        mockBundle = {
            id: 'bundle-uuid-1',
            tenantId: 'tenant-123',
            name_en: 'Original Bundle',
            name_ar: 'باقة أصلية',
            description_en: 'Old description',
            description_ar: 'وصف قديم',
            tenantServiceCategoryId: 'cat-uncategorized',
            scheduleType: 'sequence',
            pricingType: 'service',
            totalPrice: 150,
            totalDuration: 60,
            isActive: true,
            save: jest.fn().mockResolvedValue(true)
        };

        mockService1 = {
            id: 'srv-1',
            tenantId: 'tenant-123',
            rawPrice: 100,
            finalPrice: 100,
            duration: 30
        };

        mockService2 = {
            id: 'srv-2',
            tenantId: 'tenant-123',
            rawPrice: 50,
            finalPrice: 50,
            duration: 30
        };

        db.Service.findAll.mockResolvedValue([mockService1, mockService2]);
        db.Service.findByPk.mockImplementation((id) => {
            if (id === 'srv-1') return Promise.resolve(mockService1);
            if (id === 'srv-2') return Promise.resolve(mockService2);
            return Promise.resolve(null);
        });

        db.TenantServiceCategory.findOne.mockResolvedValue({ id: 'cat-bundles', tenantId: 'tenant-123' });
        db.ServicePackage.findOne.mockResolvedValue(mockBundle);

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    test('1. Metadata-only edit with historical package item -> succeeds', async () => {
        const existingItem1 = {
            id: 'pkg-item-1',
            packageId: 'bundle-uuid-1',
            serviceId: 'srv-1',
            variantId: null,
            sequenceOrder: 0,
            isActive: true,
            save: jest.fn().mockResolvedValue(true),
            destroy: jest.fn()
        };
        db.ServicePackageItem.findAll.mockResolvedValue([existingItem1]);
        db.Appointment.count.mockResolvedValue(3); // historically booked

        req = {
            params: { id: 'bundle-uuid-1' },
            tenantId: 'tenant-123',
            body: {
                tenantServiceCategoryId: 'cat-bundles',
                description_en: 'Updated Category and description',
                items: JSON.stringify([{ serviceId: 'srv-1', sequenceOrder: 0 }])
            }
        };

        await tenantBundleController.updateBundle(req, res);

        expect(res.status).not.toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalled();
        expect(res.json.mock.calls[0][0].success).toBe(true);
        expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('2. Existing active item keeps same ID', async () => {
        const existingItem1 = {
            id: 'pkg-item-1',
            packageId: 'bundle-uuid-1',
            serviceId: 'srv-1',
            variantId: null,
            sequenceOrder: 0,
            isActive: true,
            save: jest.fn().mockResolvedValue(true),
            destroy: jest.fn()
        };
        db.ServicePackageItem.findAll.mockResolvedValue([existingItem1]);

        req = {
            params: { id: 'bundle-uuid-1' },
            tenantId: 'tenant-123',
            body: {
                items: JSON.stringify([{ id: 'pkg-item-1', serviceId: 'srv-1', sequenceOrder: 0 }])
            }
        };

        await tenantBundleController.updateBundle(req, res);

        expect(existingItem1.id).toBe('pkg-item-1');
        expect(existingItem1.save).toHaveBeenCalled();
        expect(existingItem1.destroy).not.toHaveBeenCalled();
    });

    test('3. New item creates a new ID', async () => {
        const existingItem1 = {
            id: 'pkg-item-1',
            packageId: 'bundle-uuid-1',
            serviceId: 'srv-1',
            variantId: null,
            sequenceOrder: 0,
            isActive: true,
            save: jest.fn().mockResolvedValue(true),
            destroy: jest.fn()
        };
        db.ServicePackageItem.findAll.mockResolvedValue([existingItem1]);
        db.ServicePackageItem.create.mockResolvedValue({ id: 'pkg-item-2-new', isActive: true });

        req = {
            params: { id: 'bundle-uuid-1' },
            tenantId: 'tenant-123',
            body: {
                items: JSON.stringify([
                    { serviceId: 'srv-1', sequenceOrder: 0 },
                    { serviceId: 'srv-2', sequenceOrder: 1 } // new item
                ])
            }
        };

        await tenantBundleController.updateBundle(req, res);

        expect(db.ServicePackageItem.create).toHaveBeenCalledWith(
            expect.objectContaining({
                packageId: 'bundle-uuid-1',
                serviceId: 'srv-2',
                sequenceOrder: 1,
                isActive: true
            }),
            expect.objectContaining({ transaction: mockTransaction })
        );
    });

    test('4. Unbooked removed item is deleted', async () => {
        const existingItem1 = {
            id: 'pkg-item-1',
            packageId: 'bundle-uuid-1',
            serviceId: 'srv-1',
            sequenceOrder: 0,
            isActive: true,
            save: jest.fn().mockResolvedValue(true),
            destroy: jest.fn()
        };
        const existingItem2 = {
            id: 'pkg-item-2-unbooked',
            packageId: 'bundle-uuid-1',
            serviceId: 'srv-2',
            sequenceOrder: 1,
            isActive: true,
            save: jest.fn().mockResolvedValue(true),
            destroy: jest.fn().mockResolvedValue(true)
        };
        db.ServicePackageItem.findAll.mockResolvedValue([existingItem1, existingItem2]);
        db.Appointment.count.mockImplementation(({ where }) => {
            if (where.packageItemId === 'pkg-item-2-unbooked') return Promise.resolve(0); // 0 appointments
            return Promise.resolve(2);
        });

        req = {
            params: { id: 'bundle-uuid-1' },
            tenantId: 'tenant-123',
            body: {
                items: JSON.stringify([{ serviceId: 'srv-1', sequenceOrder: 0 }])
            }
        };

        await tenantBundleController.updateBundle(req, res);

        expect(existingItem2.destroy).toHaveBeenCalledWith({ transaction: mockTransaction });
    });

    test('5. Historically booked removed item becomes inactive, not deleted', async () => {
        const existingItem1 = {
            id: 'pkg-item-1',
            packageId: 'bundle-uuid-1',
            serviceId: 'srv-1',
            sequenceOrder: 0,
            isActive: true,
            save: jest.fn().mockResolvedValue(true),
            destroy: jest.fn()
        };
        const existingItem2 = {
            id: 'pkg-item-2-booked',
            packageId: 'bundle-uuid-1',
            serviceId: 'srv-2',
            sequenceOrder: 1,
            isActive: true,
            save: jest.fn().mockResolvedValue(true),
            destroy: jest.fn()
        };
        db.ServicePackageItem.findAll.mockResolvedValue([existingItem1, existingItem2]);
        db.Appointment.count.mockImplementation(({ where }) => {
            if (where.packageItemId === 'pkg-item-2-booked') return Promise.resolve(5); // booked!
            return Promise.resolve(0);
        });

        req = {
            params: { id: 'bundle-uuid-1' },
            tenantId: 'tenant-123',
            body: {
                items: JSON.stringify([{ serviceId: 'srv-1', sequenceOrder: 0 }])
            }
        };

        await tenantBundleController.updateBundle(req, res);

        // Crucial verification: NOT deleted, but deactivated!
        expect(existingItem2.destroy).not.toHaveBeenCalled();
        expect(existingItem2.isActive).toBe(false);
        expect(existingItem2.save).toHaveBeenCalled();
    });

    test('6. Inactive historical item is excluded from bundle reads', async () => {
        // Mock getBundle call which includes items
        const activeItem = { id: 'item-active', serviceId: 'srv-1', sequenceOrder: 0, isActive: true };
        const bundleWithActiveOnly = {
            ...mockBundle,
            items: [activeItem]
        };
        db.ServicePackage.findOne.mockResolvedValue(bundleWithActiveOnly);

        req = {
            params: { id: 'bundle-uuid-1' },
            tenantId: 'tenant-123'
        };

        await tenantBundleController.getBundle(req, res);

        expect(res.json).toHaveBeenCalled();
        const resBundle = res.json.mock.calls[0][0].bundle;
        expect(resBundle.items).toHaveLength(1);
        expect(resBundle.items[0].id).toBe('item-active');
        expect(resBundle.items.some(it => it.isActive === false)).toBe(false);
    });

    test('7. Inactive historical item cannot be booked as a new bundle item', async () => {
        // Test Safety Rule #2 in bookingService: inactive item rejection
        db.PlatformUser.findByPk.mockResolvedValue({ id: 'usr-1', isActive: true, isBanned: false });
        const activeItems = [
            { id: 'pkg-item-active', packageId: 'bundle-uuid-1', serviceId: 'srv-1', isActive: true }
        ];
        db.ServicePackage.findOne.mockResolvedValue(mockBundle);
        db.ServicePackageItem.findAll.mockResolvedValue(activeItems);

        const bookingData = {
            platformUserId: 'usr-1',
            tenantId: 'tenant-123',
            items: [
                {
                    itemType: 'package',
                    packageId: 'bundle-uuid-1',
                    packageItems: [
                        // Client passes an inactive/historical packageItemId!
                        { serviceId: 'srv-2', packageItemId: 'pkg-item-inactive-historical' }
                    ]
                }
            ]
        };

        await expect(bookingService.createBookingSession(bookingData)).rejects.toThrow(
            /inactive or does not belong to package/
        );
    });

    test('8. Active bundle items remain bookable', async () => {
        db.PlatformUser.findByPk.mockResolvedValue({ id: 'usr-1', isActive: true, isBanned: false });
        const activeItems = [
            { id: 'pkg-item-1', packageId: 'bundle-uuid-1', serviceId: 'srv-1', isActive: true }
        ];
        db.ServicePackage.findOne.mockResolvedValue(mockBundle);
        db.ServicePackageItem.findAll.mockResolvedValue(activeItems);

        // Mock createBooking on bookingService
        const mockAppointment = { id: 'appt-1', price: 150, rawPrice: 150, taxAmount: 0, platformFee: 0 };
        jest.spyOn(bookingService, 'createBooking').mockResolvedValue(mockAppointment);
        db.BookingSession.create.mockResolvedValue({ id: 'sess-1', bookingReference: 'BKG-TEST-1' });

        const bookingData = {
            platformUserId: 'usr-1',
            tenantId: 'tenant-123',
            items: [
                {
                    itemType: 'package',
                    packageId: 'bundle-uuid-1',
                    packageItems: [
                        { serviceId: 'srv-1', packageItemId: 'pkg-item-1', startTime: '2026-09-22T15:00:00Z' }
                    ]
                }
            ]
        };

        const result = await bookingService.createBookingSession(bookingData);
        expect(result).toBeDefined();
        expect(result.appointments).toHaveLength(1);
    });

    test('9. Saving the bundle again does not reactivate historical items', async () => {
        // Currently in DB: item 1 is active, item 2 is inactive historical
        const activeItem1 = {
            id: 'pkg-item-1',
            packageId: 'bundle-uuid-1',
            serviceId: 'srv-1',
            sequenceOrder: 0,
            isActive: true,
            save: jest.fn().mockResolvedValue(true)
        };
        // The DB query findAll only returns active items
        db.ServicePackageItem.findAll.mockResolvedValue([activeItem1]);

        // Next edit: operator updates description only
        req = {
            params: { id: 'bundle-uuid-1' },
            tenantId: 'tenant-123',
            body: {
                description_en: 'Next edit description',
                items: JSON.stringify([
                    { serviceId: 'srv-1', sequenceOrder: 0 }
                ])
            }
        };

        await tenantBundleController.updateBundle(req, res);

        // Verifies ServicePackageItem.findAll was called with { isActive: true }
        expect(db.ServicePackageItem.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ isActive: true })
            })
        );
        // Active item remained active
        expect(activeItem1.save).toHaveBeenCalled();
        expect(activeItem1.isActive).toBe(true);
        // No new item created
        expect(db.ServicePackageItem.create).not.toHaveBeenCalled();
    });
});
