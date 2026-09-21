'use strict';

// In-memory mock store for Jest
const mockBalances = new Map();
const mockLedger = [];
const mockIdempotencyKeys = new Map();
const mockTransactions = new Map();
const mockSettlements = new Map();
const mockTenants = new Map();
const mockTenantSettings = new Map();
const mockUsers = new Map();

jest.mock('../../models', () => {
    return {
        sequelize: {
            transaction: jest.fn(async (cb) => {
                const tx = {
                    commit: jest.fn(async () => {}),
                    rollback: jest.fn(async () => {}),
                    LOCK: { UPDATE: 'UPDATE' }
                };
                if (typeof cb === 'function') {
                    return await cb(tx);
                }
                return tx;
            }),
            where: jest.fn((fn, val) => ({ _isWhere: true, fn, val })),
            fn: jest.fn((name, col) => ({ _isFn: true, name, col })),
            col: jest.fn((col) => col)
        },
        TenantWalletBalance: {
            findOne: jest.fn(async ({ where }) => {
                const key = `${where.platformUserId}:${where.tenantId}`;
                return mockBalances.get(key) || null;
            }),
            findOrCreate: jest.fn(async ({ where, defaults }) => {
                const key = `${where.platformUserId}:${where.tenantId}`;
                let row = mockBalances.get(key);
                let created = false;
                if (!row) {
                    row = {
                        platformUserId: defaults.platformUserId,
                        tenantId: defaults.tenantId,
                        balance: defaults.balance || 0,
                        currency: defaults.currency || 'SAR',
                        reload: jest.fn(async () => row),
                        save: jest.fn(async () => row)
                    };
                    mockBalances.set(key, row);
                    created = true;
                }
                return [row, created];
            })
        },
        TenantWalletLedgerEntry: {
            create: jest.fn(async (entry) => {
                const record = { id: `ledger-${Date.now()}-${Math.random()}`, ...entry, createdAt: new Date() };
                mockLedger.push(record);
                return record;
            }),
            findAll: jest.fn(async ({ where }) => {
                return mockLedger.filter(
                    (l) => l.platformUserId === where.platformUserId && l.tenantId === where.tenantId
                );
            })
        },
        PaymentIdempotencyKey: {
            findOne: jest.fn(async ({ where }) => {
                return mockIdempotencyKeys.get(where.key) || null;
            }),
            findOrCreate: jest.fn(async ({ where, defaults }) => {
                let row = mockIdempotencyKeys.get(where.key);
                let created = false;
                if (!row) {
                    row = {
                        ...defaults,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        update: jest.fn(async (fields) => {
                            Object.assign(row, fields, { updatedAt: new Date() });
                            return row;
                        }),
                        destroy: jest.fn(async () => {
                            mockIdempotencyKeys.delete(where.key);
                        })
                    };
                    mockIdempotencyKeys.set(where.key, row);
                    created = true;
                }
                return [row, created];
            })
        },
        Transaction: {
            findByPk: jest.fn(async (id) => mockTransactions.get(id) || null),
            findOne: jest.fn(async ({ where }) => {
                for (const tx of mockTransactions.values()) {
                    let match = true;
                    if (where.id && tx.id !== where.id) match = false;
                    if (where.platformUserId && tx.platformUserId !== where.platformUserId) match = false;
                    if (where.type && tx.type !== where.type) match = false;
                    if (where.status && tx.status !== where.status) match = false;
                    if (match) return tx;
                }
                return null;
            }),
            create: jest.fn(async (data) => {
                const id = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                const record = {
                    id,
                    ...data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    update: jest.fn(async (fields) => {
                        Object.assign(record, fields, { updatedAt: new Date() });
                        return record;
                    })
                };
                mockTransactions.set(id, record);
                return record;
            }),
            count: jest.fn(async ({ where } = {}) => {
                if (!where) return mockTransactions.size;
                let count = 0;
                for (const tx of mockTransactions.values()) {
                    let match = true;
                    if (where.platformUserId && tx.platformUserId !== where.platformUserId) match = false;
                    if (where.tenantId && tx.tenantId !== where.tenantId) match = false;
                    if (where.type && tx.type !== where.type) match = false;
                    if (match) count++;
                }
                return count;
            })
        },
        Tenant: {
            findByPk: jest.fn(async (id) => mockTenants.get(id) || null),
            findOne: jest.fn(async ({ where }) => {
                for (const t of mockTenants.values()) {
                    if (where.id && t.id !== where.id) continue;
                    if (where.status && t.status !== where.status) continue;
                    return t;
                }
                return null;
            })
        },
        TenantSettings: {
            findOne: jest.fn(async ({ where }) => mockTenantSettings.get(where.tenantId) || null)
        },
        TenantSettlement: {
            findByPk: jest.fn(async (id) => mockSettlements.get(id) || null),
            findOne: jest.fn(async ({ where }) => {
                for (const s of mockSettlements.values()) {
                    if (where.sourceTransactionId && s.sourceTransactionId !== where.sourceTransactionId) continue;
                    if (where.tenantId && s.tenantId !== where.tenantId) continue;
                    return s;
                }
                return null;
            }),
            findAll: jest.fn(async ({ where } = {}) => {
                const results = [];
                for (const s of mockSettlements.values()) {
                    let match = true;
                    if (where?.tenantId && s.tenantId !== where.tenantId) match = false;
                    if (where?.status && s.status !== where.status) match = false;
                    if (where?.settlementPeriod && s.settlementPeriod !== where.settlementPeriod) match = false;
                    if (match) results.push(s);
                }
                return results;
            }),
            findAndCountAll: jest.fn(async ({ where } = {}) => {
                const rows = [];
                for (const s of mockSettlements.values()) {
                    let match = true;
                    if (where?.tenantId && s.tenantId !== where.tenantId) match = false;
                    if (where?.sourceType && s.sourceType !== where.sourceType) match = false;
                    if (where?.status && s.status !== where.status) match = false;
                    if (match) rows.push(s);
                }
                return { count: rows.length, rows };
            }),
            create: jest.fn(async (data) => {
                const id = `settle-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                const record = {
                    id,
                    ...data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    update: jest.fn(async (fields) => {
                        Object.assign(record, fields, { updatedAt: new Date() });
                        return record;
                    })
                };
                mockSettlements.set(id, record);
                return record;
            }),
            count: jest.fn(async ({ where } = {}) => {
                if (!where) return mockSettlements.size;
                let count = 0;
                for (const s of mockSettlements.values()) {
                    if (where.tenantId && s.tenantId !== where.tenantId) continue;
                    count++;
                }
                return count;
            })
        },
        PlatformUser: {
            findByPk: jest.fn(async (id) => mockUsers.get(id) || null)
        }
    };
});

const tenantWalletService = require('../tenantWalletService');
const tenantSettlementService = require('../tenantSettlementService');
const userTenantWalletController = require('../../controllers/userTenantWalletController');

const createMockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.headers = {};
    res.body = null;
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
};

describe('Sprint 3A — Direct Card Wallet Recharge & Tenant Settlement Layer', () => {
    const testUserId = 'user-sprint3a-001';
    const tenantAId = 'tenant-sprint3a-alpha';
    const tenantBId = 'tenant-sprint3a-beta';

    beforeEach(() => {
        mockBalances.clear();
        mockLedger.length = 0;
        mockIdempotencyKeys.clear();
        mockTransactions.clear();
        mockSettlements.clear();
        mockTenants.clear();
        mockTenantSettings.clear();
        mockUsers.clear();

        // Setup user
        mockUsers.set(testUserId, {
            id: testUserId,
            firstName: 'Sara',
            lastName: 'Tester',
            email: 'sara@test.com'
        });

        // Setup Tenant A with configured 2.50% commission
        mockTenants.set(tenantAId, {
            id: tenantAId,
            name: 'Happiness Salon',
            name_ar: 'صالون السعادة',
            name_en: 'Happiness Salon',
            status: 'active'
        });
        mockTenantSettings.set(tenantAId, {
            tenantId: tenantAId,
            commissionRate: 2.50,
            currency: 'SAR'
        });

        // Setup Tenant B with NO commission configured
        mockTenants.set(tenantBId, {
            id: tenantBId,
            name: 'Vanilla Salon',
            name_ar: 'صالون فانيلا',
            name_en: 'Vanilla Salon',
            status: 'active'
        });
    });

    // Test A: Card recharge credits correct tenant wallet
    test('Scenario A: Card recharge credits correct tenant wallet', async () => {
        const req = {
            userId: testUserId,
            body: {
                tenantId: tenantAId,
                amount: 500,
                payment: {
                    cardNumber: '4111111111111111',
                    expiryDate: '12/28',
                    cvv: '123',
                    cardholderName: 'Sara'
                },
                idempotencyKey: 'recharge-a-key'
            },
            headers: {}
        };
        const res = createMockRes();

        await userTenantWalletController.rechargeTenantWallet(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.rechargeAmount).toBe(500);
        expect(res.body.balanceBefore).toBe(0);
        expect(res.body.balanceAfter).toBe(500);

        const currentBalance = await tenantWalletService.getTenantBalance(testUserId, tenantAId);
        expect(currentBalance).toBe(500);
    });

    // Test B: Card recharge creates exactly one financial transaction
    test('Scenario B: Card recharge creates exactly one financial transaction', async () => {
        const req = {
            userId: testUserId,
            body: {
                tenantId: tenantAId,
                amount: 100,
                payment: {
                    cardNumber: '4111111111111111',
                    expiryDate: '12/28',
                    cvv: '123'
                },
                idempotencyKey: 'recharge-b-key'
            },
            headers: {}
        };
        const res = createMockRes();

        await userTenantWalletController.rechargeTenantWallet(req, res);

        expect(res.statusCode).toBe(200);
        expect(mockTransactions.size).toBe(1);

        const tx = mockTransactions.get(res.body.transactionId);
        expect(tx).toBeDefined();
        expect(tx.type).toBe('wallet_topup');
        expect(Number(tx.amount)).toBe(100);
        expect(tx.metadata.subType).toBe('tenant_wallet_card_recharge');
    });

    // Test C: Idempotency prevents duplicate charge/credit
    test('Scenario C: Idempotency prevents duplicate charge/credit', async () => {
        const stableKey = 'recharge-stable-key';
        const reqPayload = {
            userId: testUserId,
            body: {
                tenantId: tenantAId,
                amount: 200,
                payment: {
                    cardNumber: '4111111111111111',
                    expiryDate: '12/28',
                    cvv: '123'
                },
                idempotencyKey: stableKey
            },
            headers: {}
        };

        const res1 = createMockRes();
        await userTenantWalletController.rechargeTenantWallet(reqPayload, res1);
        expect(res1.statusCode).toBe(200);
        const balanceAfterFirst = res1.body.balanceAfter;

        // Replay identical request
        const res2 = createMockRes();
        await userTenantWalletController.rechargeTenantWallet(reqPayload, res2);

        expect(res2.statusCode).toBe(200);
        expect(res2.body.transactionId).toBe(res1.body.transactionId);
        expect(res2.body.balanceAfter).toBe(balanceAfterFirst);

        // Verify balance did NOT double increase
        const finalBalance = await tenantWalletService.getTenantBalance(testUserId, tenantAId);
        expect(finalBalance).toBe(balanceAfterFirst);
        // Verify only 1 transaction created
        expect(mockTransactions.size).toBe(1);
    });

    // Test D: Failed payment creates no wallet credit and no settlement entry
    test('Scenario D: Failed payment creates no wallet credit', async () => {
        const req = {
            userId: testUserId,
            body: {
                tenantId: tenantAId,
                amount: 300,
                payment: {
                    cardNumber: '4000000000000002', // Declined card
                    expiryDate: '12/28',
                    cvv: '123'
                },
                idempotencyKey: 'recharge-failed-key'
            },
            headers: {}
        };
        const res = createMockRes();

        await userTenantWalletController.rechargeTenantWallet(req, res);

        expect(res.statusCode).toBe(402);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('CARD_DECLINED');

        const balance = await tenantWalletService.getTenantBalance(testUserId, tenantAId);
        expect(balance).toBe(0);
        expect(mockSettlements.size).toBe(0);
        expect(mockTransactions.size).toBe(0);
    });

    // Test E: Tenant isolation (Tenant A recharge cannot pay or credit Tenant B)
    test('Scenario E: Tenant isolation gate', async () => {
        // Credit Tenant A
        await tenantWalletService.creditTenantWallet({
            platformUserId: testUserId,
            tenantId: tenantAId,
            amount: 500,
            type: 'tenant_wallet_card_recharge'
        });

        const balanceA = await tenantWalletService.getTenantBalance(testUserId, tenantAId);
        expect(balanceA).toBe(500);

        const balanceB = await tenantWalletService.getTenantBalance(testUserId, tenantBId);
        expect(balanceB).toBe(0);

        // Attempting to spend from Tenant B must throw insufficient funds
        await expect(tenantWalletService.assertCanSpendFromTenantWallet({
            platformUserId: testUserId,
            tenantId: tenantBId,
            amount: 50
        })).rejects.toThrow(/Insufficient/i);
    });

    // Test F: Exact ledger before/after match
    test('Scenario F: Exact ledger before/after math', async () => {
        // Initial balance: 150
        await tenantWalletService.creditTenantWallet({
            platformUserId: testUserId,
            tenantId: tenantAId,
            amount: 150,
            type: 'tenant_wallet_card_recharge'
        });

        const rechargeAmount = 250;
        const req = {
            userId: testUserId,
            body: {
                tenantId: tenantAId,
                amount: rechargeAmount,
                payment: {
                    cardNumber: '4111111111111111',
                    expiryDate: '12/28',
                    cvv: '123'
                },
                idempotencyKey: 'recharge-ledger-key'
            },
            headers: {}
        };
        const res = createMockRes();
        await userTenantWalletController.rechargeTenantWallet(req, res);

        expect(res.body.balanceBefore).toBe(150);
        expect(res.body.balanceAfter).toBe(400); // 150 + 250 = 400

        const ledger = await tenantWalletService.getTenantLedger(testUserId, tenantAId, { limit: 1 });
        expect(ledger.length).toBe(2);
        const lastEntry = ledger[ledger.length - 1];
        expect(lastEntry.type).toBe('tenant_wallet_card_recharge');
        expect(Number(lastEntry.amount)).toBe(rechargeAmount);
        expect(Number(lastEntry.balanceBefore)).toBe(150);
        expect(Number(lastEntry.balanceAfter)).toBe(400);
    });

    // Test G: Settlement entry created correctly with commission/fees
    test('Scenario G: Settlement entry created correctly', async () => {
        // Recharge 400 SAR at Tenant A (2.50% commission = 10.00 SAR fee, 390.00 SAR net)
        const req = {
            userId: testUserId,
            body: {
                tenantId: tenantAId,
                amount: 400,
                payment: {
                    cardNumber: '4111111111111111',
                    expiryDate: '12/28',
                    cvv: '123'
                },
                idempotencyKey: 'recharge-settlement-key'
            },
            headers: {}
        };
        const res = createMockRes();
        await userTenantWalletController.rechargeTenantWallet(req, res);

        expect(res.statusCode).toBe(200);
        const settlement = mockSettlements.get(res.body.settlementId);
        expect(settlement).toBeDefined();
        expect(Number(settlement.grossAmount)).toBe(400);
        expect(Number(settlement.platformFeeAmount)).toBe(10); // 2.5% of 400 = 10.00
        expect(Number(settlement.gatewayFeeAmount)).toBe(0); // 0.00 not_configured
        expect(Number(settlement.netPayableAmount)).toBe(390); // 400 - 10 = 390.00
        expect(settlement.status).toBe('pending'); // strictly pending, NOT settled
        expect(settlement.metadata.commissionRate).toBe(2.50);
    });

    // Test H: Super Admin report totals and traceability
    test('Scenario H: Super Admin settlement report totals and traceability', async () => {
        // Create 2 settlement records
        await tenantSettlementService.recordSettlementEntry({
            tenantId: tenantAId,
            sourceTransactionId: 'tx-001',
            sourceType: 'wallet_recharge',
            grossAmount: 500,
            platformFeeAmount: 12.50
        });

        const report = await tenantSettlementService.getSuperAdminSettlementReport({
            tenantId: tenantAId
        });

        expect(report.success).toBe(true);
        expect(report.recordsCount).toBe(1);
        expect(report.totals.totalGross).toBe(500);
        expect(report.totals.totalPlatformFees).toBe(12.50);
        expect(report.totals.totalNetPayable).toBe(487.50);
        expect(report.rows[0].transactionIds).toContain('tx-001');
    });

    // Test I: Tenant report totals and strict data isolation
    test('Scenario I: Tenant report totals and isolation', async () => {
        // Record settlement for Tenant A
        await tenantSettlementService.recordSettlementEntry({
            tenantId: tenantAId,
            sourceTransactionId: 'tx-alpha',
            sourceType: 'wallet_recharge',
            grossAmount: 300,
            platformFeeAmount: 7.50
        });

        const summaryA = await tenantSettlementService.getTenantSettlementSummary(tenantAId);
        expect(summaryA.summary.grossRevenue).toBe(300);
        expect(summaryA.summary.customerWalletRecharges.gross).toBe(300);
        expect(summaryA.summary.netAmountPayable).toBe(292.50);

        // Tenant B has 0
        const summaryB = await tenantSettlementService.getTenantSettlementSummary(tenantBId);
        expect(summaryB.summary.grossRevenue).toBe(0);
        expect(summaryB.transactionsCount).toBe(0);
    });

    // Test J: No double counting on wallet spend
    test('Scenario J: No double counting on wallet spend', async () => {
        const settlementCountBefore = mockSettlements.size;

        // Customer spends 50 SAR from their existing tenant wallet credit
        await tenantWalletService.creditTenantWallet({
            platformUserId: testUserId,
            tenantId: tenantAId,
            amount: 100,
            type: 'tenant_wallet_card_recharge'
        });

        const countAfterRecharge = mockSettlements.size;

        // Customer spends 50 SAR on appointment
        await tenantWalletService.debitTenantWallet({
            platformUserId: testUserId,
            tenantId: tenantAId,
            amount: 50,
            type: 'tenant_gift_redeem_debit',
            referenceType: 'appointment',
            referenceId: 'appt-001'
        });

        // Wallet spend must NOT create a second settlement entry
        expect(mockSettlements.size).toBe(countAfterRecharge);
    });

    // Test K: Refund accounting reversal
    test('Scenario K: Refund accounting reversal', async () => {
        const rechargeReq = {
            userId: testUserId,
            body: {
                tenantId: tenantAId,
                amount: 100,
                payment: {
                    cardNumber: '4111111111111111',
                    expiryDate: '12/28',
                    cvv: '123'
                },
                idempotencyKey: 'recharge-refund-key'
            },
            headers: {}
        };
        const rechargeRes = createMockRes();
        await userTenantWalletController.rechargeTenantWallet(rechargeReq, rechargeRes);
        const txId = rechargeRes.body.transactionId;

        const balanceBeforeRefund = await tenantWalletService.getTenantBalance(testUserId, tenantAId);
        expect(balanceBeforeRefund).toBe(100);

        // Process refund
        const refundReq = {
            userId: testUserId,
            body: {
                transactionId: txId,
                reason: 'Customer requested cancellation'
            }
        };
        const refundRes = createMockRes();
        await userTenantWalletController.refundTenantWalletRecharge(refundReq, refundRes);

        expect(refundRes.statusCode).toBe(200);
        expect(refundRes.body.refundAmount).toBe(100);

        const balanceAfterRefund = await tenantWalletService.getTenantBalance(testUserId, tenantAId);
        expect(balanceAfterRefund).toBe(0); // 100 - 100 = 0

        // Verify Transaction is marked refunded
        const tx = mockTransactions.get(txId);
        expect(tx.status).toBe('refunded');

        // Verify settlement was cancelled/reversed
        const settlement = Array.from(mockSettlements.values()).find(s => s.sourceTransactionId === txId);
        expect(settlement.status).toBe('cancelled');
        expect(settlement.netPayableAmount).toBe(0);
    });
});
