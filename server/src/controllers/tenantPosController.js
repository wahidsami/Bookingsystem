const { Op } = require('sequelize');
const db = require('../models');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const { ACTIVE_APPOINTMENT_STATUSES } = require('../utils/appointmentStatus');

const POS_QUEUE_LIMIT = 100;
const POS_TRANSACTION_LIMIT = 100;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseDateRange = (startDate, endDate) => {
    const range = {};

    if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
            start.setHours(0, 0, 0, 0);
            range[Op.gte] = start;
        }
    }

    if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            range[Op.lte] = end;
        }
    }

    return Object.keys(range).length ? range : null;
};

const getCustomerName = (user) => {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || user?.email || user?.phone || 'Guest Customer';
};

const getServiceName = (service) => (
    service?.name_en || service?.name_ar || 'Service'
);

const getOrderLabel = (order) => {
    const itemNames = Array.isArray(order?.items)
        ? order.items
            .map((item) => item?.product?.name_en || item?.product?.name_ar)
            .filter(Boolean)
        : [];

    return itemNames.length
        ? itemNames.slice(0, 2).join(', ')
        : 'Product order';
};

const getAppointmentDueAmount = (appointment) => {
    if (appointment.paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID) {
        const remainder = parseFloat(appointment.remainderAmount || 0);
        return Number.isFinite(remainder) && remainder > 0 ? remainder : 0;
    }

    const price = parseFloat(appointment.price || 0);
    const totalPaid = parseFloat(appointment.totalPaid || 0);
    const dueAmount = price - totalPaid;

    return Number.isFinite(dueAmount) && dueAmount > 0
        ? parseFloat(dueAmount.toFixed(2))
        : 0;
};

const formatPaymentMethodLabel = (paymentMethod) => ({
    online: 'Online',
    cash: 'Cash',
    card_pos: 'Card POS',
    wallet: 'Wallet',
    bank_transfer: 'Bank transfer',
    pay_on_visit: 'Pay on visit',
    cash_on_delivery: 'Cash on delivery'
}[paymentMethod] || paymentMethod || 'Not set');

const mapAppointmentQueueItem = (appointment) => ({
    id: `appointment-${appointment.id}`,
    entityType: 'appointment',
    entityId: appointment.id,
    reference: appointment.bookingNumber || appointment.id,
    customerName: getCustomerName(appointment.user),
    customerPhone: appointment.user?.phone || null,
    title: getServiceName(appointment.service),
    employeeName: appointment.staff?.name || null,
    scheduledAt: appointment.startTime,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    paymentIntent: appointment.paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
        ? 'deposit_remainder_due'
        : ['online', 'online-full', 'booking-fee'].includes(appointment.paymentMethod)
            ? 'online_payment_pending'
            : 'pay_at_center',
    paymentMethod: appointment.paymentMethod || 'cash',
    paymentMethodLabel: formatPaymentMethodLabel(appointment.paymentMethod || 'cash'),
    totalAmount: parseFloat(appointment.price || 0),
    paidAmount: parseFloat(appointment.totalPaid || 0),
    dueAmount: getAppointmentDueAmount(appointment),
    detailPath: `/dashboard/appointments/${appointment.id}`
});

const mapOrderQueueItem = (order) => ({
    id: `order-${order.id}`,
    entityType: 'order',
    entityId: order.id,
    reference: order.orderNumber,
    customerName: getCustomerName(order.user),
    customerPhone: order.user?.phone || null,
    title: getOrderLabel(order),
    employeeName: null,
    scheduledAt: order.createdAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentIntent: order.paymentMethod === 'pay_on_visit'
        ? 'pay_on_pickup'
        : 'cash_on_delivery',
    paymentMethod: order.paymentMethod,
    paymentMethodLabel: formatPaymentMethodLabel(order.paymentMethod),
    totalAmount: parseFloat(order.totalAmount || 0),
    paidAmount: 0,
    dueAmount: parseFloat(order.totalAmount || 0),
    detailPath: `/dashboard/orders/${order.id}`
});

const mapPaymentTransaction = (transaction) => {
    const appointment = transaction.appointment;
    const order = transaction.order;
    const entityType = appointment ? 'appointment' : 'order';
    const reference = appointment?.bookingNumber || appointment?.id || order?.orderNumber || transaction.transactionRef || transaction.id;
    const user = appointment?.user || order?.user;

    return {
        id: transaction.id,
        entityType,
        entityId: appointment?.id || order?.id || null,
        reference,
        customerName: getCustomerName(user),
        title: appointment
            ? getServiceName(appointment.service)
            : getOrderLabel(order),
        amount: parseFloat(transaction.amount || 0),
        type: transaction.type,
        paymentMethod: transaction.paymentMethod,
        paymentMethodLabel: formatPaymentMethodLabel(transaction.paymentMethod),
        status: transaction.status,
        transactionRef: transaction.transactionRef,
        notes: transaction.notes,
        processedAt: transaction.processedAt,
        processorName: transaction.processor?.name || null,
        detailPath: appointment
            ? `/dashboard/appointments/${appointment.id}`
            : order?.id
                ? `/dashboard/orders/${order.id}`
                : null
    };
};

