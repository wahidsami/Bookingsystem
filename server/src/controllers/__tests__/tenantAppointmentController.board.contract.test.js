const { Op: mockOp } = require('sequelize');

jest.mock('../../services/pushNotificationService', () => ({
    sendToUser: jest.fn()
}));
jest.mock('../../services/customerNotificationService', () => ({}));
jest.mock('../../services/bookingService', () => ({
    hasConflict: jest.fn()
}));
jest.mock('../../services/appointmentLifecycleService', () => ({}));
jest.mock('../../services/availabilityService', () => ({
    getAvailableSlots: jest.fn(),
    _getTimeZoneDayRange: jest.fn((dateKey, timezone) => {
        if (dateKey === '2026-08-16') {
            return {
                startOfDay: new Date('2026-08-15T21:00:00.000Z'),
                endOfDay: new Date('2026-08-16T20:59:59.999Z')
            };
        }

        if (dateKey === '2026-08-17') {
            return {
                startOfDay: new Date('2026-08-16T21:00:00.000Z'),
                endOfDay: new Date('2026-08-17T20:59:59.999Z')
            };
        }

        return {
            startOfDay: new Date(`${dateKey}T00:00:00.000Z`),
            endOfDay: new Date(`${dateKey}T23:59:59.999Z`)
        };
    })
}));
jest.mock('../../services/staffNotificationService', () => ({
    createStaffAppointmentMessage: jest.fn()
}));
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
jest.mock('../../utils/url', () => ({
    getServerPublicUrl: jest.fn()
}));
jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn()
}));

const mockDb = {
    Sequelize: { Op: mockOp },
    sequelize: {
        transaction: jest.fn()
    },
    Appointment: {
        update: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn()
    },
    Staff: {
        findAll: jest.fn(),
        findOne: jest.fn()
    },
    StaffBreak: {
        findAll: jest.fn()
    },
    TenantSettings: {
        findOne: jest.fn()
    },
    Service: {},
    ServiceEmployee: {
        findOne: jest.fn()
    },
    PlatformUser: {},
    AppointmentEvent: {
        create: jest.fn()
    }
};

jest.mock('../../models', () => mockDb);

const controller = require('../tenantAppointmentController');
const bookingService = require('../../services/bookingService');
const availabilityService = require('../../services/availabilityService');

const createRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn()
});

const boardRangeForDate = (dateKey) => {
    if (dateKey === '2026-08-16') {
        return {
            startOfDay: new Date('2026-08-15T21:00:00.000Z'),
            endOfDay: new Date('2026-08-16T20:59:59.999Z'),
            nextDayStart: new Date('2026-08-16T21:00:00.000Z')
        };
    }

    if (dateKey === '2026-08-17') {
        return {
            startOfDay: new Date('2026-08-16T21:00:00.000Z'),
            endOfDay: new Date('2026-08-17T20:59:59.999Z'),
            nextDayStart: new Date('2026-08-17T21:00:00.000Z')
        };
    }

    throw new Error(`Unsupported test date: ${dateKey}`);
};

const createAppointmentSeed = (overrides) => ({
    id: overrides.id,
    tenantId: 'tenant-1',
    staffId: overrides.staffId || 'staff-1',
    serviceId: overrides.serviceId || 'service-1',
    status: overrides.status || 'scheduled',
    paymentStatus: overrides.paymentStatus || 'unpaid',
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    service: overrides.service || { id: overrides.serviceId || 'service-1', tenantId: 'tenant-1' },
    staff: overrides.staff || { id: overrides.staffId || 'staff-1', tenantId: 'tenant-1' },
    user: overrides.user || null
});

const createBreakSeed = (overrides) => ({
    id: overrides.id,
    staffId: overrides.staffId || 'staff-1',
    type: overrides.type || 'lunch',
    label: overrides.label || 'Break',
    isRecurring: overrides.isRecurring || false,
    specificDate: overrides.specificDate || null,
    dayOfWeek: overrides.dayOfWeek ?? null,
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    isActive: overrides.isActive !== false
});

