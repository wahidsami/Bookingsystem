/**
 * Tenant Reports Controller
 * Generates analytics and reports for the tenant dashboard
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const {
    generateReportPdfBuffer,
    generateFallbackReportPdfBuffer,
    generateEmergencyReportPdfBuffer,
    resolveUploadPath,
    sanitizeFileNamePart,
    safePlainClone
} = require('../services/tenantReportPdfService');
const {
    deliverTenantSavedReport,
    normalizeDeliveryChannels,
    normalizeExportFormats
} = require('../services/tenantReportDeliveryService');
const {
    buildAdvancedAnalytics,
    buildRebookingAnalyticsEnhanced
} = require('../services/tenantAdvancedAnalyticsService');

function getCustomerName(user) {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || user?.email || user?.phone || 'Guest Customer';
}

function resolveCustomerIdentity(user, customerId) {
    const firstName = `${user?.firstName || ''}`.trim();
    const lastName = `${user?.lastName || ''}`.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const displayName = `${user?.displayName || user?.name || user?.fullName || ''}`.trim();
    const email = `${user?.email || ''}`.trim();
    const phone = `${user?.phone || ''}`.trim();

    const identityLine = email || phone || user?.id || customerId || 'Guest Customer';

    if (fullName) {
        return {
            customerName: fullName,
            customerBadge: 'Registered Customer',
            customerBadgeKey: 'registered_customer',
            customerIdentityLine: identityLine,
            customerDisplayName: fullName,
            customerType: 'registered_customer'
        };
    }

    if (displayName) {
        return {
            customerName: displayName,
            customerBadge: 'Registered Customer',
            customerBadgeKey: 'registered_customer',
            customerIdentityLine: identityLine,
            customerDisplayName: displayName,
            customerType: 'registered_customer'
        };
    }

    if (email || phone) {
        return {
            customerName: email || phone || 'Walk-In Customer',
            customerBadge: 'Walk-In Customer',
            customerBadgeKey: 'walk_in_customer',
            customerIdentityLine: identityLine,
            customerDisplayName: 'Walk-In Customer',
            customerType: 'walk_in_customer'
        };
    }

    return {
        customerName: 'Guest Customer',
        customerBadge: 'Guest Customer',
        customerBadgeKey: 'guest_customer',
        customerIdentityLine: identityLine,
        customerDisplayName: 'Guest Customer',
        customerType: 'guest_customer'
    };
}

function getServiceName(service) {
    return service?.name_en || service?.name_ar || 'Service';
}

function getOrderLabel(order) {
    const itemNames = Array.isArray(order?.items)
        ? order.items
            .map((item) => item?.product?.name_en || item?.product?.name_ar)
            .filter(Boolean)
        : [];

    return itemNames.length
        ? itemNames.slice(0, 2).join(', ')
        : 'Product order';
}

function formatPaymentMethodLabel(paymentMethod) {
    return ({
        online: 'Online',
        cash: 'Cash',
        card_pos: 'Card',
        wallet: 'Wallet',
        bank_transfer: 'Bank transfer',
        gift_card_code: 'Gift card',
        pay_on_visit: 'Pay on visit',
        cash_on_delivery: 'Cash on delivery',
        split: 'Split payments'
    }[paymentMethod] || paymentMethod || 'Not set');
}

function normalizePaymentMethodGroup(paymentMethod) {
    const method = `${paymentMethod || ''}`.trim().toLowerCase();

    if (['cash', 'pay_on_visit', 'cash_on_delivery'].includes(method)) return 'cash';
    if (['card_pos', 'online', 'online-full', 'mock_online', 'bank_transfer'].includes(method)) return 'card';
    if (['wallet'].includes(method)) return 'wallet';
    if (['gift_card_code'].includes(method)) return 'gift_card';
    if (method === 'split') return 'split';
    return 'other';
}

function normalizeScheduleConfig(scheduleConfig = {}) {
    const cadence = `${scheduleConfig.cadence || 'daily'}`.trim().toLowerCase();
    const normalizedCadence = cadence === 'weekly' || cadence === 'monthly' ? cadence : 'daily';
    const deliveryChannels = normalizeDeliveryChannels(scheduleConfig);
    const exportFormats = normalizeExportFormats(scheduleConfig);

    return {
        enabled: Boolean(scheduleConfig.enabled),
        cadence: normalizedCadence,
        timeOfDay: `${scheduleConfig.timeOfDay || '09:00'}`.trim() || '09:00',
        dayOfWeek: Number.isInteger(scheduleConfig.dayOfWeek) ? scheduleConfig.dayOfWeek : null,
        dayOfMonth: Number.isInteger(scheduleConfig.dayOfMonth) ? scheduleConfig.dayOfMonth : null,
        recipients: Array.isArray(scheduleConfig.recipients) ? scheduleConfig.recipients.map((value) => `${value}`.trim()).filter(Boolean) : [],
        deliveryChannels,
        exportFormats,
        customIntervalMinutes: Number.isFinite(Number.parseInt(scheduleConfig.customIntervalMinutes, 10))
            ? Number.parseInt(scheduleConfig.customIntervalMinutes, 10)
            : null
    };
}

function calcNextRunAt(scheduleConfig = {}, fromDate = new Date()) {
    if (!scheduleConfig.enabled) return null;

    const cadence = `${scheduleConfig.cadence || 'daily'}`.toLowerCase();
    const timeOfDay = `${scheduleConfig.timeOfDay || '09:00'}`;
    const [hours, minutes] = timeOfDay.split(':').map((part) => parseInt(part, 10));
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);

    if (next <= fromDate) {
        if (cadence === 'weekly') {
            next.setDate(next.getDate() + 7);
        } else if (cadence === 'monthly') {
            next.setMonth(next.getMonth() + 1);
        } else if (cadence === 'custom') {
            const intervalMinutes = Number.parseInt(scheduleConfig.customIntervalMinutes, 10);
            next.setTime(next.getTime() + (Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 1440) * 60000);
        } else {
            next.setDate(next.getDate() + 1);
        }
    }

    if (cadence === 'weekly' && Number.isInteger(scheduleConfig.dayOfWeek)) {
        while (next.getDay() !== scheduleConfig.dayOfWeek) {
            next.setDate(next.getDate() + 1);
        }
    }

    if (cadence === 'monthly' && Number.isInteger(scheduleConfig.dayOfMonth)) {
        const safeDay = Math.min(Math.max(scheduleConfig.dayOfMonth, 1), 28);
        next.setDate(safeDay);
        if (next <= fromDate) {
            next.setMonth(next.getMonth() + 1);
            next.setDate(safeDay);
        }
    }

    if (cadence === 'custom') {
        const intervalMinutes = Number.parseInt(scheduleConfig.customIntervalMinutes, 10);
        if (Number.isFinite(intervalMinutes) && intervalMinutes > 0) {
            return new Date(fromDate.getTime() + intervalMinutes * 60000);
        }
    }

    return next;
}

function getRefundModeLabel(amount, referenceAmount) {
    const numericAmount = Number(amount || 0);
    const numericReference = Number(referenceAmount || 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 'Partial';
    if (!Number.isFinite(numericReference) || numericReference <= 0) return 'Partial';
    return numericAmount >= (numericReference - 0.01) ? 'Full' : 'Partial';
}

function getDateBucketKey(dateValue, groupBy = 'day') {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    if (groupBy === 'month') {
        return `${year}-${month}`;
    }

    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTrendSeriesPointDateLabel(bucketKey, groupBy = 'day') {
    if (!bucketKey) return bucketKey;
    if (groupBy === 'month') {
        return `${bucketKey}-01`;
    }
    return bucketKey;
}

function buildTimeSeriesBuckets(transactions, groupBy = 'day') {
    const buckets = new Map();

    transactions.forEach((transaction) => {
        if (transaction.status !== 'completed' && transaction.status !== 'refunded') {
            return;
        }

        const bucketKey = getDateBucketKey(transaction.processedAt || transaction.createdAt, groupBy);
        if (!bucketKey) return;

        const group = normalizePaymentMethodGroup(transaction.paymentMethod);
        const paymentMethod = group === 'split' ? 'split' : group;
        const amount = Number(transaction.amount || 0);
        const signedAmount = transaction.status === 'refunded' || transaction.type === 'refund'
            ? -Math.abs(amount)
            : Math.abs(amount);

        const mapKey = `${bucketKey}:${paymentMethod}`;
        const existing = buckets.get(mapKey) || {
            date: getTrendSeriesPointDateLabel(bucketKey, groupBy),
            paymentMethod,
            paymentMethodLabel: ({
                cash: 'Cash',
                card: 'Card',
                wallet: 'Wallet',
                gift_card: 'Gift Card',
                split: 'Split Payments',
                other: 'Other'
            }[paymentMethod] || paymentMethod),
            revenue: 0,
            transactionCount: 0
        };

        existing.revenue += signedAmount;
        existing.transactionCount += 1;
        buckets.set(mapKey, existing);
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

async function buildRebookingAnalytics(req, startDate, endDate, groupBy = 'day') {
    const tenantId = req.tenantId;
    const where = {
        [Op.or]: [
            { tenantId },
            { '$service.tenantId$': tenantId },
            { '$staff.tenantId$': tenantId }
        ],
        status: 'completed'
    };

    const dateRange = buildDateRangeWhere('startTime', startDate, endDate);
    if (dateRange.startTime) {
        where.startTime = dateRange.startTime;
    }

    const appointments = await db.Appointment.findAll({
        where,
        include: [
            ...getTenantAppointmentIncludes(),
            {
                model: db.PlatformUser,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
            }
        ],
        attributes: ['id', 'startTime', 'status', 'price', 'platformUserId', 'customerId', 'staffId', 'bookingReference', 'bookingNumber'],
        order: [['startTime', 'ASC']],
        subQuery: false
    });

    const customerHistory = new Map();
    const rebookedRows = [];
    const trendBuckets = new Map();
    const employeeBuckets = new Map();

    appointments.forEach((appointment) => {
        const customerKey = appointment.platformUserId || appointment.customerId || null;
        if (!customerKey) {
            return;
        }

        const history = customerHistory.get(customerKey) || [];
        const amount = Number(appointment.price || 0);
        const isRebooked = history.length > 0;

        if (isRebooked) {
            rebookedRows.push({
                id: appointment.id,
                date: appointment.startTime,
                customer: getCustomerName(appointment.user),
                reference: appointment.bookingReference || appointment.bookingNumber || appointment.id,
                service: getServiceName(appointment.service),
                employee: appointment.staff?.name || null,
                amount: Number(amount.toFixed(2)),
                staffId: appointment.staffId || null,
                customerId: customerKey
            });

            const bucketKey = getDateBucketKey(appointment.startTime, groupBy);
            if (bucketKey) {
                const trend = trendBuckets.get(bucketKey) || {
                    date: getTrendSeriesPointDateLabel(bucketKey, groupBy),
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
        }

        history.push({
            id: appointment.id,
            startTime: appointment.startTime,
            amount
        });
        customerHistory.set(customerKey, history);
    });

    const totalCompletedAppointments = appointments.length;
    const repeatCustomers = Array.from(customerHistory.values()).filter((history) => history.length > 1).length;
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

    return {
        rows: rebookedRows,
        totals: {
            totalCompletedAppointments,
            rebookedAppointments,
            repeatCustomers,
            rebookedRevenue: Number(rebookedRevenue.toFixed(2)),
            rebookingRate
        },
        trend,
        topRebookingEmployees
    };
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
                    attributes: ['id', 'name_en', 'name_ar'],
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

function buildTransactionReference(transaction) {
    const appointment = transaction?.appointment;
    const order = transaction?.order;
    return appointment?.bookingNumber
        || appointment?.id
        || order?.orderNumber
        || transaction?.transactionRef
        || transaction?.id;
}

function buildTransactionReferenceAmount(transaction) {
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

function mapRefundRow(transaction) {
    const appointment = transaction.appointment;
    const order = transaction.order;
    const user = appointment?.user || order?.user;
    const reference = buildTransactionReference(transaction);
    const amount = Number(transaction.amount || 0);
    const referenceAmount = buildTransactionReferenceAmount(transaction);
    const refundMode = getRefundModeLabel(amount, referenceAmount);
    const refundReason = `${transaction.notes || transaction.metadata?.reason || transaction.metadata?.refundReason || transaction.gatewayResponse?.reason || ''}`.trim() || null;

    return {
        id: transaction.id,
        date: transaction.processedAt || transaction.createdAt,
        customer: getCustomerName(user),
        reference,
        entityType: appointment ? 'appointment' : 'order',
        entityLabel: appointment ? getServiceName(appointment.service) : getOrderLabel(order),
        amount: Number(amount.toFixed(2)),
        refundReason,
        employee: transaction.processor?.name || null,
        paymentMethod: transaction.paymentMethod,
        paymentMethodLabel: formatPaymentMethodLabel(transaction.paymentMethod),
        refundMode,
        status: transaction.status,
        detailPath: appointment?.id
            ? `/dashboard/appointments/${appointment.id}`
            : order?.id
                ? `/dashboard/orders/${order.id}`
                : null
    };
}

function buildCustomerSalesRows(transactions) {
    const customers = new Map();

    transactions.forEach((transaction) => {
        const appointment = transaction.appointment;
        const order = transaction.order;
        const user = appointment?.user || order?.user;
        if (!user) return;

        const customerId = user.id || user.email || user.phone;
        const identity = resolveCustomerIdentity(user, customerId);
        const current = customers.get(customerId) || {
            id: customerId,
            name: identity.customerName,
            customerDisplayName: identity.customerDisplayName,
            customerBadge: identity.customerBadge,
            customerBadgeKey: identity.customerBadgeKey,
            customerIdentityLine: identity.customerIdentityLine,
            customerType: identity.customerType,
            totalSpent: 0,
            visits: 0,
            averageSpend: 0,
            lastVisit: null,
            firstVisit: null
        };

        const amount = Number(transaction.amount || 0);
        const isRefund = transaction.status === 'refunded' || transaction.type === 'refund';
        const delta = isRefund ? -Math.abs(amount) : Math.abs(amount);
        const visitedAt = transaction.processedAt || appointment?.startTime || order?.createdAt || transaction.createdAt;

        current.totalSpent += delta;
        if (!isRefund) {
            current.visits += 1;
            current.lastVisit = !current.lastVisit || new Date(visitedAt) > new Date(current.lastVisit) ? visitedAt : current.lastVisit;
            current.firstVisit = !current.firstVisit || new Date(visitedAt) < new Date(current.firstVisit) ? visitedAt : current.firstVisit;
        }
        current.averageSpend = current.visits > 0 ? current.totalSpent / current.visits : 0;

        customers.set(customerId, current);
    });

    return Array.from(customers.values())
        .sort((left, right) => right.totalSpent - left.totalSpent)
        .map((item) => ({
            ...item,
            customerName: item.name,
            customer: item.customerDisplayName || item.name,
            customerDisplayName: item.customerDisplayName || item.name,
            customerBadge: item.customerBadge || 'Guest Customer',
            customerBadgeKey: item.customerBadgeKey || 'guest_customer',
            customerIdentityLine: item.customerIdentityLine || item.id || 'Guest Customer',
            customerType: item.customerType || 'guest_customer',
            bookings: item.visits,
            completed: item.visits,
            revenue: item.totalSpent,
            totalSpent: Number(item.totalSpent.toFixed(2)),
            averageSpend: Number(item.averageSpend.toFixed(2))
        }));
}

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
            attributes: ['id', 'tenantId'],
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

/**
 * Get dashboard summary report
 */
