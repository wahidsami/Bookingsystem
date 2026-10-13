'use strict';

const express = require('express');
const request = require('supertest');
const db = require('../../models');
const { batchCheckResourceAvailability, allocateServiceResources } = require('../../utils/resourceRequirementResolver');
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

        test('Empty participant drafts consume zero capacity and do not invalidate existing draft availability', async () => {
            // Salon has 1 Bed
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

            // Baseline check with only Participant 1
            const baseline = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'part-1-item', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'cat-facial', serviceId: SERVICE_FACIAL, startTime: '2026-10-15T10:00:00.000Z', duration: 30 }
                ]
            });
            expect(baseline.results['part-1-item'].isAvailable).toBe(true);

            // Adding an empty participant (item with empty/null serviceId, or no staged item at all)
            const withEmptyParticipant = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'part-1-item', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'part-2-empty', serviceId: null, startTime: '2026-10-15T10:00:00.000Z', duration: 0 }
                ],
                catalogueItems: [
                    { id: 'cat-facial', serviceId: SERVICE_FACIAL, startTime: '2026-10-15T10:00:00.000Z', duration: 30 }
                ]
            });

            // Participant 1's availability is unchanged
            expect(withEmptyParticipant.results['part-1-item'].isAvailable).toBe(true);
            // Empty participant reports no requirements and doesn't crash or claim resources
            expect(withEmptyParticipant.results['part-2-empty'].hasRequirements).toBe(false);
            expect(withEmptyParticipant.results['part-2-empty'].isAvailable).toBe(true);
            // Catalogue item availability is identical to baseline
            expect(withEmptyParticipant.results['cat-facial'].isAvailable).toBe(baseline.results['cat-facial'].isAvailable);
        });
    });

    describe('7. allocateServiceResources interval-aware pre-allocations (Phase 5A Regression)', () => {
        test('Non-overlapping intervals: sequential session items reuse physical resources without 409 conflict', async () => {
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

            // Step 1: Allocates Bed 1 for 10:00 - 11:00
            const step1Result = await allocateServiceResources({
                tenantId: TENANT_ID,
                serviceId: SERVICE_MASSAGE,
                startTime: new Date('2026-10-15T10:00:00.000Z'),
                endTime: new Date('2026-10-15T11:00:00.000Z'),
                alreadyAllocatedResourceIds: []
            });
            expect(step1Result.required).toBe(true);
            expect(step1Result.allocations).toHaveLength(1);
            expect(step1Result.allocations[0].resourceId).toBe('res-bed-1');

            // Step 2: Next participant or sequential service at 11:00 - 12:00 passing step 1 allocation
            const step2Result = await allocateServiceResources({
                tenantId: TENANT_ID,
                serviceId: SERVICE_MASSAGE,
                startTime: new Date('2026-10-15T11:00:00.000Z'),
                endTime: new Date('2026-10-15T12:00:00.000Z'),
                alreadyAllocatedResourceIds: [
                    {
                        resourceId: 'res-bed-1',
                        startMs: new Date('2026-10-15T10:00:00.000Z').getTime(),
                        endMs: new Date('2026-10-15T11:00:00.000Z').getTime()
                    }
                ]
            });
            // Reuses Bed 1 without throwing 409 conflict!
            expect(step2Result.required).toBe(true);
            expect(step2Result.allocations).toHaveLength(1);
            expect(step2Result.allocations[0].resourceId).toBe('res-bed-1');
        });

        test('Overlapping intervals: concurrent allocation throws 409 conflict when physical capacity is exhausted', async () => {
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

            // Bed 1 already taken at 10:00 - 11:00
            const preAllocations = [
                {
                    resourceId: 'res-bed-1',
                    startMs: new Date('2026-10-15T10:00:00.000Z').getTime(),
                    endMs: new Date('2026-10-15T11:00:00.000Z').getTime()
                }
            ];

            // Concurrent request at 10:30 - 11:30 must be rejected
            await expect(allocateServiceResources({
                tenantId: TENANT_ID,
                serviceId: SERVICE_MASSAGE,
                startTime: new Date('2026-10-15T10:30:00.000Z'),
                endTime: new Date('2026-10-15T11:30:00.000Z'),
                alreadyAllocatedResourceIds: preAllocations
            })).rejects.toMatchObject({
                conflict: true,
                conflictDetails: expect.objectContaining({
                    code: 'BOOKING_CONFLICT'
                })
            });
        });
    });

    describe('8. Authoritative Capacity Counts & Independent Resources (Phase 5A Badge Counts)', () => {
        const SERVICE_PEDICURE = 'srv-pedicure-3333';
        const TYPE_PEDI = 'type-pedicure-station';

        test('Returns exact availableQuantity and totalActive for one occupied room, both occupied rooms, and independent stations', async () => {
            // Setup: 2 Massage Beds, 1 Pedicure Station
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-bed-1', resourceTypeId: TYPE_BED, name_en: 'Bed 1', name_ar: 'سرير 1', is_active: true },
                { id: 'res-bed-2', resourceTypeId: TYPE_BED, name_en: 'Bed 2', name_ar: 'سرير 2', is_active: true },
                { id: 'res-pedi-1', resourceTypeId: TYPE_PEDI, name_en: 'Pedi Station 1', name_ar: 'محطة بدكير 1', is_active: true }
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
                if (where.serviceId === SERVICE_PEDICURE) {
                    return [{
                        resourceTypeId: TYPE_PEDI,
                        quantity: 1,
                        variantId: null,
                        resourceType: { id: TYPE_PEDI, name_en: 'Pedicure Station', name_ar: 'محطة بدكير', is_active: true }
                    }];
                }
                return [];
            });

            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            // State 1: Participant 1 stages Massage at 10:00.
            // When probing at 10:00:
            // Massage Bed should have 1 available out of 2 total (1/2 available)
            // Pedicure Station should have 1 available out of 1 total (1/1 available)
            const state1 = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'p1-massage', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'cat-massage', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'cat-pedicure', serviceId: SERVICE_PEDICURE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }
                ]
            });

            const catMassage1 = state1.results['cat-massage'];
            expect(catMassage1.isAvailable).toBe(true);
            expect(catMassage1.requirements[0].availableQuantity).toBe(1);
            expect(catMassage1.requirements[0].totalActive).toBe(2);

            const catPedicure1 = state1.results['cat-pedicure'];
            expect(catPedicure1.isAvailable).toBe(true);
            expect(catPedicure1.requirements[0].availableQuantity).toBe(1);
            expect(catPedicure1.requirements[0].totalActive).toBe(1);

            // State 2: Participant 2 ALSO stages Massage at 10:00 (both massage rooms now occupied).
            // When probing at 10:00:
            // Massage Bed capacity is exhausted: 0 available out of 2 total (0/2 available) -> CONFLICT (red)
            // Pedicure Station remains independent and available: 1/1 available -> AVAILABLE (green)
            const state2 = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'p1-massage', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'p2-massage', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'cat-massage', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 },
                    { id: 'cat-pedicure', serviceId: SERVICE_PEDICURE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }
                ]
            });

            const catMassage2 = state2.results['cat-massage'];
            expect(catMassage2.isAvailable).toBe(false);
            expect(catMassage2.requirements[0].availableQuantity).toBe(0);
            expect(catMassage2.requirements[0].totalActive).toBe(2);
            expect(catMassage2.requirements[0].reason).toBe('RESOURCE_OCCUPIED');

            const catPedicure2 = state2.results['cat-pedicure'];
            expect(catPedicure2.isAvailable).toBe(true);
            expect(catPedicure2.requirements[0].availableQuantity).toBe(1);
            expect(catPedicure2.requirements[0].totalActive).toBe(1);

            // State 3: Removing Participant 2's massage restores Bed availability back to 1/2 available immediately
            const state3 = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'p1-massage', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'cat-massage', serviceId: SERVICE_MASSAGE, startTime: '2026-10-15T10:00:00.000Z', duration: 60 }
                ]
            });

            const catMassage3 = state3.results['cat-massage'];
            expect(catMassage3.isAvailable).toBe(true);
            expect(catMassage3.requirements[0].availableQuantity).toBe(1);
            expect(catMassage3.requirements[0].totalActive).toBe(2);
        });
    });

    describe('9. Authoritative Two-Room Fixture & Screenshot A/B Scenarios (Inconsistency Regression)', () => {
        const TYPE_MASSAGE_ROOM = 'type-massage-room';
        const SRV_MOROCCAN = 'srv-moroccan-massage';
        const SRV_THAI = 'srv-thai-therapy';
        const SRV_SAUNA = 'srv-sauna-session';

        beforeEach(() => {
            // Salon has exactly two physical massage rooms
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: 'res-room-1', resourceTypeId: TYPE_MASSAGE_ROOM, name_en: 'Massage Room 1', name_ar: 'غرفة مساج 1', is_active: true },
                { id: 'res-room-2', resourceTypeId: TYPE_MASSAGE_ROOM, name_en: 'Massage Room 2', name_ar: 'غرفة مساج 2', is_active: true }
            ]);

            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockImplementation(async ({ where }) => {
                // All three services require 1 massage room
                if ([SRV_MOROCCAN, SRV_THAI, SRV_SAUNA].includes(where.serviceId)) {
                    return [{
                        resourceTypeId: TYPE_MASSAGE_ROOM,
                        quantity: 1,
                        variantId: null,
                        resourceType: { id: TYPE_MASSAGE_ROOM, name_en: 'Massage rooms', name_ar: 'غرف مساج', is_active: true }
                    }];
                }
                return [];
            });
        });

        test('Case 1: Screenshot A — One queued service at 1:20 PM for 60m (queued: 2/2, candidate at 2:20 PM: 2/2)', async () => {
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'queue-1', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'cat-candidate-220', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T14:20:00.000Z', duration: 60 }
                ]
            });

            // Queued-service badge: excludes own staged allocation -> 2/2 available
            expect(res.results['queue-1'].isAvailable).toBe(true);
            expect(res.results['queue-1'].requirements[0].availableQuantity).toBe(2);
            expect(res.results['queue-1'].requirements[0].totalActive).toBe(2);

            // Catalogue candidate at 2:20 PM: queue-1 ends at 2:20 PM. Half-open rule: 14:20 < 14:20 is FALSE.
            // Queue-1 does not consume capacity at 2:20 PM -> 2/2 available
            expect(res.results['cat-candidate-220'].isAvailable).toBe(true);
            expect(res.results['cat-candidate-220'].requirements[0].availableQuantity).toBe(2);
            expect(res.results['cat-candidate-220'].requirements[0].totalActive).toBe(2);
        });

        test('Case 2: Screenshot B — Sequential queued services (1:20-2:20 and 2:20-2:50) reuse physical room (both 2/2)', async () => {
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'queue-1', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 },
                    { id: 'queue-2', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T14:20:00.000Z', duration: 30 }
                ]
            });

            // Service 1 [13:20, 14:20): excludes self; other item starts at 14:20 (no overlap) -> 2/2 available
            expect(res.results['queue-1'].isAvailable).toBe(true);
            expect(res.results['queue-1'].requirements[0].availableQuantity).toBe(2);
            expect(res.results['queue-1'].requirements[0].totalActive).toBe(2);

            // Service 2 [14:20, 14:50): excludes self; other item ends at 14:20 (no overlap) -> 2/2 available
            expect(res.results['queue-2'].isAvailable).toBe(true);
            expect(res.results['queue-2'].requirements[0].availableQuantity).toBe(2);
            expect(res.results['queue-2'].requirements[0].totalActive).toBe(2);
        });

        test('Case 3: Candidate overlapping first service (1:40 PM) receives 1/2 available', async () => {
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'queue-1', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'cat-overlap', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:40:00.000Z', duration: 60 }
                ]
            });

            // Candidate at 1:40 PM overlaps 1:20-2:20 PM -> 1 room consumed -> 1/2 available
            expect(res.results['cat-overlap'].isAvailable).toBe(true);
            expect(res.results['cat-overlap'].requirements[0].availableQuantity).toBe(1);
            expect(res.results['cat-overlap'].requirements[0].totalActive).toBe(2);
        });

        test('Case 4: Third simultaneous one-room demand detects conflict (0/2 available)', async () => {
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'queue-1', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 },
                    { id: 'queue-2', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'cat-simultaneous', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                ]
            });

            // Each queued item excludes self and sees the other -> 1/2 available
            expect(res.results['queue-1'].requirements[0].availableQuantity).toBe(1);
            expect(res.results['queue-2'].requirements[0].availableQuantity).toBe(1);

            // Candidate sees BOTH rooms occupied -> 0/2 available, conflict
            expect(res.results['cat-simultaneous'].isAvailable).toBe(false);
            expect(res.results['cat-simultaneous'].requirements[0].availableQuantity).toBe(0);
            expect(res.results['cat-simultaneous'].requirements[0].totalActive).toBe(2);
            expect(res.results['cat-simultaneous'].requirements[0].reason).toBe('RESOURCE_OCCUPIED');
        });

        test('Case 5: Variants with differing durations (Moroccan 60m vs Sauna 30m) when a 3:20 PM booking exists (1/2 vs 2/2)', async () => {
            // DB has an appointment in Room 1 from 3:20 PM to 4:20 PM (15:20 to 16:20)
            const apptStart = new Date('2026-10-15T15:20:00.000Z');
            const apptEnd = new Date('2026-10-15T16:20:00.000Z');

            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async (options) => {
                const apptWhere = options?.include?.[0]?.where;
                const ltEnd = apptWhere?.startTime?.[db.Sequelize.Op.lt];
                const gtStart = apptWhere?.endTime?.[db.Sequelize.Op.gt];
                // Overlaps if apptStart < end && apptEnd > start
                if (ltEnd && gtStart && apptStart < ltEnd && apptEnd > gtStart) {
                    return [
                        {
                            resourceId: 'res-room-1',
                            appointment: {
                                startTime: apptStart,
                                endTime: apptEnd
                            }
                        }
                    ];
                }
                return [];
            });

            // Both staged services end at 2:50 PM (14:50)
            // Candidate probe time is 2:50 PM (14:50)
            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'queue-1', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 },
                    { id: 'queue-2', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T14:20:00.000Z', duration: 30 }
                ],
                catalogueItems: [
                    // Moroccan 60m: [14:50, 15:50) -> overlaps DB booking at 15:20 -> 1/2 available!
                    { id: 'cat-moroccan', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T14:50:00.000Z', duration: 60 },
                    // Thai 60m: [14:50, 15:50) -> overlaps DB booking at 15:20 -> 1/2 available!
                    { id: 'cat-thai', serviceId: SRV_THAI, startTime: '2026-10-15T14:50:00.000Z', duration: 60 },
                    // Sauna 30m: [14:50, 15:20) -> ends at 15:20. 15:20 < 15:20 is FALSE -> NO overlap with DB booking -> 2/2 available!
                    { id: 'cat-sauna', serviceId: SRV_SAUNA, startTime: '2026-10-15T14:50:00.000Z', duration: 30 }
                ]
            });

            // Moroccan: 1 room occupied by DB appointment -> 1/2 available
            expect(res.results['cat-moroccan'].isAvailable).toBe(true);
            expect(res.results['cat-moroccan'].requirements[0].availableQuantity).toBe(1);
            expect(res.results['cat-moroccan'].requirements[0].totalActive).toBe(2);

            // Thai: 1 room occupied by DB appointment -> 1/2 available
            expect(res.results['cat-thai'].isAvailable).toBe(true);
            expect(res.results['cat-thai'].requirements[0].availableQuantity).toBe(1);
            expect(res.results['cat-thai'].requirements[0].totalActive).toBe(2);

            // Sauna: ends before DB appointment starts -> 2/2 available!
            expect(res.results['cat-sauna'].isAvailable).toBe(true);
            expect(res.results['cat-sauna'].requirements[0].availableQuantity).toBe(2);
            expect(res.results['cat-sauna'].requirements[0].totalActive).toBe(2);
        });

        test('Case 6: Adding, removing, and changing the time of queued items dynamically updates availability', async () => {
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            // Step 1: Initial state - 1 queued item at 1:20 PM
            const state1 = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'q1', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'probe-1320', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                ]
            });
            expect(state1.results['probe-1320'].requirements[0].availableQuantity).toBe(1);

            // Step 2: Change time of queued item to 3:00 PM (15:00)
            const state2 = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'q1', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T15:00:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'probe-1320', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                ]
            });
            // At 13:20, both rooms are now free!
            expect(state2.results['probe-1320'].requirements[0].availableQuantity).toBe(2);

            // Step 3: Remove queued item entirely
            const state3 = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [],
                catalogueItems: [
                    { id: 'probe-1320', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                ]
            });
            expect(state3.results['probe-1320'].requirements[0].availableQuantity).toBe(2);
        });

        test('Case 7: Controller integration endpoint correctly processes batchCheckResourceAvailability', async () => {
            jest.spyOn(db.AppointmentResource, 'findAll').mockResolvedValue([]);

            const req = {
                tenantId: TENANT_ID,
                body: {
                    stagedItems: [
                        { id: 'queue-1', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T13:20:00.000Z', duration: 60 }
                    ],
                    catalogueItems: [
                        { id: 'cat-cand', serviceId: SRV_MOROCCAN, startTime: '2026-10-15T14:20:00.000Z', duration: 60 }
                    ]
                }
            };
            const jsonMock = jest.fn();
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jsonMock
            };

            await tenantResourceController.batchCheckResourceAvailability(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                results: expect.objectContaining({
                    'queue-1': expect.objectContaining({ isAvailable: true }),
                    'cat-cand': expect.objectContaining({ isAvailable: true })
                })
            }));
        });
    });

    describe('10. Workstream B — Two-Room Fixture (Room A ends at 16:40, Room B ends at 17:05) & Boundary Semantics', () => {
        const ROOM_A = 'room-a-1111';
        const ROOM_B = 'room-b-2222';
        const TYPE_MASSAGE_ROOM = 'type-massage-room';
        const SRV_MASSAGE = 'srv-massage-60';

        beforeEach(() => {
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: ROOM_A, resourceTypeId: TYPE_MASSAGE_ROOM, name_en: 'Massage Room A', name_ar: 'غرفة مساج أ', is_active: true },
                { id: ROOM_B, resourceTypeId: TYPE_MASSAGE_ROOM, name_en: 'Massage Room B', name_ar: 'غرفة مساج ب', is_active: true }
            ]);

            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockResolvedValue([
                {
                    resourceTypeId: TYPE_MASSAGE_ROOM,
                    quantity: 1,
                    variantId: null,
                    resourceType: { id: TYPE_MASSAGE_ROOM, name_en: 'Massage rooms', name_ar: 'غرف مساج', is_active: true }
                }
            ]);
        });

        test('Case 1: Candidate at 16:40 for 60m [16:40, 17:40) correctly reports 1/2 available when Room A ends at 16:40 and Room B ends at 17:05', async () => {
            const roomAAppt = {
                resourceId: ROOM_A,
                appointment: {
                    id: 'appt-a',
                    startTime: new Date('2026-10-15T15:40:00.000Z'),
                    endTime: new Date('2026-10-15T16:40:00.000Z'),
                    status: 'confirmed'
                }
            };
            const roomBAppt = {
                resourceId: ROOM_B,
                appointment: {
                    id: 'appt-b',
                    startTime: new Date('2026-10-15T16:05:00.000Z'),
                    endTime: new Date('2026-10-15T17:05:00.000Z'),
                    status: 'confirmed'
                }
            };

            const dbAppts = [roomAAppt, roomBAppt];

            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where, include }) => {
                const apptWhere = include?.[0]?.where || {};
                const ltEnd = apptWhere.startTime?.[db.Sequelize.Op?.lt];
                const gtStart = apptWhere.endTime?.[db.Sequelize.Op?.gt];

                return dbAppts.filter(ea => {
                    const rIds = where?.resourceId?.[db.Sequelize.Op?.in] || [];
                    if (!rIds.includes(ea.resourceId)) return false;

                    const aStart = ea.appointment.startTime;
                    const aEnd = ea.appointment.endTime;

                    return (!ltEnd || aStart < ltEnd) && (!gtStart || aEnd > gtStart);
                });
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                catalogueItems: [
                    { id: 'cat-1640', serviceId: SRV_MASSAGE, startTime: '2026-10-15T16:40:00.000Z', duration: 60 }
                ]
            });

            const result1640 = res.results['cat-1640'];
            expect(result1640).toBeDefined();
            expect(result1640.isAvailable).toBe(true);
            expect(result1640.requirements[0].totalActive).toBe(2);
            expect(result1640.requirements[0].availableQuantity).toBe(1);
            expect(result1640.requirements[0].available).toBe(true);
        });

        test('Case 2: Candidate at 17:05 for 60m [17:05, 18:05) correctly reports 2/2 available when both rooms are free', async () => {
            const roomAAppt = {
                resourceId: ROOM_A,
                appointment: {
                    id: 'appt-a',
                    startTime: new Date('2026-10-15T15:40:00.000Z'),
                    endTime: new Date('2026-10-15T16:40:00.000Z'),
                    status: 'confirmed'
                }
            };
            const roomBAppt = {
                resourceId: ROOM_B,
                appointment: {
                    id: 'appt-b',
                    startTime: new Date('2026-10-15T16:05:00.000Z'),
                    endTime: new Date('2026-10-15T17:05:00.000Z'),
                    status: 'confirmed'
                }
            };

            const dbAppts = [roomAAppt, roomBAppt];

            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where, include }) => {
                const apptWhere = include?.[0]?.where || {};
                const ltEnd = apptWhere.startTime?.[db.Sequelize.Op?.lt];
                const gtStart = apptWhere.endTime?.[db.Sequelize.Op?.gt];

                return dbAppts.filter(ea => {
                    const rIds = where?.resourceId?.[db.Sequelize.Op?.in] || [];
                    if (!rIds.includes(ea.resourceId)) return false;

                    const aStart = ea.appointment.startTime;
                    const aEnd = ea.appointment.endTime;

                    return (!ltEnd || aStart < ltEnd) && (!gtStart || aEnd > gtStart);
                });
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                catalogueItems: [
                    { id: 'cat-1705', serviceId: SRV_MASSAGE, startTime: '2026-10-15T17:05:00.000Z', duration: 60 }
                ]
            });

            const result1705 = res.results['cat-1705'];
            expect(result1705.isAvailable).toBe(true);
            expect(result1705.requirements[0].totalActive).toBe(2);
            expect(result1705.requirements[0].availableQuantity).toBe(2);
            expect(result1705.requirements[0].available).toBe(true);
        });

        test('Case 3: Staged item ending at 16:40 + candidate probe at 16:40 correctly reports 1/2 available (Room B occupied in DB)', async () => {
            const roomBAppt = {
                resourceId: ROOM_B,
                appointment: {
                    id: 'appt-b',
                    startTime: new Date('2026-10-15T16:05:00.000Z'),
                    endTime: new Date('2026-10-15T17:05:00.000Z'),
                    status: 'confirmed'
                }
            };

            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where, include }) => {
                const apptWhere = include?.[0]?.where || {};
                const ltEnd = apptWhere.startTime?.[db.Sequelize.Op?.lt];
                const gtStart = apptWhere.endTime?.[db.Sequelize.Op?.gt];

                const aStart = roomBAppt.appointment.startTime;
                const aEnd = roomBAppt.appointment.endTime;

                const overlaps = (!ltEnd || aStart < ltEnd) && (!gtStart || aEnd > gtStart);
                return overlaps ? [roomBAppt] : [];
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                stagedItems: [
                    { id: 'stg-1', serviceId: SRV_MASSAGE, startTime: '2026-10-15T15:40:00.000Z', duration: 60 }
                ],
                catalogueItems: [
                    { id: 'cat-1640', serviceId: SRV_MASSAGE, startTime: '2026-10-15T16:40:00.000Z', duration: 60 }
                ]
            });

            expect(res.results['stg-1'].requirements[0].availableQuantity).toBe(1);
            expect(res.results['cat-1640'].requirements[0].availableQuantity).toBe(1);
            expect(res.results['cat-1640'].isAvailable).toBe(true);
        });

        test('Case 4: Candidate at 16:30 for 60m [16:30, 17:30) overlaps both Room A and Room B -> reports 0/2 available (conflict)', async () => {
            const roomAAppt = {
                resourceId: ROOM_A,
                appointment: {
                    id: 'appt-a',
                    startTime: new Date('2026-10-15T15:40:00.000Z'),
                    endTime: new Date('2026-10-15T16:40:00.000Z'),
                    status: 'confirmed'
                }
            };
            const roomBAppt = {
                resourceId: ROOM_B,
                appointment: {
                    id: 'appt-b',
                    startTime: new Date('2026-10-15T16:05:00.000Z'),
                    endTime: new Date('2026-10-15T17:05:00.000Z'),
                    status: 'confirmed'
                }
            };

            const dbAppts = [roomAAppt, roomBAppt];

            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where, include }) => {
                const apptWhere = include?.[0]?.where || {};
                const ltEnd = apptWhere.startTime?.[db.Sequelize.Op?.lt];
                const gtStart = apptWhere.endTime?.[db.Sequelize.Op?.gt];

                return dbAppts.filter(ea => {
                    const rIds = where?.resourceId?.[db.Sequelize.Op?.in] || [];
                    if (!rIds.includes(ea.resourceId)) return false;

                    const aStart = ea.appointment.startTime;
                    const aEnd = ea.appointment.endTime;

                    return (!ltEnd || aStart < ltEnd) && (!gtStart || aEnd > gtStart);
                });
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                catalogueItems: [
                    { id: 'cat-1630', serviceId: SRV_MASSAGE, startTime: '2026-10-15T16:30:00.000Z', duration: 60 }
                ]
            });

            const result1630 = res.results['cat-1630'];
            expect(result1630.isAvailable).toBe(false);
            expect(result1630.requirements[0].totalActive).toBe(2);
            expect(result1630.requirements[0].availableQuantity).toBe(0);
            expect(result1630.requirements[0].reason).toBe('RESOURCE_OCCUPIED');
        });
    });

    describe('11. Controlled Fixtures: Scenarios A-D (Two Massage Rooms & One Nail Station)', () => {
        const ROOM_A = 'room-a-fixture';
        const ROOM_B = 'room-b-fixture';
        const NAIL_1 = 'nail-1-fixture';
        const TYPE_MASSAGE = 'type-massage-room-fixture';
        const TYPE_NAIL = 'type-nail-station-fixture';

        const SRV_MOROCCAN_MASSAGE = 'srv-moroccan-massage-fixture';
        const SRV_THAI_THERAPY = 'srv-thai-therapy-fixture';
        const SRV_CLASSIC_MANICURE = 'srv-classic-manicure-fixture';

        beforeEach(() => {
            jest.spyOn(db.Resource, 'findAll').mockResolvedValue([
                { id: ROOM_A, tenantId: TENANT_ID, resourceTypeId: TYPE_MASSAGE, name_en: 'Massage Room A', name_ar: 'غرفة مساج أ', is_active: true },
                { id: ROOM_B, tenantId: TENANT_ID, resourceTypeId: TYPE_MASSAGE, name_en: 'Massage Room B', name_ar: 'غرفة مساج ب', is_active: true },
                { id: NAIL_1, tenantId: TENANT_ID, resourceTypeId: TYPE_NAIL, name_en: 'Nail Station 1', name_ar: 'محطة أظافر 1', is_active: true }
            ]);

            jest.spyOn(db.ServiceResourceRequirement, 'findAll').mockImplementation(async ({ where }) => {
                if (where.serviceId === SRV_MOROCCAN_MASSAGE || where.serviceId === SRV_THAI_THERAPY) {
                    return [{
                        resourceTypeId: TYPE_MASSAGE,
                        quantity: 1,
                        variantId: null,
                        resourceType: { id: TYPE_MASSAGE, name_en: 'Massage rooms', name_ar: 'غرف مساج', is_active: true }
                    }];
                }
                if (where.serviceId === SRV_CLASSIC_MANICURE) {
                    return [{
                        resourceTypeId: TYPE_NAIL,
                        quantity: 1,
                        variantId: null,
                        resourceType: { id: TYPE_NAIL, name_en: 'Nail station', name_ar: 'محطة أظافر', is_active: true }
                    }];
                }
                return [];
            });
        });

        test('Scenario A: Nail-resource overlap — Candidate manicure 6:45-7:15 PM overlaps Abeer 7:00-7:30 PM (0/1), but 7:30-8:00 PM is free (1/1)', async () => {
            const abeerManicure = {
                resourceId: NAIL_1,
                appointment: {
                    id: 'appt-abeer',
                    startTime: new Date('2026-10-13T16:00:00.000Z'),
                    endTime: new Date('2026-10-13T16:30:00.000Z'),
                    status: 'confirmed'
                }
            };

            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where, include }) => {
                const apptWhere = include?.[0]?.where || {};
                const ltEnd = apptWhere.startTime?.[db.Sequelize.Op?.lt];
                const gtStart = apptWhere.endTime?.[db.Sequelize.Op?.gt];

                const rIds = where?.resourceId?.[db.Sequelize.Op?.in] || [];
                if (!rIds.includes(NAIL_1)) return [];

                const aStart = abeerManicure.appointment.startTime;
                const aEnd = abeerManicure.appointment.endTime;
                return (!ltEnd || aStart < ltEnd) && (!gtStart || aEnd > gtStart) ? [abeerManicure] : [];
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                catalogueItems: [
                    { id: 'cat-mani-overlap', serviceId: SRV_CLASSIC_MANICURE, startTime: '2026-10-13T15:45:00.000Z', duration: 30 },
                    { id: 'cat-mani-free', serviceId: SRV_CLASSIC_MANICURE, startTime: '2026-10-13T16:30:00.000Z', duration: 30 }
                ]
            });

            const overlapResult = res.results['cat-mani-overlap'];
            expect(overlapResult.isAvailable).toBe(false);
            expect(overlapResult.requirements[0].totalActive).toBe(1);
            expect(overlapResult.requirements[0].availableQuantity).toBe(0);
            expect(overlapResult.requirements[0].reason).toBe('RESOURCE_OCCUPIED');

            const freeResult = res.results['cat-mani-free'];
            expect(freeResult.isAvailable).toBe(true);
            expect(freeResult.requirements[0].totalActive).toBe(1);
            expect(freeResult.requirements[0].availableQuantity).toBe(1);
        });

        test('Scenario B: Massage-resource independence — Unrelated nail appointment does not consume massage-room capacity (2/2 available)', async () => {
            const abeerManicure = {
                resourceId: NAIL_1,
                appointment: {
                    id: 'appt-abeer',
                    startTime: new Date('2026-10-13T16:00:00.000Z'),
                    endTime: new Date('2026-10-13T16:30:00.000Z'),
                    status: 'confirmed'
                }
            };

            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where }) => {
                const rIds = where?.resourceId?.[db.Sequelize.Op?.in] || [];
                return rIds.includes(NAIL_1) ? [abeerManicure] : [];
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                catalogueItems: [
                    { id: 'cat-moroccan-645', serviceId: SRV_MOROCCAN_MASSAGE, startTime: '2026-10-13T15:45:00.000Z', duration: 60 },
                    { id: 'cat-thai-645', serviceId: SRV_THAI_THERAPY, startTime: '2026-10-13T15:45:00.000Z', duration: 45 }
                ]
            });

            const moroccan = res.results['cat-moroccan-645'];
            expect(moroccan.isAvailable).toBe(true);
            expect(moroccan.requirements[0].totalActive).toBe(2);
            expect(moroccan.requirements[0].availableQuantity).toBe(2);

            const thai = res.results['cat-thai-645'];
            expect(thai.isAvailable).toBe(true);
            expect(thai.requirements[0].totalActive).toBe(2);
            expect(thai.requirements[0].availableQuantity).toBe(2);
        });

        test('Scenario C: True partial capacity — Room A ends at 6:45 PM, Room B ends at 7:15 PM -> candidate at 6:45 PM reports 1/2 available', async () => {
            const roomAAppt = {
                resourceId: ROOM_A,
                appointment: {
                    id: 'appt-room-a',
                    startTime: new Date('2026-10-13T14:45:00.000Z'),
                    endTime: new Date('2026-10-13T15:45:00.000Z'),
                    status: 'confirmed'
                }
            };
            const roomBAppt = {
                resourceId: ROOM_B,
                appointment: {
                    id: 'appt-room-b',
                    startTime: new Date('2026-10-13T15:15:00.000Z'),
                    endTime: new Date('2026-10-13T16:15:00.000Z'),
                    status: 'confirmed'
                }
            };

            const dbAppts = [roomAAppt, roomBAppt];
            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where, include }) => {
                const apptWhere = include?.[0]?.where || {};
                const ltEnd = apptWhere.startTime?.[db.Sequelize.Op?.lt];
                const gtStart = apptWhere.endTime?.[db.Sequelize.Op?.gt];

                return dbAppts.filter(ea => {
                    const rIds = where?.resourceId?.[db.Sequelize.Op?.in] || [];
                    if (!rIds.includes(ea.resourceId)) return false;

                    const aStart = ea.appointment.startTime;
                    const aEnd = ea.appointment.endTime;
                    return (!ltEnd || aStart < ltEnd) && (!gtStart || aEnd > gtStart);
                });
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                catalogueItems: [
                    { id: 'cat-moroccan-c', serviceId: SRV_MOROCCAN_MASSAGE, startTime: '2026-10-13T15:45:00.000Z', duration: 60 }
                ]
            });

            const moroccan = res.results['cat-moroccan-c'];
            expect(moroccan.isAvailable).toBe(true);
            expect(moroccan.requirements[0].totalActive).toBe(2);
            expect(moroccan.requirements[0].availableQuantity).toBe(1);
        });

        test('Scenario D: Later candidate — Candidate at 7:15 PM for 60m reports 2/2 available when both rooms are free', async () => {
            const roomAAppt = {
                resourceId: ROOM_A,
                appointment: {
                    id: 'appt-room-a',
                    startTime: new Date('2026-10-13T14:45:00.000Z'),
                    endTime: new Date('2026-10-13T15:45:00.000Z'),
                    status: 'confirmed'
                }
            };
            const roomBAppt = {
                resourceId: ROOM_B,
                appointment: {
                    id: 'appt-room-b',
                    startTime: new Date('2026-10-13T15:15:00.000Z'),
                    endTime: new Date('2026-10-13T16:15:00.000Z'),
                    status: 'confirmed'
                }
            };

            const dbAppts = [roomAAppt, roomBAppt];
            jest.spyOn(db.AppointmentResource, 'findAll').mockImplementation(async ({ where, include }) => {
                const apptWhere = include?.[0]?.where || {};
                const ltEnd = apptWhere.startTime?.[db.Sequelize.Op?.lt];
                const gtStart = apptWhere.endTime?.[db.Sequelize.Op?.gt];

                return dbAppts.filter(ea => {
                    const rIds = where?.resourceId?.[db.Sequelize.Op?.in] || [];
                    if (!rIds.includes(ea.resourceId)) return false;

                    const aStart = ea.appointment.startTime;
                    const aEnd = ea.appointment.endTime;
                    return (!ltEnd || aStart < ltEnd) && (!gtStart || aEnd > gtStart);
                });
            });

            const res = await batchCheckResourceAvailability({
                tenantId: TENANT_ID,
                catalogueItems: [
                    { id: 'cat-moroccan-d', serviceId: SRV_MOROCCAN_MASSAGE, startTime: '2026-10-13T16:15:00.000Z', duration: 60 }
                ]
            });

            const moroccan = res.results['cat-moroccan-d'];
            expect(moroccan.isAvailable).toBe(true);
            expect(moroccan.requirements[0].totalActive).toBe(2);
            expect(moroccan.requirements[0].availableQuantity).toBe(2);
        });
    });
});

