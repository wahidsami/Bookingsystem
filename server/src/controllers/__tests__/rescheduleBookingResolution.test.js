const {
    rescheduleBooking,
    getBooking,
    getInviteDetails
} = require('../bookingController');
const db = require('../../models');
const bookingService = require('../../services/bookingService');

describe('Reschedule Booking & Tenant Contact Resolution', () => {
    let originalAppointmentFindOne;
    let originalAppointmentFindByPk;
    let originalStaffFindOne;
    let originalTenantSettingsFindOne;
    let originalTransaction;
    let originalEvaluate;
    let originalEventCreate;

    beforeEach(() => {
        originalAppointmentFindOne = db.Appointment.findOne;
        originalAppointmentFindByPk = db.Appointment.findByPk;
        originalStaffFindOne = db.Staff.findOne;
        originalTenantSettingsFindOne = db.TenantSettings?.findOne;
        originalTransaction = db.sequelize.transaction;
        originalEvaluate = bookingService.evaluateSchedulingRequest;
        originalEventCreate = db.AppointmentEvent?.create;

        if (db.TenantSettings) {
            db.TenantSettings.findOne = jest.fn().mockResolvedValue({
                bookingSettings: { rescheduleHours: 2 }
            });
        }
        if (db.AppointmentEvent) {
            db.AppointmentEvent.create = jest.fn().mockResolvedValue({});
        }
    });

    afterEach(() => {
        db.Appointment.findOne = originalAppointmentFindOne;
        db.Appointment.findByPk = originalAppointmentFindByPk;
        db.Staff.findOne = originalStaffFindOne;
        if (db.TenantSettings) {
            db.TenantSettings.findOne = originalTenantSettingsFindOne;
        }
        db.sequelize.transaction = originalTransaction;
        bookingService.evaluateSchedulingRequest = originalEvaluate;
        if (db.AppointmentEvent) {
            db.AppointmentEvent.create = originalEventCreate;
        }
    });

    test('1. Successful reschedule uses ["whatsapp", "whatsappNumber"] attribute mapping and returns 200', async () => {
        const mockTransaction = {
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
            finished: false
        };
        db.sequelize.transaction = jest.fn().mockResolvedValue(mockTransaction);

        const futureDate = new Date(Date.now() + 48 * 3600 * 1000);
        const originalStart = new Date(Date.now() + 24 * 3600 * 1000);
        const originalEnd = new Date(originalStart.getTime() + 60 * 60000);

        const mockAppointment = {
            id: 'apt-123',
            tenantId: 'tenant-456',
            serviceId: 'srv-789',
            staffId: 'staff-001',
            platformUserId: 'user-001',
            status: 'confirmed',
            startTime: originalStart,
            endTime: originalEnd,
            service: { duration: 60, allowReschedule: true },
            staff: { tenantId: 'tenant-456' },
            notes: '',
            customerReminderSentAt: new Date(),
            noShowMarkedAt: null,
            save: jest.fn().mockResolvedValue(true)
        };

        const mockStaff = {
            id: 'staff-001',
            tenantId: 'tenant-456',
            isActive: true
        };

        db.Appointment.findOne = jest.fn().mockResolvedValue(mockAppointment);
        db.Staff.findOne = jest.fn().mockResolvedValue(mockStaff);
        bookingService.evaluateSchedulingRequest = jest.fn().mockResolvedValue({ valid: true });

        let queriedInclude = null;
        db.Appointment.findByPk = jest.fn().mockImplementation((id, options) => {
            queriedInclude = options.include;
            return Promise.resolve({
                ...mockAppointment,
                startTime: futureDate,
                tenant: {
                    id: 'tenant-456',
                    name: 'Happiness Salon',
                    whatsappNumber: '+966500000000'
                }
            });
        });

        const req = {
            params: { id: 'apt-123' },
            userId: 'user-001',
            body: {
                startTime: futureDate.toISOString(),
                staffId: 'staff-001'
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await rescheduleBooking(req, res);

        expect(mockAppointment.save).toHaveBeenCalled();
        expect(mockTransaction.commit).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: 'Booking rescheduled successfully'
        }));

        // Verify that the tenant include attributes use ['whatsapp', 'whatsappNumber']
        const tenantInclude = queriedInclude.find(inc => inc.as === 'tenant');
        expect(tenantInclude).toBeDefined();
        expect(tenantInclude.attributes).toContainEqual(['whatsapp', 'whatsappNumber']);
        expect(tenantInclude.attributes).not.toContain('whatsappNumber');
    });

    test('2. If post-commit refresh query encounters an error, reschedule remains successful and returns 200', async () => {
        const mockTransaction = {
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
            finished: false
        };
        db.sequelize.transaction = jest.fn().mockResolvedValue(mockTransaction);

        const futureDate = new Date(Date.now() + 48 * 3600 * 1000);
        const originalStart = new Date(Date.now() + 24 * 3600 * 1000);

        const mockAppointment = {
            id: 'apt-999',
            tenantId: 'tenant-456',
            serviceId: 'srv-789',
            staffId: 'staff-001',
            platformUserId: 'user-001',
            status: 'confirmed',
            startTime: originalStart,
            endTime: new Date(originalStart.getTime() + 60 * 60000),
            service: { duration: 60, allowReschedule: true },
            staff: { tenantId: 'tenant-456' },
            notes: '',
            save: jest.fn().mockResolvedValue(true)
        };

        db.Appointment.findOne = jest.fn().mockResolvedValue(mockAppointment);
        db.Staff.findOne = jest.fn().mockResolvedValue({ id: 'staff-001', tenantId: 'tenant-456', isActive: true });
        bookingService.evaluateSchedulingRequest = jest.fn().mockResolvedValue({ valid: true });

        // Simulate secondary findByPk failure after transaction commit
        db.Appointment.findByPk = jest.fn().mockRejectedValue(new Error('column tenant.whatsappNumber does not exist'));

        const req = {
            params: { id: 'apt-999' },
            userId: 'user-001',
            body: {
                startTime: futureDate.toISOString()
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await rescheduleBooking(req, res);

        expect(mockTransaction.commit).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: 'Booking rescheduled successfully',
            appointment: mockAppointment
        }));
    });

    test('3. Genuinely conflicting reschedule fails with 409 and rolls back transaction', async () => {
        const mockTransaction = {
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
            finished: false
        };
        db.sequelize.transaction = jest.fn().mockResolvedValue(mockTransaction);

        const futureDate = new Date(Date.now() + 48 * 3600 * 1000);
        const originalStart = new Date(Date.now() + 24 * 3600 * 1000);

        const mockAppointment = {
            id: 'apt-conflict',
            tenantId: 'tenant-456',
            serviceId: 'srv-789',
            staffId: 'staff-001',
            platformUserId: 'user-001',
            status: 'confirmed',
            startTime: originalStart,
            endTime: new Date(originalStart.getTime() + 60 * 60000),
            service: { duration: 60, allowReschedule: true },
            staff: { tenantId: 'tenant-456' },
            save: jest.fn()
        };

        db.Appointment.findOne = jest.fn().mockResolvedValue(mockAppointment);
        db.Staff.findOne = jest.fn().mockResolvedValue({ id: 'staff-001', tenantId: 'tenant-456', isActive: true });
        // Return genuine scheduling conflict
        bookingService.evaluateSchedulingRequest = jest.fn().mockResolvedValue({
            valid: false,
            reasonType: 'STAFF_BUSY',
            message: 'Staff member is already booked at this time'
        });

        const req = {
            params: { id: 'apt-conflict' },
            userId: 'user-001',
            body: {
                startTime: futureDate.toISOString()
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await rescheduleBooking(req, res);

        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(mockAppointment.save).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            code: 'STAFF_BUSY',
            message: 'Staff member is already booked at this time'
        }));
    });

    test('4. Reschedule to past time fails with 400 and rolls back transaction', async () => {
        const mockTransaction = {
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
            finished: false
        };
        db.sequelize.transaction = jest.fn().mockResolvedValue(mockTransaction);

        const pastDate = new Date(Date.now() - 3600 * 1000);
        const originalStart = new Date(Date.now() + 24 * 3600 * 1000);

        const mockAppointment = {
            id: 'apt-past',
            tenantId: 'tenant-456',
            platformUserId: 'user-001',
            startTime: originalStart,
            status: 'confirmed',
            service: { allowReschedule: true }
        };

        db.Appointment.findOne = jest.fn().mockResolvedValue(mockAppointment);

        const req = {
            params: { id: 'apt-past' },
            userId: 'user-001',
            body: {
                startTime: pastDate.toISOString()
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await rescheduleBooking(req, res);

        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'New booking time must be in the future'
        }));
    });

    test('5. getBooking query uses ["whatsapp", "whatsappNumber"] attribute mapping', async () => {
        let queriedInclude = null;
        db.Appointment.findByPk = jest.fn().mockImplementation((id, options) => {
            queriedInclude = options.include;
            return Promise.resolve({
                id: 'apt-001',
                tenant: { id: 'tenant-456', whatsappNumber: '+966500000000' }
            });
        });

        const req = {
            params: { id: 'apt-001' },
            userId: 'user-001'
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getBooking(req, res);

        const tenantInclude = queriedInclude.find(inc => inc.as === 'tenant');
        expect(tenantInclude).toBeDefined();
        expect(tenantInclude.attributes).toContainEqual(['whatsapp', 'whatsappNumber']);
        expect(tenantInclude.attributes).not.toContain('whatsappNumber');
    });

    test('6. getInviteDetails query uses ["whatsapp", "whatsappNumber"] attribute mapping', async () => {
        let queriedInclude = null;
        db.Appointment.findOne = jest.fn().mockImplementation((options) => {
            queriedInclude = options.include;
            return Promise.resolve({
                id: 'apt-invite',
                inviteToken: 'token-abc',
                tenant: { id: 'tenant-456', whatsappNumber: '+966500000000' }
            });
        });

        const req = {
            params: { token: 'token-abc' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await getInviteDetails(req, res);

        const tenantInclude = queriedInclude.find(inc => inc.as === 'tenant');
        expect(tenantInclude).toBeDefined();
        expect(tenantInclude.attributes).toContainEqual(['whatsapp', 'whatsappNumber']);
        expect(tenantInclude.attributes).not.toContain('whatsappNumber');
    });
});
