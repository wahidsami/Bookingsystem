'use strict';

const db = require('../models');
const { Op } = require('sequelize');
const {
    normalizeFinancialPaymentMethodGroup,
    getRefundModeLabel,
    buildPaymentMethodBucketRows
} = require('./tenantFinancialFormulaService');

function parseDateValue(value, endOfDay = false) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (endOfDay) {
            date.setHours(23, 59, 59, 999);
        } else {
            date.setHours(0, 0, 0, 0);
        }
    }

    return date;
}

function buildRange(startDate, endDate, fallbackDays = 30) {
    const fallbackEnd = new Date();
    fallbackEnd.setHours(23, 59, 59, 999);
    const fallbackStart = new Date(fallbackEnd.getTime() - fallbackDays * 24 * 60 * 60 * 1000);
    fallbackStart.setHours(0, 0, 0, 0);

    const start = parseDateValue(startDate, false) || fallbackStart;
    const end = parseDateValue(endDate, true) || fallbackEnd;

    return { start, end };
}

function shiftRange(range, mode) {
    const duration = Math.max(range.end.getTime() - range.start.getTime(), 24 * 60 * 60 * 1000);
    const start = new Date(range.start);
    const end = new Date(range.end);

    if (mode === 'previous_year') {
        start.setFullYear(start.getFullYear() - 1);
        end.setFullYear(end.getFullYear() - 1);
        return { start, end };
    }

    if (mode === 'month_over_month') {
        start.setMonth(start.getMonth() - 1);
        end.setMonth(end.getMonth() - 1);
        return { start, end };
    }

    if (mode === 'year_over_year') {
        start.setFullYear(start.getFullYear() - 1);
        end.setFullYear(end.getFullYear() - 1);
        return { start, end };
    }

    const previousEnd = new Date(range.start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    previousStart.setMilliseconds(0);
    previousStart.setSeconds(0);
    previousStart.setMinutes(0);
    previousStart.setHours(0);
    return { start: previousStart, end: previousEnd };
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
            attributes: ['id', 'tenantId', 'name_en', 'name_ar', 'category'],
            required: false
        },
        {
            model: db.Staff,
            as: 'staff',
            attributes: ['id', 'tenantId', 'name'],
            required: false
        },
        {
            model: db.PlatformUser,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
            required: false
        }
    ];
}