exports.getDashboardSummary = async (req, res) => {
    try {
        const financialResponse = await runHandler(tenantFinancialController.getFinancialOverview, req);
        if (!financialResponse?.success || !financialResponse?.overview) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate dashboard summary'
            });
        }

        const overview = financialResponse.overview;

        res.json({
            success: true,
            data: {
                totalBookings: Number(overview.totalBookings || 0),
                completedBookings: Number(overview.completedBookings || 0),
                cancelledBookings: Number(overview.cancelledBookings || 0),
                noShowBookings: Number(overview.noShowBookings || 0),
                totalRevenue: Number(overview.totalRevenue || 0),
                paidRevenue: Number(overview.totalRevenue || 0),
                pendingRevenue: Number(overview.pendingPayments || 0),
                uniqueCustomers: Number(overview.uniqueCustomers || 0),
                completionRate: Number(overview.completionRate || 0),
                avgBookingValue: Number(overview.avgBookingValue || 0)
            }
        });

    } catch (error) {
        console.error('Get dashboard summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate dashboard summary',
            error: error.message
        });
    }
};

/**
 * Get booking trends over time
 */
exports.getBookingTrends = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate, groupBy = 'day' } = req.query;
        const fallbackStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        fallbackStart.setHours(0, 0, 0, 0);
        const fallbackEnd = new Date();
        fallbackEnd.setHours(23, 59, 59, 999);
        const start = parseDateValue(startDate, false) || fallbackStart;
        const end = parseDateValue(endDate, true) || fallbackEnd;

        const appointments = await db.Appointment.findAll({
            where: {
                ...buildTenantAppointmentScope(tenantId),
                startTime: {
                    [Op.gte]: start,
                    [Op.lte]: end
                }
            },
            include: getTenantAppointmentIncludes(),
            attributes: ['startTime', 'status', 'price', 'tenantId'],
            subQuery: false
        });

        // Group by date
        const trends = {};
        appointments.forEach(appointment => {
            let key;
            const date = new Date(appointment.startTime);
            
            if (groupBy === 'month') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else if (groupBy === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
            } else {
                key = date.toISOString().split('T')[0];
            }

            if (!trends[key]) {
                trends[key] = { date: key, bookings: 0, revenue: 0, completed: 0 };
            }
            trends[key].bookings++;
            if (appointment.status === 'completed') {
                trends[key].completed++;
                trends[key].revenue += parseFloat(appointment.price || 0);
            }
        });

        // Convert to array and sort
        const trendData = Object.values(trends).sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        res.json({
            success: true,
            data: trendData
        });

    } catch (error) {
        console.error('Get booking trends error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate booking trends',
            error: error.message
        });
    }
};

