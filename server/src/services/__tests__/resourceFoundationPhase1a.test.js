'use strict';

const db = require('../../models');
const tenantResourceController = require('../../controllers/tenantResourceController');
const tenantServiceController = require('../../controllers/tenantServiceController');

// Helper to mock express req/res
function createMockReqRes(options = {}) {
    const req = {
        tenantId: options.tenantId,
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

describe('Phase 1A: Resource Foundation Tests (Live DB Verification)', () => {
    let tenantA;
    let tenantB;
    let serviceCategory;

    beforeAll(async () => {
        await db.sequelize.authenticate();

        const timestamp = Date.now();
        // Create 2 test tenants for isolation testing
        tenantA = await db.Tenant.create({
            name: 'Test Salon A',
            name_en: 'Test Salon A',
            name_ar: 'صالون أ التجريبي',
            slug: `test-salon-a-${timestamp}`,
            dbSchema: `tenant_a_${timestamp}`,
            email: `test_tenant_a_${timestamp}@refah.test`,
            phone: `+96650${Math.floor(1000000 + Math.random() * 9000000)}`,
            status: 'active'
        });

        tenantB = await db.Tenant.create({
            name: 'Test Salon B',
            name_en: 'Test Salon B',
            name_ar: 'صالون ب التجريبي',
            slug: `test-salon-b-${timestamp}`,
            dbSchema: `tenant_b_${timestamp}`,
            email: `test_tenant_b_${timestamp}@refah.test`,
            phone: `+96650${Math.floor(1000000 + Math.random() * 9000000)}`,
            status: 'active'
        });

        // Create a tenant service category for Tenant A
        serviceCategory = await db.TenantServiceCategory.create({
            tenantId: tenantA.id,
            name_en: 'Spa Treatments',
            name_ar: 'علاجات السبا',
            isActive: true
        });
    });

    afterAll(async () => {
        // Cleanup test data in correct dependency order
        if (tenantA) {
            await db.AppointmentResource.destroy({
                where: {},
                include: [{ model: db.Resource, as: 'resource', where: { tenantId: tenantA.id } }]
            }).catch(() => {});
            await db.ServiceResourceRequirement.destroy({
                where: {},
                include: [{ model: db.Service, as: 'service', where: { tenantId: tenantA.id } }]
            }).catch(() => {});
            await db.Resource.destroy({ where: { tenantId: tenantA.id } });
            await db.ResourceType.destroy({ where: { tenantId: tenantA.id } });
            await db.Service.destroy({ where: { tenantId: tenantA.id } });
            await db.TenantServiceCategory.destroy({ where: { tenantId: tenantA.id } });
            await db.Tenant.destroy({ where: { id: tenantA.id } });
        }

        if (tenantB) {
            await db.Resource.destroy({ where: { tenantId: tenantB.id } });
            await db.ResourceType.destroy({ where: { tenantId: tenantB.id } });
            await db.Tenant.destroy({ where: { id: tenantB.id } });
        }

        await db.sequelize.close();
    });

    // Test A: Tenant creates resource type
    test('Scenario A: Tenant can create a resource type', async () => {
        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Massage Room',
                name_ar: 'غرفة مساج',
                is_active: true
            }
        });

        await tenantResourceController.createResourceType(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.resourceType).toBeDefined();
        expect(res.data.resourceType.name_en).toBe('Massage Room');
        expect(res.data.resourceType.tenantId).toBe(tenantA.id);
        expect(res.data.resourceType.is_active).toBe(true);
    });

    // Test B: Tenant creates multiple resources under that type
    test('Scenario B: Tenant can create multiple resource instances under that type', async () => {
        // Find the created resource type
        const type = await db.ResourceType.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room' } });
        expect(type).not.toBeNull();

        // Create Room 1
        const r1 = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                resourceTypeId: type.id,
                name_en: 'Massage Room 1',
                name_ar: 'غرفة مساج 1'
            }
        });
        await tenantResourceController.createResource(r1.req, r1.res);
        expect(r1.res.statusCode).toBe(201);
        expect(r1.res.data.resource.name_en).toBe('Massage Room 1');

        // Create Room 2
        const r2 = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                resourceTypeId: type.id,
                name_en: 'Massage Room 2',
                name_ar: 'غرفة مساج 2'
            }
        });
        await tenantResourceController.createResource(r2.req, r2.res);
        expect(r2.res.statusCode).toBe(201);
        expect(r2.res.data.resource.name_en).toBe('Massage Room 2');

        // Verify listing resource types includes counts
        const listRes = createMockReqRes({ tenantId: tenantA.id });
        await tenantResourceController.getResourceTypes(listRes.req, listRes.res);
        expect(listRes.res.statusCode).toBe(200);
        const massageType = listRes.res.data.resourceTypes.find(t => t.name_en === 'Massage Room');
        expect(massageType.resourcesCount).toBe(2);
        expect(massageType.activeResourcesCount).toBe(2);
    });

    // Test C: Resource update/deactivation works
    test('Scenario C: Tenant can update and deactivate a resource instance', async () => {
        const room = await db.Resource.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room 2' } });
        expect(room).not.toBeNull();

        // Update name and deactivate
        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            params: { id: room.id },
            body: {
                name_en: 'Massage Room 2 (Renovated)',
                is_active: false
            }
        });
        await tenantResourceController.updateResource(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.data.resource.name_en).toBe('Massage Room 2 (Renovated)');
        expect(res.data.resource.is_active).toBe(false);

        // Verify active count decreases to 1
        const listRes = createMockReqRes({ tenantId: tenantA.id });
        await tenantResourceController.getResourceTypes(listRes.req, listRes.res);
        const massageType = listRes.res.data.resourceTypes.find(t => t.name_en === 'Massage Room');
        expect(massageType.resourcesCount).toBe(2);
        expect(massageType.activeResourcesCount).toBe(1);
    });

    // Test D: Cross-tenant isolation is enforced
    test('Scenario D: Tenant B cannot access or modify Tenant A resources', async () => {
        const roomA = await db.Resource.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room 1' } });
        expect(roomA).not.toBeNull();

        // Tenant B tries to get Room A
        const getRes = createMockReqRes({
            tenantId: tenantB.id,
            params: { id: roomA.id }
        });
        await tenantResourceController.getResource(getRes.req, getRes.res);
        expect(getRes.res.statusCode).toBe(404);

        // Tenant B tries to update Room A
        const updateRes = createMockReqRes({
            tenantId: tenantB.id,
            params: { id: roomA.id },
            body: { name_en: 'Hacked Room' }
        });
        await tenantResourceController.updateResource(updateRes.req, updateRes.res);
        expect(updateRes.res.statusCode).toBe(404);

        // Room A remains unchanged
        await roomA.reload();
        expect(roomA.name_en).toBe('Massage Room 1');
    });

    // Test E: Service can have a resource requirement
    test('Scenario E: Service can be created with parent-level resource requirement', async () => {
        const type = await db.ResourceType.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room' } });

        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Moroccan Massage',
                name_ar: 'مساج مغربي',
                priceType: 'fixed',
                finalPrice: 200,
                duration: 60,
                tenantServiceCategoryId: serviceCategory.id,
                resourceRequirements: [
                    {
                        resourceTypeId: type.id,
                        quantity: 1
                    }
                ]
            }
        });

        await tenantServiceController.createService(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.service.resourceRequirements).toHaveLength(1);
        expect(res.data.service.resourceRequirements[0].resourceTypeId).toBe(type.id);
        expect(res.data.service.resourceRequirements[0].quantity).toBe(1);
        expect(res.data.service.resourceRequirements[0].variantId).toBeNull();
        expect(res.data.service.resourceRequirements[0].resourceType.name_en).toBe('Massage Room');
    });

    // Test F: Service without resource requirements remains compatible
    test('Scenario F: Service without resource requirements behaves normally', async () => {
        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Quick Consultation',
                name_ar: 'استشارة سريعة',
                priceType: 'fixed',
                finalPrice: 50,
                duration: 15,
                tenantServiceCategoryId: serviceCategory.id
            }
        });

        await tenantServiceController.createService(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.service.resourceRequirements).toHaveLength(0);
    });

    // Test G: Variant-specific requirements work
    test('Scenario G: Service with variants can have parent AND variant-specific requirements', async () => {
        // Create second resource type for Tenant A: Laser Machine
        const laserType = await db.ResourceType.create({
            tenantId: tenantA.id,
            name_en: 'Special Equipment',
            name_ar: 'أجهزة خاصة',
            is_active: true
        });

        const roomType = await db.ResourceType.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room' } });

        const variants = [
            {
                id: 'var_standard_60',
                name_en: 'Standard 60min',
                name_ar: 'عادي 60 دقيقة',
                duration: 60,
                finalPrice: 200,
                isActive: true
            },
            {
                id: 'var_premium_90',
                name_en: 'Premium 90min with Equipment',
                name_ar: 'بريميوم 90 دقيقة مع جهاز',
                duration: 90,
                finalPrice: 350,
                isActive: true
            }
        ];

        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Advanced Body Treatment',
                name_ar: 'علاج جسم متقدم',
                priceType: 'fixed',
                finalPrice: 200,
                duration: 60,
                variants,
                tenantServiceCategoryId: serviceCategory.id,
                resourceRequirements: [
                    // Parent level requirement (applies to all): 1 Massage Room
                    {
                        resourceTypeId: roomType.id,
                        variantId: null,
                        quantity: 1
                    },
                    // Variant-specific requirement: Premium variant also requires Special Equipment x 1
                    {
                        resourceTypeId: laserType.id,
                        variantId: 'var_premium_90',
                        quantity: 1
                    }
                ]
            }
        });

        await tenantServiceController.createService(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.service.resourceRequirements).toHaveLength(2);

        const parentReq = res.data.service.resourceRequirements.find(r => r.variantId === null);
        const variantReq = res.data.service.resourceRequirements.find(r => r.variantId === 'var_premium_90');

        expect(parentReq).toBeDefined();
        expect(parentReq.resourceTypeId).toBe(roomType.id);
        expect(variantReq).toBeDefined();
        expect(variantReq.resourceTypeId).toBe(laserType.id);
    });

    // Test H: Invalid variantId is rejected
    test('Scenario H: Requirement with non-existent variantId is rejected with 400', async () => {
        const roomType = await db.ResourceType.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room' } });

        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Facial Service',
                name_ar: 'خدمة تنظيف بشرة',
                priceType: 'fixed',
                finalPrice: 150,
                duration: 45,
                variants: [
                    { id: 'var_real_1', name_en: 'Real Variant', name_ar: 'حقيقي', duration: 45, finalPrice: 150, isActive: true }
                ],
                resourceRequirements: [
                    {
                        resourceTypeId: roomType.id,
                        variantId: 'var_fake_does_not_exist',
                        quantity: 1
                    }
                ]
            }
        });

        await tenantServiceController.createService(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.data.success).toBe(false);
        expect(res.data.message).toContain('does not exist in the service variants list');
    });

    // Test I: Invalid resourceTypeId belonging to another tenant is rejected
    test('Scenario I: Tenant A cannot use Tenant B resourceTypeId in service requirements', async () => {
        // Create resource type for Tenant B
        const typeB = await db.ResourceType.create({
            tenantId: tenantB.id,
            name_en: 'Tenant B Secret Room',
            name_ar: 'غرفة خاصة ب ب',
            is_active: true
        });

        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Intrusion Service',
                name_ar: 'خدمة تجربة اختراق',
                priceType: 'fixed',
                finalPrice: 100,
                duration: 30,
                resourceRequirements: [
                    {
                        resourceTypeId: typeB.id,
                        quantity: 1
                    }
                ]
            }
        });

        await tenantServiceController.createService(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.data.success).toBe(false);
        expect(res.data.message).toContain('do not belong to your salon');
    });

    // Test J: Duplicate requirement is rejected
    test('Scenario J: Duplicate resource requirement in same payload is rejected with 400', async () => {
        const roomType = await db.ResourceType.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room' } });

        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Duplicate Test Service',
                name_ar: 'خدمة تكرار',
                priceType: 'fixed',
                finalPrice: 100,
                duration: 30,
                resourceRequirements: [
                    { resourceTypeId: roomType.id, variantId: null, quantity: 1 },
                    { resourceTypeId: roomType.id, variantId: null, quantity: 1 }
                ]
            }
        });

        await tenantServiceController.createService(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.data.success).toBe(false);
        expect(res.data.message).toContain('Duplicate resource requirement detected');
    });

    // Test K: quantity 0 / negative / decimal is rejected
    test('Scenario K: Invalid quantities (0, negative, decimal) are rejected with 400', async () => {
        const roomType = await db.ResourceType.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room' } });

        // Zero quantity
        const zeroReq = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Zero Qty Service',
                name_ar: 'كمية صفر',
                priceType: 'fixed',
                finalPrice: 100,
                duration: 30,
                resourceRequirements: [{ resourceTypeId: roomType.id, quantity: 0 }]
            }
        });
        await tenantServiceController.createService(zeroReq.req, zeroReq.res);
        expect(zeroReq.res.statusCode).toBe(400);

        // Negative quantity
        const negReq = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Neg Qty Service',
                name_ar: 'كمية سالبة',
                priceType: 'fixed',
                finalPrice: 100,
                duration: 30,
                resourceRequirements: [{ resourceTypeId: roomType.id, quantity: -2 }]
            }
        });
        await tenantServiceController.createService(negReq.req, negReq.res);
        expect(negReq.res.statusCode).toBe(400);

        // Decimal quantity
        const decReq = createMockReqRes({
            tenantId: tenantA.id,
            body: {
                name_en: 'Decimal Qty Service',
                name_ar: 'كمية عشرية',
                priceType: 'fixed',
                finalPrice: 100,
                duration: 30,
                resourceRequirements: [{ resourceTypeId: roomType.id, quantity: 1.5 }]
            }
        });
        await tenantServiceController.createService(decReq.req, decReq.res);
        expect(decReq.res.statusCode).toBe(400);
    });

    // Test L: Existing appointments remain valid without resource rows
    test('Scenario L: Appointments remain fully readable and valid without resource rows', async () => {
        // Query recent appointments in DB with new AppointmentResource association
        const appointments = await db.Appointment.findAll({
            limit: 5,
            include: [
                {
                    model: db.AppointmentResource,
                    as: 'appointmentResources',
                    required: false
                }
            ]
        });

        // Even with 0 appointmentResources rows, existing appointments must load without error
        expect(Array.isArray(appointments)).toBe(true);
        appointments.forEach(apt => {
            expect(apt.id).toBeDefined();
            expect(Array.isArray(apt.appointmentResources)).toBe(true);
        });
    });

    // Test M: Existing services and variants remain readable
    test('Scenario M: Existing services and variants remain readable and compatible', async () => {
        const { req, res } = createMockReqRes({ tenantId: tenantA.id });
        await tenantServiceController.getServices(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.services)).toBe(true);
        expect(res.data.services.length).toBeGreaterThanOrEqual(2);

        // Check service with requirements
        const moroccan = res.data.services.find(s => s.name_en === 'Moroccan Massage');
        expect(moroccan).toBeDefined();
        expect(moroccan.resourceRequirements).toHaveLength(1);
        expect(moroccan.resourceRequirements[0].resourceType.name_en).toBe('Massage Room');
    });

    // Test N: Existing bundles remain readable
    test('Scenario N: Existing service packages (bundles) remain readable', async () => {
        const bundles = await db.ServicePackage.findAll({
            limit: 5,
            include: [
                {
                    model: db.ServicePackageItem,
                    as: 'items',
                    required: false
                }
            ]
        });

        expect(Array.isArray(bundles)).toBe(true);
    });

    // Test O: Service requirements can be updated via updateService
    test('Scenario O: Service resource requirements can be modified via updateService', async () => {
        const service = await db.Service.findOne({ where: { tenantId: tenantA.id, name_en: 'Moroccan Massage' } });
        expect(service).not.toBeNull();

        // Create an additional equipment type
        const saunaType = await db.ResourceType.create({
            tenantId: tenantA.id,
            name_en: 'Sauna Cabin',
            name_ar: 'كابينة ساونا',
            is_active: true
        });

        const roomType = await db.ResourceType.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room' } });

        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            params: { id: service.id },
            body: {
                finalPrice: 200,
                resourceRequirements: [
                    { resourceTypeId: roomType.id, quantity: 1 },
                    { resourceTypeId: saunaType.id, quantity: 1 }
                ]
            }
        });

        await tenantServiceController.updateService(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.service.resourceRequirements).toHaveLength(2);

        const typeNames = res.data.service.resourceRequirements.map(r => r.resourceType.name_en);
        expect(typeNames).toContain('Massage Room');
        expect(typeNames).toContain('Sauna Cabin');
    });

    // Test P: Safe deactivation when resource type has linked resources
    test('Scenario P: Deleting a resource type with linked resources safely deactivates it', async () => {
        const roomType = await db.ResourceType.findOne({ where: { tenantId: tenantA.id, name_en: 'Massage Room' } });
        expect(roomType).not.toBeNull();

        const { req, res } = createMockReqRes({
            tenantId: tenantA.id,
            params: { id: roomType.id }
        });

        await tenantResourceController.deleteResourceType(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.data.deactivated).toBe(true);

        await roomType.reload();
        expect(roomType.is_active).toBe(false);
    });
});
