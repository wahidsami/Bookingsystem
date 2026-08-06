jest.mock('../../models', () => ({
    sequelize: {
        transaction: jest.fn()
    },
    Appointment: {},
    PaymentTransaction: {},
    Transaction: {},
    PaymentIdempotencyKey: {},
    TenantGiftCardTransaction: {},
    TenantGiftCardSettlement: {}
}));

const { normalizePaymentAllocations } = require('../splitPaymentService');

describe('splitPaymentService.normalizePaymentAllocations', () => {
    it('normalizes a single payment (no allocations array)', () => {
        const payload = {
            amount: 100,
            paymentMethod: 'card_pos',
            fallbackSource: 'cash'
        };
        const result = normalizePaymentAllocations(payload);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            paymentMethod: 'card_pos',
            amount: 100,
            giftCardCode: null,
            notes: null
        });
    });

    it('normalizes a split payment (array of allocations)', () => {
        const payload = {
            amount: 100,
            paymentMethod: 'split',
            paymentAllocations: [
                { paymentMethod: 'cash', amount: 40 },
                { paymentMethod: 'card_pos', amount: 60 }
            ],
            fallbackSource: 'cash'
        };
        const result = normalizePaymentAllocations(payload);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ paymentMethod: 'cash', amount: 40, giftCardCode: null, notes: null });
        expect(result[1]).toEqual({ paymentMethod: 'card_pos', amount: 60, giftCardCode: null, notes: null });
    });

    it('throws on invalid total payment amount', () => {
        expect(() => normalizePaymentAllocations({ amount: 0, paymentMethod: 'cash' }))
            .toThrow('Payment amount must be greater than zero');
        expect(() => normalizePaymentAllocations({ amount: -50, paymentMethod: 'cash' }))
            .toThrow('Payment amount must be greater than zero');
        expect(() => normalizePaymentAllocations({ amount: NaN, paymentMethod: 'cash' }))
            .toThrow('Payment amount must be greater than zero');
    });

    it('throws on invalid allocation item amount', () => {
        const payload = {
            amount: 100,
            paymentAllocations: [
                { paymentMethod: 'cash', amount: 100 },
                { paymentMethod: 'card_pos', amount: 0 }
            ]
        };
        expect(() => normalizePaymentAllocations(payload))
            .toThrow('Invalid payment allocation amount at position 2');
    });

    it('resolves fallback correctly for unsupported methods', () => {
        const payload = {
            amount: 100,
            paymentAllocations: [
                { paymentMethod: 'unknown_crypto', amount: 100 }
            ],
            fallbackSource: 'card_pos'
        };
        const result = normalizePaymentAllocations(payload);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            paymentMethod: 'card_pos',
            amount: 100,
            giftCardCode: null,
            notes: null
        });
    });

    it('normalizes payment method variations', () => {
        const payload = {
            amount: 100,
            paymentAllocations: [
                { paymentMethod: 'at_center', amount: 100 }
            ],
            fallbackSource: 'card_pos'
        };
        const result = normalizePaymentAllocations(payload);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            paymentMethod: 'cash',
            amount: 100,
            giftCardCode: null,
            notes: null
        });
    });
});
