'use strict';

const {
    calculateAppointmentFinancialState,
    isAppointmentFullyPaid,
    isBookingLocked,
    APPOINTMENT_PAYMENT_STATUS
} = require('../../utils/appointmentPaymentStatus');

describe('BARSPA-FIN-OPS-01: Payment Engine, Bank Transfer Verification & Paid Booking Lock', () => {

    describe('1. Authoritative Financial State & Balances', () => {
        it('calculates initial unpaid booking: paid = 0, outstanding = total, isLocked = false', () => {
            const state = calculateAppointmentFinancialState({
                price: 230.00,
                totalPaid: 0,
                depositAmount: 50.00
            });

            expect(state.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.PENDING);
            expect(state.totalPaid).toBe(0);
            expect(state.outstandingAmount).toBe(230.00);
            expect(state.depositPaid).toBe(false);
            expect(state.remainderPaid).toBe(false);
            expect(state.isLocked).toBe(false);
            expect(state.awaitingTransferVerification).toBe(false);
        });

        it('excludes pending bank transfers from confirmed paid and outstanding balance', () => {
            const state = calculateAppointmentFinancialState({
                price: 230.00,
                totalPaid: 0, // No confirmed payments yet
                depositAmount: 50.00,
                pendingTransferAmount: 50.00 // Submitted bank transfer
            });

            // Pending transfer must NOT reduce outstanding balance
            expect(state.totalPaid).toBe(0);
            expect(state.outstandingAmount).toBe(230.00);
            expect(state.pendingTransferAmount).toBe(50.00);
            expect(state.awaitingTransferVerification).toBe(true);
            expect(state.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.AWAITING_VERIFICATION);
            expect(state.depositPaid).toBe(false);
            expect(state.isLocked).toBe(false);
        });

        it('recognizes confirmed/verified deposit: paid increases, outstanding decreases, not fully paid', () => {
            const state = calculateAppointmentFinancialState({
                price: 230.00,
                totalPaid: 50.00, // Verified deposit
                depositAmount: 50.00,
                pendingTransferAmount: 0
            });

            expect(state.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID);
            expect(state.totalPaid).toBe(50.00);
            expect(state.outstandingAmount).toBe(180.00);
            expect(state.depositPaid).toBe(true);
            expect(state.remainderPaid).toBe(false);
            expect(state.isLocked).toBe(false); // Deposit alone does NOT lock booking
        });

        it('rejected transfer does not contribute to paid amount', () => {
            const state = calculateAppointmentFinancialState({
                price: 230.00,
                totalPaid: 0,
                depositAmount: 50.00,
                pendingTransferAmount: 0 // Rejected transfer was discarded
            });

            expect(state.totalPaid).toBe(0);
            expect(state.outstandingAmount).toBe(230.00);
            expect(state.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.PENDING);
            expect(state.isLocked).toBe(false);
        });

        it('aggregates multiple verified payments correctly', () => {
            // First deposit 50, then remainder 180 collected at salon
            const state = calculateAppointmentFinancialState({
                price: 230.00,
                totalPaid: 230.00,
                depositAmount: 50.00
            });

            expect(state.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.FULLY_PAID);
            expect(state.totalPaid).toBe(230.00);
            expect(state.outstandingAmount).toBe(0);
            expect(state.depositPaid).toBe(true);
            expect(state.remainderPaid).toBe(true);
            expect(state.isLocked).toBe(true); // Reaches zero outstanding -> LOCKED
        });

        it('handles overpayments explicitly without losing excess or forcing negative balance', () => {
            const state = calculateAppointmentFinancialState({
                price: 200.00,
                totalPaid: 250.00, // Customer paid 50 extra
                depositAmount: 0
            });

            expect(state.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.FULLY_PAID);
            expect(state.totalPaid).toBe(250.00);
            expect(state.outstandingAmount).toBe(0);
            expect(state.overpaidAmount).toBe(50.00);
            expect(state.isLocked).toBe(true);
        });

        it('updates balance correctly after refund', () => {
            const state = calculateAppointmentFinancialState({
                price: 230.00,
                totalPaid: 0,
                previousTotalPaid: 230.00
            });

            expect(state.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.REFUNDED);
            expect(state.totalPaid).toBe(0);
            expect(state.outstandingAmount).toBe(230.00);
            expect(state.isLocked).toBe(false);
        });

        it('updates balance correctly after partial refund', () => {
            const state = calculateAppointmentFinancialState({
                price: 230.00,
                totalPaid: 100.00,
                previousTotalPaid: 230.00
            });

            expect(state.paymentStatus).toBe(APPOINTMENT_PAYMENT_STATUS.PARTIALLY_REFUNDED);
            expect(state.totalPaid).toBe(100.00);
            expect(state.outstandingAmount).toBe(130.00);
            expect(state.isLocked).toBe(false);
        });
    });

    describe('2. Fully Paid Booking Lock Decision (Decision 1)', () => {
        it('unpaid booking is NOT locked', () => {
            const apt = { price: 230, totalPaid: 0, paymentStatus: 'pending', outstandingAmount: 230 };
            expect(isBookingLocked(apt)).toBe(false);
        });

        it('partially paid booking (deposit only) is NOT locked', () => {
            const apt = { price: 230, totalPaid: 50, paymentStatus: 'deposit_paid', outstandingAmount: 180 };
            expect(isBookingLocked(apt)).toBe(false);
        });

        it('booking awaiting transfer verification is NOT locked', () => {
            const apt = { price: 230, totalPaid: 0, paymentStatus: 'awaiting_verification', outstandingAmount: 230 };
            expect(isBookingLocked(apt)).toBe(false);
        });

        it('fully paid booking is locked when confirmed paid covers price', () => {
            const apt = { price: 230, totalPaid: 230, paymentStatus: 'fully_paid', outstandingAmount: 0 };
            expect(isBookingLocked(apt)).toBe(true);
        });

        it('detects fully paid lock even if paymentStatus string is lowercase or uppercase', () => {
            expect(isBookingLocked({ price: 100, totalPaid: 100, paymentStatus: 'FULLY_PAID', outstandingAmount: 0 })).toBe(true);
            expect(isBookingLocked({ price: 100, totalPaid: 100, paymentStatus: 'fully_paid', outstandingAmount: 0 })).toBe(true);
        });
    });

    describe('3. Split Payment Allocation with Bank Transfer Lifecycle', () => {
        const { normalizePaymentAllocations } = require('../splitPaymentService');

        it('supports bank_transfer in allocations', () => {
            const result = normalizePaymentAllocations({
                amount: 150,
                paymentMethod: 'split',
                paymentAllocations: [
                    { paymentMethod: 'bank_transfer', amount: 100, notes: 'Al Rajhi transfer ref 9988' },
                    { paymentMethod: 'cash', amount: 50 }
                ]
            });

            expect(result).toHaveLength(2);
            expect(result[0].paymentMethod).toBe('bank_transfer');
            expect(result[0].amount).toBe(100);
            expect(result[0].notes).toBe('Al Rajhi transfer ref 9988');
            expect(result[1].paymentMethod).toBe('cash');
            expect(result[1].amount).toBe(50);
        });
    });
});