function buildPaymentTransactionIncludes() {
    return [
        {
            model: db.Appointment,
            as: 'appointment',
            attributes: ['id', 'bookingNumber', 'tenantId', 'startTime', 'paymentStatus', 'status', 'price'],
            required: false,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar', 'category'],
                    required: false
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                }
            ]
        },
        {
            model: db.Order,
            as: 'order',
            attributes: ['id', 'tenantId', 'orderNumber', 'paymentStatus', 'status', 'paymentMethod', 'totalAmount', 'subtotal', 'taxAmount', 'shippingFee'],
            required: false,
            include: [
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                },
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar'],
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

function getCustomerName(user) {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    return `${firstName} ${lastName}`.trim() || user?.email || user?.phone || 'Guest Customer';
}

function getOrderLabel(order) {
    const itemNames = Array.isArray(order?.items)
        ? order.items.map((item) => item?.product?.name_en || item?.product?.name_ar).filter(Boolean)
        : [];
    return itemNames.length ? itemNames.slice(0, 2).join(', ') : 'Product order';
}

function mapRefundRow(transaction) {
    const appointment = transaction.appointment;
    const order = transaction.order;
    const user = appointment?.user || order?.user;
    const amount = Number(transaction.amount || 0);
    const referenceAmount = appointment
        ? Number(appointment.price || 0)
        : order
            ? Number(order.totalAmount || 0)
            : amount;
    const refundMode = getRefundModeLabel(amount, referenceAmount);
    const refundReason = `${transaction.notes || transaction.metadata?.reason || transaction.metadata?.refundReason || transaction.gatewayResponse?.reason || ''}`.trim() || null;

    return {
        id: transaction.id,
        date: transaction.processedAt || transaction.createdAt,
        customer: getCustomerName(user),
        reference: appointment?.bookingNumber || appointment?.id || order?.orderNumber || transaction.transactionRef || transaction.id,
        entityType: appointment ? 'appointment' : 'order',
        entityLabel: appointment?.service?.name_en || appointment?.service?.name_ar || getOrderLabel(order),
        amount: Number(amount.toFixed(2)),
        refundReason,
        employee: transaction.processor?.name || null,
        paymentMethod: transaction.paymentMethod,
        paymentMethodLabel: ({
            online: 'Online',
            cash: 'Cash',
            card_pos: 'Card',
            wallet: 'Wallet',
            bank_transfer: 'Bank transfer',
            gift_card_code: 'Gift card',
            pay_on_visit: 'Pay on visit',
            cash_on_delivery: 'Cash on delivery',
            split: 'Split payments'
        }[transaction.paymentMethod] || transaction.paymentMethod || 'Not set'),
        refundMode,
        status: transaction.status,
        detailPath: appointment?.id
            ? `/dashboard/appointments/${appointment.id}`
            : order?.id
                ? `/dashboard/orders/${order.id}`
                : null
    };
}

async function loadAppointments(tenantId, start, end) {
    return db.Appointment.findAll({
        where: {
            ...buildTenantAppointmentScope(tenantId),
            startTime: {
                [Op.gte]: start,
                [Op.lte]: end
            }
        },
        include: getTenantAppointmentIncludes(),
        attributes: [
            'id',
            'platformUserId',
            'serviceId',
            'staffId',
            'status',
            'price',
            'rawPrice',
            'tenantRevenue',
            'employeeCommission',
            'paymentStatus',
            'startTime'
        ],
        subQuery: false
    });
}

async function loadOrders(tenantId, start, end) {
    return db.Order.findAll({
        where: {
            tenantId,
            createdAt: {
                [Op.gte]: start,
                [Op.lte]: end
            },
            status: { [Op.in]: ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'] }
        },
        include: [
            {
                model: db.PlatformUser,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
            },
            {
                model: db.OrderItem,
                as: 'items',
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
        ],
        attributes: ['id', 'orderNumber', 'platformUserId', 'subtotal', 'taxAmount', 'shippingFee', 'totalAmount', 'status', 'paymentStatus', 'paymentMethod', 'createdAt'],
        subQuery: false
    });
}

async function loadTransactions(tenantId, start, end, limit = 600) {
    return db.PaymentTransaction.findAll({
        where: {
            [Op.or]: [
                { '$appointment.tenantId$': tenantId },
                { '$order.tenantId$': tenantId }
            ],
            status: { [Op.in]: ['completed', 'refunded'] },
            type: { [Op.in]: ['booking', 'product_purchase', 'refund'] },
            processedAt: {
                [Op.gte]: start,
                [Op.lte]: end
            }
        },
        include: buildPaymentTransactionIncludes(),
        order: [['processedAt', 'DESC']],
        limit,
        subQuery: false
    });
}

async function loadGiftCards(tenantId, start, end) {
    return db.TenantGiftCardTransaction.findAll({
        where: {
            tenantId,
            createdAt: {
                [Op.gte]: start,
                [Op.lte]: end
            }
        },
        attributes: ['id', 'purchaseAmount', 'status', 'createdAt', 'claimedAt']
    }).catch(() => []);
}

function bucketByDate(value, groupBy = 'day') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    if (groupBy === 'month') {
        return `${year}-${month}`;
    }

    if (groupBy === 'week') {
        const day = date.getUTCDay();
        const weekStart = new Date(date);
        weekStart.setUTCDate(date.getUTCDate() - day);
        return weekStart.toISOString().split('T')[0];
    }

    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function trendPointLabel(bucketKey, groupBy = 'day') {
    if (!bucketKey) return bucketKey;
    return groupBy === 'month' ? `${bucketKey}-01` : bucketKey;
}

function buildChange(current, previous) {
    const currentValue = Number(current || 0);
    const previousValue = Number(previous || 0);
    const delta = currentValue - previousValue;
    const percent = previousValue === 0 ? (currentValue === 0 ? 0 : 100) : (delta / Math.abs(previousValue)) * 100;

    return {
        current: Number(currentValue.toFixed(2)),
        previous: Number(previousValue.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        percentChange: Number(percent.toFixed(1))
    };
}

async function summarizeRange(tenantId, start, end) {
    const [appointments, orders, transactions, giftCards] = await Promise.all([
        loadAppointments(tenantId, start, end),
        loadOrders(tenantId, start, end),
        loadTransactions(tenantId, start, end),
        loadGiftCards(tenantId, start, end)
    ]);

    const currentCustomers = new Set();
    let totalRevenue = 0;
    let refunds = 0;
    let bookings = 0;
    let completedBookings = 0;

    appointments.forEach((appointment) => {
        if (appointment.platformUserId) {
            currentCustomers.add(appointment.platformUserId);
        }
        bookings += 1;
        if (appointment.status === 'completed') {
            completedBookings += 1;
            totalRevenue += Number(appointment.price || 0);
        }
    });

    orders.forEach((order) => {
        if (order.platformUserId) {
            currentCustomers.add(order.platformUserId);
        }
        if (['completed', 'delivered'].includes(order.status)) {
            totalRevenue += Number(order.totalAmount || 0);
        }
    });

    giftCards.forEach((giftCard) => {
        totalRevenue += Number(giftCard.purchaseAmount || 0);
    });

    transactions.forEach((transaction) => {
        if (transaction.type === 'refund' || transaction.status === 'refunded') {
            refunds += Math.abs(Number(transaction.amount || 0));
        }
    });

    const paymentTotals = {
        cash: 0,
        card: 0,
        online: 0,
        wallet: 0,
        gift_card: 0
    };

    transactions.forEach((transaction) => {
        if (transaction.type === 'refund' || transaction.status === 'refunded') {
            return;
        }
        const group = normalizeFinancialPaymentMethodGroup(transaction.paymentMethod);
        const amount = Number(transaction.amount || 0);
        if (group === 'cash') paymentTotals.cash += amount;
        else if (group === 'card') paymentTotals.card += amount;
        else if (group === 'wallet') paymentTotals.wallet += amount;
        else if (group === 'gift_card') paymentTotals.gift_card += amount;
        else paymentTotals.online += amount;
    });

    const completionRate = bookings > 0 ? (completedBookings / bookings) * 100 : 0;

    return {
        appointments,
        orders,
        transactions,
        giftCards,
        summary: {
            revenue: Number(totalRevenue.toFixed(2)),
            bookings,
            completedBookings,
            refunds: Number(refunds.toFixed(2)),
            customers: currentCustomers.size,
            completionRate: Number(completionRate.toFixed(1)),
            paymentTotals: {
                cash: Number(paymentTotals.cash.toFixed(2)),
                card: Number(paymentTotals.card.toFixed(2)),
                online: Number(paymentTotals.online.toFixed(2)),
                wallet: Number(paymentTotals.wallet.toFixed(2)),
                gift_card: Number(paymentTotals.gift_card.toFixed(2))
            }
        }
    };
}

async function buildComparativeAnalytics(req, startDate, endDate) {
    const tenantId = req.tenantId;
    const currentRange = buildRange(startDate, endDate, 30);
    const previousPeriod = shiftRange(currentRange, 'previous_period');
    const previousYear = shiftRange(currentRange, 'previous_year');
    const monthOverMonth = shiftRange(currentRange, 'month_over_month');
    const yearOverYear = shiftRange(currentRange, 'year_over_year');

    const [current, previous, prevYear, mom, yoy] = await Promise.all([
        summarizeRange(tenantId, currentRange.start, currentRange.end),
        summarizeRange(tenantId, previousPeriod.start, previousPeriod.end),
        summarizeRange(tenantId, previousYear.start, previousYear.end),
        summarizeRange(tenantId, monthOverMonth.start, monthOverMonth.end),
        summarizeRange(tenantId, yearOverYear.start, yearOverYear.end)
    ]);

    return {
        range: {
            startDate: currentRange.start.toISOString().split('T')[0],
            endDate: currentRange.end.toISOString().split('T')[0]
        },
        current: current.summary,
        comparisons: {
            previousPeriod: {
                range: {
                    startDate: previousPeriod.start.toISOString().split('T')[0],
                    endDate: previousPeriod.end.toISOString().split('T')[0]
                },
                revenue: buildChange(current.summary.revenue, previous.summary.revenue),
                bookings: buildChange(current.summary.bookings, previous.summary.bookings),
                refunds: buildChange(current.summary.refunds, previous.summary.refunds),
                customers: buildChange(current.summary.customers, previous.summary.customers),
                completionRate: buildChange(current.summary.completionRate, previous.summary.completionRate)
            },
            previousYear: {
                range: {
                    startDate: previousYear.start.toISOString().split('T')[0],
                    endDate: previousYear.end.toISOString().split('T')[0]
                },
                revenue: buildChange(current.summary.revenue, prevYear.summary.revenue),
                bookings: buildChange(current.summary.bookings, prevYear.summary.bookings),
                refunds: buildChange(current.summary.refunds, prevYear.summary.refunds),
                customers: buildChange(current.summary.customers, prevYear.summary.customers),
                completionRate: buildChange(current.summary.completionRate, prevYear.summary.completionRate)
            },
            monthOverMonth: {
                range: {
                    startDate: monthOverMonth.start.toISOString().split('T')[0],
                    endDate: monthOverMonth.end.toISOString().split('T')[0]
                },
                revenue: buildChange(current.summary.revenue, mom.summary.revenue),
                bookings: buildChange(current.summary.bookings, mom.summary.bookings),
                refunds: buildChange(current.summary.refunds, mom.summary.refunds),
                customers: buildChange(current.summary.customers, mom.summary.customers),
                completionRate: buildChange(current.summary.completionRate, mom.summary.completionRate)
            },
            yearOverYear: {
                range: {
                    startDate: yearOverYear.start.toISOString().split('T')[0],
                    endDate: yearOverYear.end.toISOString().split('T')[0]
                },
                revenue: buildChange(current.summary.revenue, yoy.summary.revenue),
                bookings: buildChange(current.summary.bookings, yoy.summary.bookings),
                refunds: buildChange(current.summary.refunds, yoy.summary.refunds),
                customers: buildChange(current.summary.customers, yoy.summary.customers),
                completionRate: buildChange(current.summary.completionRate, yoy.summary.completionRate)
            }
        }
    };
}

async function buildPaymentMethodTrends(req, startDate, endDate, groupBy = 'day') {
    const tenantId = req.tenantId;
    const range = buildRange(startDate, endDate, 30);
    const transactions = await loadTransactions(tenantId, range.start, range.end, 900);
    const trends = buildPaymentMethodBucketRows(transactions, { groupBy, includeRefunds: false });

    return {
        range: {
            startDate: range.start.toISOString().split('T')[0],
            endDate: range.end.toISOString().split('T')[0]
        },
        trends,
        totals: trends.reduce((acc, row) => {
            acc.revenue += Number(row.revenue || 0);
            acc.transactionCount += Number(row.transactionCount || 0);
            return acc;
        }, { revenue: 0, transactionCount: 0 })
    };
}

async function buildRefundTrends(req, startDate, endDate, groupBy = 'day') {
    const tenantId = req.tenantId;
    const range = buildRange(startDate, endDate, 30);
    const transactions = await loadTransactions(tenantId, range.start, range.end, 900);
    const buckets = new Map();
    let totalTransactions = 0;

    transactions.forEach((transaction) => {
        const bucketKey = bucketByDate(transaction.processedAt || transaction.createdAt, groupBy);
        if (!bucketKey) return;
        totalTransactions += 1;

        const existing = buckets.get(bucketKey) || {
            date: trendPointLabel(bucketKey, groupBy),
            refundAmount: 0,
            refundCount: 0,
            totalTransactions: 0
        };

        existing.totalTransactions += 1;
        if (transaction.type === 'refund' || transaction.status === 'refunded') {
            existing.refundAmount += Math.abs(Number(transaction.amount || 0));
            existing.refundCount += 1;
        }
        buckets.set(bucketKey, existing);
    });

    const trends = Array.from(buckets.values())
        .map((row) => ({
            ...row,
            refundAmount: Number(row.refundAmount.toFixed(2)),
            refundRate: row.totalTransactions > 0 ? Number(((row.refundCount / row.totalTransactions) * 100).toFixed(1)) : 0
        }))
        .sort((left, right) => left.date.localeCompare(right.date));

    const totals = trends.reduce((acc, row) => {
        acc.refundAmount += Number(row.refundAmount || 0);
        acc.refundCount += Number(row.refundCount || 0);
        acc.totalTransactions += Number(row.totalTransactions || 0);
        return acc;
    }, { refundAmount: 0, refundCount: 0, totalTransactions });

    return {
        range: {
            startDate: range.start.toISOString().split('T')[0],
            endDate: range.end.toISOString().split('T')[0]
        },
        trends,
        totals: {
            refundAmount: Number(totals.refundAmount.toFixed(2)),
            refundCount: totals.refundCount,
            refundRate: totals.totalTransactions > 0 ? Number(((totals.refundCount / totals.totalTransactions) * 100).toFixed(1)) : 0
        }
    };
}

async function buildCustomerCohorts(req, startDate, endDate) {
    const tenantId = req.tenantId;
    const range = buildRange(startDate, endDate, 90);
    const [appointments, orders] = await Promise.all([
        loadAppointments(tenantId, new Date(range.start.getTime() - 365 * 24 * 60 * 60 * 1000), range.end),
        loadOrders(tenantId, new Date(range.start.getTime() - 365 * 24 * 60 * 60 * 1000), range.end)
    ]);

    const customers = new Map();
    const consider = (user, visitedAt, source) => {
        if (!user) return;
        const customerId = user.id || user.email || user.phone;
        if (!customerId) return;
        const date = new Date(visitedAt);
        if (Number.isNaN(date.getTime())) return;

        const existing = customers.get(customerId) || {
            id: customerId,
            name: getCustomerName(user),
            firstVisit: date,
            lastVisit: date,
            totalVisits: 0,
            inRangeVisits: 0,
            sources: new Set()
        };
        existing.name = existing.name || getCustomerName(user);
        existing.firstVisit = existing.firstVisit < date ? existing.firstVisit : date;
        existing.lastVisit = existing.lastVisit > date ? existing.lastVisit : date;
        existing.totalVisits += 1;
        existing.sources.add(source);
        if (date >= range.start && date <= range.end) {
            existing.inRangeVisits += 1;
        }
        customers.set(customerId, existing);
    };

    appointments.forEach((appointment) => {
        consider(appointment.user, appointment.startTime, 'appointment');
    });
    orders.forEach((order) => {
        consider(order.user, order.createdAt, 'order');
    });

    const currentCustomers = Array.from(customers.values()).filter((customer) => customer.inRangeVisits > 0);
    const newCustomers = currentCustomers.filter((customer) => customer.firstVisit >= range.start && customer.inRangeVisits === 1);
    const returningCustomers = currentCustomers.filter((customer) => customer.inRangeVisits > 1 || customer.firstVisit < range.start);
    const loyalCustomers = currentCustomers.filter((customer) => customer.totalVisits >= 6 || customer.inRangeVisits >= 4);
    const churnCutoff = new Date(range.end.getTime() - 90 * 24 * 60 * 60 * 1000);
    const churnedCustomers = Array.from(customers.values()).filter((customer) => customer.lastVisit < range.start || customer.lastVisit < churnCutoff);

    const cohortRows = [
        { cohort: 'new', label: 'New customers', count: newCustomers.length, share: currentCustomers.length ? Number(((newCustomers.length / currentCustomers.length) * 100).toFixed(1)) : 0 },
        { cohort: 'returning', label: 'Returning customers', count: returningCustomers.length, share: currentCustomers.length ? Number(((returningCustomers.length / currentCustomers.length) * 100).toFixed(1)) : 0 },
        { cohort: 'loyal', label: 'Loyal customers', count: loyalCustomers.length, share: currentCustomers.length ? Number(((loyalCustomers.length / currentCustomers.length) * 100).toFixed(1)) : 0 },
        { cohort: 'churned', label: 'Churned customers', count: churnedCustomers.length, share: customers.size ? Number(((churnedCustomers.length / customers.size) * 100).toFixed(1)) : 0 }
    ];

    return {
        range: {
            startDate: range.start.toISOString().split('T')[0],
            endDate: range.end.toISOString().split('T')[0]
        },
        rows: cohortRows,
        totals: {
            currentCustomers: currentCustomers.length,
            newCustomers: newCustomers.length,
            returningCustomers: returningCustomers.length,
            loyalCustomers: loyalCustomers.length,
            churnedCustomers: churnedCustomers.length
        }
    };
}

async function buildRebookingAnalyticsEnhanced(req, startDate, endDate, groupBy = 'day') {
    const tenantId = req.tenantId;
    const range = buildRange(startDate, endDate, 90);
    const appointments = await loadAppointments(tenantId, range.start, range.end);
    const customerHistory = new Map();
    const rebookedRows = [];
    const trendBuckets = new Map();
    const employeeBuckets = new Map();
    const serviceBuckets = new Map();

    appointments.forEach((appointment) => {
        const customerKey = appointment.platformUserId || null;
        if (!customerKey) return;
        const history = customerHistory.get(customerKey) || [];
        const amount = Number(appointment.price || 0);
        const isRebooked = history.length > 0;

        if (isRebooked) {
            rebookedRows.push({
                id: appointment.id,
                date: appointment.startTime,
                customer: getCustomerName(appointment.user),
                reference: appointment.bookingReference || appointment.bookingNumber || appointment.id,
                service: appointment.service?.name_en || appointment.service?.name_ar || 'Service',
                employee: appointment.staff?.name || null,
                amount: Number(amount.toFixed(2)),
                staffId: appointment.staffId || null,
                customerId: customerKey,
                serviceId: appointment.serviceId || null
            });

            const bucketKey = bucketByDate(appointment.startTime, groupBy);
            if (bucketKey) {
                const trend = trendBuckets.get(bucketKey) || {
                    date: trendPointLabel(bucketKey, groupBy),
                    rebookedAppointments: 0,
                    repeatCustomers: new Set(),
                    revenue: 0
                };
                trend.rebookedAppointments += 1;
                trend.repeatCustomers.add(customerKey);
                trend.revenue += amount;
                trendBuckets.set(bucketKey, trend);
            }

            const employeeKey = appointment.staffId || 'unassigned';
            const employee = employeeBuckets.get(employeeKey) || {
                id: employeeKey,
                name: appointment.staff?.name || 'Unassigned',
                totalRebookings: 0,
                rebookedRevenue: 0,
                repeatCustomers: new Set()
            };
            employee.totalRebookings += 1;
            employee.rebookedRevenue += amount;
            employee.repeatCustomers.add(customerKey);
            employeeBuckets.set(employeeKey, employee);

            const serviceKey = appointment.serviceId || 'unknown';
            const service = serviceBuckets.get(serviceKey) || {
                id: serviceKey,
                name_en: appointment.service?.name_en || 'Service',
                name_ar: appointment.service?.name_ar || 'الخدمة',
                totalRebookings: 0,
                rebookedRevenue: 0
            };
            service.totalRebookings += 1;
            service.rebookedRevenue += amount;
            serviceBuckets.set(serviceKey, service);
        }

        history.push({ id: appointment.id, startTime: appointment.startTime, amount });
        customerHistory.set(customerKey, history);
    });

    const totalCompletedAppointments = appointments.length;
    const rebookedAppointments = rebookedRows.length;
    const rebookedRevenue = rebookedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const rebookingRate = totalCompletedAppointments > 0
        ? Number(((rebookedAppointments / totalCompletedAppointments) * 100).toFixed(1))
        : 0;

    const trend = Array.from(trendBuckets.values())
        .map((item) => ({
            ...item,
            repeatCustomers: item.repeatCustomers.size,
            revenue: Number(item.revenue.toFixed(2))
        }))
        .sort((left, right) => left.date.localeCompare(right.date));

    const topRebookingEmployees = Array.from(employeeBuckets.values())
        .map((item) => ({
            ...item,
            repeatCustomers: item.repeatCustomers.size,
            rebookedRevenue: Number(item.rebookedRevenue.toFixed(2))
        }))
        .sort((left, right) => right.totalRebookings - left.totalRebookings)
        .slice(0, 10);

    const topRebookedServices = Array.from(serviceBuckets.values())
        .map((item) => ({
            ...item,
            rebookedRevenue: Number(item.rebookedRevenue.toFixed(2))
        }))
        .sort((left, right) => right.totalRebookings - left.totalRebookings)
        .slice(0, 10);

    return {
        range: {
            startDate: range.start.toISOString().split('T')[0],
            endDate: range.end.toISOString().split('T')[0]
        },
        rows: rebookedRows,
        totals: {
            totalCompletedAppointments,
            rebookedAppointments,
            repeatCustomers: Array.from(customerHistory.values()).filter((history) => history.length > 1).length,
            rebookedRevenue: Number(rebookedRevenue.toFixed(2)),
            rebookingRate
        },
        trend,
        topRebookingEmployees,
        topRebookedServices
    };
}

async function buildMultiLocationComparisons(req, startDate, endDate) {
    const tenantId = req.tenantId;
    const range = buildRange(startDate, endDate, 30);
    const tenant = await db.Tenant.findByPk(tenantId, {
        attributes: ['id', 'name', 'name_en', 'name_ar', 'address', 'city', 'country', 'googleMapLink']
    });
    const singleLocationLabel = `${tenant?.name_ar || tenant?.name_en || tenant?.name || 'Primary branch'}`.trim();
    const summary = await summarizeRange(tenantId, range.start, range.end);

    return {
        range: {
            startDate: range.start.toISOString().split('T')[0],
            endDate: range.end.toISOString().split('T')[0]
        },
        datasetAvailable: false,
        locations: [
            {
                id: tenantId,
                name: singleLocationLabel,
                address: tenant?.address || tenant?.city || tenant?.country || null,
                revenue: summary.summary.revenue,
                bookings: summary.summary.bookings,
                completionRate: summary.summary.completionRate,
                refunds: summary.summary.refunds,
                rank: 1,
                trend: 'stable'
            }
        ],
        rankings: [
            {
                id: tenantId,
                name: singleLocationLabel,
                revenue: summary.summary.revenue,
                bookings: summary.summary.bookings,
                completionRate: summary.summary.completionRate,
                refunds: summary.summary.refunds
            }
        ],
        trends: [
            {
                date: range.start.toISOString().split('T')[0],
                revenue: summary.summary.revenue,
                bookings: summary.summary.bookings,
                refunds: summary.summary.refunds
            }
        ]
    };
}

async function buildOperationalAlerts(req, startDate, endDate) {
    const tenantId = req.tenantId;
    const comparative = await buildComparativeAnalytics(req, startDate, endDate);
    const cohort = await buildCustomerCohorts(req, startDate, endDate);
    const rebooking = await buildRebookingAnalyticsEnhanced(req, startDate, endDate);
    const alerts = [];

    const revenueDelta = comparative.comparisons.previousPeriod.revenue.percentChange;
    if (revenueDelta < -10) {
        alerts.push({
            severity: 'high',
            type: 'declining_revenue',
            title: 'Declining revenue',
            detail: `Revenue is down ${Math.abs(revenueDelta).toFixed(1)}% versus the previous period.`,
            module: 'financial',
            deepLink: '/dashboard/reports/financial/summary',
            metricValue: revenueDelta
        });
    }

    if (rebooking.totals.rebookingRate < 25) {
        alerts.push({
            severity: 'medium',
            type: 'low_retention',
            title: 'Low rebooking rate',
            detail: `Rebooking rate is ${rebooking.totals.rebookingRate.toFixed(1)}%.`,
            module: 'reports',
            deepLink: '/dashboard/reports?section=rebookings',
            metricValue: rebooking.totals.rebookingRate
        });
    }

    if (cohort.totals.returningCustomers < Math.max(1, Math.round(cohort.totals.currentCustomers * 0.4))) {
        alerts.push({
            severity: 'medium',
            type: 'low_retention',
            title: 'Low retention',
            detail: `Only ${cohort.totals.returningCustomers} returning customers were detected in the period.`,
            module: 'customers',
            deepLink: '/dashboard/customers',
            metricValue: cohort.totals.returningCustomers
        });
    }

    if (comparative.current.refunds > comparative.current.revenue * 0.12) {
        alerts.push({
            severity: 'high',
            type: 'high_refunds',
            title: 'High refund activity',
            detail: `Refunds represent ${((comparative.current.refunds / Math.max(comparative.current.revenue, 1)) * 100).toFixed(1)}% of current revenue.`,
            module: 'financial',
            deepLink: '/dashboard/reports/financial/payment-transactions',
            metricValue: comparative.current.refunds
        });
    }

    if (comparative.current.bookings > 0 && comparative.current.completionRate < 70) {
        alerts.push({
            severity: 'high',
            type: 'high_no_show',
            title: 'Low completion rate',
            detail: `Completion rate is ${comparative.current.completionRate.toFixed(1)}% for the selected range.`,
            module: 'appointments',
            deepLink: '/dashboard/appointments',
            metricValue: comparative.current.completionRate
        });
    }

    if (alerts.length === 0) {
        alerts.push({
            severity: 'low',
            type: 'stable',
            title: 'Operational stability',
            detail: 'No critical revenue, retention, or completion alerts were detected for the selected range.',
            module: 'reports',
            deepLink: '/dashboard/reports',
            metricValue: comparative.current.revenue
        });
    }

    return {
        range: comparative.range,
        alerts,
        summary: {
            tenantId,
            alertCount: alerts.length,
            highestSeverity: alerts.some((alert) => alert.severity === 'high') ? 'high' : alerts.some((alert) => alert.severity === 'medium') ? 'medium' : 'low',
            revenueDelta: comparative.comparisons.previousPeriod.revenue.percentChange,
            completionRate: comparative.current.completionRate
        }
    };
}

async function buildAdvancedAnalytics(req, startDate, endDate, groupBy = 'day') {
    const [comparative, paymentTrends, refundTrends, customerCohorts, rebookingEnhancements, multiLocationComparisons, operationalAlerts] = await Promise.all([
        buildComparativeAnalytics(req, startDate, endDate),
        buildPaymentMethodTrends(req, startDate, endDate, groupBy),
        buildRefundTrends(req, startDate, endDate, groupBy),
        buildCustomerCohorts(req, startDate, endDate),
        buildRebookingAnalyticsEnhanced(req, startDate, endDate, groupBy),
        buildMultiLocationComparisons(req, startDate, endDate),
        buildOperationalAlerts(req, startDate, endDate)
    ]);

    return {
        comparativeAnalytics: comparative,
        paymentMethodTrends: paymentTrends,
        refundTrends,
        customerCohorts,
        rebookingAnalytics: rebookingEnhancements,
        multiLocationComparisons,
        operationalAlerts
    };
}

module.exports = {
    buildAdvancedAnalytics,
    buildComparativeAnalytics,
    buildPaymentMethodTrends,
    buildRefundTrends,
    buildCustomerCohorts,
    buildRebookingAnalyticsEnhanced,
    buildMultiLocationComparisons,
    buildOperationalAlerts
};
