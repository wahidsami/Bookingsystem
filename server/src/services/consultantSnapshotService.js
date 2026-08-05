const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');

const DEFAULT_CURRENCY = 'SAR';
const DEFAULT_WORKDAY_HOURS = 8;
const REVENUE_APPOINTMENT_STATUSES = new Set(['completed', 'confirmed']);
const REVENUE_ORDER_STATUSES = new Set(['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed']);
const PAID_PAYROLL_STATUSES = new Set(['paid', 'processed']);

const toNumber = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const buildStableHash = (value) => crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');

const toDate = (value) => (value ? new Date(value) : new Date());

const startOfUtcDay = (date) => new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
));

const endOfUtcDay = (date) => new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999
));

const addUtcDays = (date, days) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};

const addUtcMonths = (date, months) => {
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth() + months);
    return next;
};

const resolvePeriodWindow = (periodType = 'daily', referenceDate = new Date()) => {
    const anchor = toDate(referenceDate);
    const dayStart = startOfUtcDay(anchor);

    if (periodType === 'weekly') {
        const dayIndex = dayStart.getUTCDay();
        const mondayOffset = (dayIndex + 6) % 7;
        const start = addUtcDays(dayStart, -mondayOffset);
        return {
            periodType: 'weekly',
            periodStart: start,
            periodEnd: endOfUtcDay(addUtcDays(start, 6))
        };
    }

    if (periodType === 'monthly') {
        const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
        const end = endOfUtcDay(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)));
        return {
            periodType: 'monthly',
            periodStart: start,
            periodEnd: end
        };
    }

    return {
        periodType: 'daily',
        periodStart: dayStart,
        periodEnd: endOfUtcDay(dayStart)
    };
};

const resolvePreviousWindow = (window) => {
    if (window.periodType === 'weekly') {
        const start = addUtcDays(window.periodStart, -7);
        return {
            periodType: 'weekly',
            periodStart: start,
            periodEnd: endOfUtcDay(addUtcDays(start, 6))
        };
    }

    if (window.periodType === 'monthly') {
        const start = new Date(Date.UTC(window.periodStart.getUTCFullYear(), window.periodStart.getUTCMonth() - 1, 1));
        return {
            periodType: 'monthly',
            periodStart: start,
            periodEnd: endOfUtcDay(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)))
        };
    }

    const start = addUtcDays(window.periodStart, -1);
    return {
        periodType: 'daily',
        periodStart: start,
        periodEnd: endOfUtcDay(start)
    };
};

const buildDateRangeWhere = (column, window) => ({
    [column]: {
        [Op.between]: [window.periodStart, window.periodEnd]
    }
});

const buildTenantAppointmentScope = (tenantId) => ({
    [Op.or]: [
        { tenantId },
        { '$service.tenantId$': tenantId },
        { '$staff.tenantId$': tenantId }
    ]
});

const getCustomerDisplayName = (user, legacyCustomer) => {
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;

    const displayName = `${user?.displayName || user?.name || user?.fullName || ''}`.trim();
    if (displayName) return displayName;

    const legacyName = `${legacyCustomer?.name || ''}`.trim();
    if (legacyName) return legacyName;

    return `${user?.email || legacyCustomer?.phone || user?.phone || ''}`.trim() || 'Guest Customer';
};

const getCustomerIdentityLine = (user, legacyCustomer, fallbackId) => (
    `${user?.email || legacyCustomer?.email || user?.phone || legacyCustomer?.phone || fallbackId || 'Guest Customer'}`
);

