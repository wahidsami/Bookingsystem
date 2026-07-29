/**
 * Tenant Financial Controller
 * Handles financial reporting and analytics for authenticated tenants
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { isAppointmentFullyPaid } = require('../utils/appointmentPaymentStatus');
const { getActiveSubscriptionForTenant } = require('../services/tenantSubscriptionService');
const { buildSubscriptionConsumption } = require('../services/subscriptionConsumptionService');
const { PAYABLE_BILL_STATUSES } = require('../utils/billStatus');
const {
    buildReportFilterContext,
    matchesAppointmentFilters,
    matchesOrderFilters,
    matchesTransactionFilters,
    matchesSelection
} = require('../services/tenantReportFilterService');
const {
    normalizeFinancialPaymentMethodGroup,
    getRefundModeLabel
} = require('../services/tenantFinancialFormulaService');
const tenantPosController = require('./tenantPosController');

function parseDateValue(value, endOfDay = false) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (endOfDay) {
            date.setHours(23, 59, 59, 999);
        } else {
            date.setHours(0, 0, 0, 0);
        }
    }

    return date;
}

function buildDateRangeWhere(field, startDate, endDate) {
    const start = parseDateValue(startDate, false);
    const end = parseDateValue(endDate, true);

    if (!start && !end) {
        return {};
    }

    const filter = {};
    if (start) {
        filter[Op.gte] = start;
    }
    if (end) {
        filter[Op.lte] = end;
    }

    return {
        [field]: filter
    };
}

function getLedgerCustomerName(user) {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || user?.email || user?.phone || 'Guest Customer';
}

function getLedgerServiceName(service) {
    return service?.name_en || service?.name_ar || 'Service';
}

function getLedgerOrderLabel(order) {
    const itemNames = Array.isArray(order?.items)
        ? order.items
            .map((item) => item?.product?.name_en || item?.product?.name_ar)
            .filter(Boolean)
        : [];

    return itemNames.length ? itemNames.slice(0, 2).join(', ') : 'Product order';
}

function formatLedgerPaymentMethodLabel(paymentMethod) {
    return ({
        online: 'Online',
        cash: 'Cash',
        card_pos: 'Card POS',
        wallet: 'Wallet',
        bank_transfer: 'Bank transfer',
        gift_card_code: 'Gift card code',
        pay_on_visit: 'Pay on visit',
        cash_on_delivery: 'Cash on delivery',
        split: 'Split payments'
    }[paymentMethod] || paymentMethod || 'Not set');
}

function getLedgerTransactionIncludes() {
    return [
        {
            model: db.Appointment,
            as: 'appointment',
            attributes: [
                'id',
                'bookingNumber',
                'bookingReference',
                'bookingItemIndex',
                'tenantId',
                'startTime',
                'paymentStatus',
                'status',
                'price',
                'rawPrice',
                'taxAmount',
                'platformFee',
                'tenantRevenue',
                'employeeCommission',
                'employeeCommissionRate',
                'depositAmount',
                'depositPaid',
                'remainderAmount',
                'remainderPaid',
                'totalPaid',
                'paidAt'
            ],
            required: false,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar', 'category'],
                    required: false
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name'],
                    required: false
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'city', 'address'],
                    required: false
                },
                {
                    model: db.BookingSession,
                    as: 'bookingSession',
                    attributes: ['id', 'bookingReference', 'paymentMethod', 'paymentStatus'],
                    required: false,
                    include: [
                        {
                            model: db.Appointment,
                            as: 'appointments',
                            attributes: ['id', 'bookingItemIndex', 'status', 'startTime', 'serviceId'],
                            required: false,
                            include: [
                                {
                                    model: db.Service,
                                    as: 'service',
                                    attributes: ['id', 'name_en', 'name_ar', 'category'],
                                    required: false
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            model: db.Order,
            as: 'order',
            attributes: [
                'id',
                'tenantId',
                'orderNumber',
                'paymentStatus',
                'status',
                'paymentMethod',
                'subtotal',
                'taxAmount',
                'shippingFee',
                'platformFee',
                'totalAmount'
            ],
            required: false,
            include: [
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                },
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'city', 'address'],
                    required: false
                },
                {
                    model: db.OrderItem,
                    as: 'items',
                    attributes: ['id', 'quantity', 'unitPrice', 'totalPrice', 'productId'],
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar', 'category'],
                            required: false
                        }
                    ],
                    required: false
                }
            ]
        },
        {
            model: db.Staff,
            as: 'processor',
            attributes: ['id', 'name'],
            required: false
        }
    ];
}

function getCashFlowPeriodStart(date, grouping = 'day') {
    const start = new Date(date);
    if (Number.isNaN(start.getTime())) {
        return null;
    }

    if (grouping === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    if (grouping === 'week') {
        const day = start.getDay();
        const diff = (day + 6) % 7;
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    start.setHours(0, 0, 0, 0);
    return start;
}

function getCashFlowPeriodEnd(start, grouping = 'day') {
    const end = new Date(start);
    if (Number.isNaN(end.getTime())) {
        return null;
    }

    if (grouping === 'month') {
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return end;
    }

    if (grouping === 'week') {
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return end;
    }

    end.setHours(23, 59, 59, 999);
    return end;
}

function getCashFlowPeriodLabel(date, grouping = 'day') {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return 'Unavailable';
    }

    if (grouping === 'month') {
        return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    }

    if (grouping === 'week') {
        const start = getCashFlowPeriodStart(date, grouping);
        const end = getCashFlowPeriodEnd(start, grouping);
        return `${start.toISOString().split('T')[0]} → ${end.toISOString().split('T')[0]}`;
    }

    return date.toISOString().split('T')[0];
}

function buildCashFlowSummaryRows(settlementRows = [], paymentRows = [], grouping = 'day') {
    const buckets = new Map();

    settlementRows.forEach((row) => {
        const rawDate = new Date(String(row?.date || ''));
        if (Number.isNaN(rawDate.getTime())) {
            return;
        }

        const start = getCashFlowPeriodStart(rawDate, grouping);
        const end = getCashFlowPeriodEnd(start, grouping);
        const key = `${start.toISOString().split('T')[0]}:${grouping}`;
        const existing = buckets.get(key) || {
            id: key,
            period: getCashFlowPeriodLabel(rawDate, grouping),
            periodStart: start.toISOString(),
            periodEnd: end.toISOString(),
            openingBalance: null,
            cashIn: 0,
            cashOut: 0,
            netMovement: 0,
            closingBalance: null,
            cashPayments: 0,
            cardPayments: 0,
            onlinePayments: 0,
            walletPayments: 0,
            bankTransferPayments: 0,
            transactionCount: 0,
            sourceRows: []
        };

        existing.cashIn += Number(row?.grossRevenue || 0);
        existing.cashOut += Number(row?.refunds || 0);
        existing.netMovement += Number(row?.netCollected || 0);
        existing.cashPayments += Number(row?.cash || 0);
        existing.cardPayments += Number(row?.card || 0);
        existing.walletPayments += Number(row?.wallet || 0);
        existing.sourceRows = [...(existing.sourceRows || []), row];
        buckets.set(key, existing);
    });

    paymentRows.forEach((row) => {
        const rawDate = new Date(String(row?.date || row?.processedAt || row?.createdAt || ''));
        if (Number.isNaN(rawDate.getTime())) {
            return;
        }

        const start = getCashFlowPeriodStart(rawDate, grouping);
        const end = getCashFlowPeriodEnd(start, grouping);
        const key = `${start.toISOString().split('T')[0]}:${grouping}`;
        const existing = buckets.get(key) || {
            id: key,
            period: getCashFlowPeriodLabel(rawDate, grouping),
            periodStart: start.toISOString(),
            periodEnd: end.toISOString(),
            openingBalance: null,
            cashIn: 0,
            cashOut: 0,
            netMovement: 0,
            closingBalance: null,
            cashPayments: 0,
            cardPayments: 0,
            onlinePayments: 0,
            walletPayments: 0,
            bankTransferPayments: 0,
            transactionCount: 0,
            sourceRows: []
        };

        const amount = Math.abs(Number(row?.amount || 0));
        const method = normalizeFinancialPaymentMethodGroup(row?.paymentMethod || row?.method);
        if (method === 'online') existing.onlinePayments += amount;
        if (method === 'bank_transfer') existing.bankTransferPayments += amount;
        existing.sourceRows = [...(existing.sourceRows || []), row];
        existing.transactionCount += 1;
        buckets.set(key, existing);
    });

    const rows = Array.from(buckets.values())
        .sort((left, right) => right.periodStart.localeCompare(left.periodStart))
        .map((row) => ({
            ...row,
            cashIn: Number(row.cashIn.toFixed(2)),
            cashOut: Number(row.cashOut.toFixed(2)),
            netMovement: Number(row.netMovement.toFixed(2)),
            cashPayments: Number(row.cashPayments.toFixed(2)),
            cardPayments: Number(row.cardPayments.toFixed(2)),
            onlinePayments: Number(row.onlinePayments.toFixed(2)),
            walletPayments: Number(row.walletPayments.toFixed(2)),
            bankTransferPayments: Number(row.bankTransferPayments.toFixed(2))
        }));

    const totals = rows.reduce((acc, row) => {
        acc.periods += 1;
        acc.cashIn += Number(row.cashIn || 0);
        acc.cashOut += Number(row.cashOut || 0);
        acc.netMovement += Number(row.netMovement || 0);
        acc.cashPayments += Number(row.cashPayments || 0);
        acc.cardPayments += Number(row.cardPayments || 0);
        acc.onlinePayments += Number(row.onlinePayments || 0);
        acc.walletPayments += Number(row.walletPayments || 0);
        acc.bankTransferPayments += Number(row.bankTransferPayments || 0);
        acc.transactionCount += Number(row.transactionCount || 0);
        return acc;
    }, {
        periods: 0,
        cashIn: 0,
        cashOut: 0,
        netMovement: 0,
        cashPayments: 0,
        cardPayments: 0,
        onlinePayments: 0,
        walletPayments: 0,
        bankTransferPayments: 0,
        transactionCount: 0
    });

    return {
        grouping,
        rows,
        totals: {
            periods: totals.periods,
            cashIn: Number(totals.cashIn.toFixed(2)),
            cashOut: Number(totals.cashOut.toFixed(2)),
            netMovement: Number(totals.netMovement.toFixed(2)),
            cashPayments: Number(totals.cashPayments.toFixed(2)),
            cardPayments: Number(totals.cardPayments.toFixed(2)),
            onlinePayments: Number(totals.onlinePayments.toFixed(2)),
            walletPayments: Number(totals.walletPayments.toFixed(2)),
            bankTransferPayments: Number(totals.bankTransferPayments.toFixed(2)),
            transactionCount: totals.transactionCount
        }
    };
}

function getTransactionReference(transaction) {
    const appointment = transaction?.appointment;
    const order = transaction?.order;
    return appointment?.bookingNumber
        || appointment?.id
        || order?.orderNumber
        || transaction?.transactionRef
        || transaction?.id;
}

function getTransactionAppointmentReference(transaction) {
    const appointment = transaction?.appointment;
    return appointment?.bookingReference
        || appointment?.bookingNumber
        || appointment?.id
        || null;
}

function getTransactionLocationLabel(transaction) {
    const appointment = transaction?.appointment;
    const order = transaction?.order;
    const tenant = appointment?.tenant || order?.tenant;
    return tenant?.city
        || tenant?.name_en
        || tenant?.name_ar
        || tenant?.name
        || 'Unavailable';
}

function getTransactionReferenceAmount(transaction) {
    if (transaction?.appointment) {
        return Number(transaction.appointment.price || 0);
    }
    if (transaction?.order) {
        const subtotal = Number(transaction.order.subtotal || 0);
        const taxAmount = Number(transaction.order.taxAmount || 0);
        const shippingFee = Number(transaction.order.shippingFee || 0);
        return subtotal + taxAmount + shippingFee;
    }
    return Number(transaction?.amount || 0);
}

function getTransactionDiscountAmount(transaction) {
    const appointment = transaction?.appointment;
    const order = transaction?.order;

    if (appointment) {
        const rawPrice = Number(appointment.rawPrice || 0);
        const price = Number(appointment.price || 0);
        return Math.max(rawPrice - price, 0);
    }

    if (order) {
        const subtotal = Number(order.subtotal || 0);
        const taxAmount = Number(order.taxAmount || 0);
        const shippingFee = Number(order.shippingFee || 0);
        const totalAmount = Number(order.totalAmount || 0);
        return Math.max((subtotal + taxAmount + shippingFee) - totalAmount, 0);
    }

    return 0;
}

function getTransactionServiceLabel(transaction) {
    const appointment = transaction?.appointment;
    const order = transaction?.order;
    if (appointment) {
        return getLedgerServiceName(appointment.service);
    }
    return getLedgerOrderLabel(order);
}

function getTransactionEmployeeLabel(transaction) {
    const appointment = transaction?.appointment;
    return appointment?.staff?.name || transaction?.processor?.name || 'Tenant Dashboard';
}

function mapLedgerTransaction(transaction, invoiceLookup = new Map()) {
    const appointment = transaction.appointment;
    const order = transaction.order;
    const user = appointment?.user || order?.user;
    const amount = Number(transaction.amount || 0);
    const isRefund = transaction.status === 'refunded' || transaction.type === 'refund';
    const signedAmount = isRefund ? -Math.abs(amount) : Math.abs(amount);
    const invoiceKey = appointment?.id
        ? `appointment:${appointment.id}`
        : order?.id
            ? `order:${order.id}`
            : null;
    const invoice = invoiceKey ? invoiceLookup.get(invoiceKey) || null : null;
    const invoiceItems = Array.isArray(invoice?.items) ? invoice.items : [];
    const amountPaid = appointment
        ? Number(appointment.totalPaid || 0)
        : Number(invoice?.paidAmount || amount || 0);
    const remainingBalance = appointment
        ? Number(appointment.remainderAmount || 0)
        : Number(invoice?.dueAmount || 0);
    const orderedSessionAppointments = Array.isArray(appointment?.bookingSession?.appointments)
        ? appointment.bookingSession.appointments
            .filter((sessionAppointment) => sessionAppointment && `${sessionAppointment.status || ''}`.trim().toLowerCase() !== 'cancelled')
            .slice()
            .sort((left, right) => {
                const leftIndex = Number.isFinite(Number(left.bookingItemIndex)) ? Number(left.bookingItemIndex) : 0;
                const rightIndex = Number.isFinite(Number(right.bookingItemIndex)) ? Number(right.bookingItemIndex) : 0;
                if (leftIndex !== rightIndex) {
                    return leftIndex - rightIndex;
                }
                return new Date(left.startTime || 0) - new Date(right.startTime || 0);
            })
        : [];
    const orderItems = Array.isArray(order?.items) ? order.items : [];

    const detailedInvoiceItems = invoiceItems.map((item, index) => {
        const sourceAppointment = appointment
            ? (orderedSessionAppointments[index]
                || orderedSessionAppointments.find((candidate) => `${candidate.bookingItemIndex ?? ''}` === `${item?.metadata?.bookingItemIndex ?? ''}`)
                || appointment)
            : null;
        const sourceOrderItem = !appointment ? (orderItems[index] || orderItems.find((candidate) => `${candidate?.productId || ''}` === `${item?.itemRefId || ''}`)) : null;
        const category = sourceAppointment?.service?.category
            || sourceOrderItem?.product?.category
            || item?.metadata?.category
            || null;
        const itemType = `${item?.itemType || ''}`.trim() || (sourceAppointment ? 'service' : sourceOrderItem ? 'product' : null);
        const gross = Number(item?.lineTotal || 0);
        const vat = Number(item?.taxAmount || 0);
        const net = Number((gross - vat).toFixed(2));
        return {
            id: item?.id || `${transaction.id}:${index}`,
            itemType,
            itemRefId: item?.itemRefId || null,
            itemNameEn: item?.nameEn || sourceAppointment?.service?.name_en || sourceOrderItem?.product?.name_en || 'Unavailable',
            itemNameAr: item?.nameAr || sourceAppointment?.service?.name_ar || sourceOrderItem?.product?.name_ar || item?.nameEn || 'Unavailable',
            category,
            quantity: Number(item?.quantity || sourceOrderItem?.quantity || 1),
            unitPrice: Number(item?.unitPrice || sourceOrderItem?.unitPrice || 0),
            gross: Number(gross.toFixed(2)),
            discount: null,
            vat: Number(vat.toFixed(2)),
            net,
            metadata: item?.metadata || {}
        };
    });

    return {
        id: transaction.id,
        date: transaction.processedAt || transaction.createdAt,
        reference: getTransactionReference(transaction),
        appointmentReference: getTransactionAppointmentReference(transaction),
        invoiceNumber: invoice?.invoiceNumber || null,
        customer: getLedgerCustomerName(user),
        employee: getTransactionEmployeeLabel(transaction),
        service: getTransactionServiceLabel(transaction),
        itemsSold: getTransactionServiceLabel(transaction),
        channel: appointment ? 'Appointment' : order ? 'Order' : 'Transaction',
        location: getTransactionLocationLabel(transaction),
        revenue: Number(signedAmount.toFixed(2)),
        tax: Number((Number(appointment?.taxAmount || order?.taxAmount || 0)).toFixed(2)),
        discount: Number(getTransactionDiscountAmount(transaction).toFixed(2)),
        paymentMethod: transaction.paymentMethod,
        paymentMethodLabel: formatLedgerPaymentMethodLabel(transaction.paymentMethod),
        status: appointment?.status || order?.status || transaction.status,
        amountPaid: Number(amountPaid.toFixed(2)),
        remainingBalance: Number(remainingBalance.toFixed(2)),
        paidAt: appointment?.paidAt || order?.paidAt || transaction.processedAt || transaction.createdAt,
        invoiceStatus: invoice?.status || null,
        invoiceIssuedAt: invoice?.issuedAt || null,
        invoicePaidAt: invoice?.paidAt || null,
        invoiceSubtotalAmount: invoice?.subtotalAmount == null ? null : Number(invoice.subtotalAmount),
        invoiceVatAmount: invoice?.vatAmount == null ? null : Number(invoice.vatAmount),
        invoiceTotalAmount: invoice?.totalAmount == null ? null : Number(invoice.totalAmount),
        invoicePaidAmount: invoice?.paidAmount == null ? null : Number(invoice.paidAmount),
        invoiceDueAmount: invoice?.dueAmount == null ? null : Number(invoice.dueAmount),
        invoiceItems: detailedInvoiceItems,
        transactionRef: transaction?.transactionRef || null,
        type: transaction?.type || null,
        notes: transaction?.notes
            || transaction?.metadata?.notes
            || transaction?.metadata?.note
            || transaction?.gatewayResponse?.notes
            || transaction?.gatewayResponse?.note
            || null,
        status: transaction.status,
        entityType: appointment ? 'appointment' : 'order',
        entityId: appointment?.id || order?.id || null,
        detailPath: appointment?.id
            ? `/dashboard/appointments/${appointment.id}`
            : order?.id
                ? `/dashboard/orders/${order.id}`
                : null
    };
}

function mapRefundLedgerRow(transaction) {
    const appointment = transaction.appointment;
    const order = transaction.order;
    const user = appointment?.user || order?.user;
    const amount = Number(transaction.amount || 0);
    const reference = getTransactionReference(transaction);
    const referenceAmount = getTransactionReferenceAmount(transaction);
    const refundReason = `${transaction.notes || transaction.metadata?.reason || transaction.metadata?.refundReason || transaction.gatewayResponse?.reason || ''}`.trim() || null;

    return {
        id: transaction.id,
        date: transaction.processedAt || transaction.createdAt,
        customer: getLedgerCustomerName(user),
        amount: Number(amount.toFixed(2)),
        reference,
        reason: refundReason,
        employee: transaction.processor?.name || null,
        method: transaction.paymentMethod,
        methodLabel: formatLedgerPaymentMethodLabel(transaction.paymentMethod),
        entityType: appointment ? 'appointment' : 'order',
        entityLabel: appointment ? getLedgerServiceName(appointment.service) : getLedgerOrderLabel(order),
        refundMode: getRefundModeLabel(amount, referenceAmount),
        status: transaction.status,
        detailPath: appointment?.id
            ? `/dashboard/appointments/${appointment.id}`
            : order?.id
                ? `/dashboard/orders/${order.id}`
                : null
    };
}

function buildTenantAppointmentScope(tenantId) {
    return {
        [Op.or]: [
            { tenantId },
            { '$service.tenantId$': tenantId },
            { '$staff.tenantId$': tenantId }
        ]
    };
}

function getTenantAppointmentIncludes() {
    return [
        {
            model: db.Service,
            as: 'service',
            attributes: ['id', 'tenantId', 'name_en', 'name_ar', 'category', 'rawPrice', 'finalPrice'],
            required: false
        },
        {
            model: db.Staff,
            as: 'staff',
            attributes: ['id', 'tenantId'],
            required: false
        }
    ];
}

function getAppointmentDiscountAmount(appointment) {
    const serviceRawPrice = parseFloat(appointment?.service?.rawPrice || 0);
    const discountedRawPrice = parseFloat(appointment?.rawPrice || 0);
    const discountAmount = serviceRawPrice - discountedRawPrice;
    return Number.isFinite(discountAmount) && discountAmount > 0 ? discountAmount : 0;
}

function getOrderDiscountAmount(order) {
    const subtotal = parseFloat(order?.subtotal || 0);
    const taxAmount = parseFloat(order?.taxAmount || 0);
    const shippingFee = parseFloat(order?.shippingFee || 0);
    const totalAmount = parseFloat(order?.totalAmount || 0);
    const baseAmount = subtotal + taxAmount + shippingFee;
    const discountAmount = baseAmount - totalAmount;
    return Number.isFinite(discountAmount) && discountAmount > 0 ? discountAmount : 0;
}

function runHandler(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            json(body) { resolve(body); },
            status() { return this; },
            send(body) { resolve(body); }
        };

        Promise.resolve(handler(req, res)).catch(reject);
    });
}

async function getLandingCollectionsSummary(req, endDate) {
    const closingResponse = await runHandler(tenantPosController.getClosingSummary, {
        ...req,
        query: { date: endDate }
    });

    if (closingResponse?.success && closingResponse?.summary) {
        return closingResponse.summary;
    }

    return null;
}

/**
 * Get financial overview/summary
 * GET /api/v1/tenant/financial/overview
 */