/**
 * Get service performance report
 */
exports.getServicePerformance = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;

        // Get services with their bookings
        const services = await db.Service.findAll({
            where: { tenantId },
            include: [{
                model: db.Appointment,
                as: 'appointments',
                where: buildDateRangeWhere('startTime', startDate, endDate),
                required: false,
                attributes: ['id', 'status', 'price']
            }],
            attributes: ['id', 'name_en', 'name_ar', 'category', 'finalPrice', 'duration']
        });

        const serviceStats = services.map(service => {
            const appointments = service.appointments || [];
            const completed = appointments.filter(a => a.status === 'completed');
            const revenue = completed.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
            
            return {
                id: service.id,
                name_en: service.name_en,
                name_ar: service.name_ar,
                category: service.category,
                price: service.finalPrice,
                duration: service.duration,
                totalBookings: appointments.length,
                completedBookings: completed.length,
                revenue,
                avgRevenue: completed.length > 0 ? (revenue / completed.length).toFixed(2) : 0,
                completionRate: appointments.length > 0 
                    ? ((completed.length / appointments.length) * 100).toFixed(1) 
                    : 0
            };
        }).sort((a, b) => b.revenue - a.revenue);

        res.json({
            success: true,
            data: serviceStats
        });

    } catch (error) {
        console.error('Get service performance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate service performance report',
            error: error.message
        });
    }
};

/**
 * Get employee performance report
 */
exports.getEmployeePerformance = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;

        // Get employees with their appointments
        const employees = await db.Staff.findAll({
            where: { tenantId },
            include: [{
                model: db.Appointment,
                as: 'appointments',
                where: buildDateRangeWhere('startTime', startDate, endDate),
                required: false,
                attributes: ['id', 'status', 'price', 'employeeCommission']
            }],
            attributes: ['id', 'name', 'photo', 'commissionRate', 'salary']
        });

        const employeeStats = employees.map(employee => {
            const appointments = employee.appointments || [];
            const completed = appointments.filter(a => a.status === 'completed');
            const revenue = completed.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
            const commission = completed.reduce((sum, a) => sum + parseFloat(a.employeeCommission || 0), 0);
            
            return {
                id: employee.id,
                name: employee.name,
                photo: employee.photo,
                commissionRate: employee.commissionRate,
                salary: employee.salary,
                totalBookings: appointments.length,
                completedBookings: completed.length,
                revenue,
                commission,
                avgBookingValue: completed.length > 0 ? (revenue / completed.length).toFixed(2) : 0,
                completionRate: appointments.length > 0 
                    ? ((completed.length / appointments.length) * 100).toFixed(1) 
                    : 0
            };
        }).sort((a, b) => b.revenue - a.revenue);

        res.json({
            success: true,
            data: employeeStats
        });

    } catch (error) {
        console.error('Get employee performance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate employee performance report',
            error: error.message
        });
    }
};

/**
 * Get peak hours analysis
 */