const resolveCustomerIdentity = (user, legacyCustomer, fallbackId) => {
    const customerName = getCustomerDisplayName(user, legacyCustomer);
    const email = `${user?.email || legacyCustomer?.email || ''}`.trim();
    const phone = `${user?.phone || legacyCustomer?.phone || ''}`.trim();

    if (customerName && customerName !== 'Guest Customer') {
        const hasRealName = Boolean([user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.displayName || user?.name || user?.fullName || legacyCustomer?.name);
        return {
            customerName,
            customerBadge: hasRealName ? 'Registered Customer' : 'Walk-In Customer',
            customerBadgeKey: hasRealName ? 'registered_customer' : 'walk_in_customer',
            customerIdentityLine: getCustomerIdentityLine(user, legacyCustomer, fallbackId),
            customerDisplayName: customerName,
            customerType: hasRealName ? 'registered_customer' : 'walk_in_customer'
        };
    }

    return {
        customerName: 'Guest Customer',
        customerBadge: 'Guest Customer',
        customerBadgeKey: 'guest_customer',
        customerIdentityLine: getCustomerIdentityLine(user, legacyCustomer, fallbackId),
        customerDisplayName: 'Guest Customer',
        customerType: 'guest_customer'
    };
};

const getAppointmentDiscountAmount = (appointment) => {
    const serviceRawPrice = toNumber(appointment?.service?.rawPrice ?? 0);
    const discountedRawPrice = toNumber(appointment?.rawPrice ?? 0);
    const discountAmount = serviceRawPrice - discountedRawPrice;
    return Number.isFinite(discountAmount) && discountAmount > 0 ? discountAmount : 0;
};

const getOrderDiscountAmount = (order) => {
    const subtotal = toNumber(order?.subtotal ?? 0);
    const taxAmount = toNumber(order?.taxAmount ?? 0);
    const shippingFee = toNumber(order?.shippingFee ?? 0);
    const totalAmount = toNumber(order?.totalAmount ?? 0);
    const baseAmount = subtotal + taxAmount + shippingFee;
    const discountAmount = baseAmount - totalAmount;
    return Number.isFinite(discountAmount) && discountAmount > 0 ? discountAmount : 0;
};

const buildPercentChange = (currentValue, previousValue) => {
    const current = toNumber(currentValue);
    const previous = toNumber(previousValue);
    const delta = current - previous;
    const percentage = previous === 0 ? (current === 0 ? 0 : 100) : (delta / Math.abs(previous)) * 100;

    return {
        current: Number(current.toFixed(2)),
        previous: Number(previous.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        percentage: Number(percentage.toFixed(1)),
        direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    };
};

const isRevenueAppointment = (appointment) => REVENUE_APPOINTMENT_STATUSES.has(`${appointment?.status || ''}`.toLowerCase());

const isRevenueOrder = (order) => REVENUE_ORDER_STATUSES.has(`${order?.status || ''}`.toLowerCase());

const normalizeProductKey = (item) => item?.productId || item?.productSku || item?.productName || item?.productNameAr || 'product';

async function loadTenantSnapshotInputs(tenantId, window, includeHistory = false) {
    const appointmentWhere = {
        ...buildTenantAppointmentScope(tenantId)
    };

    const currentWindowScope = buildDateRangeWhere('startTime', window);
    appointmentWhere.startTime = currentWindowScope.startTime;

    const orderWhere = {
        tenantId,
        ...buildDateRangeWhere('createdAt', window),
        status: { [Op.in]: Array.from(REVENUE_ORDER_STATUSES) }
    };

    const transactionWhere = {
        ...buildDateRangeWhere('processedAt', window),
        status: { [Op.in]: ['completed', 'refunded'] }
    };

    const historyAppointmentWhere = {
        ...buildTenantAppointmentScope(tenantId)
    };
    const historyOrderWhere = { tenantId };

    const [appointments, orders, transactions, staff, payrolls, historyAppointments, historyOrders] = await Promise.all([
        db.Appointment.findAll({
            where: appointmentWhere,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'tenantId', 'name_en', 'name_ar', 'rawPrice'],
                    required: false
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'tenantId', 'name', 'commissionRate', 'isActive'],
                    required: false
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                },
                {
                    model: db.Customer,
                    as: 'legacyCustomer',
                    attributes: ['id', 'name', 'email', 'phone'],
                    required: false
                }
            ],
            attributes: [
                'id',
                'platformUserId',
                'customerId',
                'serviceId',
                'staffId',
                'price',
                'rawPrice',
                'taxAmount',
                'tenantRevenue',
                'employeeCommission',
                'paymentStatus',
                'paymentMethod',
                'status',
                'startTime',
                'endTime',
                'bookingNumber',
                'bookingReference'
            ],
            order: [['startTime', 'ASC']],
            subQuery: false
        }),
        db.Order.findAll({
            where: orderWhere,
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
                    attributes: ['id', 'productId', 'productName', 'productNameAr', 'quantity', 'unitPrice', 'totalPrice', 'productSku'],
                    required: false,
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar', 'sku'],
                            required: false
                        }
                    ]
                }
            ],
            attributes: [
                'id',
                'tenantId',
                'platformUserId',
                'orderNumber',
                'status',
                'paymentStatus',
                'subtotal',
                'taxAmount',
                'shippingFee',
                'platformFee',
                'totalAmount',
                'createdAt'
            ],
            order: [['createdAt', 'ASC']],
            subQuery: false
        }),
        db.PaymentTransaction.findAll({
            where: transactionWhere,
            include: [
                {
                    model: db.Appointment,
                    as: 'appointment',
                    attributes: ['id', 'tenantId', 'platformUserId', 'customerId', 'status', 'price', 'bookingNumber'],
                    required: false,
                    include: [
                        {
                            model: db.PlatformUser,
                            as: 'user',
                            attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                            required: false
                        },
                        {
                            model: db.Customer,
                            as: 'legacyCustomer',
                            attributes: ['id', 'name', 'email', 'phone'],
                            required: false
                        }
                    ]
                },
                {
                    model: db.Order,
                    as: 'order',
                    attributes: ['id', 'tenantId', 'platformUserId', 'orderNumber', 'status', 'totalAmount'],
                    required: false,
                    include: [
                        {
                            model: db.PlatformUser,
                            as: 'user',
                            attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                            required: false
                        }
                    ]
                }
            ],
            attributes: ['id', 'appointmentId', 'orderId', 'amount', 'paymentMethod', 'status', 'type', 'processedAt', 'createdAt'],
            order: [['processedAt', 'ASC']],
            subQuery: false
        }),
        db.Staff.findAll({
            where: { tenantId },
            attributes: ['id', 'tenantId', 'name', 'commissionRate', 'isActive'],
            order: [['name', 'ASC']],
            subQuery: false
        }),
        db.StaffPayroll.findAll({
            where: {
                tenantId,
                [Op.or]: [
                    { periodStart: { [Op.between]: [window.periodStart, window.periodEnd] } },
                    { paidAt: { [Op.between]: [window.periodStart, window.periodEnd] } }
                ]
            },
            attributes: ['id', 'staffId', 'commission', 'status', 'paidAt', 'periodStart', 'periodEnd'],
            order: [['periodStart', 'ASC']],
            subQuery: false
        }).catch(() => []),
        includeHistory ? db.Appointment.findAll({
            where: historyAppointmentWhere,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'tenantId', 'name_en', 'name_ar', 'rawPrice'],
                    required: false
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'tenantId', 'name', 'commissionRate', 'isActive'],
                    required: false
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                },
                {
                    model: db.Customer,
                    as: 'legacyCustomer',
                    attributes: ['id', 'name', 'email', 'phone'],
                    required: false
                }
            ],
            attributes: ['id', 'platformUserId', 'customerId', 'startTime', 'status'],
            order: [['startTime', 'ASC']],
            subQuery: false
        }) : Promise.resolve([]),
        includeHistory ? db.Order.findAll({
            where: historyOrderWhere,
            include: [
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                    required: false
                }
            ],
            attributes: ['id', 'platformUserId', 'orderNumber', 'createdAt', 'status', 'totalAmount'],
            order: [['createdAt', 'ASC']],
            subQuery: false
        }) : Promise.resolve([])
    ]);

    return {
        appointments,
        orders,
        transactions: transactions.filter((transaction) => (
            transaction?.appointment?.tenantId === tenantId
            || transaction?.order?.tenantId === tenantId
        )),
        staff,
        payrolls,
        historyAppointments,
        historyOrders
    };
}