exports.getFinancialOverview = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;
        const filters = buildReportFilterContext(req.query);

        // Build date filter for appointments
        const dateFilter = buildDateRangeWhere('startTime', startDate, endDate);

        // Build date filter for orders
        const orderDateFilter = buildDateRangeWhere('createdAt', startDate, endDate);

        // Get all appointments for KPI counters (status distribution, unique customers, completion rate)
        let allAppointments = await db.Appointment.findAll({
            where: {
                ...buildTenantAppointmentScope(tenantId),
                ...dateFilter
            },
            include: getTenantAppointmentIncludes(),
            attributes: ['id', 'status', 'platformUserId', 'startTime', 'tenantId'],
            subQuery: false
        });

        // Get monetized appointments with financials
        let appointments = await db.Appointment.findAll({
            where: {
                ...buildTenantAppointmentScope(tenantId),
                ...dateFilter,
                status: { [Op.in]: ['completed', 'confirmed'] }
            },
            include: getTenantAppointmentIncludes(),
            attributes: [
                'id', 'price', 'rawPrice', 'taxAmount', 'platformFee', 
                'tenantRevenue', 'employeeCommission', 'paymentStatus', 'status', 'platformUserId', 'startTime', 'tenantId'
            ],
            subQuery: false
        });

        // Get product orders with financials
        const orderWhere = {
            tenantId,
            status: { [Op.in]: ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed'] }
        };
        
        // Add date filter if provided
        if (orderDateFilter.createdAt) {
            orderWhere.createdAt = orderDateFilter.createdAt;
        }
        
        let orders = await db.Order.findAll({
            where: orderWhere,
            attributes: [
                'id', 'orderNumber', 'subtotal', 'taxAmount', 'shippingFee', 'totalAmount', 'platformFee',
                'paymentStatus', 'status', 'createdAt'
            ]
        });

        const giftCardWhere = { tenantId };
        const giftCardDateFilter = buildDateRangeWhere('createdAt', startDate, endDate);
        if (giftCardDateFilter.createdAt) {
            giftCardWhere.createdAt = giftCardDateFilter.createdAt;
        }

        let giftCards = await db.TenantGiftCardTransaction.findAll({
            where: giftCardWhere,
            attributes: ['id', 'purchaseAmount', 'createdAt', 'status']
        }).catch(() => []);

        const giftCardTotals = {
            totalRevenue: 0,
            totalTransactions: giftCards.length,
            completedTransactions: 0
        };

        giftCards.forEach((giftCard) => {
            giftCardTotals.totalRevenue += parseFloat(giftCard.purchaseAmount || 0);
            if (!['cancelled', 'expired'].includes(giftCard.status)) {
                giftCardTotals.completedTransactions++;
            }
        });

        let paymentTransactions = await db.PaymentTransaction.findAll({
            where: {
                [Op.or]: [
                    { '$appointment.tenantId$': tenantId },
                    { '$order.tenantId$': tenantId }
                ],
                status: { [Op.in]: ['completed', 'refunded'] },
                type: { [Op.in]: ['deposit', 'remainder', 'full', 'refund'] },
                ...buildDateRangeWhere('processedAt', startDate, endDate)
            },
            include: getLedgerTransactionIncludes(),
            order: [['processedAt', 'DESC']],
            subQuery: false
        });

        allAppointments = allAppointments.filter((appointment) => matchesAppointmentFilters(appointment, filters));
        appointments = appointments.filter((appointment) => matchesAppointmentFilters(appointment, filters));
        orders = orders.filter((order) => matchesOrderFilters(order, filters));
        paymentTransactions = paymentTransactions.filter((transaction) => matchesTransactionFilters(transaction, filters));

        const paymentTransactionTotals = paymentTransactions.reduce((totals, transaction) => {
            const appointment = transaction.appointment;
            const order = transaction.order;
            const amount = Number(transaction.amount || 0);
            const isRefund = transaction.status === 'refunded' || transaction.type === 'refund';
            const signedAmount = isRefund ? -Math.abs(amount) : Math.abs(amount);

            totals.totalRevenue += signedAmount;
            totals.totalDiscountAmount += getTransactionDiscountAmount(transaction);
            totals.totalTransactions += 1;

            if (transaction.status === 'completed') {
                totals.completedTransactions += 1;
            }

            if (isRefund) {
                totals.refundedTransactions += 1;
            }

            if (appointment) {
                totals.appointmentRevenue += signedAmount;
                const rawPrice = Number(appointment.rawPrice || 0);
                const taxAmount = Number(appointment.taxAmount || 0);
                const platformFee = Number(appointment.platformFee || 0);
                const tenantRevenue = Number(appointment.tenantRevenue || 0);
                const employeeCommission = Number(appointment.employeeCommission || 0);

                totals.totalRawPrice += isRefund ? -Math.abs(rawPrice) : rawPrice;
                totals.totalTax += isRefund ? -Math.abs(taxAmount) : taxAmount;
                totals.totalPlatformFees += isRefund ? -Math.abs(platformFee) : platformFee;
                totals.totalTenantRevenue += isRefund ? -Math.abs(tenantRevenue) : tenantRevenue;
                totals.totalEmployeeCommissions += isRefund ? -Math.abs(employeeCommission) : employeeCommission;
            } else if (order) {
                const subtotal = Number(order.subtotal || 0);
                const taxAmount = Number(order.taxAmount || 0);
                const platformFee = Number(order.platformFee || 0);
                const totalAmount = Number(order.totalAmount || 0);
                const tenantRevenue = totalAmount - platformFee;

                totals.orderRevenue += signedAmount;
                totals.totalRawPrice += isRefund ? -Math.abs(subtotal) : subtotal;
                totals.totalTax += isRefund ? -Math.abs(taxAmount) : taxAmount;
                totals.totalPlatformFees += isRefund ? -Math.abs(platformFee) : platformFee;
                totals.totalTenantRevenue += isRefund ? -Math.abs(tenantRevenue) : tenantRevenue;
            }

            return totals;
        }, {
            totalRevenue: 0,
            totalRawPrice: 0,
            totalTax: 0,
            totalPlatformFees: 0,
            totalTenantRevenue: 0,
            totalEmployeeCommissions: 0,
            totalDiscountAmount: 0,
            totalTransactions: 0,
            completedTransactions: 0,
            refundedTransactions: 0,
            appointmentRevenue: 0,
            orderRevenue: 0
        });

        // Calculate totals from appointments
        const appointmentTotals = {
            totalRevenue: 0,
            totalRawPrice: 0,
            totalTax: 0,
            totalPlatformFees: 0,
            totalTenantRevenue: 0,
            totalEmployeeCommissions: 0,
            totalDiscountAmount: 0,
            totalBookings: allAppointments.length,
            paidBookings: 0,
            pendingPayments: 0,
            completedBookings: 0,
            discountedBookings: 0
        };

        const discountedServiceTotals = new Map();

        appointments.forEach(appt => {
            appointmentTotals.totalRevenue += parseFloat(appt.price || 0);
            appointmentTotals.totalRawPrice += parseFloat(appt.rawPrice || 0);
            appointmentTotals.totalTax += parseFloat(appt.taxAmount || 0);
            appointmentTotals.totalPlatformFees += parseFloat(appt.platformFee || 0);
            appointmentTotals.totalTenantRevenue += parseFloat(appt.tenantRevenue || 0);
            appointmentTotals.totalEmployeeCommissions += parseFloat(appt.employeeCommission || 0);

            const discountAmount = getAppointmentDiscountAmount(appt);
            if (discountAmount > 0) {
                appointmentTotals.totalDiscountAmount += discountAmount;
                appointmentTotals.discountedBookings += 1;

                const serviceKey = appt.service?.id || appt.serviceId || 'unknown';
                const serviceName = appt.service?.name_en || appt.service?.name_ar || 'Service';
                const existingService = discountedServiceTotals.get(serviceKey) || {
                    id: serviceKey,
                    name_en: appt.service?.name_en || serviceName,
                    name_ar: appt.service?.name_ar || serviceName,
                    category: appt.service?.category || null,
                    discountAmount: 0,
                    bookingCount: 0
                };

                existingService.discountAmount += discountAmount;
                existingService.bookingCount += 1;
                discountedServiceTotals.set(serviceKey, existingService);
            }

            if (isAppointmentFullyPaid(appt.paymentStatus)) {
                appointmentTotals.paidBookings++;
            } else {
                appointmentTotals.pendingPayments += parseFloat(appt.price || 0);
            }

            if (appt.status === 'completed') {
                appointmentTotals.completedBookings++;
            }
        });

        // Calculate totals from orders
        const orderTotals = {
            totalRevenue: 0,
            totalPlatformFees: 0,
            totalTenantRevenue: 0,
            totalDiscountAmount: 0,
            totalOrders: orders.length,
            paidOrders: 0,
            pendingPayments: 0,
            completedOrders: 0,
            discountedOrders: 0
        };

        const discountedOrderTotals = [];

        orders.forEach(order => {
            const totalAmount = parseFloat(order.totalAmount || 0);
            const platformFee = parseFloat(order.platformFee || 0);
            const tenantRevenue = totalAmount - platformFee;
            const discountAmount = getOrderDiscountAmount(order);
            
            orderTotals.totalRevenue += totalAmount;
            orderTotals.totalPlatformFees += platformFee;
            orderTotals.totalTenantRevenue += tenantRevenue;

            if (discountAmount > 0) {
                orderTotals.totalDiscountAmount += discountAmount;
                orderTotals.discountedOrders += 1;
                discountedOrderTotals.push({
                    id: order.id,
                    orderNumber: order.orderNumber || order.id,
                    discountAmount,
                    totalAmount,
                    baseAmount: parseFloat((parseFloat(order.subtotal || 0) + parseFloat(order.taxAmount || 0) + parseFloat(order.shippingFee || 0)).toFixed(2))
                });
            }

            if (order.paymentStatus === 'paid') {
                orderTotals.paidOrders++;
            } else {
                orderTotals.pendingPayments += parseFloat(order.totalAmount || 0);
            }

            if (order.status === 'completed' || order.status === 'delivered') {
                orderTotals.completedOrders++;
            }
        });

        // Combine totals
        const usePaymentTransactions = paymentTransactions.length > 0;

        const overview = {
            // Combined totals
            totalRevenue: usePaymentTransactions
                ? paymentTransactionTotals.totalRevenue + giftCardTotals.totalRevenue
                : appointmentTotals.totalRevenue + orderTotals.totalRevenue + giftCardTotals.totalRevenue,
            totalRawPrice: usePaymentTransactions ? paymentTransactionTotals.totalRawPrice : appointmentTotals.totalRawPrice,
            totalTax: usePaymentTransactions ? paymentTransactionTotals.totalTax : appointmentTotals.totalTax,
            totalPlatformFees: usePaymentTransactions
                ? paymentTransactionTotals.totalPlatformFees
                : appointmentTotals.totalPlatformFees + orderTotals.totalPlatformFees,
            totalTenantRevenue: usePaymentTransactions
                ? paymentTransactionTotals.totalTenantRevenue + giftCardTotals.totalRevenue
                : appointmentTotals.totalTenantRevenue + orderTotals.totalTenantRevenue + giftCardTotals.totalRevenue,
            totalEmployeeCommissions: usePaymentTransactions
                ? paymentTransactionTotals.totalEmployeeCommissions
                : appointmentTotals.totalEmployeeCommissions,
            netRevenue: usePaymentTransactions
                ? (paymentTransactionTotals.totalTenantRevenue + giftCardTotals.totalRevenue) - paymentTransactionTotals.totalEmployeeCommissions
                : (appointmentTotals.totalTenantRevenue + orderTotals.totalTenantRevenue + giftCardTotals.totalRevenue) - appointmentTotals.totalEmployeeCommissions,
            // Booking/Order counts
            totalBookings: appointmentTotals.totalBookings,
            totalOrders: orderTotals.totalOrders,
            paidBookings: appointmentTotals.paidBookings,
            paidOrders: orderTotals.paidOrders,
            pendingPayments: appointmentTotals.pendingPayments + orderTotals.pendingPayments,
            completedBookings: appointmentTotals.completedBookings,
            completedOrders: orderTotals.completedOrders,
            cancelledBookings: allAppointments.filter((appt) => appt.status === 'cancelled').length,
            noShowBookings: allAppointments.filter((appt) => appt.status === 'no_show').length,
            uniqueCustomers: [...new Set(allAppointments.map((appt) => appt.platformUserId).filter(Boolean))].length,
            completionRate: allAppointments.length > 0
                ? parseFloat(((allAppointments.filter((appt) => appt.status === 'completed').length / allAppointments.length) * 100).toFixed(1))
                : 0,
            avgBookingValue: allAppointments.filter((appt) => appt.status === 'completed').length > 0
                ? parseFloat((appointmentTotals.totalRevenue / allAppointments.filter((appt) => appt.status === 'completed').length).toFixed(2))
                : 0,
            totalDiscountAmount: usePaymentTransactions
                ? parseFloat(paymentTransactionTotals.totalDiscountAmount.toFixed(2))
                : parseFloat((appointmentTotals.totalDiscountAmount + orderTotals.totalDiscountAmount).toFixed(2)),
            appointmentDiscountAmount: usePaymentTransactions
                ? parseFloat(paymentTransactionTotals.totalDiscountAmount.toFixed(2))
                : parseFloat(appointmentTotals.totalDiscountAmount.toFixed(2)),
            orderDiscountAmount: usePaymentTransactions
                ? 0
                : parseFloat(orderTotals.totalDiscountAmount.toFixed(2)),
            discountedBookings: appointmentTotals.discountedBookings,
            discountedOrders: orderTotals.discountedOrders,
            // Separate breakdowns
            appointmentRevenue: usePaymentTransactions ? paymentTransactionTotals.appointmentRevenue : appointmentTotals.totalRevenue,
            orderRevenue: usePaymentTransactions ? paymentTransactionTotals.orderRevenue : orderTotals.totalRevenue,
            giftCardRevenue: giftCardTotals.totalRevenue,
            giftCardTransactions: giftCardTotals.totalTransactions,
            appointmentTenantRevenue: usePaymentTransactions ? paymentTransactionTotals.totalTenantRevenue : appointmentTotals.totalTenantRevenue,
            orderTenantRevenue: usePaymentTransactions ? 0 : orderTotals.totalTenantRevenue,
            giftCardTenantRevenue: giftCardTotals.totalRevenue,
            discountTotals: {
                totalDiscountAmount: usePaymentTransactions
                    ? parseFloat(paymentTransactionTotals.totalDiscountAmount.toFixed(2))
                    : parseFloat((appointmentTotals.totalDiscountAmount + orderTotals.totalDiscountAmount).toFixed(2)),
                appointmentDiscountAmount: usePaymentTransactions
                    ? parseFloat(paymentTransactionTotals.totalDiscountAmount.toFixed(2))
                    : parseFloat(appointmentTotals.totalDiscountAmount.toFixed(2)),
                orderDiscountAmount: usePaymentTransactions
                    ? 0
                    : parseFloat(orderTotals.totalDiscountAmount.toFixed(2)),
                discountedBookings: appointmentTotals.discountedBookings,
                discountedOrders: orderTotals.discountedOrders,
                averageDiscountAmount: parseFloat(((usePaymentTransactions ? paymentTransactionTotals.totalDiscountAmount : (appointmentTotals.totalDiscountAmount + orderTotals.totalDiscountAmount)) / Math.max(appointmentTotals.discountedBookings + orderTotals.discountedOrders, 1)).toFixed(2)),
                topDiscountedServices: Array.from(discountedServiceTotals.values())
                    .sort((left, right) => right.discountAmount - left.discountAmount)
                    .slice(0, 10)
                    .map((entry) => ({
                        ...entry,
                        discountAmount: parseFloat(entry.discountAmount.toFixed(2))
                    })),
                topDiscountedOrders: discountedOrderTotals
                    .sort((left, right) => right.discountAmount - left.discountAmount)
                    .slice(0, 10)
                    .map((entry) => ({
                        ...entry,
                        discountAmount: parseFloat(entry.discountAmount.toFixed(2)),
                        baseAmount: parseFloat(entry.baseAmount.toFixed(2))
                    }))
            }
        };

        // Round all values
        Object.keys(overview).forEach(key => {
            if (typeof overview[key] === 'number' && 
                key !== 'totalBookings' && key !== 'totalOrders' &&
                key !== 'paidBookings' && key !== 'paidOrders' &&
                key !== 'completedBookings' && key !== 'completedOrders' &&
                key !== 'cancelledBookings' && key !== 'noShowBookings' &&
                key !== 'uniqueCustomers' && key !== 'giftCardTransactions') {
                overview[key] = parseFloat(overview[key].toFixed(2));
            }
        });

        res.json({
            success: true,
            overview
        });
    } catch (error) {
        console.error('Get financial overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch financial overview',
            error: error.message
        });
    }
};