const applyAppointmentBoardFilter = (where, appointment) => {
    const startConstraint = where?.startTime?.[mockOp.lt];
    const endConstraint = where?.endTime?.[mockOp.gt];

    if (startConstraint && !(new Date(appointment.startTime) < startConstraint)) {
        return false;
    }

    if (endConstraint && !(new Date(appointment.endTime) > endConstraint)) {
        return false;
    }

    if (where?.staffId && appointment.staffId !== where.staffId) {
        return false;
    }

    if (where?.serviceId && appointment.serviceId !== where.serviceId) {
        return false;
    }

    if (where?.paymentStatus && appointment.paymentStatus !== where.paymentStatus) {
        return false;
    }

    if (where?.status && where.status[mockOp.ne]) {
        return appointment.status !== where.status[mockOp.ne];
    }

    if (typeof where?.status === 'string') {
        return appointment.status === where.status;
    }

    return true;
};

const applyBreakBoardFilter = (where, breakRecord) => {
    const staffIds = where?.staffId?.[mockOp.in] || [];
    if (staffIds.length > 0 && !staffIds.includes(breakRecord.staffId)) {
        return false;
    }

    if (where?.isActive === true && breakRecord.isActive !== true) {
        return false;
    }

    const dateSpecific = Array.isArray(where?.[mockOp.or])
        ? where[mockOp.or].find((item) => item && Object.prototype.hasOwnProperty.call(item, 'specificDate'))
        : null;

    if (dateSpecific && !breakRecord.isRecurring) {
        return breakRecord.specificDate === dateSpecific.specificDate;
    }

    return true;
};