function buildCustomerAnalytics(historyAppointments = [], historyOrders = [], window) {
    const activity = new Map();

    const touch = (customerKey, activityDate, payload = {}) => {
        if (!customerKey) return;

        const date = new Date(activityDate);
        if (Number.isNaN(date.getTime())) return;

        const existing = activity.get(customerKey) || {
            firstSeenAt: date,
            lastSeenAt: date,
            activeInWindow: false,
            profile: payload.profile || null
        };

        if (date < existing.firstSeenAt) existing.firstSeenAt = date;
        if (date > existing.lastSeenAt) existing.lastSeenAt = date;
        if (date >= window.periodStart && date <= window.periodEnd) existing.activeInWindow = true;
        if (!existing.profile && payload.profile) existing.profile = payload.profile;

        activity.set(customerKey, existing);
    };

    historyAppointments.forEach((appointment) => {
        const customerKey = appointment.platformUserId || appointment.customerId || null;
        const identity = resolveCustomerIdentity(appointment.user, appointment.legacyCustomer, customerKey);
        touch(customerKey, appointment.startTime || appointment.createdAt, { profile: identity });
    });

    historyOrders.forEach((order) => {
        const customerKey = order.platformUserId || null;
        const identity = resolveCustomerIdentity(order.user, null, customerKey);
        touch(customerKey, order.createdAt, { profile: identity });
    });

    let activeCustomers = 0;
    let newCustomers = 0;
    let returningCustomers = 0;
    let inactiveCustomers = 0;

    activity.forEach((entry) => {
        if (entry.activeInWindow) {
            activeCustomers += 1;
            if (entry.firstSeenAt >= window.periodStart && entry.firstSeenAt <= window.periodEnd) {
                newCustomers += 1;
            } else {
                returningCustomers += 1;
            }
        } else if (entry.lastSeenAt < window.periodStart) {
            inactiveCustomers += 1;
        }
    });

    return {
        activeCustomers,
        newCustomers,
        returningCustomers,
        inactiveCustomers,
        retentionRate: activeCustomers > 0 ? Number(((returningCustomers / activeCustomers) * 100).toFixed(1)) : 0
    };
}

