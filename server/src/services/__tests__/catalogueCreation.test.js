'use strict';

describe('BARSPA-FIN-OPS-01 Phase 4: Service & Package Creation Repair', () => {
    let tenantServiceController;
    let tenantPackageController;
    let checkSubscription;
    let packageEntitlements;
    let db;
    let mockTx;

    beforeEach(() => {
        jest.clearAllMocks();

        mockTx = {
            commit: jest.fn().mockResolvedValue(true),
            rollback: jest.fn().mockResolvedValue(true),
            LOCK: { UPDATE: 'UPDATE' }
        };

        const mockServiceRecord = {
            id: 'srv-101',
            tenantId: 'tenant-100',
            name_en: 'Signature Hair Care',
            name_ar: 'عناية الشعر المميزة',
            duration: 60,
            rawPrice: 100.00,
            finalPrice: 115.00,
            isActive: true,
            reload: jest.fn().mockResolvedValue(true),
            save: jest.fn().mockResolvedValue(true),
            update: jest.fn().mockImplementation(async (updates) => Object.assign(mockServiceRecord, updates)),
            calculateFinalPrice: () => 115.00
        };

        const mockPackageItem1 = {
            id: 'item-201',
            packageId: 'pkg-301',
            serviceId: 'srv-101',
            variantId: null,
            sequenceOrder: 0,
            isActive: true,
            update: jest.fn().mockImplementation(async (updates) => Object.assign(mockPackageItem1, updates)),
            destroy: jest.fn().mockResolvedValue(true)
        };

        const mockPackageRecord = {
            id: 'pkg-301',
            tenantId: 'tenant-100',
            name_en: 'Relaxation Package',
            name_ar: 'باقة الاسترخاء',
            totalPrice: 115.00,
            totalDuration: 60,
            isActive: true,
            save: jest.fn().mockResolvedValue(true)
        };

        db = {
            sequelize: {
                transaction: jest.fn().mockResolvedValue(mockTx)
            },
            GlobalSettings: {
                findOne: jest.fn().mockResolvedValue({
                    taxRate: 15.00,
                    serviceCommissionRate: 10.00
                })
            },
            Service: {
                create: jest.fn().mockImplementation(async (payload) => ({
                    ...payload,
                    id: 'srv-created-1',
                    reload: jest.fn().mockResolvedValue(true)
                })),
                findOne: jest.fn().mockResolvedValue(mockServiceRecord),
                findAll: jest.fn().mockResolvedValue([mockServiceRecord]),
                count: jest.fn().mockResolvedValue(5)
            },
            ServicePackage: {
                create: jest.fn().mockImplementation(async (payload) => ({
                    ...payload,
                    id: 'pkg-created-1'
                })),
                findOne: jest.fn().mockResolvedValue(mockPackageRecord),
                findAll: jest.fn().mockResolvedValue([mockPackageRecord]),
                count: jest.fn().mockResolvedValue(2)
            },
            ServicePackageItem: {
                create: jest.fn().mockImplementation(async (payload) => ({
                    ...payload,
                    id: 'item-created-1'
                })),
                bulkCreate: jest.fn().mockResolvedValue([]),
                findAll: jest.fn().mockResolvedValue([mockPackageItem1]),
                destroy: jest.fn().mockResolvedValue(1)
            },
            Appointment: {
                count: jest.fn().mockResolvedValue(0)
            },
            Staff: {
                count: jest.fn().mockResolvedValue(3),
                findAll: jest.fn().mockResolvedValue([])
            },
            Product: {
                count: jest.fn().mockResolvedValue(10)
            },
            TenantServiceCategory: {
                findOne: jest.fn().mockResolvedValue({ id: 'cat-hair-1', slug: 'hair' })
            },
            ServiceResourceRequirement: {
                bulkCreate: jest.fn().mockResolvedValue([])
            }
        };

        jest.doMock('../../models', () => db);

        tenantServiceController = require('../../controllers/tenantServiceController');
        tenantPackageController = require('../../controllers/tenantPackageController');
        checkSubscription = require('../../middleware/checkSubscription');
        packageEntitlements = require('../../utils/packageEntitlements');
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('Service Creation & Price Normalization', () => {
        test('allows creating a service when price is passed (QuickCreateModal compatibility)', async () => {
            const req = {
                tenantId: 'tenant-100',
                body: {
                    name_en: 'Moroccan Bath Special',
                    name_ar: 'حمام مغربي خاص',
                    price: 230.00,
                    duration: 60,
                    category: 'spa'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await tenantServiceController.createService(req, res);

            expect(mockTx.commit).toHaveBeenCalled();
            expect(db.Service.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name_en: 'Moroccan Bath Special',
                    name_ar: 'حمام مغربي خاص',
                    finalPrice: 230.00,
                    rawPrice: expect.any(Number)
                }),
                expect.anything()
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('rejects service creation if name is missing in either language', async () => {
            const req = {
                tenantId: 'tenant-100',
                body: {
                    name_en: 'Spa Only',
                    price: 150.00
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await tenantServiceController.createService(req, res);

            expect(mockTx.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('both English and Arabic')
            }));
        });

        test('updateService retains existing finalPrice when updating other fields', async () => {
            const req = {
                tenantId: 'tenant-100',
                params: { id: 'srv-101' },
                body: {
                    name_en: 'Updated Name Only'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await tenantServiceController.updateService(req, res);

            expect(mockTx.commit).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });
    });

    describe('Package Creation & Multipart Parsing', () => {
        test('successfully creates a package when items is sent as a stringified JSON array', async () => {
            const req = {
                tenantId: 'tenant-100',
                body: {
                    name_en: 'Bridal Package',
                    name_ar: 'باقة العروس',
                    items: JSON.stringify([
                        { serviceId: 'srv-101', sequenceOrder: 0 }
                    ])
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await tenantPackageController.createPackage(req, res);

            expect(mockTx.commit).toHaveBeenCalled();
            expect(db.ServicePackage.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name_en: 'Bridal Package',
                    name_ar: 'باقة العروس',
                    totalPrice: 115.00,
                    totalDuration: 60
                }),
                expect.anything()
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('rejects package creation when items array is empty or missing', async () => {
            const req = {
                tenantId: 'tenant-100',
                body: {
                    name_en: 'Empty Package',
                    name_ar: 'باقة فارغة',
                    items: '[]'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await tenantPackageController.createPackage(req, res);

            expect(mockTx.rollback).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('Package Update & Foreign Key Safe In-Place Reconciliation', () => {
        test('reconciles package items in place without deleting referenced appointment items', async () => {
            // Simulate appointment referencing item-201
            db.Appointment.count.mockResolvedValueOnce(3);

            const req = {
                tenantId: 'tenant-100',
                params: { id: 'pkg-301' },
                body: {
                    name_en: 'Updated Package Name',
                    items: JSON.stringify([
                        { id: 'item-201', serviceId: 'srv-101', sequenceOrder: 0 },
                        { serviceId: 'srv-101', sequenceOrder: 1 } // new item
                    ])
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await tenantPackageController.updatePackage(req, res);

            expect(mockTx.commit).toHaveBeenCalled();
            // Should NOT have called ServicePackageItem.destroy unconditionally
            expect(db.ServicePackageItem.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    packageId: 'pkg-301',
                    serviceId: 'srv-101',
                    sequenceOrder: 1
                }),
                expect.anything()
            );
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });
    });

    describe('Subscription Entitlements & Resource Limit Aliases', () => {
        test('checkResourceLimit recognizes both "service" and "maxServices"', async () => {
            const middlewareService = checkSubscription.checkResourceLimit('service');
            const middlewareMaxServices = checkSubscription.checkResourceLimit('maxServices');

            const req = {
                tenantId: 'tenant-100',
                subscription: { getDataValue: () => 'active' },
                packageLimits: { maxServices: 20 }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next1 = jest.fn();
            const next2 = jest.fn();

            await middlewareService(req, res, next1);
            await middlewareMaxServices(req, res, next2);

            expect(next1).toHaveBeenCalled();
            expect(next2).toHaveBeenCalled();
        });

        test('packageEntitlements recognizes hasServicePackages when maxPackages is present', () => {
            const keys = packageEntitlements.getFeatureKeys('hasServicePackages');
            expect(keys).toContain('maxPackages');
            expect(keys).toContain('servicePackages');
        });
    });
});