describe('tenantAppointmentController.reassignRescheduleAppointment', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockDb.Appointment.findOne.mockResolvedValue(null);
        mockDb.Staff.findOne.mockResolvedValue({ id: 'staff-2', tenantId: 'tenant-1', isActive: true, name: 'Staff 2' });
        mockDb.ServiceEmployee.findOne.mockResolvedValue({ serviceId: 'service-1', staffId: 'staff-2' });
        mockDb.TenantSettings.findOne.mockResolvedValue({ timezone: 'Asia/Riyadh' });
        mockDb.AppointmentEvent.create.mockResolvedValue({});
        bookingService.hasConflict.mockResolvedValue(false);
        availabilityService.getAvailableSlots.mockResolvedValue({
            slots: [{ available: true, startTime: '2026-10-02T09:00:00.000Z', endTime: '2026-10-02T10:00:00.000Z' }]
        });
        mockDb.sequelize.transaction.mockResolvedValue({
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined)
        });
    });

    it('allows rescheduling a no-show appointment to a future slot', async () => {
        const appointment = {
            id: 'appt-1',
            tenantId: 'tenant-1',
            staffId: 'staff-1',
            requestedStaffId: 'staff-1',
            assignmentMode: 'unknown',
            serviceId: 'service-1',
            status: 'no_show',
            paymentStatus: 'unpaid',
            platformUserId: null,
            bookingNumber: 'B-000001',
            startTime: new Date('2026-10-01T09:00:00.000Z'),
            endTime: new Date('2026-10-01T10:00:00.000Z'),
            service: { id: 'service-1', tenantId: 'tenant-1', name_en: 'Massage', name_ar: 'مساج' },
            staff: { id: 'staff-1', tenantId: 'tenant-1', name: 'Staff 1' },
            user: null,
            save: jest.fn().mockResolvedValue(undefined)
        };
        mockDb.Appointment.findOne.mockResolvedValue(appointment);

        const req = {
            tenantId: 'tenant-1',
            params: { id: 'appt-1' },
            body: {
                staffId: 'staff-2',
                startTime: '2026-10-02T09:00:00.000Z',
                notifyCustomer: false
            }
        };
        const res = createRes();

        await controller.reassignRescheduleAppointment(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(appointment.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: 'Appointment updated successfully'
        }));
    });

    it('keeps completed appointments blocked from reassign-reschedule', async () => {
        const appointment = {
            id: 'appt-2',
            tenantId: 'tenant-1',
            staffId: 'staff-1',
            requestedStaffId: 'staff-1',
            assignmentMode: 'unknown',
            serviceId: 'service-1',
            status: 'completed',
            paymentStatus: 'unpaid',
            platformUserId: null,
            bookingNumber: 'B-000002',
            startTime: new Date('2026-10-01T09:00:00.000Z'),
            endTime: new Date('2026-10-01T10:00:00.000Z'),
            service: { id: 'service-1', tenantId: 'tenant-1', name_en: 'Massage', name_ar: 'مساج' },
            staff: { id: 'staff-1', tenantId: 'tenant-1', name: 'Staff 1' },
            user: null,
            save: jest.fn()
        };
        mockDb.Appointment.findOne.mockResolvedValue(appointment);

        const req = {
            tenantId: 'tenant-1',
            params: { id: 'appt-2' },
            body: {
                staffId: 'staff-2',
                startTime: '2026-10-02T09:00:00.000Z',
                notifyCustomer: false
            }
        };
        const res = createRes();

        await controller.reassignRescheduleAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Closed appointments cannot be changed'
        }));
    });

    it('allows rescheduling an arrived (checked_in) appointment even if past its original time', async () => {
        const appointment = {
            id: 'appt-arrived-1',
            tenantId: 'tenant-1',
            staffId: 'staff-1',
            requestedStaffId: 'staff-1',
            assignmentMode: 'unknown',
            serviceId: 'service-1',
            status: 'checked_in',
            paymentStatus: 'unpaid',
            platformUserId: null,
            bookingNumber: 'B-000003',
            startTime: new Date(Date.now() - 3600000), // 1 hour ago
            endTime: new Date(Date.now() - 1800000),
            service: { id: 'service-1', tenantId: 'tenant-1', name_en: 'Massage', name_ar: 'مساج' },
            staff: { id: 'staff-1', tenantId: 'tenant-1', name: 'Staff 1' },
            user: null,
            save: jest.fn().mockResolvedValue(undefined)
        };
        mockDb.Appointment.findOne.mockResolvedValue(appointment);

        const req = {
            tenantId: 'tenant-1',
            params: { id: 'appt-arrived-1' },
            body: {
                staffId: 'staff-2',
                startTime: '2026-10-02T09:00:00.000Z',
                notifyCustomer: false
            }
        };
        const res = createRes();

        await controller.reassignRescheduleAppointment(req, res);

        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true
        }));
        expect(appointment.save).toHaveBeenCalled();
    });

    it('allows rescheduling an in_service appointment even if past its original time', async () => {
        const appointment = {
            id: 'appt-in-service-1',
            tenantId: 'tenant-1',
            staffId: 'staff-1',
            requestedStaffId: 'staff-1',
            assignmentMode: 'unknown',
            serviceId: 'service-1',
            status: 'in_service',
            paymentStatus: 'unpaid',
            platformUserId: null,
            bookingNumber: 'B-000004',
            startTime: new Date(Date.now() - 3600000),
            endTime: new Date(Date.now() - 1800000),
            service: { id: 'service-1', tenantId: 'tenant-1', name_en: 'Massage', name_ar: 'مساج' },
            staff: { id: 'staff-1', tenantId: 'tenant-1', name: 'Staff 1' },
            user: null,
            save: jest.fn().mockResolvedValue(undefined)
        };
        mockDb.Appointment.findOne.mockResolvedValue(appointment);

        const req = {
            tenantId: 'tenant-1',
            params: { id: 'appt-in-service-1' },
            body: {
                staffId: 'staff-2',
                startTime: '2026-10-02T09:00:00.000Z',
                notifyCustomer: false
            }
        };
        const res = createRes();

        await controller.reassignRescheduleAppointment(req, res);

        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true
        }));
        expect(appointment.save).toHaveBeenCalled();
    });

    it('passes excludeAppointmentId during drag and drop reassign-reschedule', async () => {
        const appointment = {
            id: 'appt-self-conflict-1',
            tenantId: 'tenant-1',
            staffId: 'staff-1',
            requestedStaffId: 'staff-1',
            assignmentMode: 'unknown',
            serviceId: 'service-1',
            status: 'pending',
            paymentStatus: 'unpaid',
            platformUserId: null,
            bookingNumber: 'B-000005',
            startTime: new Date(Date.now() - 3600000),
            endTime: new Date(Date.now() - 1800000),
            service: { id: 'service-1', tenantId: 'tenant-1', name_en: 'Massage', name_ar: 'مساج' },
            staff: { id: 'staff-1', tenantId: 'tenant-1', name: 'Staff 1' },
            user: null,
            save: jest.fn().mockResolvedValue(undefined)
        };
        mockDb.Appointment.findOne.mockResolvedValue(appointment);

        const req = {
            tenantId: 'tenant-1',
            params: { id: 'appt-self-conflict-1' },
            body: {
                staffId: 'staff-1',
                startTime: '2026-10-02T09:00:00.000Z',
                notifyCustomer: false
            }
        };
        const res = createRes();

        await controller.reassignRescheduleAppointment(req, res);

        expect(bookingService.hasConflict).toHaveBeenCalledWith(
            'staff-1',
            expect.any(Date),
            expect.any(Date),
            'appt-self-conflict-1',
            expect.anything()
        );
    });

    it('Test 1 - self-overlap allowed: reschedule to a slightly overlapping time succeeds if no other conflict', async () => {
        const appointment = {
            id: 'appt-self-overlap',
            tenantId: 'tenant-1',
            staffId: 'staff-1',
            requestedStaffId: 'staff-1',
            assignmentMode: 'unknown',
            serviceId: 'service-1',
            status: 'pending',
            paymentStatus: 'unpaid',
            platformUserId: null,
            bookingNumber: 'B-000005',
            startTime: new Date('2026-10-01T15:30:00.000Z'),
            endTime: new Date('2026-10-01T16:30:00.000Z'),
            service: { id: 'service-1', tenantId: 'tenant-1', name_en: 'Massage', name_ar: 'مساج' },
            staff: { id: 'staff-1', tenantId: 'tenant-1', name: 'Staff 1' },
            user: null,
            save: jest.fn().mockResolvedValue(undefined)
        };
        mockDb.Appointment.findOne.mockResolvedValue(appointment);
        bookingService.hasConflict.mockResolvedValue(false);
        // The slot is marked available because the secondary check also correctly excludes the self-conflict
        availabilityService.getAvailableSlots.mockResolvedValue({ slots: [{ available: true, startTime: '2026-10-01T15:50:00.000Z', endTime: '2026-10-01T16:50:00.000Z' }] });

        const req = {
            tenantId: 'tenant-1',
            params: { id: 'appt-self-overlap' },
            body: {
                staffId: 'staff-1',
                startTime: '2026-10-01T15:50:00.000Z',
                notifyCustomer: false
            }
        };
        const res = createRes();

        await controller.reassignRescheduleAppointment(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(appointment.save).toHaveBeenCalled();
        
        // Test 4 - same appointment ID is excluded
        expect(availabilityService.getAvailableSlots).toHaveBeenCalledWith(
            'tenant-1',
            expect.objectContaining({
                serviceId: 'service-1',
                staffId: 'staff-1',
                excludeAppointmentId: 'appt-self-overlap'
            })
        );
    });

    it('Test 3 - genuine conflict still blocks', async () => {
        const appointment = {
            id: 'appt-conflict',
            tenantId: 'tenant-1',
            staffId: 'staff-1',
            requestedStaffId: 'staff-1',
            assignmentMode: 'unknown',
            serviceId: 'service-1',
            status: 'pending',
            paymentStatus: 'unpaid',
            platformUserId: null,
            bookingNumber: 'B-000006',
            startTime: new Date('2026-10-01T15:30:00.000Z'),
            endTime: new Date('2026-10-01T16:30:00.000Z'),
            service: { id: 'service-1', tenantId: 'tenant-1', name_en: 'Massage', name_ar: 'مساج' },
            staff: { id: 'staff-1', tenantId: 'tenant-1', name: 'Staff 1' },
            user: null,
            save: jest.fn()
        };
        mockDb.Appointment.findOne.mockResolvedValue(appointment);
        bookingService.hasConflict.mockResolvedValue(true); // genuine conflict from primary check

        const req = {
            tenantId: 'tenant-1',
            params: { id: 'appt-conflict' },
            body: {
                staffId: 'staff-1',
                startTime: '2026-10-01T16:00:00.000Z',
                notifyCustomer: false
            }
        };
        const res = createRes();

        await controller.reassignRescheduleAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Selected slot is not available' }));
    });

    it('Test 5 - status policy remains intact (NO_SHOW / ARRIVED reschedulable, CANCELLED rejected)', async () => {
        const baseAppointment = {
            tenantId: 'tenant-1',
            staffId: 'staff-1',
            requestedStaffId: 'staff-1',
            assignmentMode: 'unknown',
            serviceId: 'service-1',
            paymentStatus: 'unpaid',
            platformUserId: null,
            startTime: new Date('2026-10-01T09:00:00.000Z'),
            endTime: new Date('2026-10-01T10:00:00.000Z'),
            service: { id: 'service-1', tenantId: 'tenant-1', name_en: 'Massage', name_ar: 'مساج' },
            staff: { id: 'staff-1', tenantId: 'tenant-1', name: 'Staff 1' },
            user: null,
            save: jest.fn().mockResolvedValue(undefined)
        };

        bookingService.hasConflict.mockResolvedValue(false);
        availabilityService.getAvailableSlots.mockResolvedValue({ slots: [{ available: true, startTime: '2026-10-02T09:00:00.000Z', endTime: '2026-10-02T10:00:00.000Z' }] });

        const req = {
            tenantId: 'tenant-1',
            body: { staffId: 'staff-2', startTime: '2026-10-02T09:00:00.000Z', notifyCustomer: false }
        };
        const res = createRes();

        // NO_SHOW -> Allowed
        mockDb.Appointment.findOne.mockResolvedValue({ ...baseAppointment, id: 'appt-ns', status: 'no_show', bookingNumber: 'B-NS' });
        req.params = { id: 'appt-ns' };
        await controller.reassignRescheduleAppointment(req, res);
        expect(baseAppointment.save).toHaveBeenCalled();

        // ARRIVED -> Allowed
        jest.clearAllMocks();
        mockDb.Appointment.findOne.mockResolvedValue({ ...baseAppointment, id: 'appt-ar', status: 'arrived', bookingNumber: 'B-AR' });
        req.params = { id: 'appt-ar' };
        await controller.reassignRescheduleAppointment(req, res);
        expect(baseAppointment.save).toHaveBeenCalled();

        // CANCELLED -> Rejected
        jest.clearAllMocks();
        mockDb.Appointment.findOne.mockResolvedValue({ ...baseAppointment, id: 'appt-cx', status: 'cancelled', bookingNumber: 'B-CX' });
        req.params = { id: 'appt-cx' };
        await controller.reassignRescheduleAppointment(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Closed appointments cannot be changed' }));
    });
});