function buildFinancialAnalytics(appointments = [], orders = [], transactions = [], previous = {}) {
    let grossRevenue = 0;
    let appointmentDiscounts = 0;
    let orderDiscounts = 0;
    let refunds = 0;

    appointments.forEach((appointment) => {
        if (!isRevenueAppointment(appointment)) return;
        grossRevenue += toNumber(appointment.price ?? 0);
        appointmentDiscounts += getAppointmentDiscountAmount(appointment);
    });

    orders.forEach((order) => {
        if (!isRevenueOrder(order)) return;
        grossRevenue += toNumber(order.totalAmount ?? 0);
        orderDiscounts += getOrderDiscountAmount(order);
    });

    transactions.forEach((transaction) => {
        const isRefund = `${transaction.type || ''}`.toLowerCase() === 'refund' || `${transaction.status || ''}`.toLowerCase() === 'refunded';
        if (isRefund) {
            refunds += Math.abs(toNumber(transaction.amount || 0));
        }
    });

    const netRevenue = Math.max(grossRevenue - refunds, 0);
    const previousNetRevenue = Math.max(toNumber(previous.grossRevenue || 0) - toNumber(previous.refunds || 0), 0);

    return {
        revenue: {
            gross: Number(grossRevenue.toFixed(2)),
            net: Number(netRevenue.toFixed(2)),
            growth: buildPercentChange(netRevenue, previousNetRevenue)
        },
        discounts: {
            total: Number((appointmentDiscounts + orderDiscounts).toFixed(2)),
            appointment: Number(appointmentDiscounts.toFixed(2)),
            order: Number(orderDiscounts.toFixed(2))
        },
        refunds: {
            total: Number(refunds.toFixed(2)),
            count: transactions.filter((transaction) => {
                const isRefund = `${transaction.type || ''}`.toLowerCase() === 'refund' || `${transaction.status || ''}`.toLowerCase() === 'refunded';
                return isRefund;
            }).length
        }
    };
}

