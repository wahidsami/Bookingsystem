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
            findOne: jest.fn(),
            findByPk: jest.fn()
        },
        BookingSession: {
            findByPk: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
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
jest.mock('../../services/appointmentPaymentService', () => ({
    processAppointmentPayment: jest.fn().mockImplementation(async ({ appointment, amount, scope }) => {
        return {
            appointment,
            forensicPaymentTransactionIds: ['tx-123']
        };
    })
}));

describe('tenantAppointmentController - Phase 5A Genuine Group Appointments', () => {
    let req, res, mockTransaction;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
        db.sequelize.transaction.mockResolvedValue(mockTransaction);

        db.TenantSettings.findOne.mockResolvedValue({
            tenantId: 'tenant-group-1',
            bookingSettings: { requireWalkInPhone: false }
        });

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    test('1. Three participants with 3 distinct customers, services, and staff', async () => {
        db.PlatformUser.create
            .mockResolvedValueOnce({ id: 'user-organizer', firstName: 'Sara', lastName: 'Ahmad', phone: '0501111111', isActive: true })
            .mockResolvedValueOnce({ id: 'user-p2', firstName: 'Noura', lastName: 'Ali', phone: '0502222222', isActive: true })
            .mockResolvedValueOnce({ id: 'user-p3', firstName: 'Mona', lastName: 'Hassan', phone: '0503333333', isActive: true });

        const mockAppointments = [
            {
                id: 'appt-1',
                platformUserId: 'user-organizer',
                serviceId: 'srv-bridal-hair',
                staffId: 'staff-1',
                price: 300,
                rawPrice: 260.87,
                taxAmount: 39.13,
                totalPaid: 0,
                status: 'confirmed',
                paymentStatus: 'pending'
            },
            {
                id: 'appt-2',
                platformUserId: 'user-p2',
                serviceId: 'srv-makeup',
                staffId: 'staff-2',
                price: 250,
                rawPrice: 217.39,
                taxAmount: 32.61,
                totalPaid: 0,
                status: 'confirmed',
                paymentStatus: 'pending'
            },
            {
                id: 'appt-3',
                platformUserId: 'user-p3',
                serviceId: 'srv-manicure',
                staffId: 'staff-3',
                price: 150,
                rawPrice: 130.43,
                taxAmount: 19.57,
                totalPaid: 0,
                status: 'confirmed',
                paymentStatus: 'pending'
            }
        ];

        db.Appointment.findAll.mockResolvedValue(mockAppointments);

        bookingService.createBookingSession.mockResolvedValue({
            session: {
                id: 'sess-group-1',
                bookingReference: 'BKS-2026-000001',
                paymentMethod: 'at-center',
                itemCount: 3,
                subtotal: 608.69,
                taxAmount: 91.31,
                platformFee: 0,
                totalAmount: 700.00,
                metadata: {
                    sessionType: 'group',
                    groupName: 'Sara Bridal Group',
                    paymentArrangement: 'organizer_pays',
                    organizer: { platformUserId: 'user-organizer', name: 'Sara Ahmad' },
                    participants: [
                        { participantIndex: 0, platformUserId: 'user-organizer', name: 'Sara Ahmad', isOrganizer: true },
                        { participantIndex: 1, platformUserId: 'user-p2', name: 'Noura Ali', isOrganizer: false },
                        { participantIndex: 2, platformUserId: 'user-p3', name: 'Mona Hassan', isOrganizer: false }
                    ]
                }
            },
            appointments: mockAppointments,
            paymentSummary: { totalAmount: 700 }
        });

        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            body: {
                sessionType: 'group',
                groupName: 'Sara Bridal Group',
                paymentArrangement: 'organizer_pays',
                participants: [
                    {
                        name: 'Sara Ahmad',
                        phone: '0501111111',
                        isOrganizer: true,
                        items: [{ serviceId: 'srv-bridal-hair', staffId: 'staff-1', startTime: '2026-10-20T14:00:00Z', price: 300 }]
                    },
                    {
                        name: 'Noura Ali',
                        phone: '0502222222',
                        isOrganizer: false,
                        items: [{ serviceId: 'srv-makeup', staffId: 'staff-2', startTime: '2026-10-20T14:00:00Z', price: 250 }]
                    },
                    {
                        name: 'Mona Hassan',
                        phone: '0503333333',
                        isOrganizer: false,
                        items: [{ serviceId: 'srv-manicure', staffId: 'staff-3', startTime: '2026-10-20T14:00:00Z', price: 150 }]
                    }
                ]
            }
        };

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        const responseData = res.json.mock.calls[0][0];
        expect(responseData.success).toBe(true);
        expect(responseData.groupSummary).toBeDefined();
        expect(responseData.groupSummary.totalAmount).toBe(700);
        expect(responseData.groupSummary.subtotal).toBe(608.69);
        expect(responseData.groupSummary.taxAmount).toBe(91.31);
        expect(responseData.groupSummary.participants).toHaveLength(3);

        // Verify each appointment is attributed to distinct participant, NOT all to organizer
        expect(bookingService.createBookingSession).toHaveBeenCalled();
        const sessionCallArg = bookingService.createBookingSession.mock.calls[0][0];
        expect(sessionCallArg.items).toHaveLength(3);
        expect(sessionCallArg.items[0].platformUserId).toBe('user-organizer');
        expect(sessionCallArg.items[1].platformUserId).toBe('user-p2');
        expect(sessionCallArg.items[2].platformUserId).toBe('user-p3');
        expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('2. Option A (Organizer pays for everyone) with verified session payment', async () => {
        const appointmentPaymentService = require('../../services/appointmentPaymentService');

        db.PlatformUser.create
            .mockResolvedValueOnce({ id: 'user-organizer', firstName: 'Sara', lastName: 'Ahmad', isActive: true })
            .mockResolvedValueOnce({ id: 'user-p2', firstName: 'Noura', lastName: 'Ali', isActive: true });

        const mockAppointments = [
            { id: 'appt-1', platformUserId: 'user-organizer', price: 300, rawPrice: 260.87, taxAmount: 39.13, totalPaid: 300, status: 'confirmed', paymentStatus: 'fully_paid' },
            { id: 'appt-2', platformUserId: 'user-p2', price: 200, rawPrice: 173.91, taxAmount: 26.09, totalPaid: 200, status: 'confirmed', paymentStatus: 'fully_paid' }
        ];

        db.Appointment.findAll.mockResolvedValue(mockAppointments);

        bookingService.createBookingSession.mockResolvedValue({
            session: {
                id: 'sess-group-optA',
                bookingReference: 'BKS-OPTA',
                totalAmount: 500.00,
                subtotal: 434.78,
                taxAmount: 65.22,
                itemCount: 2,
                metadata: {
                    sessionType: 'group',
                    paymentArrangement: 'organizer_pays',
                    participants: [
                        { platformUserId: 'user-organizer', name: 'Sara Ahmad', isOrganizer: true },
                        { platformUserId: 'user-p2', name: 'Noura Ali', isOrganizer: false }
                    ]
                }
            },
            appointments: mockAppointments,
            paymentSummary: { totalAmount: 500 }
        });

        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            body: {
                sessionType: 'group',
                paymentArrangement: 'organizer_pays',
                amount: 500,
                paymentStatus: 'paid',
                paymentMethod: 'card_pos',
                participants: [
                    { name: 'Sara Ahmad', isOrganizer: true, items: [{ serviceId: 'srv-1', startTime: '2026-10-20T14:00:00Z', price: 300 }] },
                    { name: 'Noura Ali', isOrganizer: false, items: [{ serviceId: 'srv-2', startTime: '2026-10-20T14:00:00Z', price: 200 }] }
                ]
            }
        };

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(appointmentPaymentService.processAppointmentPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 500,
                scope: 'session'
            })
        );
        const resBody = res.json.mock.calls[0][0];
        expect(resBody.groupSummary.totalAmount).toBe(500);
        expect(resBody.groupSummary.totalPaid).toBe(500);
        expect(resBody.groupSummary.remainingBalance).toBe(0);
        expect(resBody.groupSummary.paymentStatus).toBe('fully_paid');
    });

    test('3. Option B (Each participant pays individually) - isolated payment scope', async () => {
        const appointmentPaymentService = require('../../services/appointmentPaymentService');

        db.PlatformUser.create
            .mockResolvedValueOnce({ id: 'user-organizer', firstName: 'Sara', lastName: 'Ahmad', isActive: true })
            .mockResolvedValueOnce({ id: 'user-p2', firstName: 'Noura', lastName: 'Ali', isActive: true });

        const mockAppointments = [
            { id: 'appt-1', platformUserId: 'user-organizer', price: 300, rawPrice: 260.87, taxAmount: 39.13, totalPaid: 0, status: 'confirmed', paymentStatus: 'pending' },
            { id: 'appt-2', platformUserId: 'user-p2', price: 200, rawPrice: 173.91, taxAmount: 26.09, totalPaid: 0, status: 'confirmed', paymentStatus: 'pending' }
        ];

        db.Appointment.findAll.mockResolvedValue(mockAppointments);

        bookingService.createBookingSession.mockResolvedValue({
            session: {
                id: 'sess-group-optB',
                bookingReference: 'BKS-OPTB',
                totalAmount: 500.00,
                subtotal: 434.78,
                taxAmount: 65.22,
                itemCount: 2,
                metadata: {
                    sessionType: 'group',
                    paymentArrangement: 'individual_pays',
                    participants: [
                        { platformUserId: 'user-organizer', name: 'Sara Ahmad', isOrganizer: true },
                        { platformUserId: 'user-p2', name: 'Noura Ali', isOrganizer: false }
                    ]
                }
            },
            appointments: mockAppointments,
            paymentSummary: { totalAmount: 500 }
        });

        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            body: {
                sessionType: 'group',
                paymentArrangement: 'individual_pays',
                participants: [
                    { name: 'Sara Ahmad', isOrganizer: true, items: [{ serviceId: 'srv-1', startTime: '2026-10-20T14:00:00Z', price: 300 }] },
                    { name: 'Noura Ali', isOrganizer: false, items: [{ serviceId: 'srv-2', startTime: '2026-10-20T14:00:00Z', price: 200 }] }
                ]
            }
        };

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        const resBody = res.json.mock.calls[0][0];
        expect(resBody.groupSummary.paymentArrangement).toBe('individual_pays');
        expect(resBody.groupSummary.participants[0].paymentStatus).toBe('pending');
        expect(resBody.groupSummary.participants[1].paymentStatus).toBe('pending');
        expect(resBody.groupSummary.participants[0].total).toBe(300);
        expect(resBody.groupSummary.participants[1].total).toBe(200);
    });

    test('4. Atomic validation rejects invalid participant with zero created rows', async () => {
        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            body: {
                sessionType: 'group',
                paymentArrangement: 'organizer_pays',
                participants: [
                    { name: 'Sara Ahmad', isOrganizer: true, items: [{ serviceId: 'srv-1', startTime: '2026-10-20T14:00:00Z', price: 300 }] },
                    { name: 'Noura Ali', isOrganizer: false, items: [] } // Empty services!
                ]
            }
        };

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('must have at least one service selected')
        }));
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(bookingService.createBookingSession).not.toHaveBeenCalled();
    });

    test('5. Cancelling one participant updates session totals without cancelling sibling appointments', async () => {
        const mockAppointmentToCancel = {
            id: 'appt-1',
            status: 'confirmed',
            price: 300,
            rawPrice: 260.87,
            taxAmount: 39.13,
            platformFee: 0,
            bookingSessionId: 'sess-group-cancel',
            save: jest.fn().mockResolvedValue(),
            reload: jest.fn().mockResolvedValue()
        };

        db.Appointment.findOne.mockResolvedValue(mockAppointmentToCancel);
        db.Appointment.findByPk.mockResolvedValue(mockAppointmentToCancel);

        // When syncing session totals, active appointments only have appt-2
        const activeAppointments = [
            { id: 'appt-1', status: 'cancelled', price: 300, rawPrice: 260.87, taxAmount: 39.13, platformFee: 0 },
            { id: 'appt-2', status: 'confirmed', price: 200, rawPrice: 173.91, taxAmount: 26.09, platformFee: 0 }
        ];
        db.Appointment.findAll.mockResolvedValue(activeAppointments);

        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            params: { id: 'appt-1' },
            body: { status: 'cancelled' }
        };

        await tenantAppointmentController.updateAppointmentStatus(req, res);

        expect(mockAppointmentToCancel.status).toBe('cancelled');
        expect(mockAppointmentToCancel.save).toHaveBeenCalled();
        expect(db.BookingSession.update).toHaveBeenCalledWith(
            expect.objectContaining({
                itemCount: 1, // Only 1 active appointment remains!
                totalAmount: 200,
                subtotal: 173.91,
                taxAmount: 26.09
            }),
            expect.anything()
        );
        expect(mockTransaction.commit).toHaveBeenCalled();
    });
    test('6. Guest participant without phone or lastName succeeds when requireWalkInPhone is false', async () => {
        db.TenantSettings.findOne.mockResolvedValue({
            tenantId: 'tenant-group-1',
            bookingSettings: { requireWalkInPhone: false }
        });

        db.PlatformUser.create.mockResolvedValue({
            id: 'user-walkin-1',
            firstName: 'Noura',
            lastName: null,
            phone: null,
            isActive: true
        });

        const mockAppointments = [{
            id: 'appt-w1',
            platformUserId: 'user-walkin-1',
            serviceId: 'srv-1',
            staffId: 'staff-1',
            price: 100,
            rawPrice: 86.96,
            taxAmount: 13.04,
            status: 'confirmed',
            paymentStatus: 'pending'
        }];

        db.Appointment.findAll.mockResolvedValue(mockAppointments);

        bookingService.createBookingSession.mockResolvedValue({
            session: {
                id: 'sess-w1',
                bookingReference: 'BKS-W1',
                paymentMethod: 'at-center',
                itemCount: 1,
                totalAmount: 100,
                subtotal: 86.96,
                taxAmount: 13.04,
                metadata: {}
            },
            appointments: mockAppointments,
            paymentSummary: { totalAmount: 100 }
        });

        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            body: {
                sessionType: 'group',
                paymentArrangement: 'individual_pays',
                participants: [
                    {
                        name: 'Noura', // single name, no phone
                        isOrganizer: true,
                        items: [{ serviceId: 'srv-1', staffId: 'staff-1', startTime: '2026-10-20T14:00:00Z', price: 100 }]
                    }
                ]
            }
        };

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(db.PlatformUser.create).toHaveBeenCalledWith(
            expect.objectContaining({
                firstName: 'Noura',
                lastName: null,
                phone: null
            }),
            expect.anything()
        );
        expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('7. Guest participant without phone is rejected with HTTP 400 when requireWalkInPhone is true', async () => {
        db.TenantSettings.findOne.mockResolvedValue({
            tenantId: 'tenant-group-1',
            bookingSettings: { requireWalkInPhone: true }
        });

        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            body: {
                sessionType: 'group',
                paymentArrangement: 'individual_pays',
                participants: [
                    {
                        name: 'Noura', // no phone provided
                        isOrganizer: true,
                        items: [{ serviceId: 'srv-1', staffId: 'staff-1', startTime: '2026-10-20T14:00:00Z', price: 100 }]
                    }
                ]
            }
        };

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('phone number is required')
        }));
        expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('8. Name normalization splits full names into firstName and lastName without losing parts', async () => {
        db.TenantSettings.findOne.mockResolvedValue({
            tenantId: 'tenant-group-1',
            bookingSettings: { requireWalkInPhone: false }
        });

        db.PlatformUser.create.mockResolvedValue({
            id: 'user-split-1',
            firstName: 'Sara',
            lastName: 'Mohammed Ahmad Al-Otaibi',
            phone: null,
            isActive: true
        });

        const mockAppointments = [{
            id: 'appt-s1',
            platformUserId: 'user-split-1',
            serviceId: 'srv-1',
            staffId: 'staff-1',
            price: 150,
            rawPrice: 130.43,
            taxAmount: 19.57,
            status: 'confirmed',
            paymentStatus: 'pending'
        }];

        db.Appointment.findAll.mockResolvedValue(mockAppointments);

        bookingService.createBookingSession.mockResolvedValue({
            session: {
                id: 'sess-s1',
                bookingReference: 'BKS-S1',
                itemCount: 1,
                totalAmount: 150,
                subtotal: 130.43,
                taxAmount: 19.57,
                metadata: {}
            },
            appointments: mockAppointments,
            paymentSummary: { totalAmount: 150 }
        });

        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            body: {
                sessionType: 'group',
                paymentArrangement: 'organizer_pays',
                participants: [
                    {
                        name: 'Sara Mohammed Ahmad Al-Otaibi',
                        isOrganizer: true,
                        items: [{ serviceId: 'srv-1', staffId: 'staff-1', startTime: '2026-10-20T14:00:00Z', price: 150 }]
                    }
                ]
            }
        };

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(db.PlatformUser.create).toHaveBeenCalledWith(
            expect.objectContaining({
                firstName: 'Sara',
                lastName: 'Mohammed Ahmad Al-Otaibi'
            }),
            expect.anything()
        );
    });

    test('9. Group creation rejects with 409 and rolls back when resource capacity is exhausted across participants', async () => {
        db.PlatformUser.create
            .mockResolvedValueOnce({ id: 'user-p1', firstName: 'Sara', lastName: 'A', phone: '0501111111', isActive: true })
            .mockResolvedValueOnce({ id: 'user-p2', firstName: 'Noura', lastName: 'B', phone: '0502222222', isActive: true });

        const conflictError = new Error('Salon has 1 active instance(s) of "Treatment Bed", but 2 are required.');
        conflictError.code = 'BOOKING_CONFLICT';
        conflictError.conflict = true;
        conflictError.conflictDetails = {
            success: false,
            conflict: true,
            code: 'INSUFFICIENT_TOTAL_CAPACITY',
            message: 'Salon has 1 active instance(s) of "Treatment Bed", but 2 are required.',
            conflicts: [{ type: 'INSUFFICIENT_TOTAL_CAPACITY', entityName: 'Treatment Bed' }]
        };

        bookingService.createBookingSession.mockRejectedValue(conflictError);

        req = {
            tenantId: 'tenant-group-1',
            userId: 'user-staff-1',
            body: {
                sessionType: 'group',
                paymentArrangement: 'organizer_pays',
                participants: [
                    { name: 'Sara A', phone: '0501111111', isOrganizer: true, items: [{ serviceId: 'srv-1', staffId: 'staff-1', startTime: '2026-10-20T14:00:00Z', price: 200 }] },
                    { name: 'Noura B', phone: '0502222222', isOrganizer: false, items: [{ serviceId: 'srv-1', staffId: 'staff-2', startTime: '2026-10-20T14:00:00Z', price: 200 }] }
                ]
            }
        };

        await tenantAppointmentController.createAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            conflict: true,
            code: 'INSUFFICIENT_TOTAL_CAPACITY'
        }));
        expect(mockTransaction.rollback).toHaveBeenCalled();
    });
});