exports.getPeakHoursAnalysis = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;
        const fallbackStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        fallbackStart.setHours(0, 0, 0, 0);
        const fallbackEnd = new Date();
        fallbackEnd.setHours(23, 59, 59, 999);
        const start = parseDateValue(startDate, false) || fallbackStart;
        const end = parseDateValue(endDate, true) || fallbackEnd;

        const appointments = await db.Appointment.findAll({
            where: {
                ...buildTenantAppointmentScope(tenantId),
                startTime: {
                    [Op.gte]: start,
                    [Op.lte]: end
                }
            },
            include: getTenantAppointmentIncludes(),
            attributes: ['startTime', 'status', 'tenantId'],
            subQuery: false
        });

        // Group by hour and day of week
        const hourlyStats = Array(24).fill(0).map(() => ({ bookings: 0, completed: 0 }));
        const dailyStats = Array(7).fill(0).map(() => ({ bookings: 0, completed: 0 }));

        appointments.forEach(appointment => {
            const date = new Date(appointment.startTime);
            const hour = date.getHours();
            const day = date.getDay();

            hourlyStats[hour].bookings++;
            dailyStats[day].bookings++;

            if (appointment.status === 'completed') {
                hourlyStats[hour].completed++;
                dailyStats[day].completed++;
            }
        });

        const hourlyData = hourlyStats.map((stat, hour) => ({
            hour: `${String(hour).padStart(2, '0')}:00`,
            ...stat
        }));

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dailyData = dailyStats.map((stat, day) => ({
            day: days[day],
            dayIndex: day,
            ...stat
        }));

        // Find peak hours (top 3)
        const peakHours = [...hourlyData]
            .sort((a, b) => b.bookings - a.bookings)
            .slice(0, 3)
            .map(h => h.hour);

        // Find busiest days (top 3)
        const busiestDays = [...dailyData]
            .sort((a, b) => b.bookings - a.bookings)
            .slice(0, 3)
            .map(d => d.day);

        res.json({
            success: true,
            data: {
                hourlyData,
                dailyData,
                peakHours,
                busiestDays
            }
        });

    } catch (error) {
        console.error('Get peak hours analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate peak hours analysis',
            error: error.message
        });
    }
};

/**
 * Get customer analytics
 */
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;
        const fallbackStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        fallbackStart.setHours(0, 0, 0, 0);
        const fallbackEnd = new Date();
        fallbackEnd.setHours(23, 59, 59, 999);
        const start = parseDateValue(startDate, false) || fallbackStart;
        const end = parseDateValue(endDate, true) || fallbackEnd;

        const appointments = await db.Appointment.findAll({
            where: {
                ...buildTenantAppointmentScope(tenantId),
                startTime: {
                    [Op.gte]: start,
                    [Op.lte]: end
                },
                platformUserId: { [Op.ne]: null }
            },
            include: getTenantAppointmentIncludes(),
            attributes: ['platformUserId', 'status', 'price', 'startTime', 'tenantId'],
            subQuery: false
        });

        // Customer frequency analysis
        const customerStats = {};
        appointments.forEach(appointment => {
            const customerId = appointment.platformUserId;
            const customerName = getCustomerName(appointment.user);
            if (!customerStats[customerId]) {
                customerStats[customerId] = {
                    id: customerId,
                    name: customerName,
                    bookings: 0,
                    completed: 0,
                    revenue: 0,
                    firstVisit: appointment.startTime,
                    lastVisit: appointment.startTime
                };
            } else if (customerName && (!customerStats[customerId].name || customerStats[customerId].name === customerId)) {
                customerStats[customerId].name = customerName;
            }
            
            customerStats[customerId].bookings++;
            if (appointment.status === 'completed') {
                customerStats[customerId].completed++;
                customerStats[customerId].revenue += parseFloat(appointment.price || 0);
            }
            
            if (new Date(appointment.startTime) < new Date(customerStats[customerId].firstVisit)) {
                customerStats[customerId].firstVisit = appointment.startTime;
            }
            if (new Date(appointment.startTime) > new Date(customerStats[customerId].lastVisit)) {
                customerStats[customerId].lastVisit = appointment.startTime;
            }
        });

        const customers = Object.values(customerStats);
        const totalCustomers = customers.length;
        const newCustomers = customers.filter(c => c.bookings === 1).length;
        const returningCustomers = customers.filter(c => c.bookings > 1).length;
        
        // Customer segments by booking frequency
        const segments = {
            oneTime: customers.filter(c => c.bookings === 1).length,
            occasional: customers.filter(c => c.bookings >= 2 && c.bookings <= 3).length,
            regular: customers.filter(c => c.bookings >= 4 && c.bookings <= 6).length,
            loyal: customers.filter(c => c.bookings > 6).length
        };

        // Revenue per customer segment
        const segmentRevenue = {
            oneTime: customers.filter(c => c.bookings === 1).reduce((sum, c) => sum + c.revenue, 0),
            occasional: customers.filter(c => c.bookings >= 2 && c.bookings <= 3).reduce((sum, c) => sum + c.revenue, 0),
            regular: customers.filter(c => c.bookings >= 4 && c.bookings <= 6).reduce((sum, c) => sum + c.revenue, 0),
            loyal: customers.filter(c => c.bookings > 6).reduce((sum, c) => sum + c.revenue, 0)
        };

        // Top customers by revenue
        const topCustomers = Object.entries(customerStats)
            .map(([id, stats]) => ({
                id,
                name: stats.name || id,
                ...stats
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        res.json({
            success: true,
            data: {
                totalCustomers,
                newCustomers,
                returningCustomers,
                retentionRate: totalCustomers > 0 ? ((returningCustomers / totalCustomers) * 100).toFixed(1) : 0,
                segments,
                segmentRevenue,
                topCustomers
            }
        });

    } catch (error) {
        console.error('Get customer analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate customer analytics',
            error: error.message
        });
    }
};

const tenantFinancialController = require('./tenantFinancialController');

function runHandler(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            json(body) { resolve(body); },
            status() { return this; },
            send(body) { resolve(body); },
            end(body) { resolve(body); },
            setHeader() { return this; },
            getHeader() { return null; },
            sendStatus(statusCode) {
                resolve({ success: false, statusCode });
                return this;
            }
        };
        Promise.resolve(handler(req, res)).catch(reject);
    });
}

async function getPaymentTransactions(req, { startDate, endDate, limit = 200 } = {}) {
    const tenantId = req.tenantId;
    const where = {
        [Op.or]: [
            { '$appointment.tenantId$': tenantId },
            { '$order.tenantId$': tenantId }
        ],
        status: { [Op.in]: ['completed', 'refunded'] },
        type: { [Op.in]: ['booking', 'product_purchase', 'refund'] }
    };

    if (startDate || endDate) {
        const range = {};
        const start = parseDateValue(startDate, false);
        const end = parseDateValue(endDate, true);
        if (start) range[Op.gte] = start;
        if (end) range[Op.lte] = end;
        if (Object.keys(range).length) {
            where.processedAt = range;
        }
    }

    return db.PaymentTransaction.findAll({
        where,
        include: buildPaymentTransactionIncludes(),
        order: [['processedAt', 'DESC']],
        limit,
        subQuery: false
    });
}

