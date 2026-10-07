const request = require('supertest');
const express = require('express');
const cors = require('cors');
const db = require('../../models');

describe('Admin CORS and Tenant Details Tests', () => {
    let app;
    let testTenant;

    beforeAll(async () => {
        // Build an express app mirroring server index configuration
        app = express();
        app.disable('x-powered-by');

        const normalizeOrigin = (value) => `${value || ''}`.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');

        const defaultAllowedOrigins = [
            'https://rifah.sa',
            'https://www.rifah.sa',
            'https://admin.rifah.sa',
            'https://tenant.rifah.sa',
            'https://public.rifah.sa',
            'https://radmin.unifinitylab.com',
            'https://rtenant.unifinitylab.com',
            'https://rtenantv2.unifinitylab.com',
            'https://refah.unifinitylab.com',
            'https://rapi.unifinitylab.com',
            'http://localhost:3000'
        ];

        const allowedOriginPatterns = [
            /^https:\/\/([a-z0-9-]+\.)?rifah\.sa$/i,
            /^https:\/\/([a-z0-9-]+\.)?unifinitylab\.com$/i,
            /^https?:\/\/([a-z0-9-]+\.)?sslip\.io$/i,
            /^http:\/\/localhost(:\d+)?$/i,
        ];

        const isAllowedOrigin = (origin) => {
            const normalizedOrigin = normalizeOrigin(origin);
            if (!normalizedOrigin) return false;
            if (defaultAllowedOrigins.includes(normalizedOrigin)) return true;
            return allowedOriginPatterns.some((p) => p.test(normalizedOrigin));
        };

        const corsOptions = {
            origin: (origin, callback) => {
                if (!origin || isAllowedOrigin(origin)) return callback(null, true);
                return callback(null, false);
            },
            credentials: true,
            methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
            exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
            optionsSuccessStatus: 204
        };

        app.use((req, res, next) => {
            const requestOrigin = req.headers.origin;
            if (requestOrigin && isAllowedOrigin(requestOrigin)) {
                res.setHeader('Access-Control-Allow-Origin', requestOrigin);
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                res.setHeader('Vary', 'Origin');
                res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
                res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
                res.setHeader(
                    'Access-Control-Allow-Headers',
                    req.headers['access-control-request-headers'] || 'Content-Type,Authorization,X-Requested-With,Accept,Origin'
                );
            }
            if (req.method === 'OPTIONS') {
                if (requestOrigin && isAllowedOrigin(requestOrigin)) {
                    return res.sendStatus(204);
                }
            }
            next();
        });

        app.use(cors(corsOptions));
        app.options('*', cors(corsOptions));
        app.use(express.json());

        // Dummy admin notifications endpoint for CORS test
        app.get('/api/v1/admin/notifications', (req, res) => {
            res.json({ success: true, notifications: [] });
        });

        // Admin tenants controller
        const adminTenantsController = require('../adminTenantsController');
        app.get('/api/v1/admin/tenants/:id', adminTenantsController.getTenantDetails);

        // Find or create a test tenant
        testTenant = await db.Tenant.findOne();
        if (!testTenant) {
            testTenant = await db.Tenant.create({
                name: 'Test Tenant Salon',
                name_en: 'Test Tenant Salon',
                name_ar: 'صالون تجريبي',
                businessType: 'salon',
                email: `test-admin-${Date.now()}@example.com`,
                phone: '+966500000099',
                slug: `test-admin-${Date.now()}`,
                status: 'pending_approval'
            });
        }
    });

    afterAll(async () => {
        await db.sequelize.close();
    });

    describe('Issue 1: Admin Notifications CORS & Preflight', () => {
        test('OPTIONS preflight from https://radmin.unifinitylab.com returns 204 with exact CORS headers', async () => {
            const res = await request(app)
                .options('/api/v1/admin/notifications?page=1&limit=6')
                .set('Origin', 'https://radmin.unifinitylab.com')
                .set('Access-Control-Request-Method', 'GET')
                .set('Access-Control-Request-Headers', 'Authorization,Content-Type');

            expect(res.status).toBe(204);
            expect(res.headers['access-control-allow-origin']).toBe('https://radmin.unifinitylab.com');
            expect(res.headers['access-control-allow-credentials']).toBe('true');
            expect(res.headers['access-control-allow-methods']).toMatch(/GET/i);
            expect(res.headers['access-control-allow-origin']).not.toBe('*');
        });

        test('GET request from https://radmin.unifinitylab.com receives allowed origin header', async () => {
            const res = await request(app)
                .get('/api/v1/admin/notifications?page=1&limit=6')
                .set('Origin', 'https://radmin.unifinitylab.com');

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe('https://radmin.unifinitylab.com');
            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });

        test('Disallows untrusted origin', async () => {
            const res = await request(app)
                .options('/api/v1/admin/notifications?page=1&limit=6')
                .set('Origin', 'https://untrusted-malicious-site.com')
                .set('Access-Control-Request-Method', 'GET');

            expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    });

    describe('Issue 2: Admin Tenant Details (GET /api/v1/admin/tenants/:id)', () => {
        test('User model is properly associated to Tenant model', () => {
            expect(db.Tenant.associations.Users).toBeDefined();
            expect(db.Tenant.associations.subscription).toBeDefined();
        });

        test('GET /api/v1/admin/tenants/:id returns HTTP 200 with tenant details (not 500)', async () => {
            const res = await request(app)
                .get(`/api/v1/admin/tenants/${testTenant.id}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.tenant).toBeDefined();
            expect(res.body.tenant.id).toBe(testTenant.id);
            expect(res.body.activities).toBeDefined();
            expect(res.body.bookingStats).toBeDefined();
        });
    });
});
