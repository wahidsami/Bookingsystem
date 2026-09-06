jest.mock('../models', () => ({
    Staff: { findByPk: jest.fn() },
    Service: { findByPk: jest.fn() },
    Appointment: { findOne: jest.fn(), findAll: jest.fn() },
    TenantSettings: { findOne: jest.fn() }
}));

jest.mock('./availabilityService', () => ({
    _buildAvailabilityContext: jest.fn(),
    _combineDateAndTime: jest.fn((dateKey, time) => {
        const [year, month, day] = dateKey.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
    })
}));

const db = require('../models');
const availabilityService = require('./availabilityService');
const bookingService = require('./bookingService');

const STAFF = {
    id: 'staff-1',
    tenantId: 'tenant-1',
    name: 'Sally'
};

const makeWindow = (hour, minute) => new Date(Date.UTC(2026, 8, 3, hour - 3, minute));
const request = (startHour, startMinute, endHour, endMinute) => ({
    start: makeWindow(startHour, startMinute),
    end: makeWindow(endHour, endMinute)
});

const setAvailabilityContext = ({
    dutyStart = makeWindow(14, 0),
    dutyEnd = makeWindow(21, 0),
    breaks = [],
    timeOff = []
} = {}) => {
    availabilityService._buildAvailabilityContext.mockResolvedValue({
        tenantHours: { start: '09:00', end: '23:00' },
        employeeDutyWindows: [{ startTime: dutyStart, endTime: dutyEnd }],
        rawWindows: [{ startTime: dutyStart, endTime: dutyEnd }],
        finalWindows: [{ startTime: dutyStart, endTime: dutyEnd }],
        breaks,
        timeOff
    });
};

describe('BookingService staff availability failures', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        db.Staff.findByPk.mockResolvedValue(STAFF);
        db.Appointment.findOne.mockResolvedValue(null);
        db.TenantSettings.findOne.mockResolvedValue({ timezone: 'Asia/Riyadh' });
        setAvailabilityContext();
    });

    test('rejects a booking that starts before the employee duty time', async () => {
        const { start, end } = request(13, 30, 14, 30);

        await expect(bookingService.getStaffAvailabilityFailureReason('staff-1', start, end))
            .resolves.toEqual({
                type: 'before_employee_duty',
                message: 'Sally starts at 2:00 PM. Please select a different time or employee.'
            });
    });

    test('rejects a service whose full duration exceeds the employee duty end', async () => {
        const { start, end } = request(20, 30, 21, 30);

        await expect(bookingService.getStaffAvailabilityFailureReason('staff-1', start, end))
            .resolves.toEqual({
                type: 'after_employee_duty',
                message: "Sally's working hours end at 9:00 PM, but this service would finish at 9:30 PM."
            });
    });

    test('permits only an authorized overtime override for a duty-end failure', async () => {
        const { start, end } = request(20, 30, 21, 30);
        const failure = await bookingService.getStaffAvailabilityFailureReason('staff-1', start, end);
        const authorizedApproval = {
            approved: true,
            authorizedBy: 'tenant-admin-1',
            authorizedAt: '2026-09-03T10:00:00.000Z'
        };

        const persistedApproval = bookingService._buildOvertimeApproval(authorizedApproval);

        expect(bookingService._canOverrideAvailabilityFailure(failure, persistedApproval)).toBe(true);
        expect(persistedApproval).toEqual({
            approved: true,
            authorizedBy: 'tenant-admin-1',
            authorizedAt: '2026-09-03T10:00:00.000Z',
            reason: null
        });
        expect(bookingService._canOverrideAvailabilityFailure({ type: 'staff_break' }, persistedApproval)).toBe(false);
    });

    test('identifies a scheduled staff break separately from duty limits', async () => {
        const breakStart = makeWindow(16, 0);
        const breakEnd = makeWindow(16, 30);
        setAvailabilityContext({ breaks: [{ startTime: breakStart, endTime: breakEnd }] });
        const { start, end } = request(15, 45, 16, 15);

        await expect(bookingService.getStaffAvailabilityFailureReason('staff-1', start, end))
            .resolves.toEqual({
                type: 'staff_break',
                message: 'Sally has a break from 4:00 PM to 4:30 PM. Please select a different time or employee.'
            });
    });

    test('identifies an existing appointment separately from duty limits', async () => {
        db.Appointment.findOne.mockResolvedValue({ id: 'appointment-1' });
        const { start, end } = request(15, 0, 15, 30);

        await expect(bookingService.getStaffAvailabilityFailureReason('staff-1', start, end))
            .resolves.toEqual({
                type: 'existing_booking',
                message: 'Sally is already booked for that time. Please select a different time or employee.'
            });
    });
});

describe('BookingService evaluateSchedulingRequest aggregate failures', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        db.Staff.findByPk.mockResolvedValue(STAFF);
        db.Service.findByPk.mockResolvedValue({ id: 'service-1', duration: 60 });
        db.TenantSettings.findOne.mockResolvedValue({ timezone: 'Asia/Riyadh' });
        setAvailabilityContext();
    });

    test('collects both hard conflicts and soft conflicts into a conflicts array', async () => {
        // Set duty end at 21:00
        setAvailabilityContext({ dutyEnd: makeWindow(21, 0) });
        // Mock an existing appointment at the same time
        db.Appointment.findAll.mockResolvedValue([{ id: 'existing-appointment' }]);

        // Request exceeds duty end AND conflicts with existing appointment
        const { start, end } = request(20, 30, 21, 30);

        const result = await bookingService.evaluateSchedulingRequest({
            tenantId: 'tenant-1',
            serviceId: 'service-1',
            staffId: 'staff-1',
            date: '2026-09-03',
            startTime: start,
            duration: 60
        });


        expect(result.valid).toBe(false);
        expect(result.reasonType).toBe('existing_booking');
    });
});
