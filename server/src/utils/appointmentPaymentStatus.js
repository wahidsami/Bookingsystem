const APPOINTMENT_PAYMENT_STATUS = {
    PENDING: 'pending',
    DEPOSIT_PAID: 'deposit_paid',
    FULLY_PAID: 'fully_paid',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded'
};

const isAppointmentFullyPaid = (status) => status === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;

const roundMoney = (value) => Number.parseFloat(Number(value || 0).toFixed(2));

/**
 * The single canonical function that calculates the financial state of an appointment.
 * MUST be used globally whenever an appointment's payment state changes.
 */
const calculateAppointmentFinancialState = ({
    price = 0,
    totalPaid = 0,
    depositAmount = 0,
    previousTotalPaid = 0
}) => {
    const numericPrice = roundMoney(price);
    const numericTotalPaid = roundMoney(totalPaid);
    const numericDepositAmount = roundMoney(depositAmount);

    const remainderAmount = roundMoney(Math.max(numericPrice - numericTotalPaid, 0));
    const outstandingAmount = remainderAmount;

    let paymentStatus = APPOINTMENT_PAYMENT_STATUS.PENDING;
    let depositPaid = false;
    let remainderPaid = false;

    if (numericTotalPaid >= numericPrice - 0.009) {
        paymentStatus = APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;
        depositPaid = true;
        remainderPaid = true;
    } else if (numericTotalPaid > 0 && (numericDepositAmount <= 0 || numericTotalPaid >= numericDepositAmount - 0.009)) {
        paymentStatus = APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID;
        depositPaid = true;
        remainderPaid = false;
    } else if (numericTotalPaid > 0) {
        // Partial deposit paid (rare, but mathematically possible)
        paymentStatus = APPOINTMENT_PAYMENT_STATUS.PENDING;
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

    return {
        paymentStatus,
        totalPaid: numericTotalPaid,
        remainderAmount,
        outstandingAmount,
        depositPaid,
        remainderPaid
    };
};

module.exports = {
    APPOINTMENT_PAYMENT_STATUS,
    isAppointmentFullyPaid,
    calculateAppointmentFinancialState
};