async function buildRefundsReport(req, startDate, endDate) {
    const transactions = await getPaymentTransactions(req, { startDate, endDate, limit: 300 });
    const refunds = transactions
        .filter((transaction) => transaction.type === 'refund' || transaction.status === 'refunded')
        .map(mapRefundRow);

    const totalRefunds = refunds.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const fullRefunds = refunds.filter((row) => row.refundMode === 'Full').length;
    const partialRefunds = refunds.filter((row) => row.refundMode === 'Partial').length;

    return {
        refunds,
        totals: {
            totalRefunds: Number(totalRefunds.toFixed(2)),
            refundCount: refunds.length,
            fullRefundCount: fullRefunds,
            partialRefundCount: partialRefunds
        }
    };
}

async function buildPaymentMethodsReport(req, startDate, endDate, groupBy = 'day') {
    const transactions = await getPaymentTransactions(req, { startDate, endDate, limit: 400 });
    const buckets = new Map();

    transactions.forEach((transaction) => {
        if (transaction.status !== 'completed' && transaction.status !== 'refunded') {
            return;
        }

        const group = normalizePaymentMethodGroup(transaction.paymentMethod);
        const key = group === 'split' ? 'split' : group;
        const amount = Number(transaction.amount || 0);
        const isRefund = transaction.status === 'refunded' || transaction.type === 'refund';
        const signedAmount = isRefund ? -Math.abs(amount) : Math.abs(amount);

        const existing = buckets.get(key) || {
            paymentMethod: key,
            paymentMethodLabel: ({
                cash: 'Cash',
                card: 'Card',
                wallet: 'Wallet',
                gift_card: 'Gift Card',
                split: 'Split Payments',
                other: 'Other'
            }[key] || key),
            revenue: 0,
            transactionCount: 0
        };

        existing.revenue += signedAmount;
        existing.transactionCount += 1;
        buckets.set(key, existing);
    });

    const rows = Array.from(buckets.values())
        .map((row) => ({
            ...row,
            revenue: Number(row.revenue.toFixed(2))
        }))
        .sort((left, right) => right.revenue - left.revenue);

    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const totalTransactions = rows.reduce((sum, row) => sum + Number(row.transactionCount || 0), 0);
    const trend = buildTimeSeriesBuckets(transactions, groupBy);

    return {
        rows,
        trend,
        totals: {
            revenue: Number(totalRevenue.toFixed(2)),
            transactionCount: totalTransactions
        }
    };
}

async function buildFullReportData(req, sections, startDate, endDate) {
    const result = {};
    const queryWithRange = { ...req.query, startDate, endDate };
    const groupBy = typeof req.query?.groupBy === 'string' ? req.query.groupBy : 'day';
    const transactions = (sections.includes('refunds') || sections.includes('paymentMethods') || sections.includes('customerSales'))
        ? await getPaymentTransactions(req, { startDate, endDate, limit: 400 })
        : [];
    const collectSection = async (sectionName, loader) => {
        try {
            await loader();
        } catch (error) {
            console.error(`Report section "${sectionName}" failed:`, error);
        }
    };

    if (sections.includes('overview') || sections.includes('discounts')) {
        await collectSection('overview', async () => {
            const response = await runHandler(tenantFinancialController.getFinancialOverview, req);
            const overview = response?.overview || response?.data?.overview || response?.data || null;
            if (overview) {
                if (sections.includes('overview')) {
                    result.overview = overview;
                }
                if (sections.includes('discounts') && overview.discountTotals) {
                    result.discounts = overview.discountTotals;
                }
            }
        });
    }

    if (sections.includes('employees')) {
        await collectSection('employees', async () => {
            const response = await runHandler(tenantFinancialController.getEmployeeRevenue, req);
            if (response?.success) {
                result.employees = response.employees;
                result.employeeTotals = response.totals;
            }
        });
    }

    if (sections.includes('services')) {
        await collectSection('services', async () => {
            const response = await runHandler(tenantFinancialController.getServiceRevenue, req);
            if (response?.success) {
                result.services = response.services;
                result.serviceTotals = response.totals;
            }
        });
    }

    if (sections.includes('products')) {
        await collectSection('products', async () => {
            const response = await runHandler(tenantFinancialController.getProductRevenue, req);
            if (response?.success) {
                result.products = response.products;
                result.productTotals = response.totals;
            }
        });
    }

    if (sections.includes('daily')) {
        await collectSection('daily', async () => {
            const response = await runHandler(tenantFinancialController.getDailyRevenue, req);
            if (response?.success && response?.dailyRevenue) {
                result.dailyRevenue = response.dailyRevenue;
            }
        });
    }

    if (sections.includes('bookingTrends')) {
        await collectSection('bookingTrends', async () => {
            const response = await runHandler(exports.getBookingTrends, {
                ...req,
                query: { ...queryWithRange, groupBy: 'day' }
            });
            if (response?.success && response?.data) {
                result.bookingTrends = response.data;
            }
        });
    }

    if (sections.includes('servicePerformance')) {
        await collectSection('servicePerformance', async () => {
            const response = await runHandler(exports.getServicePerformance, req);
            if (response?.success && response?.data) {
                result.servicePerformance = response.data;
            }
        });
    }

    if (sections.includes('employeePerformance')) {
        await collectSection('employeePerformance', async () => {
            const response = await runHandler(exports.getEmployeePerformance, req);
            if (response?.success && response?.data) {
                result.employeePerformance = response.data;
            }
        });
    }

    if (sections.includes('peakHours')) {
        await collectSection('peakHours', async () => {
            const response = await runHandler(exports.getPeakHoursAnalysis, req);
            if (response?.success && response?.data) {
                result.peakHours = response.data;
            }
        });
    }

    if (sections.includes('customerAnalytics')) {
        await collectSection('customerAnalytics', async () => {
            const response = await runHandler(exports.getCustomerAnalytics, req);
            if (response?.success && response?.data) {
                result.customerAnalytics = response.data;
            }
        });
    }

    if (sections.includes('rebookings')) {
        await collectSection('rebookings', async () => {
            const response = await runHandler(exports.getRebookingAnalytics, {
                ...req,
                query: { ...queryWithRange, groupBy }
            });
            if (response?.success) {
                result.rebookings = {
                    rows: response.data || [],
                    totals: response.totals || null,
                    trend: response.trend || [],
                    topRebookingEmployees: response.topRebookingEmployees || []
                };
            }
        });
    }

    if (sections.includes('refunds')) {
        await collectSection('refunds', async () => {
            const refunds = transactions
                .filter((transaction) => transaction.type === 'refund' || transaction.status === 'refunded')
                .map(mapRefundRow);

            result.refunds = {
                rows: refunds,
                totals: {
                    totalRefunds: Number(refunds.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2)),
                    refundCount: refunds.length,
                    fullRefundCount: refunds.filter((row) => row.refundMode === 'Full').length,
                    partialRefundCount: refunds.filter((row) => row.refundMode === 'Partial').length
                }
            };
        });
    }

    if (sections.includes('paymentMethods')) {
        await collectSection('paymentMethods', async () => {
            const paymentMethodsReport = await buildPaymentMethodsReport(req, startDate, endDate, groupBy);
            result.paymentMethods = {
                rows: paymentMethodsReport.rows,
                trend: paymentMethodsReport.trend,
                totals: paymentMethodsReport.totals
            };
        });
    }

    if (sections.includes('customerSales')) {
        await collectSection('customerSales', async () => {
            result.customerSales = buildCustomerSalesRows(transactions);
        });
    }

    if (sections.includes('advancedAnalytics')) {
        await collectSection('advancedAnalytics', async () => {
            result.advancedAnalytics = await buildAdvancedAnalytics(req, startDate, endDate, groupBy);
        });
    }

    return result;
}