/**
 * Get unified financial landing summary
 * GET /api/v1/tenant/financial/landing-summary
 */
exports.getLandingSummary = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;

        const [overviewResponse, subscriptionResult, subscriptionConsumption, landingCollections] = await Promise.all([
            runHandler(exports.getFinancialOverview, req),
            getActiveSubscriptionForTenant(tenantId, {
                statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE', 'past_due']
            }),
            buildSubscriptionConsumption(tenantId),
            getLandingCollectionsSummary(req, endDate)
        ]);

        const unpaidBills = await db.Bill.findAll({
            where: {
                tenantId,
                status: { [Op.in]: PAYABLE_BILL_STATUSES }
            },
            include: [{
                model: db.TenantSubscription,
                as: 'subscription',
                include: [{
                    model: db.SubscriptionPackage,
                    as: 'package'
                }]
            }],
            order: [['createdAt', 'DESC']],
            limit: 5
        });

        const activeAlerts = subscriptionConsumption?.alerts || [];
        const subscription = subscriptionResult?.subscription
            ? {
                ...subscriptionResult.subscription.toJSON(),
                package: subscriptionResult.package?.toJSON ? subscriptionResult.package.toJSON() : subscriptionResult.package
            }
            : null;

        res.json({
            success: true,
            data: {
                overview: overviewResponse?.overview || null,
                billing: {
                    currentUnpaidBill: unpaidBills[0] ? unpaidBills[0].toJSON() : null,
                    unpaidBillCount: unpaidBills.length
                },
                subscription: {
                    currentSubscription: subscription,
                    consumption: subscriptionConsumption
                },
                collections: {
                    closingSummary: landingCollections
                },
                alerts: activeAlerts,
                alertsCount: activeAlerts.length,
                updatedAt: new Date().toISOString(),
                dateRange: {
                    startDate: startDate || null,
                    endDate: endDate || null
                }
            }
        });
    } catch (error) {
        console.error('Get landing summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch landing summary',
            error: error.message
        });
    }
};