function buildOperationsAnalytics(appointments = [], staff = [], periodDays = 1) {
    let noShows = 0;
    let cancellations = 0;
    let bookedMinutes = 0;

    appointments.forEach((appointment) => {
        const status = `${appointment.status || ''}`.toLowerCase();
        if (status === 'no_show') noShows += 1;
        if (status === 'cancelled') cancellations += 1;

        if (!['cancelled', 'no_show'].includes(status)) {
            const start = appointment.startTime ? new Date(appointment.startTime) : null;
            const end = appointment.endTime ? new Date(appointment.endTime) : null;
            if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
                bookedMinutes += Math.max((end - start) / 60000, 0);
            }
        }
    });

    const activeStaffCount = staff.filter((item) => item.isActive !== false).length;
    const capacityMinutes = Math.max(activeStaffCount, 1) * Math.max(periodDays, 1) * DEFAULT_WORKDAY_HOURS * 60;
    const occupancyRate = capacityMinutes > 0 ? Number(((bookedMinutes / capacityMinutes) * 100).toFixed(1)) : 0;

    return {
        noShows,
        cancellations,
        bookedMinutes: Number(bookedMinutes.toFixed(2)),
        capacityMinutes,
        occupancyRate
    };
}

function buildEmployeeAnalytics(appointments = [], payrolls = []) {
    const rows = new Map();

    appointments.forEach((appointment) => {
        const staffId = appointment.staffId || appointment.staff?.id || null;
        if (!staffId) return;

        const existing = rows.get(staffId) || {
            id: staffId,
            name: appointment.staff?.name || 'Staff',
            revenue: 0,
            bookings: 0,
            completed: 0,
            commissionEarned: 0,
            commissionPaid: 0
        };

        existing.name = appointment.staff?.name || existing.name;
        existing.bookings += 1;
        existing.revenue += isRevenueAppointment(appointment) ? toNumber(appointment.price ?? 0) : 0;
        existing.completed += `${appointment.status || ''}`.toLowerCase() === 'completed' ? 1 : 0;
        existing.commissionEarned += toNumber(appointment.employeeCommission || 0);
        rows.set(staffId, existing);
    });

    payrolls.forEach((payroll) => {
        const staffId = payroll.staffId || null;
        if (!staffId || !PAID_PAYROLL_STATUSES.has(`${payroll.status || ''}`.toLowerCase())) return;

        const existing = rows.get(staffId) || {
            id: staffId,
            name: 'Staff',
            revenue: 0,
            bookings: 0,
            completed: 0,
            commissionEarned: 0,
            commissionPaid: 0
        };

        existing.commissionPaid += toNumber(payroll.commission || 0);
        rows.set(staffId, existing);
    });

    return Array.from(rows.values())
        .map((row) => {
            const completion = row.bookings > 0 ? (row.completed / row.bookings) * 100 : 0;
            const productivity = row.bookings > 0 ? row.revenue / row.bookings : 0;
            const commissionOutstanding = Math.max(row.commissionEarned - row.commissionPaid, 0);
            return {
                ...row,
                revenue: Number(row.revenue.toFixed(2)),
                productivity: Number(productivity.toFixed(2)),
                completion: Number(completion.toFixed(1)),
                commissionEarned: Number(row.commissionEarned.toFixed(2)),
                commissionPaid: Number(row.commissionPaid.toFixed(2)),
                commissionOutstanding: Number(commissionOutstanding.toFixed(2))
            };
        })
        .sort((left, right) => right.revenue - left.revenue);
}

