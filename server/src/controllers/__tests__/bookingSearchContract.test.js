const request = require('supertest');
const express = require('express');

describe('Booking Search Contract & Route Guarding (GET/POST /bookings/search)', () => {
    let app;
    let mockSearchAvailability;
    let mockGetBooking;

    beforeEach(() => {
        jest.clearAllMocks();

        // Fresh Express app for router testing
        app = express();
        app.use(express.json());

        // Import the real bookingRoutes
        const bookingRoutes = require('../../routes/bookingRoutes');
        app.use('/api/v1/bookings', bookingRoutes);
    });

    test('1. GET /api/v1/bookings/search without required parameters returns HTTP 400', async () => {
        const res = await request(app).get('/api/v1/bookings/search');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('tenantId is required');
        expect(res.body.messageAr).toBe('معرف المستأجر مطلوب');
    });

    test('2. GET /api/v1/bookings/search with tenantId but missing date returns HTTP 400', async () => {
        const res = await request(app)
            .get('/api/v1/bookings/search')
            .query({ tenantId: '11111111-1111-1111-1111-111111111111' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('date is required');
    });

    test('3. GET /api/v1/bookings/search with tenantId and date but missing serviceId/packageId returns HTTP 400', async () => {
        const res = await request(app)
            .get('/api/v1/bookings/search')
            .query({
                tenantId: '11111111-1111-1111-1111-111111111111',
                date: '2026-10-15'
            });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('serviceId or packageId is required');
    });

    test('4. POST /api/v1/bookings/search without required parameters returns HTTP 400', async () => {
        const res = await request(app)
            .post('/api/v1/bookings/search')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('tenantId is required');
    });

    test('5. POST /api/v1/bookings/search with tenantId and date but missing serviceId/packageId returns HTTP 400', async () => {
        const res = await request(app)
            .post('/api/v1/bookings/search')
            .send({
                tenantId: '11111111-1111-1111-1111-111111111111',
                date: '2026-10-15'
            });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('serviceId or packageId is required');
    });

    test('6. Non-UUID booking id on GET /api/v1/bookings/:id returns HTTP 404 instead of 500 database crash', async () => {
        const res = await request(app).get('/api/v1/bookings/not-a-valid-uuid');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Booking not found');
    });

    test('7. GET /api/v1/bookings/search routes to searchAvailability and never to getBooking', async () => {
        // Calling GET /search without params must return searchAvailability validation error (400)
        // rather than getBooking 404/500
        const res = await request(app).get('/api/v1/bookings/search');
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('tenantId is required');
    });

    test('8. GET /api/v1/bookings/package-search without params returns HTTP 400 with tenantId required', async () => {
        const res = await request(app).get('/api/v1/bookings/package-search');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('tenantId is required');
    });
});