/**
 * Get employee revenue breakdown
 * GET /api/v1/tenant/financial/employees
 */
exports.getEmployeeRevenue = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate, staffId } = req.query;
        const filters = buildReportFilterContext(req.query);

        // Build date filter
        const dateFilter = buildDateRangeWhere('startTime', startDate, endDate);

        // Get all staff for this tenant
        const staffWhere = { tenantId };
        if (staffId) {
            staffWhere.id = staffId;
        }

        const staff = await db.Staff.findAll({
            where: staffWhere,
            attributes: ['id', 'name', 'photo', 'salary', 'commissionRate'],
            order: [['name', 'ASC']]
        });

        // Get appointments for each staff member
        const employeeRevenue = [];

        for (const employee of staff) {
            const appointments = await db.Appointment.findAll({
                where: {
                    staffId: employee.id,
                    ...dateFilter,
                    status: { [Op.in]: ['completed', 'confirmed'] }
                },
                include: [
                    {
                        model: db.Service,
                        as: 'service',
                        where: { tenantId },
                        attributes: ['id'],
                        required: true
                    }
                ],
                attributes: [
                    'id', 'price', 'rawPrice', 'employeeRevenue', 
                    'employeeCommissionRate', 'employeeCommission', 'paymentStatus'
                ]
            });
            const filteredAppointments = appointments.filter((appointment) => matchesAppointmentFilters({
                ...appointment,
                staff: { name: employee.name },
            }, filters));

            const stats = {
                id: employee.id,
                name: employee.name,
                photo: employee.photo,
                baseSalary: parseFloat(employee.salary || 0),
                commissionRate: parseFloat(employee.commissionRate || 0),
                totalBookings: filteredAppointments.length,
                paidBookings: 0,
                totalRevenueGenerated: 0,
                totalCommission: 0,
                totalEarnings: 0
            };

            filteredAppointments.forEach(appt => {
                stats.totalRevenueGenerated += parseFloat(appt.rawPrice || appt.price || 0);
                stats.totalCommission += parseFloat(appt.employeeCommission || 0);
                if (isAppointmentFullyPaid(appt.paymentStatus)) {
                    stats.paidBookings++;
                }
            });

            // Total earnings = base salary + commission
            stats.totalEarnings = stats.baseSalary + stats.totalCommission;

            // Round values
            stats.totalRevenueGenerated = parseFloat(stats.totalRevenueGenerated.toFixed(2));
            stats.totalCommission = parseFloat(stats.totalCommission.toFixed(2));
            stats.totalEarnings = parseFloat(stats.totalEarnings.toFixed(2));

            employeeRevenue.push(stats);
        }

        // Sort by total revenue generated (descending)
        employeeRevenue.sort((a, b) => b.totalRevenueGenerated - a.totalRevenueGenerated);

        // Calculate totals
        const totals = {
            totalEmployees: employeeRevenue.length,
            totalBookings: employeeRevenue.reduce((sum, e) => sum + e.totalBookings, 0),
            totalRevenueGenerated: employeeRevenue.reduce((sum, e) => sum + e.totalRevenueGenerated, 0),
            totalCommissions: employeeRevenue.reduce((sum, e) => sum + e.totalCommission, 0),
            totalSalaries: employeeRevenue.reduce((sum, e) => sum + e.baseSalary, 0),
            totalPayroll: employeeRevenue.reduce((sum, e) => sum + e.totalEarnings, 0)
        };

        // Round totals
        totals.totalRevenueGenerated = parseFloat(totals.totalRevenueGenerated.toFixed(2));
        totals.totalCommissions = parseFloat(totals.totalCommissions.toFixed(2));
        totals.totalSalaries = parseFloat(totals.totalSalaries.toFixed(2));
        totals.totalPayroll = parseFloat(totals.totalPayroll.toFixed(2));

        res.json({
            success: true,
            employees: employeeRevenue,
            totals
        });
    } catch (error) {
        console.error('Get employee revenue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee revenue',
            error: error.message
        });
    }
};