function getTenantDisplayName(tenant) {
    return tenant?.name_ar || tenant?.name_en || tenant?.name || 'Tenant';
}

const SAVED_REPORT_SECTION_IDS = new Set([
    'overview',
    'sales',
    'financial',
    'appointments',
    'rebookings',
    'employees',
    'services',
    'products',
    'discounts',
    'refunds',
    'paymentMethods',
    'customerSales',
    'advancedAnalytics'
]);

function normalizeSavedReportSections(sections, fallback = ['overview']) {
    const normalized = Array.isArray(sections)
        ? sections.map((section) => `${section}`.trim()).filter((section) => SAVED_REPORT_SECTION_IDS.has(section))
        : [];

    return normalized.length ? normalized : fallback;
}

function buildSavedReportConfigFromBody(body = {}, fallback = {}) {
    const reportType = `${body.reportType || fallback.reportType || 'overview'}`.trim();
    const datePreset = `${body.datePreset || body.reportConfig?.datePreset || fallback.datePreset || 'custom'}`.trim() || 'custom';
    const startDate = `${body.startDate || body.reportConfig?.startDate || fallback.startDate || ''}`.trim();
    const endDate = `${body.endDate || body.reportConfig?.endDate || fallback.endDate || ''}`.trim();
    const sections = normalizeSavedReportSections(body.sections || fallback.sections || []);
    const filters = body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
        ? body.filters
        : fallback.filters || {};
    const columns = Array.isArray(body.columns)
        ? body.columns.map((column) => `${column}`.trim()).filter(Boolean)
        : Array.isArray(fallback.columns)
            ? fallback.columns.map((column) => `${column}`.trim()).filter(Boolean)
            : Array.isArray(body.selectedMetrics)
                ? body.selectedMetrics.map((metric) => `${metric}`.trim()).filter(Boolean)
                : Array.isArray(fallback.selectedMetrics)
                    ? fallback.selectedMetrics
                    : [];
    const selectedMetrics = Array.isArray(body.selectedMetrics)
        ? body.selectedMetrics.map((metric) => `${metric}`.trim()).filter(Boolean)
        : Array.isArray(fallback.selectedMetrics)
            ? fallback.selectedMetrics
            : [];
    const sorting = body.sorting && typeof body.sorting === 'object' && !Array.isArray(body.sorting)
        ? body.sorting
        : fallback.sorting || {};
    const grouping = `${body.grouping || fallback.grouping || ''}`.trim() || null;
    const reportConfig = body.reportConfig && typeof body.reportConfig === 'object' && !Array.isArray(body.reportConfig)
        ? body.reportConfig
        : fallback.reportConfig || {};

    return {
        reportType,
        datePreset,
        startDate,
        endDate,
        sections,
        filters,
        columns,
        selectedMetrics,
        sorting,
        grouping,
        reportConfig: {
            ...reportConfig,
            reportType,
            datePreset,
            startDate,
            endDate,
            sections,
            filters,
            columns,
            selectedMetrics,
            sorting,
            grouping
        }
    };
}

function serializeSavedReport(savedReport) {
    if (!savedReport) return null;

    return {
        id: savedReport.id,
        tenantId: savedReport.tenantId,
        createdByUserId: savedReport.createdByUserId,
        creator: savedReport.creator ? {
            id: savedReport.creator.id,
            name: [savedReport.creator.firstName, savedReport.creator.lastName].filter(Boolean).join(' ').trim() || savedReport.creator.email || null,
            email: savedReport.creator.email || null,
            phone: savedReport.creator.phone || null
        } : null,
        reportType: savedReport.reportType,
        title: savedReport.title,
        description: savedReport.description,
        sections: Array.isArray(savedReport.sections) ? savedReport.sections : [],
        filters: savedReport.filters || {},
        columns: Array.isArray(savedReport.columns) ? savedReport.columns : Array.isArray(savedReport.selectedMetrics) ? savedReport.selectedMetrics : [],
        selectedMetrics: Array.isArray(savedReport.selectedMetrics) ? savedReport.selectedMetrics : [],
        grouping: savedReport.grouping || null,
        sorting: savedReport.sorting || {},
        reportConfig: savedReport.reportConfig || {},
        scheduleConfig: savedReport.scheduleConfig || {},
        isFavorite: Boolean(savedReport.isFavorite),
        duplicatedFromId: savedReport.duplicatedFromId || null,
        lastOpenedAt: savedReport.lastOpenedAt || null,
        lastRunAt: savedReport.lastRunAt || null,
        nextRunAt: savedReport.nextRunAt || null,
        lastRunResult: savedReport.lastRunResult || {},
        runHistory: Array.isArray(savedReport.runHistory) ? savedReport.runHistory : [],
        createdAt: savedReport.createdAt,
        updatedAt: savedReport.updatedAt
    };
}

function appendRunHistory(savedReport, preview, runType = 'manual', delivery = null) {
    const history = Array.isArray(savedReport.runHistory) ? savedReport.runHistory : [];
    history.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        runType,
        ranAt: new Date().toISOString(),
        rows: preview?.totals?.rows || 0,
        recordCount: preview?.totals?.recordCount || 0,
        summary: preview?.summary || {},
        delivery: delivery || null
    });
    savedReport.runHistory = history.slice(0, 20);
}

async function runTenantSavedReport(savedReport, runType = 'manual', deliveryOptions = null) {
    const config = savedReport.reportConfig || {};
    const sections = Array.isArray(savedReport.sections) && savedReport.sections.length
        ? savedReport.sections
        : Array.isArray(config.sections) && config.sections.length
            ? config.sections
            : ['overview'];
    const startDate = config.startDate || savedReport.filters?.startDate || null;
    const endDate = config.endDate || savedReport.filters?.endDate || null;

    const preview = await buildFullReportData({
        tenantId: savedReport.tenantId,
        userId: savedReport.createdByUserId,
        query: { startDate, endDate },
        tenant: null
    }, sections, startDate, endDate);

    const nextRunAt = savedReport.scheduleConfig?.enabled ? calcNextRunAt(savedReport.scheduleConfig, new Date()) : null;
    let delivery = null;

    if (deliveryOptions?.deliver) {
        delivery = await deliverTenantSavedReport(savedReport, preview, deliveryOptions);
    }

    savedReport.lastRunAt = new Date();
    savedReport.lastRunResult = {
        ...safePlainClone(preview),
        delivery
    };
    appendRunHistory(savedReport, preview, runType, delivery);
    savedReport.nextRunAt = nextRunAt;
    await savedReport.save();

    return { preview, delivery };
}

async function findTenantSavedReport(tenantId, reportId) {
    return db.TenantSavedReport.findOne({
        where: {
            id: reportId,
            tenantId
        },
        include: [
            {
                model: db.PlatformUser,
                as: 'creator',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
            }
        ]
    });
}

