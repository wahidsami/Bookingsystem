function normalizeFinancialPaymentMethodGroup(paymentMethod) {
    const method = `${paymentMethod || ''}`.trim().toLowerCase();
    if (['cash', 'pay_on_visit', 'cash_on_delivery'].includes(method)) return 'cash';
    if (['card_pos', 'card', 'online', 'online-full', 'mock_online'].includes(method)) return 'card';
    if (method === 'bank_transfer') return 'bank_transfer';
    if (method === 'wallet') return 'wallet';
    if (method === 'gift_card_code') return 'gift_card';
    if (method === 'split') return 'split';
    return 'other';
}

function getFinancialPaymentMethodLabel(paymentMethodGroup) {
    return ({
        cash: 'Cash',
        card: 'Card',
        bank_transfer: 'Bank transfer',
        online: 'Online',
        wallet: 'Wallet',
        gift_card: 'Gift Card',
        split: 'Split payments',
        other: 'Other'
    }[paymentMethodGroup] || paymentMethodGroup || 'Not set');
}

function getRefundModeLabel(amount, referenceAmount) {
    const numericAmount = Number(amount || 0);
    const numericReference = Number(referenceAmount || 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 'Partial';
    if (!Number.isFinite(numericReference) || numericReference <= 0) return 'Partial';
    return numericAmount >= (numericReference - 0.01) ? 'Full' : 'Partial';
}

function buildPaymentMethodBucketRows(transactions = [], { groupBy = 'day', includeRefunds = true } = {}) {
    const buckets = new Map();

    transactions.forEach((transaction) => {
        if (transaction.status !== 'completed' && transaction.status !== 'refunded') {
            return;
        }
        if (!includeRefunds && (transaction.status === 'refunded' || transaction.type === 'refund')) {
            return;
        }

        const dateValue = transaction.processedAt || transaction.createdAt;
        const rawDate = new Date(String(dateValue || ''));
        if (Number.isNaN(rawDate.getTime())) {
            return;
        }

        const bucketKey = groupBy === 'month'
            ? `${rawDate.getUTCFullYear()}-${`${rawDate.getUTCMonth() + 1}`.padStart(2, '0')}`
            : `${rawDate.getUTCFullYear()}-${`${rawDate.getUTCMonth() + 1}`.padStart(2, '0')}-${`${rawDate.getUTCDate()}`.padStart(2, '0')}`;
        const paymentMethodGroup = normalizeFinancialPaymentMethodGroup(transaction.paymentMethod);
        const amount = Number(transaction.amount || 0);
        const isRefund = transaction.status === 'refunded' || transaction.type === 'refund';
        const signedAmount = isRefund ? -Math.abs(amount) : Math.abs(amount);

        const existing = buckets.get(bucketKey) || {
            date: groupBy === 'month' ? `${bucketKey}-01` : bucketKey,
            paymentMethod: paymentMethodGroup,
            paymentMethodLabel: getFinancialPaymentMethodLabel(paymentMethodGroup),
            revenue: 0,
            transactionCount: 0
        };

        existing.revenue += signedAmount;
        existing.transactionCount += 1;
        buckets.set(bucketKey, existing);
    });

    return Array.from(buckets.values())
        .map((row) => ({
            ...row,
            revenue: Number(row.revenue.toFixed(2))
        }))
        .sort((left, right) => {
            if (left.date === right.date) {
                return left.paymentMethod.localeCompare(right.paymentMethod);
            }
            return left.date.localeCompare(right.date);
        });
}

function buildPaymentMethodSummaryRows(transactions = [], { includeRefunds = true } = {}) {
    const buckets = new Map();

    transactions.forEach((transaction) => {
        if (transaction.status !== 'completed' && transaction.status !== 'refunded') {
            return;
        }
        if (!includeRefunds && (transaction.status === 'refunded' || transaction.type === 'refund')) {
            return;
        }

        const paymentMethodGroup = normalizeFinancialPaymentMethodGroup(transaction.paymentMethod);
        const key = paymentMethodGroup === 'split' ? 'split' : paymentMethodGroup;
        const amount = Number(transaction.amount || 0);
        const isRefund = transaction.status === 'refunded' || transaction.type === 'refund';
        const signedAmount = isRefund ? -Math.abs(amount) : Math.abs(amount);

        const existing = buckets.get(key) || {
            paymentMethod: key,
            paymentMethodLabel: getFinancialPaymentMethodLabel(key),
            revenue: 0,
            transactionCount: 0
        };

        existing.revenue += signedAmount;
        existing.transactionCount += 1;
        buckets.set(key, existing);
    });

    return Array.from(buckets.values())
        .map((row) => ({
            ...row,
            revenue: Number(row.revenue.toFixed(2))
        }))
        .sort((left, right) => right.revenue - left.revenue);
}

module.exports = {
    buildPaymentMethodBucketRows,
    buildPaymentMethodSummaryRows,
    getFinancialPaymentMethodLabel,
    getRefundModeLabel,
    normalizeFinancialPaymentMethodGroup
};
