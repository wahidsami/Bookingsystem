'use strict';

describe('BARSPA-FIN-OPS-01 Decision 3: Gift Commerce System (Monetary & Service/Package Experience)', () => {
    let userTenantGiftController;
    let publicTenantGiftController;
    let tenantPosController;
    let db;
    let mockTx;
    let createdGiftCodes;
    let createdTenantTransactions;
    let createdLedgerEntries;
    let mockGiftPackage;
    let mockService;

    beforeEach(() => {
        jest.clearAllMocks();

        mockTx = {
            commit: jest.fn().mockResolvedValue(true),
            rollback: jest.fn().mockResolvedValue(true),
            LOCK: { UPDATE: 'UPDATE' }
        };

        mockGiftPackage = {
            id: 'pkg-monetary-500',
            tenantId: 'tenant-100',
            voucherType: 'monetary',
            title_en: 'SAR 500 Gift Voucher',
            title_ar: 'قسيمة إهداء 500 ر.س',
            priceAmount: 500.00,
            walletCreditAmount: 500.00,
            bonusAmount: 0,
            isActive: true
        };

        mockService = {
            id: 'srv-spa-01',
            tenantId: 'tenant-100',
            name_en: 'Royal Hammam Treatment',
            name_ar: 'علاج الحمام الملكي',
            finalPrice: 400.00,
            price: 400.00,
            duration: 90
        };

        createdGiftCodes = [];
        createdTenantTransactions = [];
        createdLedgerEntries = [];

        db = {
            sequelize: {
                transaction: jest.fn().mockResolvedValue(mockTx)
            },
            PlatformUser: {
                findByPk: jest.fn().mockImplementation(async (id) => ({
                    id,
                    firstName: 'Hessah',
                    lastName: 'Al-Otaibi',
                    phone: '+966501112233'
                })),
                findOne: jest.fn().mockResolvedValue(null) // Unregistered recipient simulation
            },
            TenantGiftCardPackage: {
                findOne: jest.fn().mockImplementation(async ({ where }) => {
                    if (where.id === mockGiftPackage.id) return mockGiftPackage;
                    return null;
                })
            },
            Service: {
                findOne: jest.fn().mockImplementation(async ({ where }) => {
                    if (where.id === mockService.id) return mockService;
                    return null;
                })
            },
            ServicePackage: {
                findOne: jest.fn().mockResolvedValue(null)
            },
            Appointment: {
                findByPk: jest.fn().mockResolvedValue(null)
            },
            Transaction: {
                create: jest.fn().mockResolvedValue({ id: 'tx-card-101' })
            },
            GiftCardCode: {
                findOne: jest.fn().mockResolvedValue(null), // No collision
                create: jest.fn().mockImplementation(async (data) => {
                    const row = {
                        id: `gcc-${createdGiftCodes.length + 1}`,
                        ...data,
                        save: jest.fn().mockResolvedValue(true)
                    };
                    createdGiftCodes.push(row);
                    return row;
                })
            },
            TenantGiftCardTransaction: {
                create: jest.fn().mockImplementation(async (data) => {
                    const row = {
                        id: `tgt-${createdTenantTransactions.length + 1}`,
                        ...data,
                        save: jest.fn().mockResolvedValue(true)
                    };
                    createdTenantTransactions.push(row);
                    return row;
                })
            },
            GiftCardCodeRedemption: {
                create: jest.fn().mockResolvedValue({ id: 'red-1' })
            },
            FinancialLedgerEntry: {
                create: jest.fn().mockImplementation(async (data) => {
                    createdLedgerEntries.push(data);
                    return { id: `fle-${createdLedgerEntries.length}`, ...data };
                })
            }
        };

        jest.doMock('../../models', () => db);

        jest.doMock('../paymentTransactionLedgerService', () => ({
            createPaymentTransaction: jest.fn().mockResolvedValue({ id: 'pt-101' }),
            createOrderTransaction: jest.fn().mockResolvedValue({ id: 'pt-ord-1' }),
            createAppointmentTransaction: jest.fn().mockResolvedValue({ id: 'pt-appt-1' })
        }));

        jest.doMock('../financialLedgerService', () => ({
            recordRevenue: jest.fn().mockImplementation(async (data) => {
                createdLedgerEntries.push(data);
                return { id: `fle-${createdLedgerEntries.length}`, ...data };
            })
        }));

        jest.doMock('../tenantWalletService', () => ({
            creditTenantWallet: jest.fn().mockResolvedValue(true)
        }));

        jest.doMock('../tenantGiftSettlementService', () => ({
            createPendingSettlement: jest.fn().mockResolvedValue(true)
        }));

        jest.doMock('../notificationOrchestratorService', () => ({
            notifyCustomer: jest.fn().mockResolvedValue(true)
        }));

        jest.doMock('../userService', () => ({
            findOrCreatePlatformUser: jest.fn().mockResolvedValue({
                id: 'purchaser-user-uuid',
                firstName: 'Guest',
                lastName: 'Customer',
                phone: '+966555554444'
            })
        }));

        userTenantGiftController = require('../../controllers/userTenantGiftController');
        publicTenantGiftController = require('../../controllers/publicTenantGiftController');
        tenantPosController = require('../../controllers/tenantPosController');
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('1. Phone-First Monetary Gift Vouchers (Decision 3A)', () => {
        it('allows phone-only gifting to an unregistered recipient without forcing email', async () => {
            const req = {
                userId: 'user-sender-001',
                headers: {},
                body: {
                    tenantId: 'tenant-100',
                    packageId: 'pkg-monetary-500',
                    recipientName: 'Reem Al-Qahtani',
                    recipientPhone: '+966509998877',
                    // No recipientEmail provided
                    message: 'Happy Birthday Reem! Enjoy your salon pampering.',
                    cardNumber: '4111111111111111',
                    expiryDate: '12/28',
                    cvv: '123',
                    cardholderName: 'Hessah Al-Otaibi'
                }
            };

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock, json: jsonMock };

            await userTenantGiftController.sendGift(req, res);

            expect(mockTx.commit).toHaveBeenCalledTimes(1);
            expect(mockTx.rollback).not.toHaveBeenCalled();

            // Authoritative GiftCardCode was generated
            expect(createdGiftCodes).toHaveLength(1);
            const code = createdGiftCodes[0];
            expect(code.code).toMatch(/^TN-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
            expect(code.voucherType).toBe('monetary');
            expect(code.initialAmount).toBe(500.00);
            expect(code.remainingAmount).toBe(500.00);
            expect(code.recipientPhone).toBe('+966509998877');
            expect(code.recipientEmail).toBeNull();
            expect(code.recipientName).toBe('Reem Al-Qahtani');
            expect(code.giftMessage).toBe('Happy Birthday Reem! Enjoy your salon pampering.');

            // TenantGiftCardTransaction was created with correct metadata
            expect(createdTenantTransactions).toHaveLength(1);
            const tx = createdTenantTransactions[0];
            expect(tx.recipientName).toBe('Reem Al-Qahtani');
            expect(tx.recipientPhone).toBe('+966509998877');
            expect(tx.voucherType).toBe('monetary');
            expect(tx.status).toBe('sent_pending_external_redeem');
            expect(tx.deliveryMode).toBe('external_code');
        });
    });

    describe('2. Public Web Guest Gifting (Benchmarked against Ocean Spa)', () => {
        it('executes public guest purchase of monetary voucher generating shareable WhatsApp text', async () => {
            const req = {
                params: { tenantId: 'tenant-100' },
                body: {
                    voucherType: 'monetary',
                    amount: 250.00,
                    purchaser: {
                        name: 'Fahad Al-Dossari',
                        phone: '+966555554444'
                    },
                    recipient: {
                        name: 'Amal',
                        phone: '+966566667777'
                    },
                    giftMessage: 'From Fahad with love',
                    payment: { paymentMethod: 'card_pos' }
                }
            };

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock, json: jsonMock };

            await publicTenantGiftController.purchasePublicTenantGiftCard(req, res);

            expect(mockTx.commit).toHaveBeenCalledTimes(1);

            expect(createdGiftCodes).toHaveLength(1);
            const code = createdGiftCodes[0];
            expect(code.voucherType).toBe('monetary');
            expect(code.initialAmount).toBe(250.00);
            expect(code.recipientName).toBe('Amal');
            expect(code.recipientPhone).toBe('+966566667777');

            // Financial Ledger revenue recorded
            expect(createdLedgerEntries).toHaveLength(1);
            expect(createdLedgerEntries[0].entityType).toBe('GiftCardTransaction');
            expect(createdLedgerEntries[0].amount).toBe(250.00);

            // Response includes shareable voucher details
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    amount: 250.00,
                    recipientName: 'Amal',
                    shareText: expect.stringContaining('كود القسيمة:')
                })
            }));
        });

        it('executes public guest purchase of a Service Experience Gift (Decision 3B)', async () => {
            const req = {
                params: { tenantId: 'tenant-100' },
                body: {
                    voucherType: 'service_experience',
                    serviceId: 'srv-spa-01',
                    purchaser: {
                        name: 'Munira',
                        phone: '+966511112222'
                    },
                    recipient: {
                        name: 'Lulwah',
                        phone: '+966533334444'
                    },
                    giftMessage: 'Enjoy your Moroccan bath!',
                    payment: { paymentMethod: 'card_pos' }
                }
            };

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock, json: jsonMock };

            await publicTenantGiftController.purchasePublicTenantGiftCard(req, res);

            expect(mockTx.commit).toHaveBeenCalledTimes(1);

            expect(createdGiftCodes).toHaveLength(1);
            const code = createdGiftCodes[0];
            expect(code.voucherType).toBe('service_experience');
            expect(code.serviceId).toBe('srv-spa-01');
            expect(code.initialAmount).toBe(400.00); // Service price
            expect(code.recipientName).toBe('Lulwah');

            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    voucherType: 'service_experience',
                    title: 'Royal Hammam Treatment',
                    amount: 400.00
                })
            }));
        });
    });

    describe('3. POS Gift Voucher Validation & Atomic Redemption', () => {
        it('validates tenant-scoped gift card and returns max redeemable amount', async () => {
            const mockGiftCode = {
                code: 'TN-ABCD-1234',
                scopeType: 'tenant_scoped',
                tenantId: 'tenant-100',
                status: 'issued',
                remainingAmount: 500.00,
                currency: 'SAR',
                expiresAt: null
            };

            db.GiftCardCode.findOne = jest.fn().mockResolvedValue(mockGiftCode);
            db.Appointment.findByPk = jest.fn().mockResolvedValue({
                id: 'appt-123',
                tenantId: 'tenant-100',
                price: 350.00,
                totalPaid: 0
            });

            const req = {
                tenantId: 'tenant-100',
                query: {
                    code: 'TN-ABCD-1234',
                    entityType: 'appointment',
                    entityId: '12345678-1234-4234-a234-123456789abc'
                }
            };

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock, json: jsonMock };

            await tenantPosController.validateGiftCardForPos(req, res);

            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    code: 'TN-ABCD-1234',
                    remainingAmount: 500.00,
                    dueAmount: 350.00,
                    maxRedeemableAmount: 350.00
                })
            }));
        });
    });

    describe('4. Strict Gift-Entitlement & Fail-Closed Validation (Closure Mission)', () => {
        const { isGiftCodeRedeemable } = require('../../controllers/tenantPosController');

        it('fails closed when appointment lacks service identifier required by voucher', () => {
            const voucher = {
                code: 'TN-SRV-001',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'issued',
                remainingAmount: 400.00,
                voucherType: 'service_experience',
                serviceId: 'srv-spa-01',
                expiresAt: new Date(Date.now() + 86400000)
            };

            const appointmentWithoutServiceId = {
                id: 'appt-no-srv',
                tenantId: 'tenant-100',
                serviceId: null,
                price: 400.00
            };

            const result = isGiftCodeRedeemable(voucher, 'tenant-100', 'appointment', appointmentWithoutServiceId);
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('Appointment lacks the required service identifier');
        });

        it('fails closed when appointment service identifier does not match voucher', () => {
            const voucher = {
                code: 'TN-SRV-001',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'issued',
                remainingAmount: 400.00,
                voucherType: 'service_experience',
                serviceId: 'srv-spa-01',
                expiresAt: new Date(Date.now() + 86400000)
            };

            const appointmentWithDifferentService = {
                id: 'appt-wrong-srv',
                tenantId: 'tenant-100',
                serviceId: 'srv-haircut-99',
                price: 400.00
            };

            const result = isGiftCodeRedeemable(voucher, 'tenant-100', 'appointment', appointmentWithDifferentService);
            expect(result.ok).toBe(false);
            expect(result.reason).toBe('This gift voucher is valid only for its designated service experience.');
        });

        it('fails closed when appointment lacks package identifier required by voucher', () => {
            const voucher = {
                code: 'TN-PKG-001',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'issued',
                remainingAmount: 600.00,
                voucherType: 'service_experience',
                servicePackageId: 'pkg-wellness-bridal',
                expiresAt: new Date(Date.now() + 86400000)
            };

            const appointmentWithoutPackageId = {
                id: 'appt-no-pkg',
                tenantId: 'tenant-100',
                servicePackageId: null,
                packageId: null,
                price: 600.00
            };

            const result = isGiftCodeRedeemable(voucher, 'tenant-100', 'appointment', appointmentWithoutPackageId);
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('Appointment lacks the required package identifier');
        });

        it('fails closed when appointment package identifier does not match voucher', () => {
            const voucher = {
                code: 'TN-PKG-001',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'issued',
                remainingAmount: 600.00,
                voucherType: 'service_experience',
                servicePackageId: 'pkg-wellness-bridal',
                expiresAt: new Date(Date.now() + 86400000)
            };

            const appointmentWithWrongPackage = {
                id: 'appt-wrong-pkg',
                tenantId: 'tenant-100',
                servicePackageId: 'pkg-summer-glow',
                packageId: 'pkg-summer-glow',
                price: 600.00
            };

            const result = isGiftCodeRedeemable(voucher, 'tenant-100', 'appointment', appointmentWithWrongPackage);
            expect(result.ok).toBe(false);
            expect(result.reason).toBe('This gift voucher is valid only for its designated package experience.');
        });

        it('fails closed when service experience voucher is applied to retail product order', () => {
            const voucher = {
                code: 'TN-SRV-001',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'issued',
                remainingAmount: 400.00,
                voucherType: 'service_experience',
                serviceId: 'srv-spa-01'
            };

            const productOrder = {
                id: 'order-101',
                tenantId: 'tenant-100',
                totalAmount: 400.00
            };

            const result = isGiftCodeRedeemable(voucher, 'tenant-100', 'order', productOrder);
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('can only be redeemed for salon service appointments, not retail product orders');
        });

        it('fails closed when target tenant does not own the appointment or voucher', () => {
            const voucher = {
                code: 'TN-SRV-001',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'issued',
                remainingAmount: 400.00,
                voucherType: 'service_experience',
                serviceId: 'srv-spa-01'
            };

            // Caller context is tenant-999
            const crossTenantResult = isGiftCodeRedeemable(voucher, 'tenant-999', 'appointment', {
                id: 'appt-1',
                tenantId: 'tenant-999',
                serviceId: 'srv-spa-01'
            });
            expect(crossTenantResult.ok).toBe(false);
            expect(crossTenantResult.reason).toBe('This gift card can only be used in the issuing center');

            // Appointment belongs to a different tenant than the voucher
            const crossEntityResult = isGiftCodeRedeemable(voucher, 'tenant-100', 'appointment', {
                id: 'appt-2',
                tenantId: 'tenant-200',
                serviceId: 'srv-spa-01'
            });
            expect(crossEntityResult.ok).toBe(false);
            expect(crossEntityResult.reason).toContain('Cross-tenant');
        });

        it('fails closed when voucher status is revoked, cancelled, expired, or exhausted', () => {
            const baseVoucher = {
                code: 'TN-TEST-001',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'issued',
                remainingAmount: 200.00,
                voucherType: 'monetary'
            };

            // Revoked
            expect(isGiftCodeRedeemable({ ...baseVoucher, status: 'revoked' }, 'tenant-100').ok).toBe(false);
            expect(isGiftCodeRedeemable({ ...baseVoucher, status: 'revoked' }, 'tenant-100').reason).toBe('Gift card is revoked');

            // Cancelled
            expect(isGiftCodeRedeemable({ ...baseVoucher, status: 'cancelled' }, 'tenant-100').ok).toBe(false);

            // Exhausted / Zero remaining
            expect(isGiftCodeRedeemable({ ...baseVoucher, remainingAmount: 0 }, 'tenant-100').ok).toBe(false);
            expect(isGiftCodeRedeemable({ ...baseVoucher, remainingAmount: 0 }, 'tenant-100').reason).toBe('Gift card has no remaining balance');

            // Expired date
            expect(isGiftCodeRedeemable({ ...baseVoucher, expiresAt: new Date(Date.now() - 3600000) }, 'tenant-100').ok).toBe(false);
            expect(isGiftCodeRedeemable({ ...baseVoucher, expiresAt: new Date(Date.now() - 3600000) }, 'tenant-100').reason).toBe('Gift card is expired');
        });

        it('successfully validates matching service experience voucher against valid appointment', () => {
            const voucher = {
                code: 'TN-SRV-EXACT',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'active',
                remainingAmount: 400.00,
                voucherType: 'service_experience',
                serviceId: 'srv-spa-01',
                expiresAt: new Date(Date.now() + 86400000)
            };

            const matchingAppointment = {
                id: 'appt-exact-match',
                tenantId: 'tenant-100',
                serviceId: 'srv-spa-01',
                price: 400.00
            };

            const result = isGiftCodeRedeemable(voucher, 'tenant-100', 'appointment', matchingAppointment);
            expect(result.ok).toBe(true);
            expect(result.reason).toBeNull();
        });

        it('successfully validates matching package experience voucher against valid appointment', () => {
            const voucher = {
                code: 'TN-PKG-EXACT',
                tenantId: 'tenant-100',
                scopeType: 'tenant_scoped',
                status: 'active',
                remainingAmount: 600.00,
                voucherType: 'service_experience',
                servicePackageId: 'pkg-wellness-bridal',
                expiresAt: new Date(Date.now() + 86400000)
            };

            const matchingAppointment = {
                id: 'appt-pkg-match',
                tenantId: 'tenant-100',
                servicePackageId: 'pkg-wellness-bridal',
                price: 600.00
            };

            const result = isGiftCodeRedeemable(voucher, 'tenant-100', 'appointment', matchingAppointment);
            expect(result.ok).toBe(true);
            expect(result.reason).toBeNull();
        });
    });
});
