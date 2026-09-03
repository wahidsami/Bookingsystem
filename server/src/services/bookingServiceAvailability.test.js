jest.mock('../models', () => ({
    Staff: { findByPk: jest.fn() },
    Appointment: { findOne: jest.fn() },
    TenantSettings: { findOne: jest.fn() }
}));

jest.mock('./availabilityService', () => ({
    _buildAvailabilityContext: jest.fn()
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
                type: 'outside_working_hours',
                message: 'Sally starts at 2:00 PM. Please select a different time or employee.'
            });
    });

    test('rejects a service whose full duration exceeds the employee duty end', async () => {
        const { start, end } = request(20, 30, 21, 30);

        await expect(bookingService.getStaffAvailabilityFailureReason('staff-1', start, end))
            .resolves.toEqual({
                type: 'outside_working_hours',
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
                message: 'Sally is on break during this time. Please select a different time or employee.'
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