/**
 * Get revenue by service
 * GET /api/v1/tenant/financial/services
 */
exports.getServiceRevenue = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;
        const filters = buildReportFilterContext(req.query);

        // Build date filter
        const dateFilter = buildDateRangeWhere('startTime', startDate, endDate);

        // Get all services for this tenant
        const services = await db.Service.findAll({
            where: { tenantId },
            attributes: ['id', 'name_en', 'name_ar', 'category', 'rawPrice', 'finalPrice'],
            order: [['name_en', 'ASC']]
        });

        const serviceRevenue = [];

        for (const service of services.filter((item) => {
            const serviceLabel = item.name_en || item.name_ar || item.id;
            return matchesSelection(serviceLabel, filters.service) && matchesSelection(item.category, filters.category);
        })) {
            const appointments = await db.Appointment.findAll({
                where: {
                    serviceId: service.id,
                    ...dateFilter,
                    status: { [Op.in]: ['completed', 'confirmed'] }
                },
                attributes: ['id', 'price', 'rawPrice', 'taxAmount', 'platformFee', 'tenantRevenue']
            });
            const filteredAppointments = appointments.filter((appointment) => matchesAppointmentFilters({
                ...appointment,
                service,
            }, filters));

            const stats = {
                id: service.id,
                name_en: service.name_en,
                name_ar: service.name_ar,
                category: service.category,
                servicePrice: parseFloat(service.finalPrice || 0),
                totalBookings: filteredAppointments.length,
                totalRevenue: 0,
                totalTax: 0,
                totalPlatformFees: 0,
                totalTenantRevenue: 0
            };

            filteredAppointments.forEach(appt => {
                stats.totalRevenue += parseFloat(appt.price || 0);
                stats.totalTax += parseFloat(appt.taxAmount || 0);
                stats.totalPlatformFees += parseFloat(appt.platformFee || 0);
                stats.totalTenantRevenue += parseFloat(appt.tenantRevenue || 0);
            });

            // Round values
            stats.totalRevenue = parseFloat(stats.totalRevenue.toFixed(2));
            stats.totalTax = parseFloat(stats.totalTax.toFixed(2));
            stats.totalPlatformFees = parseFloat(stats.totalPlatformFees.toFixed(2));
            stats.totalTenantRevenue = parseFloat(stats.totalTenantRevenue.toFixed(2));

            serviceRevenue.push(stats);
        }

        // Sort by total revenue (descending)
        serviceRevenue.sort((a, b) => b.totalRevenue - a.totalRevenue);

        // Calculate totals
        const totals = {
            totalServices: serviceRevenue.length,
            totalBookings: serviceRevenue.reduce((sum, s) => sum + s.totalBookings, 0),
            totalRevenue: serviceRevenue.reduce((sum, s) => sum + s.totalRevenue, 0),
            totalTax: serviceRevenue.reduce((sum, s) => sum + s.totalTax, 0),
            totalPlatformFees: serviceRevenue.reduce((sum, s) => sum + s.totalPlatformFees, 0),
            totalTenantRevenue: serviceRevenue.reduce((sum, s) => sum + s.totalTenantRevenue, 0)
        };

        // Round totals
        Object.keys(totals).forEach(key => {
            if (typeof totals[key] === 'number' && key !== 'totalServices' && key !== 'totalBookings') {
                totals[key] = parseFloat(totals[key].toFixed(2));
            }
        });

        res.json({
            success: true,
            services: serviceRevenue,
            totals
        });
    } catch (error) {
        console.error('Get service revenue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch service revenue',
            error: error.message
        });
    }
};