function buildProductAnalytics(orders = []) {
    const rows = new Map();

    orders.forEach((order) => {
        (order.items || []).forEach((item) => {
            const key = normalizeProductKey(item);
            const name = item.product?.name_en || item.product?.name_ar || item.productName || item.productNameAr || 'Product';
            const existing = rows.get(key) || {
                id: key,
                name,
                sales: 0,
                quantity: 0,
                revenue: 0
            };
            const lineTotal = item.totalPrice != null
                ? toNumber(item.totalPrice || 0)
                : toNumber(item.unitPrice || 0) * Math.max(toNumber(item.quantity || 0), 1);

            existing.name = name || existing.name;
            existing.sales += 1;
            existing.quantity += toNumber(item.quantity || 0);
            existing.revenue += lineTotal;
            rows.set(key, existing);
        });
    });

    return Array.from(rows.values())
        .map((row) => ({
            ...row,
            sales: Number(row.sales.toFixed(0)),
            quantity: Number(row.quantity.toFixed(0)),
            revenue: Number(row.revenue.toFixed(2))
        }))
        .sort((left, right) => right.revenue - left.revenue);
}

async function buildBusinessSnapshot({
    tenantId,
    periodType = 'daily',
    referenceDate = new Date(),
    includeHistory = true
} = {}) {
    if (!tenantId) {
        throw new Error('tenantId is required to build a consultant snapshot');
    }

    const window = resolvePeriodWindow(periodType, referenceDate);
    const previousWindow = resolvePreviousWindow(window);
    const periodDays = Math.max(Math.round((window.periodEnd - window.periodStart) / (24 * 60 * 60 * 1000)), 0) + 1;

    const [currentInputs, previousInputs] = await Promise.all([
        loadTenantSnapshotInputs(tenantId, window, includeHistory),
        loadTenantSnapshotInputs(tenantId, previousWindow, false)
    ]);

    const customerAnalytics = buildCustomerAnalytics(
        currentInputs.historyAppointments,
        currentInputs.historyOrders,
        window
    );

    const previousFinancial = buildFinancialAnalytics(
        previousInputs.appointments,
        previousInputs.orders,
        previousInputs.transactions,
        {}
    );

    const financial = buildFinancialAnalytics(
        currentInputs.appointments,
        currentInputs.orders,
        currentInputs.transactions,
        {
            grossRevenue: previousFinancial.revenue.gross,
            refunds: previousFinancial.refunds.total
        }
    );

    const operations = buildOperationsAnalytics(currentInputs.appointments, currentInputs.staff, periodDays);
    const employees = buildEmployeeAnalytics(currentInputs.appointments, currentInputs.payrolls);
    const products = buildProductAnalytics(currentInputs.orders);

    const activeAppointmentCount = currentInputs.appointments.length;
    const activeOrderCount = currentInputs.orders.length;
    const sourceCounts = {
        appointments: activeAppointmentCount,
        orders: activeOrderCount,
        transactions: currentInputs.transactions.length,
        staff: currentInputs.staff.length,
        payrolls: currentInputs.payrolls.length,
        historyAppointments: includeHistory ? currentInputs.historyAppointments.length : activeAppointmentCount,
        historyOrders: includeHistory ? currentInputs.historyOrders.length : activeOrderCount
    };

    const summary = {
        revenue: financial.revenue.net,
        growth: financial.revenue.growth.percentage,
        discounts: financial.discounts.total,
        refunds: financial.refunds.total,
        retentionRate: customerAnalytics.retentionRate,
        occupancyRate: operations.occupancyRate,
        employeeCount: currentInputs.staff.length,
        productCount: products.length
    };

    const data = {
        period: {
            type: window.periodType,
            start: window.periodStart.toISOString(),
            end: window.periodEnd.toISOString(),
            generatedAt: new Date().toISOString()
        },
        currency: DEFAULT_CURRENCY,
        financial,
        customers: customerAnalytics,
        operations,
        employees,
        products,
        sourceCounts,
        metadata: {
            previousPeriod: {
                start: previousWindow.periodStart.toISOString(),
                end: previousWindow.periodEnd.toISOString()
            }
        }
    };

    return {
        periodType: window.periodType,
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
        previousWindow,
        snapshotHash: buildStableHash({
            periodType: window.periodType,
            periodStart: window.periodStart.toISOString(),
            periodEnd: window.periodEnd.toISOString(),
            data
        }),
        data,
        summary,
        currentInputs
    };
}

