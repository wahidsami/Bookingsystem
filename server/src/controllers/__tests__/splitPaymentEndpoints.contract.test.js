const crypto = require('crypto');

jest.mock('../../services/splitPaymentService', () => ({
    normalizePaymentAllocations: jest.fn().mockImplementation((payload) => {
        // Return a dummy normalized array to satisfy downstream code
        return [{ paymentMethod: 'cash', amount: payload.amount, metadata: { isFallback: false } }];
    }),
    recordRemainderPayment: jest.fn().mockResolvedValue({ id: 'appt-123' }),
    getPaymentSummary: jest.fn().mockResolvedValue({}),
    calculateSplitPayment: jest.fn().mockReturnValue({}),
    createAppointmentPaymentTransactions: jest.fn(),
    collectAppointmentStatusCharge: jest.fn()
}));

jest.mock('../../services/tenantWalletService', () => ({
    getTenantBalance: jest.fn()
}));

jest.mock('../../services/orderService', () => ({
    createOrder: jest.fn().mockResolvedValue({ id: 'order-1', totalAmount: 100 }),
    updatePaymentStatus: jest.fn()
}));

jest.mock('../../services/userService', () => ({
    findOrCreatePlatformUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
    findUserByEmailOrPhone: jest.fn().mockResolvedValue(null),
    generateGuestPhonePlaceholder: jest.fn().mockReturnValue('+15550000000')
}));

jest.mock('../../services/bookingService', () => ({
    createBookingSession: jest.fn().mockResolvedValue({ id: 'session-1', totalAmount: 100 })
}));

jest.mock('../../utils/forensicTrace', () => ({
    createForensicTrace: () => ({ log: jest.fn(), sqlLogger: jest.fn() })
}));

jest.mock('../../models', () => ({
    sequelize: {
        transaction: jest.fn().mockImplementation(async (callback) => {
            if (typeof callback === 'function') {
                return callback({ commit: jest.fn(), rollback: jest.fn() });
            }
            return { commit: jest.fn(), rollback: jest.fn() };
        })
    },
    TenantGiftCardPackage: {
        findOne: jest.fn().mockResolvedValue({ id: 'pkg-1', priceAmount: 100, walletCreditAmount: 100, isActive: true })
    },
    TenantGiftCardTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'gift-tx-1' })
    },
    GiftCardCode: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ code: 'CODE-123' })
    },
    PaymentTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'pay-tx-1' })
    },
    Transaction: {
        create: jest.fn().mockResolvedValue({ id: 'sale-tx-1' })
    },
    TenantGiftCardSettlement: {
        create: jest.fn().mockResolvedValue({ id: 'settle-1' })
    },
    Appointment: {
        findByPk: jest.fn().mockResolvedValue({ id: 'appt-1', tenantId: 'tenant-1' }),
        findOne: jest.fn().mockResolvedValue({ id: 'appt-1', tenantId: 'tenant-1' })
    }
}));

const tenantCartController = require('../tenantCartController');
const tenantAppointmentController = require('../tenantAppointmentController');
const tenantPaymentController = require('../tenantPaymentController');
const splitPaymentService = require('../../services/splitPaymentService');

const createRes = () => {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
};

describe('splitPaymentEndpoints.contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('tenantCartController.purchaseProducts', () => {
        it('passes paymentAllocations to normalizePaymentAllocations', async () => {
            const req = {
                tenantId: 'tenant-1',
                body: {
                    items: [{ productId: 'prod-1', quantity: 1, price: 100 }],
                    customerName: 'Test Customer',
                    paymentMethod: 'split',
                    paymentAllocations: [
                        { paymentMethod: 'cash', amount: 40 },
                        { paymentMethod: 'card_pos', amount: 60 }
                    ]
                }
            };
            const res = createRes();

            await tenantCartController.purchaseProducts(req, res);

            expect(splitPaymentService.normalizePaymentAllocations).toHaveBeenCalledWith(expect.objectContaining({
                amount: 100, // from mocked order totalAmount
                paymentMethod: 'split',
                paymentAllocations: [
                    { paymentMethod: 'cash', amount: 40 },
                    { paymentMethod: 'card_pos', amount: 60 }
                ],
                fallbackSource: 'split'
            }));
        });
    });

    describe('tenantCartController.purchaseGiftCard', () => {
        it('passes paymentAllocations to normalizePaymentAllocations', async () => {
            const req = {
                tenantId: 'tenant-1',
                body: {
                    packageId: 'pkg-1',
                    customerName: 'Test Customer',
                    paymentMethod: 'split',
                    paymentAllocations: [
                        { paymentMethod: 'cash', amount: 40 },
                        { paymentMethod: 'card_pos', amount: 60 }
                    ]
                }
            };
            const res = createRes();

            await tenantCartController.purchaseGiftCard(req, res);

            expect(splitPaymentService.normalizePaymentAllocations).toHaveBeenCalledWith(expect.objectContaining({
                amount: 100, // from mocked giftPackage priceAmount
                paymentMethod: 'split',
                paymentAllocations: [
                    { paymentMethod: 'cash', amount: 40 },
                    { paymentMethod: 'card_pos', amount: 60 }
                ],
                fallbackSource: 'split'
            }));
        });
    });

    describe('tenantPaymentController.recordPayment (Remainder Payments)', () => {
        it('passes paymentAllocations to splitPaymentService.recordRemainderPayment', async () => {
            const req = {
                tenantId: 'tenant-1',
                params: { id: 'appt-1' },
                body: {
                    amount: 100,
                    paymentMethod: 'split',
                    paymentAllocations: [
                        { paymentMethod: 'cash', amount: 40 },
                        { paymentMethod: 'card_pos', amount: 60 }
                    ],
                    notes: 'split remainder'
                }
            };
            const res = createRes();

            await tenantPaymentController.recordPayment(req, res);

            expect(splitPaymentService.recordRemainderPayment).toHaveBeenCalledWith('appt-1', expect.objectContaining({
                amount: 100,
                paymentMethod: 'split',
                paymentAllocations: [
                    { paymentMethod: 'cash', amount: 40 },
                    { paymentMethod: 'card_pos', amount: 60 }
                ],
                notes: 'split remainder'
            }));
        });
    });
});
