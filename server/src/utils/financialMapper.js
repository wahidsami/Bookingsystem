/**
 * Canonical Financial Mapper
 * 
 * Centralized utility to ensure all financial endpoints, BI reports,
 * and ledgers use the exact same financial data definitions and field names.
 */

/**
 * Build the canonical financial payload for a transaction (and optionally its invoice).
 * 
 * Semantics:
 * - Gross Sales: The pre-tax value including all platform and shipping fees.
 * - Discount: The calculated discount applied to the gross value.
 * - Net Sales: grossSales - discount (pre-tax, post-discount).
 * - VAT: The exact tax amount calculated.
 * - Total: netSales + VAT (tax-inclusive, post-discount final price).
 * 
 * @param {Object} transaction - The payment transaction object.
 * @param {Object} invoice - The associated customer invoice (optional).
 * @returns {Object} The canonical financial DTO.
 */
function buildCanonicalFinancialData(transaction, invoice = null) {
    const appointment = transaction?.appointment;
    const order = transaction?.order;
    
    // Amount Paid is what's on the transaction
    const amountPaid = Number(transaction?.amount || 0);
    const isRefund = transaction?.status === 'refunded' || transaction?.type === 'refund';
    
    // Default fallback values
    let grossSales = 0;
    let discount = 0;
    let vat = 0;
    let netSales = 0;
    let totalAmount = 0;
    let remainingBalance = 0;
    
    // If we have an invoice, it's the commercial source of truth for totals
    if (invoice) {
        vat = Number(invoice.vatAmount ?? 0);
        totalAmount = Number(invoice.totalAmount ?? 0);
        discount = Number(invoice.discountAmount ?? 0);
        remainingBalance = Number(invoice.dueAmount ?? 0);
        
        // Net sales is pre-tax post-discount
        netSales = Math.max(totalAmount - vat, 0);
        
        // Gross sales is pre-tax pre-discount
        grossSales = netSales + discount;
    } else if (appointment) {
        // Fallback calculation for Appointment when no invoice is present
        const serviceRawPrice = Number(appointment.service?.rawPrice ?? 0);
        const appointmentRawPrice = Number(appointment.rawPrice ?? 0); // Discounted raw price
        const platformFee = Number(appointment.platformFee ?? 0);
        
        // Appointment discount logic based on platform implied logic
        discount = Math.max(serviceRawPrice - appointmentRawPrice, 0);
        
        // Net Sales: Pre-tax, post-discount, including platform fees
        netSales = appointmentRawPrice + platformFee;
        
        // Gross Sales: Pre-tax, pre-discount, including platform fees
        grossSales = netSales + discount;
        
        vat = Number(appointment.taxAmount ?? 0);
        totalAmount = Number(appointment.price ?? 0); // Inclusive final price
        remainingBalance = Number(appointment.remainderAmount ?? 0);
    } else if (order) {
        // Fallback calculation for Order when no invoice is present
        const subtotal = Number(order.subtotal ?? 0);
        const shippingFee = Number(order.shippingFee ?? 0);
        vat = Number(order.taxAmount ?? 0);
        totalAmount = Number(order.totalAmount ?? 0);
        
        // Net Sales: Pre-tax, post-discount, including shipping fees
        netSales = Math.max(totalAmount - vat, 0);
        
        // The gross pre-tax pre-discount is subtotal + shippingFee minus VAT
        // (because order.subtotal is tax-inclusive in this system)
        grossSales = Math.max((subtotal + shippingFee) - vat, 0);
        
        // Discount is the difference between gross pre-tax and net pre-tax
        discount = Math.max(grossSales - netSales, 0);
        
        remainingBalance = order.paymentStatus === 'paid' ? 0 : totalAmount;
    } else {
        // Raw transaction with no associated business entity
        totalAmount = amountPaid;
        netSales = amountPaid; // Assume no tax or discount recorded
        grossSales = amountPaid;
    }
    
    return {
        grossSales: Number(grossSales.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        vat: Number(vat.toFixed(2)),
        netSales: Number(netSales.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        amountPaid: Number(amountPaid.toFixed(2)),
        remainingBalance: Number(remainingBalance.toFixed(2)),
        status: appointment?.status || order?.status || transaction?.status || 'Unknown',
        paymentMethod: transaction?.paymentMethod || 'Unknown'
    };
}

module.exports = {
    buildCanonicalFinancialData
};