async function saveBusinessSnapshot({
    tenantId,
    createdByUserId = null,
    periodType = 'daily',
    referenceDate = new Date(),
    includeHistory = true
} = {}) {
    const snapshot = await buildBusinessSnapshot({
        tenantId,
        periodType,
        referenceDate,
        includeHistory
    });

    const payload = {
        tenantId,
        createdByUserId,
        periodType: snapshot.periodType,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        generatedAt: new Date(),
        datasetVersion: 'v1',
        snapshotHash: snapshot.snapshotHash || buildStableHash(snapshot.data),
        currency: DEFAULT_CURRENCY,
        summary: snapshot.summary,
        financial: snapshot.data.financial,
        customers: snapshot.data.customers,
        operations: snapshot.data.operations,
        employees: snapshot.data.employees,
        products: snapshot.data.products,
        sourceCounts: snapshot.data.sourceCounts,
        metadata: snapshot.data.metadata
    };

    const existing = await db.ConsultantSnapshot.findOne({
        where: {
            tenantId,
            periodType: snapshot.periodType,
            periodStart: snapshot.periodStart
        }
    });

    if (existing) {
        await existing.update(payload);
        return {
            snapshot: existing,
            computed: snapshot
        };
    }

    const created = await db.ConsultantSnapshot.create(payload);
    return {
        snapshot: created,
        computed: snapshot
    };
}

async function saveConsultantReport({
    tenantId,
    snapshotId = null,
    createdByUserId = null,
    snapshotHash = '',
    analysisVersion = 'v1',
    title = 'Business Snapshot',
    description = null,
    periodType = 'daily',
    periodStart,
    periodEnd,
    sections = [],
    outputFormat = 'json',
    reportData = {},
    metadata = {}
} = {}) {
    if (!tenantId) {
        throw new Error('tenantId is required to store a consultant report');
    }

    return db.ConsultantReport.create({
        tenantId,
        snapshotId,
        createdByUserId,
        snapshotHash,
        analysisVersion,
        title,
        description,
        reportType: 'consultant_analysis',
        periodType,
        periodStart,
        periodEnd,
        outputFormat,
        sections,
        reportData,
        metadata,
        generatedAt: new Date(),
        status: 'ready'
    });
}

async function saveConsultantConversation({
    tenantId,
    createdByUserId = null,
    snapshotId = null,
    reportId = null,
    title,
    topic = null,
    messages = [],
    summary = {},
    metadata = {},
    status = 'open'
} = {}) {
    if (!tenantId) {
        throw new Error('tenantId is required to store a consultant conversation');
    }

    if (!title) {
        throw new Error('title is required to store a consultant conversation');
    }

    const searchText = messages
        .map((message) => `${message?.role || ''} ${message?.content || ''}`.trim())
        .filter(Boolean)
        .join(' ')
        .trim();

    return db.ConsultantConversation.create({
        tenantId,
        createdByUserId,
        snapshotId,
        reportId,
        title,
        topic,
        status,
        messages,
        searchText,
        summary,
        metadata,
        lastMessageAt: messages.length ? new Date() : null
    });
}

module.exports = {
    resolvePeriodWindow,
    resolvePreviousWindow,
    buildBusinessSnapshot,
    saveBusinessSnapshot,
    saveConsultantReport,
    saveConsultantConversation
};