/**
 * Get daily revenue for chart
 * GET /api/v1/tenant/financial/daily
 */
exports.getDailyRevenue = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;
        const filters = buildReportFilterContext(req.query);

        // Default to last 30 days
        const fallbackEnd = new Date();
        fallbackEnd.setHours(23, 59, 59, 999);
        const end = parseDateValue(endDate, true) || fallbackEnd;
        const fallbackStart = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        fallbackStart.setHours(0, 0, 0, 0);
        const start = parseDateValue(startDate, false) || fallbackStart;

        const appointments = (await db.Appointment.findAll({
            where: {
                startTime: {
                    [Op.gte]: start,
                    [Op.lte]: end
                },
                status: { [Op.in]: ['completed', 'confirmed'] }
            },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    attributes: ['id'],
                    required: true
                }
            ],
            attributes: ['id', 'startTime', 'price', 'tenantRevenue'],
            order: [['startTime', 'ASC']]
        })).filter((appointment) => matchesAppointmentFilters(appointment, filters));

        // Get orders in the date range
        const orders = (await db.Order.findAll({
            where: {
                tenantId,
                createdAt: {
                    [Op.gte]: start,
                    [Op.lte]: end
                },
                status: { [Op.in]: ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed'] }
            },
            attributes: ['id', 'createdAt', 'totalAmount', 'platformFee'],
            order: [['createdAt', 'ASC']]
        })).filter((order) => matchesOrderFilters(order, filters));

        const giftCards = await db.TenantGiftCardTransaction.findAll({
            where: {
                tenantId,
                createdAt: {
                    [Op.gte]: start,
                    [Op.lte]: end
                }
            },
            attributes: ['id', 'createdAt', 'purchaseAmount', 'status'],
            order: [['createdAt', 'ASC']]
        });

        // Group by date
        const dailyData = {};
        
        // Process appointments
        appointments.forEach(appt => {
            const dateKey = appt.startTime.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: dateKey,
                    bookings: 0,
                    orders: 0,
                    revenue: 0,
                    tenantRevenue: 0
                };
            }
            dailyData[dateKey].bookings++;
            dailyData[dateKey].revenue += parseFloat(appt.price || 0);
            dailyData[dateKey].tenantRevenue += parseFloat(appt.tenantRevenue || 0);
        });

        // Process orders
        orders.forEach(order => {
            const dateKey = order.createdAt.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: dateKey,
                    bookings: 0,
                    orders: 0,
                    revenue: 0,
                    tenantRevenue: 0
                };
            }
            const totalAmount = parseFloat(order.totalAmount || 0);
            const platformFee = parseFloat(order.platformFee || 0);
            const tenantRevenue = totalAmount - platformFee;
            
            dailyData[dateKey].orders++;
            dailyData[dateKey].revenue += totalAmount;
            dailyData[dateKey].tenantRevenue += tenantRevenue;
        });

        giftCards.forEach((giftCard) => {
            const dateKey = giftCard.createdAt.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: dateKey,
                    bookings: 0,
                    orders: 0,
                    giftCards: 0,
                    revenue: 0,
                    tenantRevenue: 0
                };
            }
            const amount = parseFloat(giftCard.purchaseAmount || 0);
            dailyData[dateKey].giftCards = (dailyData[dateKey].giftCards || 0) + 1;
            dailyData[dateKey].revenue += amount;
            dailyData[dateKey].tenantRevenue += amount;
        });

        // Fill in missing dates with zeros
        const result = [];
        let current = new Date(start);
        while (current <= end) {
            const dateKey = current.toISOString().split('T')[0];
            result.push(dailyData[dateKey] || {
                date: dateKey,
                bookings: 0,
                orders: 0,
                giftCards: 0,
                revenue: 0,
                tenantRevenue: 0
            });
            current.setDate(current.getDate() + 1);
        }

        // Round values
        result.forEach(day => {
            day.revenue = parseFloat(day.revenue.toFixed(2));
            day.tenantRevenue = parseFloat(day.tenantRevenue.toFixed(2));
            day.giftCards = Number(day.giftCards || 0);
        });

        res.json({
            success: true,
            dailyRevenue: result
        });
    } catch (error) {
        console.error('Get daily revenue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch daily revenue',
            error: error.message
        });
    }
};

/**
 * Get financial ledger workspace datasets
 * GET /api/v1/tenant/financial/ledger
 */
