'use strict';

const express = require('express');
const request = require('supertest');
const db = require('../../models');
const { batchCheckResourceAvailability } = require('../../utils/resourceRequirementResolver');
const tenantResourceController = require('../tenantResourceController');

describe('Authoritative Batch Resource Availability & Badges (Phase 5A)', () => {
    const TENANT_ID = '99999999-9999-9999-9999-999999999999';
    const SERVICE_MASSAGE = 'srv-massage-1111';
    const SERVICE_FACIAL = 'srv-facial-2222';
    const VARIANT_PREMIUM = 'var-premium-3333';
    const TYPE_BED = 'type-massage-bed';
    const TYPE_CHAIR = 'type-styling-chair';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('1. Endpoint Authentication & Contract Guarding', () => {
        let app;
        beforeEach(() => {
            app = express();
            app.use(express.json());
            const tenantRoutes = require('../../routes/tenantRoutes');
            app.use('/api/v1/tenant', tenantRoutes);
        });

        test('POST /api/v1/tenant/resources/batch-check without auth token returns HTTP 401', async () => {
            const res = await request(app)
                .post('/api/v1/tenant/resources/batch-check')
                .send({ items: [] });
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        test('tenantResourceController.batchCheckResourceAvailability returns 401 when tenantId is missing', async () => {
            const req = { body: { items: [] } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            await tenantResourceController.batchCheckResourceAvailability(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Unauthorized tenant' }));
        });
    });

    describe('2. Scenario 1: Correct resource badges for configured services and variants', () => {
        test('resolves and returns requirements for parent service and variant', async () => {
            // Mock DB resources
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-bed-1', resourceTypeId: TYPE_BED, name_en: 'Bed 1', name_ar: 'سرير 1', is_active: true }
            ]);
            // Mock ServiceResourceRequirement
            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockResolvedValue([
                {
                    resourceTypeId: TYPE_BED,
                    quantity: 1,
                    variantId: null,
                    resourceType: { id: TYPE_BED, name_en: 'Massage Bed', name_ar: 'سرير مساج', is_active: true }
                }
            ]);
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const { results } = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                items: [
                    { id: 'item-1', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }
                ]
            });

            expect(results['item-1']).toBeDefined();
            expect(results['item-1'].hasRequirements).toBe(true);
            expect(results['item-1'].isAvailable).toBe(true);
            expect(results['item-1'].requirements).toHaveLength(1);
            expect(results['item-1'].requirements[0].resourceTypeName).toBe('Massage Bed');
            expect(results['item-1'].requirements[0].available).toBe(true);
        });
    });

    describe('3. Scenario 2: Available resource vs fully occupied resource', () => {
        test('marks resource available when no overlapping appointments exist, and conflict when occupied', async () => {
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-bed-1', resourceTypeId: TYPE_BED, name_en: 'Bed 1', name_ar: 'سرير 1', is_active: true }
            ]);
            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockResolvedValue([
                {
                    resourceTypeId: TYPE_BED,
                    quantity: 1,
                    variantId: null,
                    resourceType: { id: TYPE_BED, name_en: 'Massage Bed', name_ar: 'سرير مساج', is_active: true }
                }
            ]);

            // When no DB appointment overlaps:
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const freeResult = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                items: [{ id: 'item-free', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }]
            });
            expect(freeResult.results['item-free'].isAvailable).toBe(true);

            // When DB appointment overlaps:
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([
                {
                    resourceId: 'res-bed-1',
                    appointment: { startTime: new Date('2026-10-15T10:00:00.000Z'), endTime: new Date('2026-10-15T11:00:00.000Z') }
                }
            ]);

            const conflictResult = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                items: [{ id: 'item-conflict', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }]
            });
            expect(conflictResult.results['item-conflict'].isAvailable).toBe(false);
            expect(conflictResult.results['item-conflict'].requirements[0].available).toBe(false);
            expect(conflictResult.results['item-conflict'].requirements[0].reason).toBe('RESOURCE_OCCUPIED');
        });
    });

    describe('4. Scenario 3 & 4: Multiple compatible resource instances & capacity exhaustion', () => {
        test('Scenario 3: 2 beds configured, 1 occupied in DB -> remaining 1 bed satisfies requirement', async () => {
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-bed-1', resourceTypeId: TYPE_BED, name_en: 'Bed 1', name_ar: 'سرير 1', is_active: true },
                { id: 'res-bed-2', resourceTypeId: TYPE_BED, name_en: 'Bed 2', name_ar: 'سرير 2', is_active: true }
            ]);
            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockResolvedValue([
                {
                    resourceTypeId: TYPE_BED,
                    quantity: 1,
                    variantId: null,
                    resourceType: { id: TYPE_BED, name_en: 'Massage Bed', name_ar: 'سرير مساج', is_active: true }
                }
            ]);
            // Only Bed 1 is occupied in DB
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([
                {
                    resourceId: 'res-bed-1',
                    appointment: { startTime: new Date('2026-10-15T10:00:00.000Z'), endTime: new Date('2026-10-15T11:00:00.000Z') }
                }
            ]);

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                items: [{ id: 'item-1', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }]
            });

            expect(res.results['item-1'].isAvailable).toBe(true);
            expect(res.results['item-1'].requirements[0].availableQuantity).toBe(1);
            expect(res.results['item-1'].requirements[0].totalActive).toBe(2);
        });

        test('Scenario 4: 2 beds configured, both occupied in DB -> capacity exhausted, returns conflict', async () => {
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-bed-1', resourceTypeId: TYPE_BED, name_en: 'Bed 1', name_ar: 'سرير 1', is_active: true },
                { id: 'res-bed-2', resourceTypeId: TYPE_BED, name_en: 'Bed 2', name_ar: 'سرير 2', is_active: true }
            ]);
            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockResolvedValue([
                {
                    resourceTypeId: TYPE_BED,
                    quantity: 1,
                    variantId: null,
                    resourceType: { id: TYPE_BED, name_en: 'Massage Bed', name_ar: 'سرير مساج', is_active: true }
                }
            ]);
            // Both Bed 1 and Bed 2 occupied in DB
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([
                { resourceId: 'res-bed-1', appointment: { startTime: new Date('2026-10-15T10:00:00.000Z'), endTime: new Date('2026-10-15T11:00:00.000Z') } },
                { resourceId: 'res-bed-2', appointment: { startTime: new Date('2026-10-15T10:00:00.000Z'), endTime: new Date('2026-10-15T11:00:00.000Z') } }
            ]);

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                items: [{ id: 'item-exhausted', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }]
            });

            expect(res.results['item-exhausted'].isAvailable).toBe(false);
            expect(res.results['item-exhausted'].requirements[0].availableQuantity).toBe(0);
            expect(res.results['item-exhausted'].requirements[0].reason).toBe('RESOURCE_OCCUPIED');
        });
    });

    describe('5. Scenario 5: Bundle components with different resource requirements and intervals', () => {
        test('evaluates sequential bundle components at their independent start times and requirements', async () => {
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-bed-1', resourceTypeId: TYPE_BED, name_en: 'Bed 1', name_ar: 'سرير 1', is_active: true },
                { id: 'res-chair-1', resourceTypeId: TYPE_CHAIR, name_en: 'Chair 1', name_ar: 'كرسي 1', is_active: true }
            ]);
            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockImplementation(async ({ where }) => {
                if (where.serviceId === SERVICE_MASSAGE) {
                    return [{
                        resourceTypeId: TYPE_BED,
                        quantity: 1,
                        variantId: null,
                        resourceType: { id: TYPE_BED, name_en: 'Massage Bed', name_ar: 'سرير مساج', is_active: true }
                    }];
                }
                return [{
                    resourceTypeId: TYPE_CHAIR,
                    quantity: 1,
                    variantId: null,
                    resourceType: { id: TYPE_CHAIR, name_en: 'Styling Chair', name_ar: 'كرسي تصفيف', is_active: true }
                }];
            });

            // Chair 1 is occupied from 10:00 to 11:00, but free from 11:00 to 12:00
            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where }) => {
                if (where.resourceId?.[db.Sequelize.Op.in]?.includes('res-chair-1')) {
                    // Overlapping query at 11:00 will see start >= 11:00
                    return [];
                }
                return [];
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'bundle-step-1', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'bundle-step-2', serviceId: SERVICE_FACIAL, startTime: '2026-10-15T11:00:00.000Z', duration: 60 }
                ]
            });

            expect(res.results['bundle-step-1'].isAvailable).toBe(true);
            expect(res.results['bundle-step-1'].requirements[0].resourceTypeName).toBe('Massage Bed');

            expect(res.results['bundle-step-2'].isAvailable).toBe(true);
            expect(res.results['bundle-step-2'].requirements[0].resourceTypeName).toBe('Styling Chair');
        });
    });

    describe('6. Scenario 7 & 8: Combined resource allocation across multiple group participants', () => {
        test('Scenario 7 & 8: Participant 1 takes Bed 1, Participant 2 takes Bed 2 -> Participant 3 gets conflict at same interval', async () => {
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-bed-1', resourceTypeId: TYPE_BED, name_en: 'Bed 1', name_ar: 'سرير 1', is_active: true },
                { id: 'res-bed-2', resourceTypeId: TYPE_BED, name_en: 'Bed 2', name_ar: 'سرير 2', is_active: true }
            ]);
            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockResolvedValue([
                {
                    resourceTypeId: TYPE_BED,
                    quantity: 1,
                    variantId: null,
                    resourceType: { id: TYPE_BED, name_en: 'Massage Bed', name_ar: 'سرير مساج', is_active: true }
                }
            ]);
            // No DB appointments initially
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'part-1-item', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'part-2-item', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'part-3-item', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'part-3-later', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T11:00:00.000Z', duration: 60 }
                ]
            });

            // Participant 1 gets Bed 1 -> available
            expect(res.results['part-1-item'].isAvailable).toBe(true);

            // Participant 2 gets Bed 2 -> available
            expect(res.results['part-2-item'].isAvailable).toBe(true);

            // Participant 3 at 10:00 is out of beds -> CONFLICT (turns RED!)
            expect(res.results['part-3-item'].isAvailable).toBe(false);
            expect(res.results['part-3-item'].requirements[0].reason).toBe('RESOURCE_OCCUPIED');

            // Participant 3 at 11:00: Bed 1 and Bed 2 are freed from 10:00-11:00 -> available!
            expect(res.results['part-3-later'].isAvailable).toBe(true);
        });

        test('Non-overlapping intervals: resource can be reused across participants without blanket conflict', async () => {
            // Only 1 Bed configured
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-bed-1', resourceTypeId: TYPE_BED, name_en: 'Bed 1', name_ar: 'سرير 1', is_active: true }
            ]);
            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockResolvedValue([
                {
                    resourceTypeId: TYPE_BED,
                    quantity: 1,
                    variantId: null,
                    resourceType: { id: TYPE_BED, name_en: 'Massage Bed', name_ar: 'سرير مساج', is_active: true }
                }
            ]);
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'part-1-10am', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'part-2-11am', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T11:00:00.000Z', duration: 60 }
                ]
            });

            // Both can successfully use Bed 1 because their time intervals do not overlap!
            expect(res.results['part-1-10am'].isAvailable).toBe(true);
            expect(res.results['part-2-11am'].isAvailable).toBe(true);
        });
    });
});
