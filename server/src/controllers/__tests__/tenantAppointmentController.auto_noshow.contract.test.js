const { Op } = require('sequelize');

jest.mock('../../services/pushNotificationService', () => ({ sendToUser: jest.fn() }));
jest.mock('../../services/customerNotificationService', () => ({}));
jest.mock('../../services/bookingService', () => ({ hasConflict: jest.fn() }));
jest.mock('../../services/appointmentLifecycleService', () => ({}));
jest.mock('../../services/availabilityService', () => ({}));
jest.mock('../../services/staffNotificationService', () => ({}));
jest.mock('../../services/splitPaymentService', () => ({}));
jest.mock('../../services/userService', () => ({}));
jest.mock('../../services/paymentTransactionLedgerService', () => ({}));
jest.mock('../../services/customerInvoiceService', () => ({}));
jest.mock('../../services/customerInvoiceEmailService', () => ({}));
jest.mock('../../utils/forensicTrace', () => ({
    createForensicTrace: jest.fn(() => ({
        log: jest.fn(),
        sqlLogger: jest.fn()
    }))
}));


const db = require('../../models');
jest.mock('../../models', () => ({
    Sequelize: { Op: { lt: Symbol('lt'), in: Symbol('in'), notIn: Symbol('notIn') } },
    sequelize: {
        transaction: jest.fn().mockResolvedValue({
            commit: jest.fn(),
            rollback: jest.fn()
        })
    },
    Appointment: {
        update: jest.fn(),
        findOne: jest.fn(),
        findAll: jest.fn()
    },
    Service: {},
    Staff: {},
    PlatformUser: {},
    BookingSession: {},
    Product: {},
    OrderItem: {},
    Order: {},
    TenantSettings: {
        findOne: jest.fn().mockResolvedValue({ timezone: 'UTC' })
    }
}));

const tenantAppointmentController = require('../tenantAppointmentController');

describe('tenantAppointmentController Auto NO_SHOW and Status Fixes', () => {
    let req, res;
    
    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            tenantId: 'tenant-123',
            params: { id: 'appointment-123' },
            query: {},
            body: {},
            method: 'GET',
            originalUrl: '/api/v1/tenant/appointments/appointment-123'
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn(),
            once: jest.fn()
        };
    });

    describe('GET /api/v1/tenant/appointments (getAppointments)', () => {
        it('1. getAppointments does NOT convert checked_in -> no_show & 2. does NOT convert in_service -> no_show', async () => {
            db.Appointment.findAll.mockResolvedValue([]);
            await tenantAppointmentController.getAppointments(req, res);
            
            expect(db.Appointment.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'no_show' }),
                expect.objectContaining({
                    where: expect.objectContaining({
                        tenantId: 'tenant-123',
                        status: { [db.Sequelize.Op.in]: ['pending', 'confirmed'] }
                    })
                })
            );
        });

        it('5. pending past appointment can still be auto-marked no_show & 6. confirmed past appointment can still be auto-marked no_show', async () => {
            db.Appointment.findAll.mockResolvedValue([]);
            await tenantAppointmentController.getAppointments(req, res);
            
            // The Op.in ['pending', 'confirmed'] handles both 5 and 6
            const updateCall = db.Appointment.update.mock.calls[0];
            const statusFilter = updateCall[1].where.status;
            
            expect(statusFilter).toEqual({ [db.Sequelize.Op.in]: ['pending', 'confirmed'] });
            const endTimeFilter = updateCall[1].where.endTime;
            expect(Object.getOwnPropertySymbols(endTimeFilter)).toContain(db.Sequelize.Op.lt);
        });
    });

    describe('GET /api/v1/tenant/appointments/:id (getAppointment)', () => {
        it('3. getAppointment does NOT convert checked_in -> no_show & 4. does NOT convert in_service -> no_show', async () => {
            db.Appointment.findOne.mockResolvedValue(null);
            await tenantAppointmentController.getAppointment(req, res);
            
            expect(db.Appointment.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'no_show' }),
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 'appointment-123',
                        tenantId: 'tenant-123',
                        status: { [db.Sequelize.Op.in]: ['pending', 'confirmed'] }
                    })
                })
            );
        });
    });

    describe('PATCH /api/v1/tenant/appointments/:id/status (updateAppointmentStatus)', () => {
        it('7. NO_SHOW -> CHECKED_IN clears noShowMarkedAt', async () => {
            const mockAppointment = {
                id: 'appointment-123',
                status: 'no_show',
                noShowMarkedAt: new Date('2026-09-01T10:00:00Z'),
                save: jest.fn()
            };
            db.Appointment.findOne.mockResolvedValue(mockAppointment);
            
            req.body = { status: 'checked_in' };
            await tenantAppointmentController.updateAppointmentStatus(req, res);
            
            expect(mockAppointment.status).toBe('checked_in');
            expect(mockAppointment.noShowMarkedAt).toBeNull();
            expect(mockAppointment.save).toHaveBeenCalled();
        });

        it('8. NO_SHOW -> IN_SERVICE clears noShowMarkedAt if transition is valid', async () => {
            const mockAppointment = {
                id: 'appointment-123',
                status: 'no_show',
                noShowMarkedAt: new Date('2026-09-01T10:00:00Z'),
                save: jest.fn()
            };
            db.Appointment.findOne.mockResolvedValue(mockAppointment);
            
            req.body = { status: 'in_service' };
            await tenantAppointmentController.updateAppointmentStatus(req, res);
            
            expect(mockAppointment.status).toBe('in_service');
            expect(mockAppointment.noShowMarkedAt).toBeNull();
            expect(mockAppointment.save).toHaveBeenCalled();
        });

        it('10. Existing auto-no-show behavior remains intact for pending and confirmed (pending -> no_show populates noShowMarkedAt)', async () => {
            const mockAppointment = {
                id: 'appointment-123',
                status: 'pending',
                noShowMarkedAt: null,
                save: jest.fn()
            };
            db.Appointment.findOne.mockResolvedValue(mockAppointment);
            
            req.body = { status: 'no_show' };
            await tenantAppointmentController.updateAppointmentStatus(req, res);
            
            expect(mockAppointment.status).toBe('no_show');
            expect(mockAppointment.noShowMarkedAt).toBeInstanceOf(Date);
            expect(mockAppointment.save).toHaveBeenCalled();
        });
    });
});
