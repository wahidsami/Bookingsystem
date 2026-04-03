const BILL_STATUS = Object.freeze({
    DRAFT: 'DRAFT',
    UNPAID: 'UNPAID',
    FAILED: 'FAILED',
    PAID: 'PAID',
    EXPIRED: 'EXPIRED',
    VOID: 'VOID'
});

const PAYABLE_BILL_STATUSES = Object.freeze([
    BILL_STATUS.UNPAID,
    BILL_STATUS.FAILED
]);

const RETIRABLE_BILL_STATUSES = Object.freeze([
    BILL_STATUS.DRAFT,
    BILL_STATUS.UNPAID,
    BILL_STATUS.FAILED
]);

const BILL_STATUS_SUMMARY_TEMPLATE = Object.freeze({
    DRAFT: { count: 0, totalAmount: 0 },
    UNPAID: { count: 0, totalAmount: 0 },
    FAILED: { count: 0, totalAmount: 0 },
    PAID: { count: 0, totalAmount: 0 },
    EXPIRED: { count: 0, totalAmount: 0 },
    VOID: { count: 0, totalAmount: 0 }
});

const BLOCKED_PAYMENT_STATUS_MESSAGES = Object.freeze({
    DRAFT: 'This invoice is still in draft and is not ready for payment yet',
    VOID: 'This invoice was voided and is no longer payable',
    EXPIRED: 'This payment link has expired',
    PAID: 'This invoice has already been paid'
});

function isBillPayableStatus(status) {
    return PAYABLE_BILL_STATUSES.includes(status);
}

function isBillRetirableStatus(status) {
    return RETIRABLE_BILL_STATUSES.includes(status);
}

function createBillStatusSummarySeed() {
    return JSON.parse(JSON.stringify(BILL_STATUS_SUMMARY_TEMPLATE));
}

function getBlockedPaymentStatusMessage(status) {
    return BLOCKED_PAYMENT_STATUS_MESSAGES[status] || 'This invoice cannot be paid in its current status';
}

module.exports = {
    BILL_STATUS,
    PAYABLE_BILL_STATUSES,
    RETIRABLE_BILL_STATUSES,
    createBillStatusSummarySeed,
    getBlockedPaymentStatusMessage,
    isBillPayableStatus,
    isBillRetirableStatus
};