exports.getFinancialLedger = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate, groupBy } = req.query;
        const filters = buildReportFilterContext(req.query);

        const fallbackEnd = new Date();
        fallbackEnd.setHours(23, 59, 59, 999);
        const end = parseDateValue(endDate, true) || fallbackEnd;
        const fallbackStart = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        fallbackStart.setHours(0, 0, 0, 0);
        const start = parseDateValue(startDate, false) || fallbackStart;

        const [transactionsRaw, employeeRevenueResponse, payrollRecords] = await Promise.all([
            db.PaymentTransaction.findAll({
                where: {
                    [Op.or]: [
                        { '$appointment.tenantId$': tenantId },
                        { '$order.tenantId$': tenantId }
                    ],
                    status: { [Op.in]: ['completed', 'refunded'] },
                    type: { [Op.in]: ['deposit', 'remainder', 'full', 'refund'] },
                    processedAt: {
                        [Op.gte]: start,
                        [Op.lte]: end
                    }
                },
                include: getLedgerTransactionIncludes(),
                order: [['processedAt', 'DESC']],
                subQuery: false
            }),
            runHandler(exports.getEmployeeRevenue, {
                ...req,
                query: { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }
            }),
            db.StaffPayroll.findAll({
                where: {
                    tenantId,
                    periodStart: {
                        [Op.gte]: start,
                        [Op.lte]: end
                    }
                },
                include: [{
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name']
                }],
                order: [['periodStart', 'DESC'], ['createdAt', 'DESC']]
            })
        ]);
        const transactions = transactionsRaw.filter((transaction) => matchesTransactionFilters(transaction, filters));

        const appointmentIds = transactions
            .map((transaction) => transaction?.appointment?.id || null)
            .filter(Boolean);
        const orderIds = transactions
            .map((transaction) => transaction?.order?.id || null)
            .filter(Boolean);

        const invoiceConditions = [];
        if (appointmentIds.length) {
            invoiceConditions.push({
                entityType: 'appointment',
                entityId: { [Op.in]: appointmentIds }
            });
        }
        if (orderIds.length) {
            invoiceConditions.push({
                entityType: 'order',
                entityId: { [Op.in]: orderIds }
            });
        }

        const invoices = invoiceConditions.length
            ? await db.CustomerInvoice.findAll({
                where: {
                    tenantId,
                    [Op.or]: invoiceConditions
                },
                attributes: [
                    'entityType',
                    'entityId',
                    'invoiceNumber',
                    'status',
                    'subtotalAmount',
                    'vatAmount',
                    'totalAmount',
                    'paidAmount',
                    'dueAmount',
                    'issuedAt',
                    'paidAt'
                ],
                include: [
                    {
                        model: db.CustomerInvoiceItem,
                        as: 'items',
                        required: false,
                        attributes: ['id', 'itemType', 'itemRefId', 'nameEn', 'nameAr', 'quantity', 'unitPrice', 'lineTotal', 'taxAmount', 'metadata']
                    }
                ]
            })
            : [];

        const invoiceLookup = new Map(
            invoices.map((invoice) => [`${invoice.entityType}:${invoice.entityId}`, invoice.toJSON ? invoice.toJSON() : invoice])
        );

        const revenueLedger = transactions.map((transaction) => mapLedgerTransaction(transaction, invoiceLookup));

        const paymentLedger = transactions.map((transaction) => ({
            id: transaction.id,
            date: transaction.processedAt || transaction.createdAt,
            reference: getTransactionReference(transaction),
            transactionRef: transaction?.transactionRef || null,
            customer: getLedgerCustomerName(transaction.appointment?.user || transaction.order?.user),
            method: formatLedgerPaymentMethodLabel(transaction.paymentMethod),
            amount: Number((Number(transaction.amount || 0)).toFixed(2)),
            type: transaction.type,
            status: transaction.status,
            notes: transaction?.notes
                || transaction?.metadata?.notes
                || transaction?.metadata?.note
                || transaction?.gatewayResponse?.notes
                || transaction?.gatewayResponse?.note
                || null,
            transactionType: transaction?.type || null,
            source: transaction.appointment ? 'appointment' : 'order',
            detailPath: transaction.appointment?.id
                ? `/dashboard/appointments/${transaction.appointment.id}`
                : transaction.order?.id
                    ? `/dashboard/orders/${transaction.order.id}`
                    : null
        }));

        const refundLedger = transactions
            .filter((transaction) => transaction.type === 'refund' || transaction.status === 'refunded')
            .map(mapRefundLedgerRow);

        const employees = employeeRevenueResponse?.employees || [];
        const payrollByStaff = new Map();
        payrollRecords.forEach((record) => {
            const key = record.staffId;
            const existing = payrollByStaff.get(key) || {
                staffId: key,
                commissionPaid: 0,
                commissionOutstanding: 0,
                payrollCount: 0,
                latestStatus: record.status || 'draft'
            };

            const commission = Number(record.commission || 0);
            const isPaid = `${record.status || ''}`.toLowerCase() === 'paid';
            existing.commissionPaid += isPaid ? commission : 0;
            existing.commissionOutstanding += isPaid ? 0 : commission;
            existing.payrollCount += 1;
            existing.latestStatus = record.status || existing.latestStatus;
            payrollByStaff.set(key, existing);
        });

        const commissionLedger = employees.map((employee) => {
            const payroll = payrollByStaff.get(employee.id) || {
                commissionPaid: 0,
                commissionOutstanding: 0,
                payrollCount: 0,
                latestStatus: 'draft'
            };
            const earned = Number(employee.totalCommission || 0);
            const paid = Number(payroll.commissionPaid || 0);
            return {
                id: employee.id,
                employee: employee.name,
                revenueGenerated: Number(employee.totalRevenueGenerated || 0),
                commissionEarned: Number(earned.toFixed(2)),
                commissionPaid: Number(paid.toFixed(2)),
                commissionOutstanding: Number(Math.max(earned - paid, 0).toFixed(2)),
                payrollCount: payroll.payrollCount,
                latestStatus: payroll.latestStatus
            };
        });

        const settlementBuckets = new Map();
        transactions.forEach((transaction) => {
            const dateSource = transaction?.processedAt || transaction?.createdAt || start;
            const dateValue = dateSource instanceof Date ? dateSource : new Date(dateSource);
            const date = Number.isNaN(dateValue.getTime())
                ? start.toISOString().split('T')[0]
                : dateValue.toISOString().split('T')[0];
            const amount = Number(transaction.amount || 0);
            const isRefund = transaction.status === 'refunded' || transaction.type === 'refund';
            const method = normalizeFinancialPaymentMethodGroup(transaction.paymentMethod);
            const signedAmount = isRefund ? -Math.abs(amount) : Math.abs(amount);

            const existing = settlementBuckets.get(date) || {
                date,
                grossRevenue: 0,
                refunds: 0,
                cash: 0,
                card: 0,
                wallet: 0,
                online: 0,
                bankTransfer: 0
            };

            if (isRefund) {
                existing.refunds += Math.abs(amount);
            } else {
                existing.grossRevenue += Math.abs(amount);
                if (method === 'cash') existing.cash += Math.abs(amount);
                if (method === 'card') existing.card += Math.abs(amount);
                if (method === 'wallet') existing.wallet += Math.abs(amount);
                if (method === 'online') existing.online += Math.abs(amount);
                if (method === 'bank_transfer') existing.bankTransfer += Math.abs(amount);
            }

            settlementBuckets.set(date, existing);
        });

        const settlementLedger = Array.from(settlementBuckets.values())
            .sort((left, right) => left.date.localeCompare(right.date))
            .map((row) => ({
                ...row,
                grossRevenue: Number(row.grossRevenue.toFixed(2)),
                refunds: Number(row.refunds.toFixed(2)),
                netCollected: Number((row.grossRevenue - row.refunds).toFixed(2)),
                cash: Number(row.cash.toFixed(2)),
                card: Number(row.card.toFixed(2)),
                wallet: Number(row.wallet.toFixed(2)),
                online: Number((row.online || 0).toFixed(2)),
                bankTransfer: Number((row.bankTransfer || 0).toFixed(2))
            }));
        const cashFlowSummary = buildCashFlowSummaryRows(
            settlementLedger,
            paymentLedger,
            typeof groupBy === 'string' && groupBy.trim() ? groupBy.trim() : 'day'
        );

        const revenueTotals = revenueLedger.reduce((acc, row) => {
            acc.revenue += Number(row.revenue || 0);
            acc.tax += Number(row.tax || 0);
            acc.discount += Number(row.discount || 0);
            return acc;
        }, { revenue: 0, tax: 0, discount: 0 });

        const refundTotals = refundLedger.reduce((acc, row) => {
            acc.amount += Number(row.amount || 0);
            return acc;
        }, { amount: 0 });

        const commissionTotals = commissionLedger.reduce((acc, row) => {
            acc.earned += Number(row.commissionEarned || 0);
            acc.paid += Number(row.commissionPaid || 0);
            acc.outstanding += Number(row.commissionOutstanding || 0);
            return acc;
        }, { earned: 0, paid: 0, outstanding: 0 });

        const settlementTotals = settlementLedger.reduce((acc, row) => {
            acc.grossRevenue += Number(row.grossRevenue || 0);
            acc.refunds += Number(row.refunds || 0);
            acc.netCollected += Number(row.netCollected || 0);
            acc.cash += Number(row.cash || 0);
            acc.card += Number(row.card || 0);
            acc.wallet += Number(row.wallet || 0);
            acc.online += Number(row.online || 0);
            acc.bankTransfer += Number(row.bankTransfer || 0);
            return acc;
        }, { grossRevenue: 0, refunds: 0, netCollected: 0, cash: 0, card: 0, wallet: 0, online: 0, bankTransfer: 0 });

        res.json({
            success: true,
            overview: {
                totalTransactions: transactions.length,
                totalRevenue: Number(revenueTotals.revenue.toFixed(2)),
                totalTax: Number(revenueTotals.tax.toFixed(2)),
                totalDiscount: Number(revenueTotals.discount.toFixed(2)),
                totalRefunds: Number(refundTotals.amount.toFixed(2)),
                totalCommissionEarned: Number(commissionTotals.earned.toFixed(2)),
                totalCommissionPaid: Number(commissionTotals.paid.toFixed(2)),
                totalCommissionOutstanding: Number(commissionTotals.outstanding.toFixed(2)),
                netCollected: Number((settlementTotals.grossRevenue - settlementTotals.refunds).toFixed(2))
            },
            revenueLedger: {
                rows: revenueLedger,
                totals: {
                    totalRows: revenueLedger.length,
                    revenue: Number(revenueTotals.revenue.toFixed(2)),
                    tax: Number(revenueTotals.tax.toFixed(2)),
                    discount: Number(revenueTotals.discount.toFixed(2))
                }
            },
            paymentLedger: {
                rows: paymentLedger,
                totals: {
                    totalRows: paymentLedger.length,
                    revenue: Number(revenueLedger.reduce((sum, row) => sum + Number(row.revenue || 0), 0).toFixed(2))
                }
            },
            refundLedger: {
                rows: refundLedger,
                totals: {
                    totalRows: refundLedger.length,
                    amount: Number(refundTotals.amount.toFixed(2))
                }
            },
            commissionLedger: {
                rows: commissionLedger,
                totals: {
                    totalRows: commissionLedger.length,
                    earned: Number(commissionTotals.earned.toFixed(2)),
                    paid: Number(commissionTotals.paid.toFixed(2)),
                    outstanding: Number(commissionTotals.outstanding.toFixed(2))
                }
            },
            settlementLedger: {
                rows: settlementLedger,
                totals: {
                    totalRows: settlementLedger.length,
                    grossRevenue: Number(settlementTotals.grossRevenue.toFixed(2)),
                    refunds: Number(settlementTotals.refunds.toFixed(2)),
                    netCollected: Number(settlementTotals.netCollected.toFixed(2)),
                    cash: Number(settlementTotals.cash.toFixed(2)),
                    card: Number(settlementTotals.card.toFixed(2)),
                    wallet: Number(settlementTotals.wallet.toFixed(2))
                }
            },
            cashFlowSummary: {
                grouping: cashFlowSummary.grouping,
                rows: cashFlowSummary.rows,
                totals: cashFlowSummary.totals
            },
            dateRange: {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            }
        });
    } catch (error) {
        console.error('Get financial ledger error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch financial ledger',
            error: error.message
        });
    }
};

