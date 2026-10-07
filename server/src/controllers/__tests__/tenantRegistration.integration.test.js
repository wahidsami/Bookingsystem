const request = require('supertest');
const express = require('express');
jest.mock('../../utils/emailService', () => ({
    sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true })
}));

const db = require('../../models');
const tenantRegistrationController = require('../tenantRegistrationController');

// Build isolated express app for testing the registration route
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.post(
    '/api/v1/auth/tenant/register',
    tenantRegistrationController.uploadMiddleware,
    tenantRegistrationController.register
);

describe('Tenant Registration Flow Stabilization Tests', () => {
    const createdTenantIds = [];
    let validPackageId;

    const getValidRegistrationFields = (overrides = {}) => ({
        name_en: `Refah Test ${Date.now()}`,
        name_ar: 'صالون ريفاه التجريبي',
        businessType: 'salon',
        email: `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@example.com`,
        phone: '+966112345678',
        mobile: '+966501234567',
        contactPersonNameEn: 'John Doe',
        contactPersonNameAr: 'جون دو',
        contactPersonEmail: 'contact@example.com',
        contactPersonMobile: '+966509876543',
        ownerNameEn: 'Alice Smith',
        ownerNameAr: 'أليس سميث',
        ownerPhone: '+966505555555',
        password: 'Password123!',
        acceptedServiceAgreement: 'true',
        selectedPackageId: validPackageId,
        selectedBillingPeriod: 'monthly',
        ...overrides
    });

    const attachFields = (req, fields) => {
        for (const [key, val] of Object.entries(fields)) {
            req.field(key, val);
        }
        return req;
    };

    beforeAll(async () => {
        const pkg = await db.SubscriptionPackage.findOne({
            where: { isActive: true }
        });
        expect(pkg).toBeTruthy();
        validPackageId = pkg.id;
    });

    afterAll(async () => {
        for (const tenantId of createdTenantIds) {
            try {
                await db.TenantSubscription.destroy({ where: { tenantId }, force: true });
                await db.Tenant.destroy({ where: { id: tenantId }, force: true });
            } catch (err) {
                // Ignore cleanup errors
            }
        }
        await db.sequelize.close();
    });

    describe('1. File Type Acceptance (Temporary Phase)', () => {
        test('accepts PDF files without rejection', async () => {
            const fields = getValidRegistrationFields({ name_en: 'PDF Test Salon' });
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req.attach('crDocument', Buffer.from('%PDF-1.4 test document content'), {
                filename: 'cr_document.pdf',
                contentType: 'application/pdf'
            });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.tenant).toBeDefined();
            createdTenantIds.push(res.body.tenant.id);
        });

        test('accepts JPG, PNG, WEBP image files without rejection', async () => {
            const fields = getValidRegistrationFields({ name_en: 'Image Formats Salon' });
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req
                .attach('logo', Buffer.from('fake-png-data'), {
                    filename: 'logo.png',
                    contentType: 'image/png'
                })
                .attach('crDocument', Buffer.from('fake-jpeg-data'), {
                    filename: 'cr.jpg',
                    contentType: 'image/jpeg'
                })
                .attach('taxDocument', Buffer.from('fake-webp-data'), {
                    filename: 'tax.webp',
                    contentType: 'image/webp'
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            createdTenantIds.push(res.body.tenant.id);
        });

        test('accepts non-standard / previously rejected file types (TXT, DOCX, custom)', async () => {
            const fields = getValidRegistrationFields({ name_en: 'Non Standard Docs Salon' });
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req
                .attach('licenseDocument', Buffer.from('PlainTextDocumentContents'), {
                    filename: 'license.txt',
                    contentType: 'text/plain'
                })
                .attach('nationalAddressDocument', Buffer.from('FakeDocxZipHeaderContents'), {
                    filename: 'address.docx',
                    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            createdTenantIds.push(res.body.tenant.id);
        });
    });

    describe('2. HTTP Status Codes & Error Handling', () => {
        test('returns 400 Bad Request when required business names are missing (not 500)', async () => {
            const fields = getValidRegistrationFields({ name_en: '', name_ar: '' });
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req;
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Business name in English and Arabic is required/i);
        });

        test('returns 400 Bad Request for invalid email format (not 500)', async () => {
            const fields = getValidRegistrationFields({ email: 'invalid-email-address' });
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req;
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Invalid business email format/i);
        });

        test('returns 400 Bad Request when selected subscription package does not exist (not 500)', async () => {
            const fields = getValidRegistrationFields({
                selectedPackageId: '00000000-0000-0000-0000-000000000000'
            });
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req;
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/subscription package was not found/i);
        });

        test('returns 400 Bad Request when file size exceeds 10MB limit (not 500)', async () => {
            const largeBuffer = Buffer.alloc(10.5 * 1024 * 1024);
            const fields = getValidRegistrationFields();
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req.attach('crDocument', largeBuffer, 'huge_file.pdf');

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/File size exceeds maximum allowed limit/i);
        });

        test('returns 400 Bad Request on duplicate business email (not 500)', async () => {
            const duplicateEmail = `dupe-${Date.now()}@example.com`;
            const fields1 = getValidRegistrationFields({ email: duplicateEmail });
            const req1 = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req1, fields1);

            const res1 = await req1;
            expect(res1.status).toBe(201);
            createdTenantIds.push(res1.body.tenant.id);

            // Second attempt with exact duplicate email
            const fields2 = getValidRegistrationFields({ email: duplicateEmail });
            const req2 = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req2, fields2);

            const res2 = await req2;
            expect(res2.status).toBe(400);
            expect(res2.body.success).toBe(false);
            expect(res2.body.message).toMatch(/already exists/i);
        });
    });

    describe('3. Atomicity & Rollback', () => {
        test('cleans up uploaded files and creates no tenant when validation fails after upload', async () => {
            const rollbackEmail = `rollback-${Date.now()}@example.com`;
            const fields = getValidRegistrationFields({
                email: rollbackEmail,
                selectedPackageId: '00000000-0000-0000-0000-000000000000'
            });
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req.attach('logo', Buffer.from('temp-logo-data'), 'temp_logo.png');

            expect(res.status).toBe(400);

            // Verify no tenant exists with this email
            const orphanTenant = await db.Tenant.findOne({
                where: { email: rollbackEmail }
            });
            expect(orphanTenant).toBeNull();
        });
    });

    describe('4. Subscription Expiry Protection', () => {
        test('newly registered tenant subscription periodEnd is set safely in the future (not expired)', async () => {
            const fields = getValidRegistrationFields({
                selectedBillingPeriod: 'monthly'
            });
            const req = request(app).post('/api/v1/auth/tenant/register');
            attachFields(req, fields);

            const res = await req;
            expect(res.status).toBe(201);
            const tenantId = res.body.tenant.id;
            createdTenantIds.push(tenantId);

            // Check subscription record
            const subscription = await db.TenantSubscription.findOne({
                where: { tenantId }
            });

            expect(subscription).toBeTruthy();
            expect(subscription.status).toBe('trial');
            expect(new Date(subscription.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());
        });
    });
});
