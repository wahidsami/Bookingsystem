/**
 * Tenant Reports Controller
 * Generates analytics and reports for the tenant dashboard
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const {
    generateReportPdfBuffer,
    resolveUploadPath,
    sanitizeFileNamePart
} = require('../services/tenantReportPdfService');

function getCustomerName(user) {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || user?.email || user?.phone || 'Guest Customer';
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

function getRefundModeLabel(amount, referenceAmount) {
    const numericAmount = Number(amount || 0);
    const numericReference = Number(referenceAmount || 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 'Partial';
    if (!Number.isFinite(numericReference) || numericReference <= 0) return 'Partial';
    return numericAmount >= (numericReference - 0.01) ? 'Full' : 'Partial';
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
        const current = customers.get(customerId) || {
            id: customerId,
            name: getCustomerName(user),
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
            if (!customerStats[customerId]) {
                customerStats[customerId] = {
                    bookings: 0,
                    completed: 0,
                    revenue: 0,
                    firstVisit: appointment.startTime,
                    lastVisit: appointment.startTime
                };
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
            .map(([id, stats]) => ({ id, ...stats }))
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
            send() { resolve(null); }
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

async function buildPaymentMethodsReport(req, startDate, endDate) {
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

    return {
        rows,
        totals: {
            revenue: Number(totalRevenue.toFixed(2)),
            transactionCount: totalTransactions
        }
    };
}

async function buildFullReportData(req, sections, startDate, endDate) {
    const result = {};
    const queryWithRange = { ...req.query, startDate, endDate };
    const transactions = (sections.includes('refunds') || sections.includes('paymentMethods') || sections.includes('customerSales'))
        ? await getPaymentTransactions(req, { startDate, endDate, limit: 400 })
        : [];

    if (sections.includes('overview') || sections.includes('discounts')) {
        const response = await runHandler(tenantFinancialController.getFinancialOverview, req);
        if (response?.success && response?.overview) {
            if (sections.includes('overview')) {
                result.overview = response.overview;
            }
            if (sections.includes('discounts') && response.overview.discountTotals) {
                result.discounts = response.overview.discountTotals;
            }
        }
    }

    if (sections.includes('employees')) {
        const response = await runHandler(tenantFinancialController.getEmployeeRevenue, req);
        if (response?.success) {
            result.employees = response.employees;
            result.employeeTotals = response.totals;
        }
    }

    if (sections.includes('services')) {
        const response = await runHandler(tenantFinancialController.getServiceRevenue, req);
        if (response?.success) {
            result.services = response.services;
            result.serviceTotals = response.totals;
        }
    }

    if (sections.includes('products')) {
        const response = await runHandler(tenantFinancialController.getProductRevenue, req);
        if (response?.success) {
            result.products = response.products;
            result.productTotals = response.totals;
        }
    }

    if (sections.includes('daily')) {
        const response = await runHandler(tenantFinancialController.getDailyRevenue, req);
        if (response?.success && response?.dailyRevenue) {
            result.dailyRevenue = response.dailyRevenue;
        }
    }

    if (sections.includes('bookingTrends')) {
        const response = await runHandler(exports.getBookingTrends, {
            ...req,
            query: { ...queryWithRange, groupBy: 'day' }
        });
        if (response?.success && response?.data) {
            result.bookingTrends = response.data;
        }
    }

    if (sections.includes('servicePerformance')) {
        const response = await runHandler(exports.getServicePerformance, req);
        if (response?.success && response?.data) {
            result.servicePerformance = response.data;
        }
    }

    if (sections.includes('employeePerformance')) {
        const response = await runHandler(exports.getEmployeePerformance, req);
        if (response?.success && response?.data) {
            result.employeePerformance = response.data;
        }
    }

    if (sections.includes('peakHours')) {
        const response = await runHandler(exports.getPeakHoursAnalysis, req);
        if (response?.success && response?.data) {
            result.peakHours = response.data;
        }
    }

    if (sections.includes('customerAnalytics')) {
        const response = await runHandler(exports.getCustomerAnalytics, req);
        if (response?.success && response?.data) {
            result.customerAnalytics = response.data;
        }
    }

    if (sections.includes('refunds')) {
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
    }

    if (sections.includes('paymentMethods')) {
        const buckets = new Map();
        transactions.forEach((transaction) => {
            if (transaction.status !== 'completed' && transaction.status !== 'refunded') return;
            const group = normalizePaymentMethodGroup(transaction.paymentMethod);
            const key = group === 'split' ? 'split' : group;
            const amount = Number(transaction.amount || 0);
            const signedAmount = transaction.status === 'refunded' || transaction.type === 'refund'
                ? -Math.abs(amount)
                : Math.abs(amount);

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

        result.paymentMethods = {
            rows: Array.from(buckets.values()).map((row) => ({
                ...row,
                revenue: Number(row.revenue.toFixed(2))
            })).sort((left, right) => right.revenue - left.revenue)
        };
    }

    if (sections.includes('customerSales')) {
        result.customerSales = buildCustomerSalesRows(transactions);
    }

    return result;
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

exports.getPaymentMethodsReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await buildPaymentMethodsReport(req, startDate, endDate);

        res.json({
            success: true,
            data: report.rows,
            totals: report.totals
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

exports.downloadReportPdf = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate, sections: sectionsParam, title } = req.query;
        const sections = typeof sectionsParam === 'string'
            ? sectionsParam.split(',').map((section) => section.trim()).filter(Boolean)
            : [];

        if (!startDate || !endDate || sections.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'startDate, endDate, and sections are required'
            });
        }

        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['id', 'name', 'name_en', 'name_ar', 'businessName', 'logo']
        });

        const data = await buildFullReportData(req, sections, startDate, endDate);
        const tenantName = tenant?.businessName || tenant?.name_ar || tenant?.name_en || tenant?.name || 'Tenant';
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

        const fileName = `report-${sanitizeFileNamePart(tenantName, 'tenant')}-${startDate}-${endDate}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
    } catch (error) {
        console.error('Download report PDF error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate report PDF',
            error: error.message
        });
    }
};