/**
 * Get revenue by product
 * GET /api/v1/tenant/financial/products
 */
exports.getProductRevenue = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;
        const filters = buildReportFilterContext(req.query);

        // Build date filter for orders
        const orderDateFilter = buildDateRangeWhere('createdAt', startDate, endDate);

        // Get all products for this tenant
        const products = await db.Product.findAll({
            where: { tenantId },
            attributes: ['id', 'name_en', 'name_ar', 'category', 'price', 'stock', 'soldCount', 'usedAsGiftCount'],
            order: [['name_en', 'ASC']]
        });

        const productRevenue = [];

        for (const product of products.filter((item) => {
            const productLabel = item.name_en || item.name_ar || item.id;
            return matchesSelection(productLabel, filters.product) && matchesSelection(item.category, filters.category);
        })) {
            // Get orders that include this product
            const orderWhere = {
                tenantId,
                status: { [Op.in]: ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed'] }
            };
            
            // Add date filter if provided
            if (orderDateFilter.createdAt) {
                orderWhere.createdAt = orderDateFilter.createdAt;
            }
            
            const orderItems = await db.OrderItem.findAll({
                where: {
                    productId: product.id
                },
                include: [
                    {
                        model: db.Order,
                        as: 'order',
                        where: orderWhere,
                        required: true,
                        attributes: ['id', 'totalAmount', 'platformFee', 'paymentStatus', 'status', 'createdAt']
                    }
                ],
                attributes: ['id', 'quantity', 'unitPrice', 'totalPrice']
            });

            const stats = {
                id: product.id,
                name_en: product.name_en,
                name_ar: product.name_ar,
                category: product.category,
                productPrice: parseFloat(product.price || 0),
                averagePrice: 0,
                stock: Number(product.stock || 0),
                soldCount: Number(product.soldCount || 0),
                usedAsGiftCount: Number(product.usedAsGiftCount || 0),
                inventoryImpact: 0,
                totalOrders: 0,
                totalQuantity: 0,
                totalRevenue: 0,
                totalPlatformFees: 0,
                totalTenantRevenue: 0,
                trend: []
            };

            // Track unique orders
            const orderIds = new Set();
            const trendBuckets = new Map();

            orderItems.forEach(item => {
                if (item.order) {
                    orderIds.add(item.order.id);
                    stats.totalQuantity += item.quantity || 0;
                    stats.totalRevenue += parseFloat(item.totalPrice || 0);

                    const bucketKey = item.order.createdAt ? new Date(item.order.createdAt).toISOString().split('T')[0] : null;
                    if (bucketKey) {
                        const trend = trendBuckets.get(bucketKey) || {
                            date: bucketKey,
                            quantitySold: 0,
                            revenue: 0
                        };
                        trend.quantitySold += item.quantity || 0;
                        trend.revenue += parseFloat(item.totalPrice || 0);
                        trendBuckets.set(bucketKey, trend);
                    }

                    // Platform fee and tenant revenue are at order level, so we need to calculate proportionally
                    // For simplicity, we'll use the order's total values divided by number of items
                    const orderTotal = parseFloat(item.order.totalAmount || 0);
                    const orderPlatformFee = parseFloat(item.order.platformFee || 0);
                    const orderTenantRevenue = orderTotal - orderPlatformFee;
                    const itemProportion = orderTotal > 0 ? parseFloat(item.totalPrice || 0) / orderTotal : 0;
                    stats.totalPlatformFees += orderPlatformFee * itemProportion;
                    stats.totalTenantRevenue += orderTenantRevenue * itemProportion;
                }
            });

            stats.totalOrders = orderIds.size;

            // Round values
            stats.totalRevenue = parseFloat(stats.totalRevenue.toFixed(2));
            stats.totalPlatformFees = parseFloat(stats.totalPlatformFees.toFixed(2));
            stats.totalTenantRevenue = parseFloat(stats.totalTenantRevenue.toFixed(2));
            stats.averagePrice = stats.totalQuantity > 0 ? parseFloat((stats.totalRevenue / stats.totalQuantity).toFixed(2)) : parseFloat(product.price || 0);
            stats.inventoryImpact = Number((stats.soldCount + stats.usedAsGiftCount).toFixed(0));
            stats.trend = Array.from(trendBuckets.values())
                .map((item) => ({
                    ...item,
                    revenue: parseFloat(item.revenue.toFixed(2)),
                    averagePrice: item.quantitySold > 0 ? parseFloat((item.revenue / item.quantitySold).toFixed(2)) : 0
                }))
                .sort((left, right) => left.date.localeCompare(right.date));

            // Only include products that have sales
            if (stats.totalOrders > 0) {
                productRevenue.push(stats);
            }
        }

        // Sort by total revenue (descending)
        productRevenue.sort((a, b) => b.totalRevenue - a.totalRevenue);

        // Calculate totals
        const totals = {
            totalProducts: productRevenue.length,
            totalOrders: productRevenue.reduce((sum, p) => sum + p.totalOrders, 0),
            totalQuantity: productRevenue.reduce((sum, p) => sum + p.totalQuantity, 0),
            totalRevenue: productRevenue.reduce((sum, p) => sum + p.totalRevenue, 0),
            totalPlatformFees: productRevenue.reduce((sum, p) => sum + p.totalPlatformFees, 0),
            totalTenantRevenue: productRevenue.reduce((sum, p) => sum + p.totalTenantRevenue, 0),
            totalInventoryImpact: productRevenue.reduce((sum, p) => sum + Number(p.inventoryImpact || 0), 0)
        };

        // Round totals
        Object.keys(totals).forEach(key => {
            if (typeof totals[key] === 'number' && key !== 'totalProducts' && key !== 'totalOrders' && key !== 'totalQuantity') {
                totals[key] = parseFloat(totals[key].toFixed(2));
            }
        });

        res.json({
            success: true,
            products: productRevenue,
            totals
        });
    } catch (error) {
        console.error('Get product revenue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product revenue',
            error: error.message
        });
    }
};

/**
 * Get single employee financial details
 * GET /api/v1/tenant/financial/employees/:id
 */
exports.getEmployeeFinancialDetails = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        // Get employee
        const employee = await db.Staff.findOne({
            where: { id, tenantId },
            attributes: ['id', 'name', 'photo', 'salary', 'commissionRate', 'email', 'phone']
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Build date filter
        const dateFilter = buildDateRangeWhere('startTime', startDate, endDate);

        // Get appointments
        const appointments = await db.Appointment.findAll({
            where: {
                staffId: id,
                ...dateFilter,
                status: { [Op.in]: ['completed', 'confirmed'] }
            },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    attributes: ['id', 'name_en', 'name_ar', 'category'],
                    required: true
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName'],
                    required: false
                }
            ],
            attributes: [
                'id', 'startTime', 'price', 'rawPrice', 'employeeCommission',
                'employeeCommissionRate', 'paymentStatus', 'status'
            ],
            order: [['startTime', 'DESC']]
        });

        // Calculate stats
        const stats = {
            totalBookings: appointments.length,
            completedBookings: appointments.filter(a => a.status === 'completed').length,
            paidBookings: appointments.filter(a => isAppointmentFullyPaid(a.paymentStatus)).length,
            totalRevenueGenerated: 0,
            totalCommission: 0
        };

        appointments.forEach(appt => {
            stats.totalRevenueGenerated += parseFloat(appt.rawPrice || appt.price || 0);
            stats.totalCommission += parseFloat(appt.employeeCommission || 0);
        });

        stats.totalRevenueGenerated = parseFloat(stats.totalRevenueGenerated.toFixed(2));
        stats.totalCommission = parseFloat(stats.totalCommission.toFixed(2));
        stats.totalEarnings = parseFloat((parseFloat(employee.salary || 0) + stats.totalCommission).toFixed(2));

        res.json({
            success: true,
            employee: {
                ...employee.toJSON(),
                stats
            },
            appointments: appointments.map(appt => ({
                id: appt.id,
                date: appt.startTime,
                service: appt.service,
                customer: appt.user ? `${appt.user.firstName} ${appt.user.lastName}` : 'Unknown',
                price: parseFloat(appt.price || 0),
                commission: parseFloat(appt.employeeCommission || 0),
                commissionRate: parseFloat(appt.employeeCommissionRate || 0),
                paymentStatus: appt.paymentStatus,
                status: appt.status
            }))
        });
    } catch (error) {
        console.error('Get employee financial details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee financial details',
            error: error.message
        });
    }
};

