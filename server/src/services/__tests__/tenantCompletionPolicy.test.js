'use strict';

const {
    isAppointmentFullyPaid,
    isBookingLocked,
    calculateAppointmentFinancialState,
    APPOINTMENT_PAYMENT_STATUS
} = require('../../utils/appointmentPaymentStatus');

describe('BARSPA-APPOINTMENT-POLICY-01: Tenant-Configurable Appointment Completion Policy', () => {
    let tenantAppointmentController;
    let staffAppController;
    let tenantSettingsController;
    let AuditService;
    let db;
    let createMockTx;

    beforeEach(() => {
        jest.clearAllMocks();

        createMockTx = () => ({
            commit: jest.fn().mockResolvedValue(true),
            rollback: jest.fn().mockResolvedValue(true),
            finished: false
        });

        AuditService = require('../auditService');
        jest.spyOn(AuditService, 'logActivity').mockResolvedValue({ id: 'audit-log-101' });

        db = require('../../models');
        jest.spyOn(db.StaffPermission, 'findOne').mockResolvedValue({ permissions: { can_start_service: true, can_mark_no_show: true } });
        jest.spyOn(db.AppointmentEvent, 'create').mockResolvedValue({});
        jest.spyOn(db.ActivityLog, 'create').mockResolvedValue({});

        tenantAppointmentController = require('../../controllers/tenantAppointmentController');
        staffAppController = require('../../controllers/staffAppController');
        tenantSettingsController = require('../../controllers/tenantSettingsController');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. Default and Explicit Strict Policy Enforcement (allowCompletionWithOutstandingBalance: false)', () => {
        it('Scenario 1: Default tenant settings (omitted) blocks completion of fully unpaid appointment with APPOINTMENT_PAYMENT_REQUIRED', async () => {
            const req = {
                params: { id: 'apt-unpaid-01' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-strict-1' },
                userId: 'user-receptionist-1'
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockAppointment = {
                id: 'apt-unpaid-01',
                tenantId: 'tenant-strict-1',
                status: 'in_service',
                price: 250.00,
                totalPaid: 0.00,
                remainderAmount: 250.00,
                outstandingAmount: 250.00,
                paymentStatus: 'pending',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            // Default tenant settings without allowCompletionWithOutstandingBalance
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-1',
                tenantId: 'tenant-strict-1',
                cancellationHours: 24,
                bookingSettings: {
                    slotInterval: 15
                }
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                code: 'APPOINTMENT_PAYMENT_REQUIRED'
            }));
            expect(tx.rollback).toHaveBeenCalled();
            expect(mockAppointment.save).not.toHaveBeenCalled();
        });

        it('Scenario 2: Default tenant settings (omitted) blocks completion of partially paid appointment', async () => {
            const req = {
                params: { id: 'apt-partial-01' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-strict-1' },
                userId: 'user-receptionist-1'
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockAppointment = {
                id: 'apt-partial-01',
                tenantId: 'tenant-strict-1',
                status: 'in_service',
                price: 300.00,
                totalPaid: 100.00,
                remainderAmount: 200.00,
                outstandingAmount: 200.00,
                paymentStatus: 'deposit_paid',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-1',
                tenantId: 'tenant-strict-1',
                bookingSettings: {} // completely omitted
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                code: 'APPOINTMENT_PAYMENT_REQUIRED'
            }));
            expect(tx.rollback).toHaveBeenCalled();
        });

        it('Scenario 3: Explicit allowCompletionWithOutstandingBalance: false blocks completion for fully unpaid appointment', async () => {
            const req = {
                params: { id: 'apt-unpaid-02' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-strict-1' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockAppointment = {
                id: 'apt-unpaid-02',
                tenantId: 'tenant-strict-1',
                status: 'in_service',
                price: 150.00,
                totalPaid: 0.00,
                remainderAmount: 150.00,
                outstandingAmount: 150.00,
                paymentStatus: 'pending',
                save: jest.fn(),
                reload: jest.fn()
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-1',
                tenantId: 'tenant-strict-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: false }
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                code: 'APPOINTMENT_PAYMENT_REQUIRED'
            }));
        });

        it('Scenario 4: Explicit allowCompletionWithOutstandingBalance: false blocks completion for partially paid appointment', async () => {
            const req = {
                params: { id: 'apt-partial-02' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-strict-1' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockAppointment = {
                id: 'apt-partial-02',
                tenantId: 'tenant-strict-1',
                status: 'in_service',
                price: 400.00,
                totalPaid: 150.00,
                remainderAmount: 250.00,
                outstandingAmount: 250.00,
                paymentStatus: 'deposit_paid',
                save: jest.fn(),
                reload: jest.fn()
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-1',
                tenantId: 'tenant-strict-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: false }
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                code: 'APPOINTMENT_PAYMENT_REQUIRED'
            }));
        });
    });

    describe('2. Permissive Policy Enforcement (allowCompletionWithOutstandingBalance: true)', () => {
        it('Scenario 5: Explicit allowCompletionWithOutstandingBalance: true allows completion of fully unpaid appointment', async () => {
            const req = {
                params: { id: 'apt-unpaid-perm' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-flex-1' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockAppointment = {
                id: 'apt-unpaid-perm',
                tenantId: 'tenant-flex-1',
                status: 'in_service',
                price: 200.00,
                totalPaid: 0.00,
                remainderAmount: 200.00,
                outstandingAmount: 200.00,
                paymentStatus: 'pending',
                currency: 'SAR',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-flex',
                tenantId: 'tenant-flex-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: true }
            });
            jest.spyOn(db.ActivityLog, 'create').mockResolvedValue({});

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                hasOutstandingBalance: true,
                financialBreakdown: expect.objectContaining({
                    totalPrice: 200.00,
                    totalPaid: 0.00,
                    outstandingAmount: 200.00
                })
            }));
            expect(mockAppointment.status).toBe('completed');
            expect(tx.commit).toHaveBeenCalled();
        });

        it('Scenario 6: Explicit allowCompletionWithOutstandingBalance: true allows completion of partially paid appointment', async () => {
            const req = {
                params: { id: 'apt-partial-perm' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-flex-1' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockAppointment = {
                id: 'apt-partial-perm',
                tenantId: 'tenant-flex-1',
                status: 'in_service',
                price: 350.00,
                totalPaid: 150.00,
                remainderAmount: 200.00,
                outstandingAmount: 200.00,
                paymentStatus: 'deposit_paid',
                currency: 'SAR',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-flex',
                tenantId: 'tenant-flex-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: true }
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                hasOutstandingBalance: true,
                financialBreakdown: expect.objectContaining({
                    totalPrice: 350.00,
                    totalPaid: 150.00,
                    outstandingAmount: 200.00
                })
            }));
            expect(mockAppointment.status).toBe('completed');
        });
    });

    describe('3. Financial Separation & Invariants Preservation', () => {
        it('Scenario 7: When completed with outstanding balance, paymentStatus is NOT mutated to paid or fully_paid', async () => {
            const req = {
                params: { id: 'apt-perm-inv1' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-flex-1' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockAppointment = {
                id: 'apt-perm-inv1',
                tenantId: 'tenant-flex-1',
                status: 'in_service',
                price: 250.00,
                totalPaid: 50.00,
                remainderAmount: 200.00,
                outstandingAmount: 200.00,
                paymentStatus: 'deposit_paid',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-flex',
                tenantId: 'tenant-flex-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: true }
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(mockAppointment.status).toBe('completed');
            // Payment status MUST NOT be altered
            expect(mockAppointment.paymentStatus).toBe('deposit_paid');
            expect(mockAppointment.paymentStatus).not.toBe('paid');
            expect(mockAppointment.paymentStatus).not.toBe('fully_paid');
        });

        it('Scenario 8: When completed with outstanding balance, totalPaid and remainderAmount are strictly preserved', async () => {
            const req = {
                params: { id: 'apt-perm-inv2' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-flex-1' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockAppointment = {
                id: 'apt-perm-inv2',
                tenantId: 'tenant-flex-1',
                status: 'in_service',
                price: 400.00,
                totalPaid: 100.00,
                remainderAmount: 300.00,
                outstandingAmount: 300.00,
                paymentStatus: 'deposit_paid',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-flex',
                tenantId: 'tenant-flex-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: true }
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(mockAppointment.totalPaid).toBe(100.00);
            expect(mockAppointment.remainderAmount).toBe(300.00);
            expect(mockAppointment.outstandingAmount).toBe(300.00);
        });

        it('Scenario 9: When completed with outstanding balance, NO payment transaction records are fabricated', async () => {
            const req = {
                params: { id: 'apt-perm-inv3' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-flex-1' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockAppointment = {
                id: 'apt-perm-inv3',
                tenantId: 'tenant-flex-1',
                status: 'in_service',
                price: 200.00,
                totalPaid: 0.00,
                remainderAmount: 200.00,
                outstandingAmount: 200.00,
                paymentStatus: 'pending',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-flex',
                tenantId: 'tenant-flex-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: true }
            });
            const ptCreateSpy = jest.spyOn(db.PaymentTransaction, 'create');

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(ptCreateSpy).not.toHaveBeenCalled();
        });

        it('Scenario 10: When completed with outstanding balance, NO financial ledger entries are created', async () => {
            const req = {
                params: { id: 'apt-perm-inv4' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-flex-1' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockAppointment = {
                id: 'apt-perm-inv4',
                tenantId: 'tenant-flex-1',
                status: 'in_service',
                price: 200.00,
                totalPaid: 0.00,
                remainderAmount: 200.00,
                outstandingAmount: 200.00,
                paymentStatus: 'pending',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-flex',
                tenantId: 'tenant-flex-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: true }
            });
            const ledgerCreateSpy = jest.spyOn(db.FinancialLedgerEntry, 'create');

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(ledgerCreateSpy).not.toHaveBeenCalled();
        });

        it('Scenario 11: Appointment completed with outstanding balance is NOT financially locked (isBookingLocked returns false)', () => {
            const completedUnpaidAppointment = {
                status: 'completed',
                price: 300.00,
                totalPaid: 100.00,
                remainderAmount: 200.00,
                paymentStatus: 'deposit_paid'
            };

            expect(isAppointmentFullyPaid(completedUnpaidAppointment.paymentStatus)).toBe(false);
            expect(isBookingLocked(completedUnpaidAppointment)).toBe(false);

            const financialState = calculateAppointmentFinancialState(completedUnpaidAppointment);
            expect(financialState.isLocked).toBe(false);
            expect(financialState.outstandingAmount).toBe(200.00);
        });

        it('Scenario 12: Subsequent payment collection on completed appointment with outstanding balance records real payment', () => {
            // Simulated state before subsequent payment
            const appointmentBefore = {
                status: 'completed',
                price: 300.00,
                totalPaid: 100.00,
                remainderAmount: 200.00,
                paymentStatus: 'deposit_paid'
            };
            expect(isBookingLocked(appointmentBefore)).toBe(false);

            // Collecting remainder 200
            const stateAfter = calculateAppointmentFinancialState({
                price: 300.00,
                totalPaid: 300.00,
                depositAmount: 100.00
            });

            expect(stateAfter.totalPaid).toBe(300.00);
            expect(stateAfter.outstandingAmount).toBe(0.00);
            expect(stateAfter.remainderPaid).toBe(true);
            expect(stateAfter.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.FULLY_PAID);
        });

        it('Scenario 13: Financial lock engages automatically once subsequent payment settles the remainder in full', () => {
            const settledAppointment = {
                status: 'completed',
                price: 300.00,
                totalPaid: 300.00,
                remainderAmount: 0.00,
                paymentStatus: 'fully_paid'
            };

            expect(isAppointmentFullyPaid(settledAppointment.paymentStatus)).toBe(true);
            expect(isBookingLocked(settledAppointment)).toBe(true);
        });
    });

    describe('4. Staff App Endpoint Enforcement & Hydration', () => {
        it('Scenario 14: Staff app endpoint /staff/appointments/:id/status respects allowCompletionWithOutstandingBalance: false', async () => {
            const req = {
                params: { id: 'staff-apt-01' },
                body: { status: 'completed' },
                staffId: 'staff-1',
                tenantId: 'tenant-strict-1',
                staffUser: { id: 'staff-user-1', tenantId: 'tenant-strict-1' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockAppointment = {
                id: 'staff-apt-01',
                staffId: 'staff-1',
                tenantId: 'tenant-strict-1',
                status: 'in_service',
                price: 180.00,
                totalPaid: 0.00,
                remainderAmount: 180.00,
                paymentStatus: 'pending',
                save: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-1',
                tenantId: 'tenant-strict-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: false }
            });

            await staffAppController.updateAppointmentStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                code: 'APPOINTMENT_PAYMENT_REQUIRED',
                message: expect.stringContaining('Cannot complete appointment until payment has been fully settled')
            }));
            expect(tx.rollback).toHaveBeenCalled();
        });

        it('Scenario 15: Staff app endpoint /staff/appointments/:id/status respects allowCompletionWithOutstandingBalance: true', async () => {
            const req = {
                params: { id: 'staff-apt-02' },
                body: { status: 'completed' },
                staffId: 'staff-2',
                tenantId: 'tenant-flex-1',
                staffUser: { id: 'staff-user-2', tenantId: 'tenant-flex-1' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockAppointment = {
                id: 'staff-apt-02',
                staffId: 'staff-2',
                tenantId: 'tenant-flex-1',
                status: 'in_service',
                price: 250.00,
                totalPaid: 50.00,
                remainderAmount: 200.00,
                paymentStatus: 'deposit_paid',
                save: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-flex',
                tenantId: 'tenant-flex-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: true }
            });

            await staffAppController.updateAppointmentStatus(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                hasOutstandingBalance: true,
                financialBreakdown: expect.objectContaining({
                    totalPrice: 250.00,
                    totalPaid: 50.00,
                    outstandingAmount: 200.00
                })
            }));
            expect(mockAppointment.status).toBe('completed');
            expect(tx.commit).toHaveBeenCalled();
        });
    });

    describe('5. Tenant Isolation, API Management & Audit Logging', () => {
        it('Scenario 16: Multi-tenant boundary — Tenant A policy does not bleed or override Tenant B policy', async () => {
            const resA = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const resB = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const aptA = {
                id: 'apt-tenantA',
                tenantId: 'tenant-A',
                status: 'in_service',
                price: 200.00,
                totalPaid: 0.00,
                remainderAmount: 200.00,
                outstandingAmount: 200.00,
                paymentStatus: 'pending',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };
            const aptB = {
                id: 'apt-tenantB',
                tenantId: 'tenant-B',
                status: 'in_service',
                price: 200.00,
                totalPaid: 0.00,
                remainderAmount: 200.00,
                outstandingAmount: 200.00,
                paymentStatus: 'pending',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(db.sequelize, 'transaction').mockImplementation(async () => createMockTx());

            jest.spyOn(db.Appointment, 'findOne').mockImplementation(async ({ where }) => {
                if (where?.id === 'apt-tenantA') return aptA;
                if (where?.id === 'apt-tenantB') return aptB;
                return null;
            });

            jest.spyOn(db.TenantSettings, 'findOne').mockImplementation(async ({ where }) => {
                if (where?.tenantId === 'tenant-A') {
                    return {
                        id: 'set-A',
                        tenantId: 'tenant-A',
                        bookingSettings: { allowCompletionWithOutstandingBalance: true }
                    };
                }
                if (where?.tenantId === 'tenant-B') {
                    return {
                        id: 'set-B',
                        tenantId: 'tenant-B',
                        bookingSettings: { allowCompletionWithOutstandingBalance: false }
                    };
                }
                return null;
            });

            // Tenant A execution
            await tenantAppointmentController.updateAppointmentStatus({
                params: { id: 'apt-tenantA' },
                body: { status: 'completed' },
                tenantId: 'tenant-A',
                tenant: { id: 'tenant-A' }
            }, resA);

            // Tenant B execution
            await tenantAppointmentController.updateAppointmentStatus({
                params: { id: 'apt-tenantB' },
                body: { status: 'completed' },
                tenantId: 'tenant-B',
                tenant: { id: 'tenant-B' }
            }, resB);

            expect(resA.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
            expect(resB.status).toHaveBeenCalledWith(400);
            expect(resB.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'APPOINTMENT_PAYMENT_REQUIRED' }));
        });

        it('Scenario 17: PUT /tenant/settings/booking updates allowCompletionWithOutstandingBalance flag', async () => {
            const req = {
                tenant: { id: 'tenant-101' },
                user: { id: 'user-owner-1', role: 'tenant_owner', firstName: 'Sara', lastName: 'Al-Harbi' },
                body: {
                    allowCompletionWithOutstandingBalance: true,
                    slotInterval: 15
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockSettings = {
                id: 'ts-101',
                tenantId: 'tenant-101',
                bookingSettings: { slotInterval: 15, allowCompletionWithOutstandingBalance: false },
                update: jest.fn().mockImplementation(function (data) {
                    Object.assign(this, data);
                    return Promise.resolve(this);
                })
            };

            jest.spyOn(db.TenantSettings, 'findOrCreate').mockResolvedValue([mockSettings, false]);

            await tenantSettingsController.updateBookingSettings(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    bookingSettings: expect.objectContaining({
                        allowCompletionWithOutstandingBalance: true
                    })
                })
            }));
            expect(mockSettings.update).toHaveBeenCalledWith(expect.objectContaining({
                bookingSettings: expect.objectContaining({
                    allowCompletionWithOutstandingBalance: true
                })
            }));
        });

        it('Scenario 18: Updating allowCompletionWithOutstandingBalance writes an immutable activity audit log', async () => {
            const req = {
                tenant: { id: 'tenant-101' },
                user: { id: 'user-owner-1', role: 'tenant_owner', firstName: 'Sara', lastName: 'Al-Harbi' },
                body: {
                    allowCompletionWithOutstandingBalance: true
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockSettings = {
                id: 'ts-101',
                tenantId: 'tenant-101',
                bookingSettings: { allowCompletionWithOutstandingBalance: false },
                update: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(db.TenantSettings, 'findOrCreate').mockResolvedValue([mockSettings, false]);

            await tenantSettingsController.updateBookingSettings(req, res);

            expect(AuditService.logActivity).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-101',
                    entityType: 'tenant_settings',
                    entityId: 'ts-101',
                    action: 'update_booking_policy',
                    details: expect.objectContaining({
                        setting: 'allowCompletionWithOutstandingBalance',
                        previousValue: false,
                        newValue: true
                    }),
                    previousValue: { allowCompletionWithOutstandingBalance: false },
                    newValue: { allowCompletionWithOutstandingBalance: true }
                }),
                expect.any(Object)
            );
        });

        it('Scenario 19: Response payload contract contains hasOutstandingBalance and financialBreakdown structure', async () => {
            const req = {
                params: { id: 'apt-contract-01' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-flex-1' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockAppointment = {
                id: 'apt-contract-01',
                tenantId: 'tenant-flex-1',
                status: 'in_service',
                price: 500.00,
                totalPaid: 200.00,
                remainderAmount: 300.00,
                outstandingAmount: 300.00,
                paymentStatus: 'deposit_paid',
                currency: 'SAR',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-flex',
                tenantId: 'tenant-flex-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: true }
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            const responseArg = res.json.mock.calls[0][0];
            expect(responseArg).toHaveProperty('hasOutstandingBalance', true);
            expect(responseArg).toHaveProperty('financialBreakdown');
            expect(responseArg.financialBreakdown).toEqual({
                totalPrice: 500.00,
                totalPaid: 200.00,
                outstandingAmount: 300.00,
                currency: 'SAR'
            });
        });

        it('Scenario 20: Fully settled appointment can always be completed regardless of policy setting', async () => {
            const req = {
                params: { id: 'apt-paid-01' },
                body: { status: 'completed' },
                tenant: { id: 'tenant-strict-1' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            const mockAppointment = {
                id: 'apt-paid-01',
                tenantId: 'tenant-strict-1',
                status: 'in_service',
                price: 250.00,
                totalPaid: 250.00,
                remainderAmount: 0.00,
                outstandingAmount: 0.00,
                paymentStatus: 'paid',
                currency: 'SAR',
                save: jest.fn().mockResolvedValue(true),
                reload: jest.fn().mockResolvedValue(true)
            };

            const tx = createMockTx();
            jest.spyOn(db.sequelize, 'transaction').mockResolvedValue(tx);
            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            // Setting is false, but appointment is fully settled!
            jest.spyOn(db.TenantSettings, 'findOne').mockResolvedValue({
                id: 'settings-1',
                tenantId: 'tenant-strict-1',
                bookingSettings: { allowCompletionWithOutstandingBalance: false }
            });

            await tenantAppointmentController.updateAppointmentStatus(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                hasOutstandingBalance: false,
                financialBreakdown: expect.objectContaining({
                    totalPrice: 250.00,
                    totalPaid: 250.00,
                    outstandingAmount: 0.00
                })
            }));
            expect(mockAppointment.status).toBe('completed');
            expect(tx.commit).toHaveBeenCalled();
        });
    });
});