exports.getFullReport = async (req, res) => {
    try {
        const { startDate, endDate, sections: sectionsParam } = req.query;
        const sections = typeof sectionsParam === 'string'
            ? sectionsParam.split(',').map(section => section.trim()).filter(Boolean)
            : Array.isArray(sectionsParam)
                ? sectionsParam.filter(Boolean)
                : [];

        if (sections.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one section required'
            });
        }

        const result = await buildFullReportData(req, sections, startDate, endDate);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Get full report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate full report',
            error: error.message
        });
    }
};

exports.getRefundsReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await buildRefundsReport(req, startDate, endDate);

        res.json({
            success: true,
            data: report.refunds,
            totals: report.totals
        });
    } catch (error) {
        console.error('Get refunds report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate refunds report',
            error: error.message
        });
    }
};

exports.getRebookingAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, groupBy } = req.query;
        const report = await buildRebookingAnalytics(req, startDate, endDate, groupBy);

        res.json({
            success: true,
            data: report.rows,
            totals: report.totals,
            trend: report.trend,
            topRebookingEmployees: report.topRebookingEmployees
        });
    } catch (error) {
        console.error('Get rebooking analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate rebooking analytics',
            error: error.message
        });
    }
};

exports.getPaymentMethodsReport = async (req, res) => {
    try {
        const { startDate, endDate, groupBy } = req.query;
        const report = await buildPaymentMethodsReport(req, startDate, endDate, groupBy);

        res.json({
            success: true,
            data: report.rows,
            totals: report.totals,
            trend: report.trend
        });
    } catch (error) {
        console.error('Get payment methods report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate payment methods report',
            error: error.message
        });
    }
};

exports.getAdvancedAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, groupBy } = req.query;
        const report = await buildAdvancedAnalytics(req, startDate, endDate, groupBy);

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Get advanced analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate advanced analytics',
            error: error.message
        });
    }
};

exports.getReportBuilderOptions = async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                reportTypes: Array.from(SAVED_REPORT_SECTION_IDS).map((value) => ({ id: value, label: value })),
                groupings: ['day', 'week', 'month', 'year', 'type', 'category', 'item', 'teamMember', 'customer'],
                datePresets: ['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'last_week', 'last_month', 'last_3_months', 'last_6_months', 'custom'],
                scheduleCadences: ['daily', 'weekly', 'monthly'],
                deliveryChannels: ['email', 'dashboard_inbox'],
                exportFormats: ['csv', 'xlsx', 'pdf'],
                datasets: [
                    { id: 'sales', label: 'Sales' },
                    { id: 'financial', label: 'Financial' },
                    { id: 'appointments', label: 'Appointments' },
                    { id: 'rebookings', label: 'Rebookings' },
                    { id: 'employees', label: 'Employees' },
                    { id: 'services', label: 'Services' },
                    { id: 'products', label: 'Products' },
                    { id: 'discounts', label: 'Discounts' },
                    { id: 'refunds', label: 'Refunds' },
                    { id: 'paymentMethods', label: 'Payment methods' },
                    { id: 'customerSales', label: 'Customer sales' }
                ]
            }
        });
    } catch (error) {
        console.error('Get report builder options error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load report builder options',
            error: error.message
        });
    }
};

exports.getSavedReports = async (req, res) => {
    try {
        const savedReports = await db.TenantSavedReport.findAll({
            where: {
                tenantId: req.tenantId
            },
            include: [
                {
                    model: db.PlatformUser,
                    as: 'creator',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                }
            ],
            order: [
                ['isFavorite', 'DESC'],
                ['updatedAt', 'DESC'],
                ['createdAt', 'DESC']
            ]
        });

        res.json({
            success: true,
            data: savedReports.map(serializeSavedReport)
        });
    } catch (error) {
        console.error('Get saved reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load saved reports',
            error: error.message
        });
    }
};

exports.runSavedReport = async (req, res) => {
    try {
        const savedReport = await findTenantSavedReport(req.tenantId, req.params.id);
        if (!savedReport) {
            return res.status(404).json({
                success: false,
                message: 'Saved report not found'
            });
        }

        const { preview } = await runTenantSavedReport(savedReport, 'manual');
        res.json({
            success: true,
            data: {
                report: serializeSavedReport(savedReport),
                preview
            }
        });
    } catch (error) {
        console.error('Run saved report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to run saved report',
            error: error.message
        });
    }
};

exports.previewSavedReport = async (req, res) => {
    try {
        const savedReport = await findTenantSavedReport(req.tenantId, req.params.id);
        if (!savedReport) {
            return res.status(404).json({
                success: false,
                message: 'Saved report not found'
            });
        }

        const sections = Array.isArray(savedReport.sections) && savedReport.sections.length
            ? savedReport.sections
            : ['overview'];
        const startDate = savedReport.reportConfig?.startDate || savedReport.filters?.startDate || null;
        const endDate = savedReport.reportConfig?.endDate || savedReport.filters?.endDate || null;
        const preview = await buildFullReportData({
            tenantId: req.tenantId,
            userId: req.userId,
            query: { startDate, endDate },
            tenant: null
        }, sections, startDate, endDate);

        res.json({
            success: true,
            data: preview
        });
    } catch (error) {
        console.error('Preview saved report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to preview saved report',
            error: error.message
        });
    }
};

exports.deliverSavedReport = async (req, res) => {
    try {
        const savedReport = await findTenantSavedReport(req.tenantId, req.params.id);
        if (!savedReport) {
            return res.status(404).json({
                success: false,
                message: 'Saved report not found'
            });
        }

        const { preview, delivery } = await runTenantSavedReport(savedReport, 'manual_delivery', {
            deliver: true,
            recipientId: req.userId || savedReport.createdByUserId || null
        });

        res.json({
            success: true,
            data: {
                report: serializeSavedReport(savedReport),
                preview,
                delivery
            }
        });
    } catch (error) {
        console.error('Deliver saved report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deliver saved report',
            error: error.message
        });
    }
};

exports.getSavedReportHistory = async (req, res) => {
    try {
        const savedReport = await findTenantSavedReport(req.tenantId, req.params.id);
        if (!savedReport) {
            return res.status(404).json({
                success: false,
                message: 'Saved report not found'
            });
        }

        res.json({
            success: true,
            data: Array.isArray(savedReport.runHistory) ? savedReport.runHistory : []
        });
    } catch (error) {
        console.error('Get saved report history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load saved report history',
            error: error.message
        });
    }
};

exports.getSavedReport = async (req, res) => {
    try {
        const savedReport = await findTenantSavedReport(req.tenantId, req.params.id);

        if (!savedReport) {
            return res.status(404).json({
                success: false,
                message: 'Saved report not found'
            });
        }

        res.json({
            success: true,
            data: serializeSavedReport(savedReport)
        });
    } catch (error) {
        console.error('Get saved report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load saved report',
            error: error.message
        });
    }
};

