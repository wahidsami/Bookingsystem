const tenantAppointmentController = require('../tenantAppointmentController');
const bookingService = require('../../services/bookingService');
const db = require('../../models');

jest.mock('../../services/bookingService');
jest.mock('../../services/auditService', () => ({
    logActivity: jest.fn()
}));
jest.mock('../../models', () => {
    return {
        sequelize: {
            transaction: jest.fn()
        },
        PlatformUser: {
            findOne: jest.fn(),
            create: jest.fn(),
            findByPk: jest.fn()
        },
        Appointment: {
            findAll: jest.fn(),
            findByPk: jest.fn()
        },
        Tenant: {
            findByPk: jest.fn()
        },
        Service: {
            findByPk: jest.fn()
        },
        TenantSettings: {
            findOne: jest.fn()
        }
    };
});
jest.mock('../../services/userService', () => ({
    findUserByEmailOrPhone: jest.fn().mockResolvedValue(null)
}));
jest.mock('../../services/pushNotificationService', () => ({
    sendToStaff: jest.fn().mockResolvedValue(),
    sendToUser: jest.fn().mockResolvedValue()
}));
jest.mock('../../utils/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue()
}));

describe('tenantAppointmentController - Operating-Hours Extension & Bundle Overtime Handling', () => {
    let req, res, mockTransaction;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
        db.sequelize.transaction.mockResolvedValue(mockTransaction);

        req = {
            tenantId: 'tenant-test-1',
            userId: 'admin-user-1',
            tenantAccountId: 'acc-admin-1',
            tenantAccount: { roleKey: 'owner', name: 'Owner' },
            body: {},
            operationContext: { op: 'overtime-test' }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        db.TenantSettings.findOne.mockResolvedValue({
            tenantId: 'tenant-test-1',
            bookingSettings: { requireWalkInPhone: false }
        });

        db.PlatformUser.create.mockImplementation((userData) => {
            return Promise.resolve({
                id: 'client-user-100',
                ...userData,
                isActive: true
            });
        });
    });

    test('Scenario 1: Package bundle with overtimeApproval propagates authorization to package and child steps', async () => {
        req.body = {
            serviceId: 'pkg-student-150',
            startTime: '2026-10-15T20:00:00.000Z',
            overtimeApproval: { approved: true, reason: 'Manual extension 90 mins' },
            items: [
                {
                    itemType: 'package',
                    packageId: 'pkg-student-150',
                    overtimeApproval: { approved: true },
                    packageItems: [
                        {
                            serviceId: 'srv-moroccan-massage',
                            packageItemId: 'pi-1',
                            startTime: '2026-10-15T20:00:00.000Z',
                            duration: 60,
                            sequenceOrder: 1
                        },
                        {
                            serviceId: 'srv-thai-therapy',
                            packageItemId: 'pi-2',
                            startTime: '2026-10-15T21:00:00.000Z',
                            duration: 60,
                            sequenceOrder: 2
                        },
                        {
                            serviceId: 'srv-classic-manicure',
                            packageItemId: 'pi-3',
                            startTime: '2026-10-15T22:00:00.000Z',
                            duration: 30,
                            sequenceOrder: 3
                        }
                    ]
                }
            ],
            customer: {
                firstName: 'Test Customer',
                isGuest: true
            },
            notifyCustomer: false
        };

        bookingService.createBookingSession.mockResolvedValue({
            session: { id: 'sess-100', bookingReference: 'REF-100', totalAmount: 527 },
            appointments: [
                { id: 'appt-1', serviceId: 'srv-moroccan-massage', price: 200 },
                { id: 'appt-2', serviceId: 'srv-thai-therapy', price: 200 },
                { id: 'appt-3', serviceId: 'srv-classic-manicure', price: 127 }
            ],
            paymentSummary: { totalAmount: 527 }
        });

        db.Appointment.findAll.mockResolvedValue([
            { id: 'appt-1', serviceId: 'srv-moroccan-massage', price: 200 },
            { id: 'appt-2', serviceId: 'srv-thai-therapy', price: 200 },
            { id: 'appt-3', serviceId: 'srv-classic-manicure', price: 127 }
        ]);

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(mockTransaction.commit).toHaveBeenCalled();

        // Verify createBookingSession received authorized overtimeApproval on both package and child steps
        expect(bookingService.createBookingSession).toHaveBeenCalled();
        const callArg = bookingService.createBookingSession.mock.calls[0][0];
        const packageItem = callArg.items[0];

        expect(packageItem.itemType).toBe('package');
        expect(packageItem.overtimeApproval).toEqual(expect.objectContaining({
            approved: true,
            authorizedBy: 'acc-admin-1'
        }));
        expect(packageItem.packageItems).toHaveLength(3);
        packageItem.packageItems.forEach(step => {
            expect(step.overtimeApproval).toEqual(expect.objectContaining({
                approved: true,
                authorizedBy: 'acc-admin-1'
            }));
        });
    });

    test('Scenario 2: When staff is genuinely unavailable, returns HTTP 409 conflict rather than HTTP 500', async () => {
        req.body = {
            serviceId: 'srv-moroccan-massage',
            startTime: '2026-10-15T20:00:00.000Z',
            items: [
                {
                    serviceId: 'srv-moroccan-massage',
                    startTime: '2026-10-15T20:00:00.000Z',
                    duration: 60
                }
            ],
            customer: { firstName: 'Walk-in', isGuest: true },
            notifyCustomer: false
        };

        const conflictError = new Error('No available staff for this service at the selected time');
        conflictError.code = 'BOOKING_CONFLICT';
        conflictError.conflictDetails = {
            type: 'STAFF_UNAVAILABLE',
            entityType: 'staff',
            reasonType: 'no_available_staff',
            message: 'No available staff for this service at the selected time',
            messageAr: 'لا يوجد موظفون متاحون لهذه الخدمة في الوقت المحدد',
            actionableGuidance: 'Please choose another time or assign an available employee.',
            actionableGuidanceAr: 'يرجى اختيار وقت آخر أو تعيين موظف متاح.'
        };

        bookingService.createBookingSession.mockRejectedValue(conflictError);

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            conflict: true,
            code: 'BOOKING_CONFLICT',
            message: 'No available staff for this service at the selected time',
            messageAr: 'لا يوجد موظفون متاحون لهذه الخدمة في الوقت المحدد'
        }));
    });
});