describe('tenantAppointmentController.getAppointmentsBoard', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockDb.Appointment.update.mockResolvedValue([0]);
        mockDb.Appointment.findOne.mockResolvedValue(null);
        mockDb.TenantSettings.findOne.mockResolvedValue({ timezone: 'Asia/Riyadh' });
        mockDb.Staff.findAll.mockResolvedValue([{ id: 'staff-1' }]);
        mockDb.Staff.findOne.mockResolvedValue({ id: 'staff-1', tenantId: 'tenant-1', isActive: true });
        mockDb.ServiceEmployee.findOne.mockResolvedValue({ serviceId: 'service-1', staffId: 'staff-1' });
        mockDb.AppointmentEvent.create.mockResolvedValue({});
        bookingService.hasConflict.mockResolvedValue(false);
        availabilityService.getAvailableSlots.mockResolvedValue({ slots: [] });
    });

    it('uses the exact tenant-local day range and excludes next-day appointments from Aug 16', async () => {
        const dateKey = '2026-08-16';
        const range = boardRangeForDate(dateKey);

        const appointments = [
            createAppointmentSeed({
                id: 'appt-local',
                startTime: '2026-08-16T08:00:00.000Z',
                endTime: '2026-08-16T09:00:00.000Z'
            }),
            createAppointmentSeed({
                id: 'appt-next-day',
                startTime: '2026-08-17T10:00:00.000Z',
                endTime: '2026-08-17T11:00:00.000Z'
            }),
            createAppointmentSeed({
                id: 'appt-cross-midnight',
                startTime: '2026-08-16T20:30:00.000Z',
                endTime: '2026-08-16T21:30:00.000Z'
            }),
            createAppointmentSeed({
                id: 'appt-previous-day',
                startTime: '2026-08-15T20:30:00.000Z',
                endTime: '2026-08-15T22:30:00.000Z'
            })
        ];

        const breaks = [
            createBreakSeed({
                id: 'break-16',
                specificDate: '2026-08-16',
                startTime: '12:00:00',
                endTime: '12:45:00'
            }),
            createBreakSeed({
                id: 'break-17',
                specificDate: '2026-08-17',
                startTime: '12:00:00',
                endTime: '12:45:00'
            })
        ];

        mockDb.Appointment.findAll.mockImplementation(async ({ where }) => appointments
            .filter((appointment) => applyAppointmentBoardFilter(where, appointment))
            .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime()));
        mockDb.StaffBreak.findAll.mockImplementation(async ({ where }) => breaks
            .filter((breakRecord) => applyBreakBoardFilter(where, breakRecord))
            .sort((left, right) => `${left.startTime}`.localeCompare(`${right.startTime}`)));

        const req = {
            tenantId: 'tenant-1',
            query: {
                date: dateKey
            }
        };
        const res = createRes();

        await controller.getAppointmentsBoard(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, max-age=0, must-revalidate');
        expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
        expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
        expect(res.setHeader).toHaveBeenCalledWith('Surrogate-Control', 'no-store');

        expect(mockDb.Appointment.findAll).toHaveBeenCalledTimes(1);
        const appointmentWhere = mockDb.Appointment.findAll.mock.calls[0][0].where;
        expect(appointmentWhere.startTime[mockOp.lt].toISOString()).toBe(range.nextDayStart.toISOString());
        expect(appointmentWhere.endTime[mockOp.gt].toISOString()).toBe(range.startOfDay.toISOString());
        expect(appointmentWhere.startTime[mockOp.between]).toBeUndefined();

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            date: dateKey
        }));

        const payload = res.json.mock.calls[0][0];
        expect(payload.appointments.map((item) => item.id)).toEqual(expect.arrayContaining(['appt-local', 'appt-cross-midnight', 'appt-previous-day']));
        expect(payload.appointments.map((item) => item.id)).not.toContain('appt-next-day');
        expect(payload.breaks.map((item) => item.id)).toEqual(['break-16']);
    });

    it('returns Aug 17 appointments when Aug 17 is requested', async () => {
        const dateKey = '2026-08-17';
        const range = boardRangeForDate(dateKey);

        const appointments = [
            createAppointmentSeed({
                id: 'appt-17',
                startTime: '2026-08-17T10:00:00.000Z',
                endTime: '2026-08-17T11:00:00.000Z'
            }),
            createAppointmentSeed({
                id: 'appt-16',
                startTime: '2026-08-16T08:00:00.000Z',
                endTime: '2026-08-16T09:00:00.000Z'
            })
        ];

        mockDb.Appointment.findAll.mockImplementation(async ({ where }) => appointments
            .filter((appointment) => applyAppointmentBoardFilter(where, appointment))
            .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime()));
        mockDb.StaffBreak.findAll.mockResolvedValue([]);

        const req = {
            tenantId: 'tenant-1',
            query: {
                date: dateKey
            }
        };
        const res = createRes();

        await controller.getAppointmentsBoard(req, res);

        const appointmentWhere = mockDb.Appointment.findAll.mock.calls[0][0].where;
        expect(appointmentWhere.startTime[mockOp.lt].toISOString()).toBe(range.nextDayStart.toISOString());
        expect(appointmentWhere.endTime[mockOp.gt].toISOString()).toBe(range.startOfDay.toISOString());

        const payload = res.json.mock.calls[0][0];
        expect(payload.appointments.map((item) => item.id)).toEqual(['appt-17']);
        expect(payload.date).toBe(dateKey);
    });

    it('keeps breaks aligned to the requested date', async () => {
        const dateKey = '2026-08-16';

        mockDb.Appointment.findAll.mockResolvedValue([]);
        mockDb.StaffBreak.findAll.mockImplementation(async ({ where }) => [
            createBreakSeed({
                id: 'break-16',
                specificDate: '2026-08-16',
                startTime: '19:00:00',
                endTime: '19:45:00'
            }),
            createBreakSeed({
                id: 'break-17',
                specificDate: '2026-08-17',
                startTime: '19:00:00',
                endTime: '19:45:00'
            })
        ].filter((breakRecord) => applyBreakBoardFilter(where, breakRecord)));

        const req = {
            tenantId: 'tenant-1',
            query: {
                date: dateKey
            }
        };
        const res = createRes();

        await controller.getAppointmentsBoard(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.breaks).toHaveLength(1);
        expect(payload.breaks[0]).toEqual(expect.objectContaining({
            id: 'break-16',
            specificDate: '2026-08-16'
        }));
    });

    it('only auto-marks pending and confirmed appointments as no-show when past endTime', async () => {
        const req = {
            tenantId: 'tenant-1',
            query: { date: '2026-08-16' }
        };
        const res = createRes();

        // Ensure we capture the exact where clause passed to db.Appointment.update
        await controller.getAppointmentsBoard(req, res);

        expect(mockDb.Appointment.update).toHaveBeenCalledTimes(1);
        const updateCall = mockDb.Appointment.update.mock.calls[0];
        const updatePayload = updateCall[0];
        const updateOptions = updateCall[1];

        // Should set status to no_show
        expect(updatePayload).toEqual(expect.objectContaining({ status: 'no_show' }));

        // Ensure the filter targets ONLY pending and confirmed statuses
        expect(updateOptions.where.status).toEqual({
            [mockOp.in]: ['pending', 'confirmed']
        });

        // Ensure it targets past appointments
        expect(updateOptions.where.endTime[mockOp.lt]).toBeInstanceOf(Date);
        expect(updateOptions.where.tenantId).toBe('tenant-1');
    });
});