exports.createSavedReport = async (req, res) => {
    try {
        const duplicatedFromId = req.body?.duplicatedFromId || null;
        let fallback = {};

        if (duplicatedFromId) {
            const source = await findTenantSavedReport(req.tenantId, duplicatedFromId);
            if (!source) {
                return res.status(404).json({
                    success: false,
                    message: 'Source report not found'
                });
            }

            fallback = {
                reportType: source.reportType,
                title: `${source.title} Copy`,
                description: source.description,
                sections: source.sections,
                filters: source.filters,
                columns: source.columns,
                selectedMetrics: source.selectedMetrics,
                grouping: source.grouping,
                sorting: source.sorting,
                reportConfig: source.reportConfig,
                scheduleConfig: source.scheduleConfig
            };
        }

        const normalized = buildSavedReportConfigFromBody(req.body || {}, fallback);
        const title = `${req.body?.title || fallback.title || ''}`.trim();

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'title is required'
            });
        }

        const savedReport = await db.TenantSavedReport.create({
            tenantId: req.tenantId,
            createdByUserId: req.userId || null,
            reportType: normalized.reportType,
            title,
            description: req.body?.description ?? fallback.description ?? null,
            sections: normalized.sections,
            filters: normalized.filters,
            columns: normalized.columns,
            selectedMetrics: normalized.selectedMetrics,
            grouping: normalized.grouping,
            sorting: normalized.sorting,
            reportConfig: normalized.reportConfig,
            scheduleConfig: normalizeScheduleConfig(req.body?.scheduleConfig || fallback.scheduleConfig || {}),
            isFavorite: Boolean(req.body?.isFavorite ?? fallback.isFavorite ?? false),
            duplicatedFromId,
            nextRunAt: calcNextRunAt(normalizeScheduleConfig(req.body?.scheduleConfig || fallback.scheduleConfig || {}), new Date())
        });

        const withCreator = await findTenantSavedReport(req.tenantId, savedReport.id);
        res.status(201).json({
            success: true,
            data: serializeSavedReport(withCreator || savedReport)
        });
    } catch (error) {
        console.error('Create saved report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save report',
            error: error.message
        });
    }
};

exports.updateSavedReport = async (req, res) => {
    try {
        const savedReport = await findTenantSavedReport(req.tenantId, req.params.id);
        if (!savedReport) {
            return res.status(404).json({
                success: false,
                message: 'Saved report not found'
            });
        }

        const normalized = buildSavedReportConfigFromBody(req.body || {}, savedReport.get({ plain: true }));

        savedReport.title = req.body?.title?.trim?.() ? `${req.body.title}`.trim() : savedReport.title;
        if (typeof req.body?.description === 'string') {
            savedReport.description = req.body.description.trim() || null;
        }
        savedReport.sections = normalized.sections;
        savedReport.filters = normalized.filters;
        savedReport.columns = normalized.columns;
        savedReport.selectedMetrics = normalized.selectedMetrics;
        savedReport.grouping = normalized.grouping;
        savedReport.sorting = normalized.sorting;
        savedReport.reportConfig = normalized.reportConfig;
        savedReport.scheduleConfig = normalizeScheduleConfig(req.body?.scheduleConfig || savedReport.scheduleConfig || {});
        if (req.body?.isFavorite !== undefined) savedReport.isFavorite = Boolean(req.body.isFavorite);
        if (req.body?.lastOpenedAt !== undefined) {
            const parsed = req.body.lastOpenedAt ? new Date(req.body.lastOpenedAt) : null;
            savedReport.lastOpenedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
        }
        savedReport.nextRunAt = savedReport.scheduleConfig?.enabled
            ? calcNextRunAt(savedReport.scheduleConfig, new Date())
            : null;

        await savedReport.save();

        const withCreator = await findTenantSavedReport(req.tenantId, savedReport.id);
        res.json({
            success: true,
            data: serializeSavedReport(withCreator || savedReport)
        });
    } catch (error) {
        console.error('Update saved report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update saved report',
            error: error.message
        });
    }
};

exports.deleteSavedReport = async (req, res) => {
    try {
        const deletedCount = await db.TenantSavedReport.destroy({
            where: {
                id: req.params.id,
                tenantId: req.tenantId
            }
        });

        if (!deletedCount) {
            return res.status(404).json({
                success: false,
                message: 'Saved report not found'
            });
        }

        res.json({
            success: true,
            message: 'Saved report deleted'
        });
    } catch (error) {
        console.error('Delete saved report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete saved report',
            error: error.message
        });
    }
};

exports.downloadReportPdf = async (req, res) => {
    const tenantId = req.tenantId;
    const { startDate, endDate, sections: sectionsParam, title } = req.query;
    const sections = typeof sectionsParam === 'string'
        ? sectionsParam.split(',').map((section) => section.trim()).filter(Boolean)
        : [];

    try {
        if (!startDate || !endDate || sections.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'startDate, endDate, and sections are required'
            });
        }

        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['id', 'name', 'name_en', 'name_ar', 'logo']
        });

        const data = safePlainClone(await buildFullReportData(req, sections, startDate, endDate));
        const tenantName = getTenantDisplayName(tenant);
        const tenantLogoPath = resolveUploadPath(tenant?.logo);
        const generatedAt = new Date().toISOString();

        const buffer = await generateReportPdfBuffer({
            tenantName,
            reportTitle: title ? `${title}` : 'Refah Report',
            startDate,
            endDate,
            generatedAt,
            tenantLogoPath,
            data
        });

        const fileName = `${sanitizeFileNamePart(title || 'report')}-${sanitizeFileNamePart(tenantName, 'tenant')}-${startDate}-${endDate}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
    } catch (error) {
        console.error('Download report PDF error:', error);
        try {
            const tenant = await db.Tenant.findByPk(tenantId, {
                attributes: ['id', 'name', 'name_en', 'name_ar', 'logo']
            });
            const tenantName = getTenantDisplayName(tenant);
            const fallbackBuffer = await generateFallbackReportPdfBuffer({
                tenantName,
                reportTitle: title ? `${title}` : 'Refah Report',
                startDate,
                endDate,
                generatedAt: new Date().toISOString(),
                errorMessage: error.message,
                sections
            });
            const fileName = `${sanitizeFileNamePart(title || 'report')}-${sanitizeFileNamePart(tenantName, 'tenant')}-${startDate}-${endDate}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', fallbackBuffer.length);
            return res.send(fallbackBuffer);
        } catch (fallbackError) {
            console.error('Fallback report PDF generation failed:', fallbackError);
            try {
                const tenant = await db.Tenant.findByPk(tenantId, {
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'logo']
                });
                const tenantName = getTenantDisplayName(tenant);
                const emergencyBuffer = await generateEmergencyReportPdfBuffer({
                    tenantName,
                    reportTitle: title ? `${title}` : 'Refah Report',
                    startDate,
                    endDate,
                    generatedAt: new Date().toISOString(),
                    errorMessage: fallbackError.message || error.message,
                    sections
                });
                const fileName = `${sanitizeFileNamePart(title || 'report')}-${sanitizeFileNamePart(tenantName, 'tenant')}-${startDate}-${endDate}.pdf`;
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                res.setHeader('Content-Length', emergencyBuffer.length);
                return res.send(emergencyBuffer);
            } catch (emergencyError) {
                console.error('Emergency report PDF generation failed:', emergencyError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to generate report PDF',
                    error: emergencyError.message || fallbackError.message || error.message
                });
            }
        }
    }
};

