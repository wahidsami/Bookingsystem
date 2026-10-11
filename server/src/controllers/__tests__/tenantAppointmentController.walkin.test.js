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
            findAll: jest.fn()
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

describe('tenantAppointmentController - Fast Walk-In & Single Client Totals', () => {
    let req, res, mockTransaction;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
        db.sequelize.transaction.mockResolvedValue(mockTransaction);

        req = {
            tenantId: 'tenant-walkin-1',
            userId: 'user-staff-1',
            tenantAccountId: 'acc-1',
            tenantAccount: { roleKey: 'owner', name: 'Owner' },
            body: {
                serviceId: 'srv-haircut',
                startTime: '2026-10-15T10:00:00Z',
                items: [
                    {
                        serviceId: 'srv-haircut',
                        startTime: '2026-10-15T10:00:00Z',
                        price: 150,
                        duration: 30
                    }
                ],
                customer: {
                    firstName: 'Customer',
                    isGuest: true
                },
                notifyCustomer: false
            },
            operationContext: { op: 'walkin-test' }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        db.TenantSettings.findOne.mockResolvedValue({
            tenantId: 'tenant-walkin-1',
            bookingSettings: { requireWalkInPhone: false }
        });

        db.PlatformUser.create.mockImplementation((userData) => {
            return Promise.resolve({
                id: 'walkin-user-999',
                ...userData,
                isActive: true
            });
        });

        bookingService.createBookingSession.mockResolvedValue({
            session: { id: 'sess-walkin-1', bookingReference: 'WALK-001' },
            appointments: [
                {
                    id: 'appt-walkin-1',
                    serviceId: 'srv-haircut',
                    status: 'confirmed',
                    bookingNumber: 'BKG-WALK-1',
                    startTime: '2026-10-15T10:00:00Z',
                    price: 150
                }
            ],
            paymentSummary: {
                subtotal: 150,
                tax: 22.5,
                total: 172.5
            }
        });

        db.Appointment.findAll.mockResolvedValue([
            {
                id: 'appt-walkin-1',
                serviceId: 'srv-haircut',
                status: 'confirmed',
                bookingNumber: 'BKG-WALK-1',
                startTime: '2026-10-15T10:00:00Z',
                price: 150
            }
        ]);
    });

    it('should successfully create a fast walk-in appointment without phone or email', async () => {
        await tenantAppointmentController.createAppointment(req, res);

        expect(mockTransaction.commit).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(db.PlatformUser.create).toHaveBeenCalledWith(
            expect.objectContaining({
                firstName: expect.any(String),
                phone: null,
                email: expect.stringMatching(/^guest\+\d+@guest\.refah\.local$/)
            }),
            expect.anything()
        );

        // Verify that booking session received exactly single-client items with no phantom pricing
        expect(bookingService.createBookingSession).toHaveBeenCalledWith(
            expect.objectContaining({
                items: expect.arrayContaining([
                    expect.objectContaining({
                        serviceId: 'srv-haircut',
                        duration: 30
                    })
                ])
            }),
            expect.anything()
        );
        const callArgs = bookingService.createBookingSession.mock.calls[0][0];
        expect(callArgs.items).toHaveLength(1);
    });

    it('should reject fast walk-in when tenant configuration mandates walk-in phone', async () => {
        db.TenantSettings.findOne.mockResolvedValue({
            tenantId: 'tenant-walkin-1',
            bookingSettings: { requireWalkInPhone: true }
        });

        await tenantAppointmentController.createAppointment(req, res);

        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('Customer phone number is required')
            })
        );
    });
});
