jest.mock('../../services/paymentService', () => ({
    processPayment: jest.fn(),
    processWalletPayment: jest.fn(),
    processProductPayment: jest.fn(),
    topUpWallet: jest.fn()
}));

jest.mock('../../services/walletService', () => ({
    getBalance: jest.fn(),
    getLedger: jest.fn()
}));

jest.mock('../../services/tenantWalletService', () => ({
    getTenantBalance: jest.fn()
}));

jest.mock('../../models', () => ({
    PaymentIdempotencyKey: {
        findOne: jest.fn(),
        create: jest.fn()
    },
    BookingSession: {
        findByPk: jest.fn()
    },
    Transaction: {
        findAll: jest.fn()
    },
    Appointment: {},
    Tenant: {},
    PaymentMethod: {}
}));

jest.mock('../../utils/productionLogger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

const paymentService = require('../../services/paymentService');
const walletService = require('../../services/walletService');
const tenantWalletService = require('../../services/tenantWalletService');
const controller = require('../paymentController');

const createRes = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis()
    };
    return res;
};

describe('paymentController contract: payment sources and eligibility guards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /payments/sources returns ordered source contract with tenant scope', async () => {
        walletService.getBalance.mockResolvedValue(120);
        tenantWalletService.getTenantBalance.mockResolvedValue(35);

        const req = {
            userId: 'user-1',
            query: {
                tenantId: 'tenant-1',
                amount: '50'
            }
        };
        const res = createRes();

        await controller.getEligiblePaymentSources(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            tenantId: 'tenant-1',
            amount: 50,
            sourcePriority: expect.arrayContaining(['wallet', 'platform_gift', 'tenant_gift', 'online_payment']),
            sources: expect.any(Array)
        }));

        const payload = res.json.mock.calls[0][0];
        expect(payload.sources.map((item) => item.source)).toEqual([
            'wallet',
            'platform_gift',
            'tenant_gift',
            'online_payment'
        ]);

        expect(payload.sources.find((item) => item.source === 'wallet')).toEqual(expect.objectContaining({
            eligible: true,
            availableAmount: 120
        }));
        expect(payload.sources.find((item) => item.source === 'tenant_gift')).toEqual(expect.objectContaining({
            eligible: true,
            tenantId: 'tenant-1',
            availableAmount: 35
        }));
    });

    test('POST /payments/process rejects wallet payment when wallet source is ineligible', async () => {
        walletService.getBalance.mockResolvedValue(0);
        tenantWalletService.getTenantBalance.mockResolvedValue(0);

        const req = {
            userId: 'user-1',
            body: {
                appointmentId: 'appt-1',
                amount: 20,
                paymentMethod: 'wallet',
                tenantId: 'tenant-1'
            },
            headers: {}
        };
        const res = createRes();

        await controller.processPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Wallet is not available for this payment context.'
        }));
        expect(paymentService.processWalletPayment).not.toHaveBeenCalled();
    });

    test('POST /payments/process accepts wallet payment when wallet source is eligible', async () => {
        walletService.getBalance.mockResolvedValue(200);
        tenantWalletService.getTenantBalance.mockResolvedValue(0);
        paymentService.processWalletPayment.mockResolvedValue({
            transaction: { id: 'tx-wallet-1' }
        });

        const req = {
            userId: 'user-1',
            body: {
                appointmentId: 'appt-1',
                amount: 20,
                paymentMethod: 'wallet',
                tenantId: 'tenant-1'
            },
            headers: {}
        };
        const res = createRes();

        await controller.processPayment(req, res);

        expect(paymentService.processWalletPayment).toHaveBeenCalledWith(expect.objectContaining({
            appointmentId: 'appt-1',
            amount: 20,
            tenantId: 'tenant-1'
        }));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            transaction: expect.objectContaining({ id: 'tx-wallet-1' })
        }));
    });
});
