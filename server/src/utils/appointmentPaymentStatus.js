const APPOINTMENT_PAYMENT_STATUS = {
    PENDING: 'pending',
    DEPOSIT_PAID: 'deposit_paid',
    FULLY_PAID: 'fully_paid',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded'
};

const isAppointmentFullyPaid = (status) => status === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID;

module.exports = {
    APPOINTMENT_PAYMENT_STATUS,
    isAppointmentFullyPaid
};