const buildAppointmentSearchWhere = (tenantId, search) => {
    const where = {
        tenantId,
        status: { [Op.in]: ACTIVE_APPOINTMENT_STATUSES },
        [Op.or]: [
            { paymentStatus: APPOINTMENT_PAYMENT_STATUS.PENDING },
            {
                [Op.and]: [
                    { paymentStatus: APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID },
                    { remainderPaid: false },
                    { remainderAmount: { [Op.gt]: 0 } }
                ]
            }
        ]
    };

    if (search) {
        const searchConditions = [
                { bookingNumber: { [Op.iLike]: `%${search}%` } },
                { '$user.firstName$': { [Op.iLike]: `%${search}%` } },
                { '$user.lastName$': { [Op.iLike]: `%${search}%` } },
                { '$user.phone$': { [Op.iLike]: `%${search}%` } },
                { '$user.email$': { [Op.iLike]: `%${search}%` } },
                { '$service.name_en$': { [Op.iLike]: `%${search}%` } },
                { '$service.name_ar$': { [Op.iLike]: `%${search}%` } }
        ];

        if (UUID_REGEX.test(search)) {
            searchConditions.unshift({ id: { [Op.eq]: search } });
        }

        where[Op.and] = [{
            [Op.or]: searchConditions
        }];
    }

    return where;
};

const buildOrderSearchWhere = (tenantId, search) => {
    const where = {
        tenantId,
        paymentStatus: 'pending',
        paymentMethod: { [Op.in]: ['pay_on_visit', 'cash_on_delivery'] },
        status: { [Op.notIn]: ['cancelled', 'refunded'] }
    };

    if (search) {
        where[Op.or] = [
            { orderNumber: { [Op.iLike]: `%${search}%` } },
            { '$user.firstName$': { [Op.iLike]: `%${search}%` } },
            { '$user.lastName$': { [Op.iLike]: `%${search}%` } },
            { '$user.phone$': { [Op.iLike]: `%${search}%` } },
            { '$user.email$': { [Op.iLike]: `%${search}%` } }
        ];
    }

    return where;
};

exports.getCollectionQueue = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const search = `${req.query.search || ''}`.trim();
        const limit = Math.min(parseInt(req.query.limit || POS_QUEUE_LIMIT, 10), POS_QUEUE_LIMIT);

        const [appointments, orders] = await Promise.all([
            db.Appointment.findAll({
                where: buildAppointmentSearchWhere(tenantId, search),
                include: [
                    {
                        model: db.Service,
                        as: 'service',
                        attributes: ['id', 'name_en', 'name_ar']
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
                    }
                ],
                order: [['startTime', 'ASC']],
                limit
            }),
            db.Order.findAll({
                where: buildOrderSearchWhere(tenantId, search),
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
                ],
                order: [['createdAt', 'ASC']],
                limit
            })
        ]);

        const queue = [
            ...appointments.map(mapAppointmentQueueItem),
            ...orders.map(mapOrderQueueItem)
        ]
            .filter((item) => item.dueAmount > 0)
            .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
            .slice(0, limit);

        const totalDueAmount = queue.reduce((sum, item) => sum + item.dueAmount, 0);
        const appointmentDueCount = queue.filter((item) => item.entityType === 'appointment').length;
        const orderDueCount = queue.filter((item) => item.entityType === 'order').length;
        const queueSummary = {
            totalDueCount: queue.length,
            appointmentDueCount,
            orderDueCount,
            totalDueAmount: parseFloat(totalDueAmount.toFixed(2)),
            checkedInDueCount: queue.filter((item) => item.entityType === 'appointment' && item.status === 'checked_in').length
        };

        res.json({
            success: true,
            queue,
            summary: queueSummary
        });
    } catch (error) {
        console.error('Get POS collection queue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load POS collection queue',
            error: error.message
        });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const {
            search = '',
            startDate,
            endDate,
            page = 1,
            limit = 25
        } = req.query;

        const safeLimit = Math.min(parseInt(limit, 10) || 25, POS_TRANSACTION_LIMIT);
        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (safePage - 1) * safeLimit;
        const dateRange = parseDateRange(startDate, endDate);

        const where = {
            [Op.or]: [
                { '$appointment.tenantId$': tenantId },
                { '$order.tenantId$': tenantId }
            ]
        };

        if (dateRange) {
            where.processedAt = dateRange;
        }

        const trimmedSearch = `${search || ''}`.trim();
        if (trimmedSearch) {
            where[Op.and] = [{
                [Op.or]: [
                    { transactionRef: { [Op.iLike]: `%${trimmedSearch}%` } },
                    { '$order.orderNumber$': { [Op.iLike]: `%${trimmedSearch}%` } },
                    { '$appointment.user.firstName$': { [Op.iLike]: `%${trimmedSearch}%` } },
                    { '$appointment.user.lastName$': { [Op.iLike]: `%${trimmedSearch}%` } },
                    { '$appointment.user.phone$': { [Op.iLike]: `%${trimmedSearch}%` } },
                    { '$order.user.firstName$': { [Op.iLike]: `%${trimmedSearch}%` } },
                    { '$order.user.lastName$': { [Op.iLike]: `%${trimmedSearch}%` } },
                    { '$order.user.phone$': { [Op.iLike]: `%${trimmedSearch}%` } }
                ]
            }];
        }

        const { rows, count } = await db.PaymentTransaction.findAndCountAll({
            where,
            include: [
                {
                    model: db.Appointment,
                    as: 'appointment',
                    attributes: ['id', 'bookingNumber', 'tenantId', 'startTime', 'paymentStatus', 'status'],
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
                    attributes: ['id', 'tenantId', 'orderNumber', 'paymentStatus', 'status', 'paymentMethod'],
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
            ],
            order: [['processedAt', 'DESC']],
            distinct: true,
            subQuery: false,
            limit: safeLimit,
            offset
        });

        res.json({
            success: true,
            transactions: rows.map(mapPaymentTransaction),
            pagination: {
                total: count,
                page: safePage,
                limit: safeLimit,
                totalPages: Math.ceil(count / safeLimit)
            }
        });
    } catch (error) {
        console.error('Get POS transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load POS transaction ledger',
            error: error.message
        });
    }
};

