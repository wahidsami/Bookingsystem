const tenantAppointmentController = require('../tenantAppointmentController');
const bookingService = require('../../services/bookingService');
const AuditService = require('../../services/auditService');
const db = require('../../models');

jest.mock('../../services/bookingService');
jest.mock('../../services/auditService');
jest.mock('../../models', () => {
    return {
        sequelize: {
            transaction: jest.fn()
        },
        PlatformUser: { findOne: jest.fn(), create: jest.fn() },
        Appointment: { findAll: jest.fn() },
        Tenant: { findByPk: jest.fn() },
        Service: { findByPk: jest.fn() },
        TenantSettings: { findOne: jest.fn() }
    };
});
jest.mock('../../services/userService', () => ({
    findUserByEmailOrPhone: jest.fn().mockResolvedValue({ id: 'user-123', isActive: true, update: jest.fn() })
}));

describe('tenantAppointmentController - createAppointment Audit', () => {
    let req, res, mockTransaction;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
        db.sequelize.transaction.mockResolvedValue(mockTransaction);
        
        req = {
            tenantId: 'tenant-123',
            userId: 'user-123',
            tenantAccountId: 'acc-123',
            tenantAccount: { roleKey: 'owner', name: 'Test Owner' },
            body: {
                serviceId: 'srv-123',
                startTime: '2026-09-10T10:00:00Z',
                items: [{ serviceId: 'srv-123', startTime: '2026-09-10T10:00:00Z' }],
                customer: { firstName: 'John' }
            },
            operationContext: { op: 'test' }
        };
        
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        
        bookingService.createBookingSession.mockResolvedValue({
            session: { id: 'sess-123', bookingReference: 'REF-1' },
            appointments: [{ id: 'appt-123', serviceId: 'srv-123', status: 'confirmed', bookingNumber: 'BKG-1' }],
            paymentSummary: {}
        });
        
        db.Appointment.findAll.mockResolvedValue([
            { id: 'appt-123', serviceId: 'srv-123', status: 'confirmed', bookingNumber: 'BKG-1' }
        ]);
        
        db.PlatformUser.findOne.mockResolvedValue({ id: 'plat-123' });
    });

    it('should create an ActivityLog for each created appointment using the same transaction', async () => {
        // We catch the error locally since we mocked everything and it might throw on something else
        try {
            await tenantAppointmentController.createAppointment(req, res);
        } catch (e) {
            // Ignore error from deep within the controller since we only mocked partially
        }
        
        expect(AuditService.logActivity).toHaveBeenCalledTimes(1);
        expect(AuditService.logActivity).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-123',
            entityType: 'Appointment',
            entityId: 'appt-123',
            action: 'create',
        }), expect.objectContaining({
            transaction: mockTransaction
        }));
    });

    it('should rollback if AuditService throws an error (preserving atomicity)', async () => {
        AuditService.logActivity.mockRejectedValueOnce(new Error('Audit DB Down'));
        
        try {
            await tenantAppointmentController.createAppointment(req, res);
        } catch (e) {
            // expected
        }
        
        expect(AuditService.logActivity).toHaveBeenCalled();
        expect(mockTransaction.commit).not.toHaveBeenCalled();
    });
});
