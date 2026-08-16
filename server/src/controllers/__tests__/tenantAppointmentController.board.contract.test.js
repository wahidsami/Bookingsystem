const { Op: mockOp } = require('sequelize');

jest.mock('../../services/pushNotificationService', () => ({}));
jest.mock('../../services/customerNotificationService', () => ({}));
jest.mock('../../services/bookingService', () => ({}));
jest.mock('../../services/appointmentLifecycleService', () => ({}));
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
    Appointment: {
        update: jest.fn(),
        findAll: jest.fn()
    },
    Staff: {
        findAll: jest.fn()
    },
    StaffBreak: {
        findAll: jest.fn()
    },
    TenantSettings: {
        findOne: jest.fn()
    },
    Service: {},
    PlatformUser: {}
};

jest.mock('../../models', () => mockDb);

const controller = require('../tenantAppointmentController');

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

describe('tenantAppointmentController.getAppointmentsBoard', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockDb.Appointment.update.mockResolvedValue([0]);
        mockDb.TenantSettings.findOne.mockResolvedValue({ timezone: 'Asia/Riyadh' });
        mockDb.Staff.findAll.mockResolvedValue([{ id: 'staff-1' }]);
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
});