exports.getClosingSummary = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
        const dateRange = parseDateRange(selectedDate, selectedDate);

        const transactions = await db.PaymentTransaction.findAll({
            where: {
                processedAt: dateRange,
                [Op.or]: [
                    { '$appointment.tenantId$': tenantId },
                    { '$order.tenantId$': tenantId }
                ]
            },
            include: [
                {
                    model: db.Appointment,
                    as: 'appointment',
                    attributes: ['id', 'tenantId'],
                    required: false
                },
                {
                    model: db.Order,
                    as: 'order',
                    attributes: ['id', 'tenantId'],
                    required: false
                },
                {
                    model: db.Staff,
                    as: 'processor',
                    attributes: ['id', 'name'],
                    required: false
                }
            ],
            order: [['processedAt', 'DESC']],
            subQuery: false
        });

        const totalsByMethod = {};
        const totalsBySource = {
            appointments: 0,
            orders: 0,
            refunds: 0
        };

        let grossCollected = 0;
        let refundsTotal = 0;

        transactions.forEach((transaction) => {
            const amount = parseFloat(transaction.amount || 0);
            const method = transaction.paymentMethod || 'cash';

            if (!totalsByMethod[method]) {
                totalsByMethod[method] = {
                    paymentMethod: method,
                    paymentMethodLabel: formatPaymentMethodLabel(method),
                    collected: 0,
                    refunded: 0,
                    transactionCount: 0
                };
            }

            totalsByMethod[method].transactionCount += 1;

            if (transaction.status === 'refunded' || transaction.type === 'refund') {
                refundsTotal += amount;
                totalsByMethod[method].refunded += amount;
                totalsBySource.refunds += amount;
                return;
            }

            if (transaction.status === 'completed') {
                grossCollected += amount;
                totalsByMethod[method].collected += amount;

                if (transaction.appointment) {
                    totalsBySource.appointments += amount;
                } else if (transaction.order) {
                    totalsBySource.orders += amount;
                }
            }
        });

        const cashierBreakdownMap = new Map();
        transactions.forEach((transaction) => {
            if (transaction.status !== 'completed') return;

            const processorName = transaction.processor?.name || 'Tenant Dashboard';
            const existing = cashierBreakdownMap.get(processorName) || {
                processorName,
                transactionCount: 0,
                collected: 0
            };

            existing.transactionCount += 1;
            existing.collected += parseFloat(transaction.amount || 0);
            cashierBreakdownMap.set(processorName, existing);
        });

        res.json({
            success: true,
            summary: {
                date: selectedDate,
                grossCollected: parseFloat(grossCollected.toFixed(2)),
                refundsTotal: parseFloat(refundsTotal.toFixed(2)),
                netCollected: parseFloat((grossCollected - refundsTotal).toFixed(2)),
                transactionCount: transactions.length,
                totalsByMethod: Object.values(totalsByMethod).map((entry) => ({
                    ...entry,
                    collected: parseFloat(entry.collected.toFixed(2)),
                    refunded: parseFloat(entry.refunded.toFixed(2))
                })),
                totalsBySource: {
                    appointments: parseFloat(totalsBySource.appointments.toFixed(2)),
                    orders: parseFloat(totalsBySource.orders.toFixed(2)),
                    refunds: parseFloat(totalsBySource.refunds.toFixed(2))
                },
                cashierBreakdown: Array.from(cashierBreakdownMap.values()).map((entry) => ({
                    ...entry,
                    collected: parseFloat(entry.collected.toFixed(2))
                }))
            }
        });
    } catch (error) {
        console.error('Get POS closing summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load POS closing summary',
            error: error.message
        });
    }
};
