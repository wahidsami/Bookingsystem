const APPOINTMENT_PAYMENT_STATUS = {
    PENDING: 'pending',
    DEPOSIT_PAID: 'deposit_paid',
    FULLY_PAID: 'fully_paid',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
    AWAITING_VERIFICATION: 'awaiting_verification'
};

const isAppointmentFullyPaid = (status) => `${status || ''}`.trim().toLowerCase() === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;

const roundMoney = (value) => Number.parseFloat(Number(value || 0).toFixed(2));

/**
 * Checks if a booking is locked due to full payment.
 * A booking becomes locked when its confirmed net payments cover the authoritative booking total
 * and the outstanding balance reaches zero.
 */
const isBookingLocked = (appointment) => {
    if (!appointment) return false;
    const paymentStatus = `${appointment.paymentStatus || ''}`.trim().toLowerCase();
    const price = roundMoney(appointment.price ?? 0);
    const totalPaid = roundMoney(appointment.totalPaid ?? 0);
    const outstanding = appointment.outstandingAmount !== undefined
        ? roundMoney(appointment.outstandingAmount)
        : roundMoney(Math.max(price - totalPaid, 0));

    // Consistency safeguard for group sessions: if all active session appointments are fully settled, lock this item
    if (appointment.bookingSession && Array.isArray(appointment.bookingSession.appointments)) {
        const activeSessionAppts = appointment.bookingSession.appointments.filter(
            (a) => `${a.status || ''}`.trim().toLowerCase() !== 'cancelled'
        );
        if (activeSessionAppts.length > 0) {
            const allSessionItemsFullyPaid = activeSessionAppts.every(
                (a) => `${a.paymentStatus || ''}`.trim().toLowerCase() === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID ||
                       (roundMoney(a.totalPaid ?? 0) >= roundMoney(a.price ?? 0) - 0.009)
            );
            if (allSessionItemsFullyPaid) {
                return true;
            }
        }
    }

    return (paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID || totalPaid >= price - 0.009) && outstanding <= 0.009;
};

/**
 * The single canonical function that calculates the financial state of an appointment.
 * MUST be used globally whenever an appointment's payment state changes.
 * 
 * Rules:
 * - Confirmed Paid = Sum of confirmed, verified, unreversed payments.
 * - Pending transfers are EXCLUDED from confirmed paid total.
 * - Outstanding = Booking Total - Confirmed Paid.
 * - When Outstanding <= 0 through confirmed payments, booking is fully paid and locked.
 * - Overpayments are explicitly captured in overpaidAmount (not silently lost).
 */
const calculateAppointmentFinancialState = ({
    price = 0,
    totalPaid = 0,
    depositAmount = 0,
    previousTotalPaid = 0,
    pendingTransferAmount = 0
}) => {
    const numericPrice = roundMoney(price);
    const numericTotalPaid = roundMoney(totalPaid); // Confirmed verified paid
    const numericDepositAmount = roundMoney(depositAmount);
    const numericPendingTransfer = roundMoney(pendingTransferAmount);

    const remainderAmount = roundMoney(Math.max(numericPrice - numericTotalPaid, 0));
    const outstandingAmount = remainderAmount;
    const overpaidAmount = roundMoney(Math.max(numericTotalPaid - numericPrice, 0));

    let paymentStatus = APPOINTMENT_PAYMENT_STATUS.PENDING;
    let depositPaid = false;
    let remainderPaid = false;

    if (numericTotalPaid >= numericPrice - 0.009 && numericPrice > 0) {
        paymentStatus = APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;
        depositPaid = true;
        remainderPaid = true;
    } else if (numericTotalPaid > 0 && (numericDepositAmount <= 0 || numericTotalPaid >= numericDepositAmount - 0.009)) {
        paymentStatus = APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID;
        depositPaid = true;
        remainderPaid = false;
    } else if (numericTotalPaid > 0) {
        // Partial deposit paid
        paymentStatus = APPOINTMENT_PAYMENT_STATUS.PENDING;
        depositPaid = false;
        remainderPaid = false;
    } else if (numericPendingTransfer > 0) {
        // Transfer submitted but not yet verified
        paymentStatus = APPOINTMENT_PAYMENT_STATUS.AWAITING_VERIFICATION;
        depositPaid = false;
        remainderPaid = false;
    }

    if (previousTotalPaid > numericTotalPaid) {
        if (numericTotalPaid <= 0.009) {
            paymentStatus = APPOINTMENT_PAYMENT_STATUS.REFUNDED;
        } else {
            paymentStatus = APPOINTMENT_PAYMENT_STATUS.PARTIALLY_REFUNDED;
        }
    }

    const isLocked = (paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID || numericTotalPaid >= numericPrice - 0.009) && outstandingAmount <= 0.009;
    const awaitingTransferVerification = numericPendingTransfer > 0.009 && outstandingAmount > 0.009;

    return {
        paymentStatus,
        totalPaid: numericTotalPaid,
        remainderAmount,
        outstandingAmount,
        overpaidAmount,
        depositPaid,
        remainderPaid,
        pendingTransferAmount: numericPendingTransfer,
        awaitingTransferVerification,
        isLocked
    };
};

module.exports = {
    APPOINTMENT_PAYMENT_STATUS,
    isAppointmentFullyPaid,
    isBookingLocked,
    calculateAppointmentFinancialState
};
