/**
 * Tenant Customer Controller
 * Manages customers (platform users who have booked with this tenant)
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { buildPublicAssetUrl } = require('../utils/url');
const TENANT_APPOINTMENT_AUDIT_LOGS_ENABLED = process.env.TENANT_APPOINTMENT_AUDIT_LOGS === '1';

function logTenantAppointmentAudit(event, payload = {}) {
    if (!TENANT_APPOINTMENT_AUDIT_LOGS_ENABLED) {
        return;
    }

    try {
        console.info('[tenant-appointment-audit]', JSON.stringify({
            event,
            at: new Date().toISOString(),
            ...payload
        }));
    } catch (error) {
        console.info('[tenant-appointment-audit]', event, payload);
    }
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

function getCustomerName(user) {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || user?.email || user?.phone || 'Guest Customer';
}

function formatPaymentMethodLabel(paymentMethod) {
    if (paymentMethod && typeof paymentMethod === 'object') {
        if (paymentMethod.cardBrand && paymentMethod.cardLast4) {
            return `${paymentMethod.cardBrand} ••••${paymentMethod.cardLast4}`;
        }

        if (paymentMethod.type) {
            return formatPaymentMethodLabel(paymentMethod.type);
        }
    }

    return ({
        online: 'Online',
        cash: 'Cash',
        card_pos: 'Card POS',
        wallet: 'Wallet',
        bank_transfer: 'Bank transfer',
        pay_on_visit: 'Pay on visit',
        cash_on_delivery: 'Cash on delivery'
    }[paymentMethod] || paymentMethod || 'Not set');
}

function formatTransactionTitle(record) {
    if (record.source === 'transaction') {
        if (record.kind === 'appointment') {
            return record.appointment?.service
                ? `${record.appointment.service.name_en || record.appointment.service.name_ar || 'Service'}`
                : 'Service booking';
        }
        if (record.kind === 'order') {
            return record.order?.orderNumber ? `Order #${record.order.orderNumber}` : 'Product purchase';
        }
    }

    if (record.kind === 'appointment') {
        return record.appointment?.service
            ? `${record.appointment.service.name_en || record.appointment.service.name_ar || 'Service'}`
            : 'Service booking';
    }
    if (record.kind === 'order') {
        return record.order?.orderNumber ? `Order #${record.order.orderNumber}` : 'Product purchase';
    }

    return 'Transaction';
}

function formatTransactionSubtitle(record, locale = 'en') {
    if (record.kind === 'appointment') {
        return record.appointment?.staff?.name || record.appointment?.bookingNumber || record.reference || '';
    }

    if (record.kind === 'order') {
        const firstItem = Array.isArray(record.order?.items) ? record.order.items[0] : null;
        if (!firstItem) return record.reference || '';
        return locale === 'ar'
            ? firstItem.product?.name_ar || firstItem.productNameAr || firstItem.productName || ''
            : firstItem.product?.name_en || firstItem.productName || firstItem.productNameAr || '';
    }

    return record.reference || '';
}

function mapCustomerTransactionRecord(record, locale = 'en') {
  const appointment = record.appointment || null;
  const order = record.order || null;
  const entityType = record.kind || (appointment ? 'appointment' : 'order');
  const reference = record.reference
        || appointment?.bookingNumber
      || order?.orderNumber
      || record.transactionRef
      || record.id;
  const processedAt = record.processedAt || record.createdAt || record.date;
  const paymentMethodValue = typeof record.paymentMethod === 'string'
      ? record.paymentMethod
      : (record.paymentMethod?.type || appointment?.paymentMethod || order?.paymentMethod || 'cash');
  const normalizedAppointmentPayment = appointment
      ? normalizeAppointmentPaymentState(appointment, record.source || 'transaction')
      : null;

  return {
    id: record.id,
    source: record.source || 'transaction',
        entityType,
        entityId: record.entityId || appointment?.id || order?.id || null,
        reference,
        title: formatTransactionTitle({ ...record, appointment, order }),
        subtitle: formatTransactionSubtitle({ ...record, appointment, order }, locale),
    amount: parseFloat(record.amount || 0),
    currency: record.currency || 'SAR',
    type: record.type || 'booking',
    status: record.status || 'completed',
    paymentMethod: paymentMethodValue,
    paymentMethodLabel: formatPaymentMethodLabel(record.paymentMethod || paymentMethodValue),
    normalizedPaymentStatus: normalizedAppointmentPayment?.normalizedPaymentStatus || null,
    appointmentOutstandingAmount: normalizedAppointmentPayment?.outstandingAmount ?? null,
    appointmentPaidAmount: normalizedAppointmentPayment?.paidAmount ?? null,
    paymentEvidenceSource: normalizedAppointmentPayment?.paymentEvidenceSource || (record.source || 'transaction'),
    transactionRef: record.transactionRef || null,
        notes: record.notes || null,
        processedAt,
        processorName: record.processor?.name || null,
        detailPath: appointment
            ? `/dashboard/appointments/${appointment.id}`
            : order?.id
                ? `/dashboard/orders/${order.id}`
                : null
    };
}

function calculateAppointmentOutstandingAmount(appointment) {
  const paymentStatus = appointment?.paymentStatus;
  if (paymentStatus === 'pending') {
    return Math.max(Number(appointment?.price || 0), 0);
  }

  if (paymentStatus === 'deposit_paid') {
    return Math.max(Number(appointment?.remainderAmount || 0), 0);
  }

  return 0;
}

function normalizeAppointmentPaymentState(appointment, evidenceSource = 'appointment') {
    const rawStatus = `${appointment?.paymentStatus || ''}`.trim().toLowerCase();
    const price = Number(appointment?.price || 0);
    const totalPaid = Number(appointment?.totalPaid || 0);
    const depositAmount = Number(appointment?.depositAmount || 0);
    const remainderAmount = Number(appointment?.remainderAmount || 0);
    const fallbackOutstanding = calculateAppointmentOutstandingAmount(appointment);
    const paidAmount = Number.isFinite(totalPaid) && totalPaid > 0
        ? totalPaid
        : (rawStatus === 'deposit_paid' ? Math.max(0, depositAmount) : 0);
    const outstandingAmount = Math.max(
        0,
        Number.isFinite(price) && price > 0
            ? price - paidAmount
            : fallbackOutstanding
    );

    let normalizedPaymentStatus = rawStatus || 'pending';
    if ((normalizedPaymentStatus === 'fully_paid' || normalizedPaymentStatus === 'paid') && outstandingAmount > 0.009) {
        normalizedPaymentStatus = 'deposit_paid';
    }
    if (normalizedPaymentStatus === 'deposit_paid' && outstandingAmount <= 0.009 && remainderAmount <= 0.009) {
        normalizedPaymentStatus = 'fully_paid';
    }

    return {
        normalizedPaymentStatus,
        paidAmount: Number.isFinite(paidAmount) ? parseFloat(paidAmount.toFixed(2)) : 0,
        outstandingAmount: parseFloat(outstandingAmount.toFixed(2)),
        paymentEvidenceSource: evidenceSource
    };
}

/**
 * Get all customers who have booked with this tenant
 */
exports.getCustomers = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'lastVisit',
            sortOrder = 'DESC',
            loyaltyTier = '',
            minBookings = 0,
            minSpent = 0
        } = req.query;

        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
        const offset = (safePage - 1) * safeLimit;
        const customerType = req.query.customerType || ''; // 'service_only', 'product_only', 'both', or ''

        // Find all platform users who have appointments OR orders with this tenant
        const whereClause = {};
        
        if (search) {
            whereClause[Op.or] = [
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Get customers with appointments
        const customersWithAppointments = await db.PlatformUser.findAll({
            where: whereClause,
            include: [
                {
                    model: db.Appointment,
                    as: 'appointments',
                    required: true,
                    include: [
                        {
                            model: db.Service,
                            as: 'service',
                            where: { tenantId },
                            required: true,
                            attributes: ['id', 'name_en', 'name_ar']
                        }
                    ],
                    attributes: ['id', 'startTime', 'status', 'price', 'paymentStatus', 'paymentMethod', 'depositAmount', 'remainderAmount', 'totalPaid']
                }
            ],
            attributes: [
                'id', 'firstName', 'lastName', 'email', 'phone', 
                'profileImage', 'gender', 'createdAt'
            ],
            distinct: true
        });

        // Get customers with orders
        const customersWithOrders = await db.PlatformUser.findAll({
            where: whereClause,
            include: [
                {
                    model: db.Order,
                    as: 'orders',
                    required: true,
                    where: { tenantId },
                    include: [
                        {
                            model: db.OrderItem,
                            as: 'items',
                            attributes: ['id', 'quantity', 'unitPrice', 'totalPrice']
                        }
                    ],
                    attributes: ['id', 'orderNumber', 'status', 'paymentStatus', 'totalAmount', 'createdAt']
                }
            ],
            attributes: [
                'id', 'firstName', 'lastName', 'email', 'phone', 
                'profileImage', 'gender', 'createdAt'
            ],
            distinct: true
        });

        // Merge and deduplicate customers
        const customerMap = new Map();
        
        customersWithAppointments.forEach(customer => {
            const customerData = customer.toJSON();
            if (!customerMap.has(customerData.id)) {
                customerMap.set(customerData.id, {
                    ...customerData,
                    appointments: customerData.appointments || [],
                    orders: []
                });
            } else {
                customerMap.get(customerData.id).appointments = customerData.appointments || [];
            }
        });

        customersWithOrders.forEach(customer => {
            const customerData = customer.toJSON();
            if (!customerMap.has(customerData.id)) {
                customerMap.set(customerData.id, {
                    ...customerData,
                    appointments: [],
                    orders: customerData.orders || []
                });
            } else {
                customerMap.get(customerData.id).orders = customerData.orders || [];
            }
        });

        let allCustomers = Array.from(customerMap.values());

        // Filter by customer type
        if (customerType === 'service_only') {
            allCustomers = allCustomers.filter(c => c.appointments.length > 0 && (!c.orders || c.orders.length === 0));
        } else if (customerType === 'product_only') {
            allCustomers = allCustomers.filter(c => (!c.appointments || c.appointments.length === 0) && c.orders.length > 0);
        } else if (customerType === 'both') {
            allCustomers = allCustomers.filter(c => c.appointments.length > 0 && c.orders.length > 0);
        }

        // Enrich with customer insights
        const customerIds = allCustomers.map(c => c.id);
        const insights = customerIds.length > 0
            ? await db.CustomerInsight.findAll({
                where: {
                    platformUserId: { [Op.in]: customerIds },
                    tenantId
                }
            })
            : [];

        const insightsMap = {};
        insights.forEach(i => {
            insightsMap[i.platformUserId] = i;
        });

        // Calculate stats for each customer
        const enrichedCustomers = allCustomers.map(customer => {
            const appointments = customer.appointments || [];
            const orders = customer.orders || [];
            const insight = insightsMap[customer.id];

            const appointmentDates = appointments
                .map(a => a.startTime)
                .filter(Boolean)
                .sort((a, b) => new Date(a) - new Date(b));
            const orderDates = orders
                .map(o => o.createdAt)
                .filter(Boolean)
                .sort((a, b) => new Date(a) - new Date(b));

            // Calculate from appointments
            const completedAppointments = appointments.filter(a => a.status === 'completed');
            const appointmentSpending = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
            
            // Calculate from orders
            const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
            const orderSpending = completedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
            const totalProductsPurchased = orders.reduce((sum, o) => {
                const items = o.items || [];
                return sum + items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
            }, 0);

            // Combined totals
            const totalSpent = appointmentSpending + orderSpending;
            const firstAppointment = appointmentDates.length > 0 ? appointmentDates[0] : null;
            const firstOrder = orderDates.length > 0 ? orderDates[0] : null;
            
            // Determine last visit (most recent of appointment or order)
            const lastAppointment = appointmentDates.length > 0
                ? appointmentDates[appointmentDates.length - 1]
                : null;
            const lastOrder = orderDates.length > 0
                ? orderDates[orderDates.length - 1]
                : null;
            const lastVisit = lastAppointment && lastOrder
                ? (new Date(lastAppointment) > new Date(lastOrder) ? lastAppointment : lastOrder)
                : (lastAppointment || lastOrder);

            // Determine customer type
            let customerType = 'both';
            if (appointments.length > 0 && orders.length === 0) {
                customerType = 'service_only';
            } else if (appointments.length === 0 && orders.length > 0) {
                customerType = 'product_only';
            }

            // Format profile image URL
            const photoUrl = buildPublicAssetUrl(customer.profileImage);

            return {
                id: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phone: customer.phone,
                photo: photoUrl,
                gender: customer.gender,
                joinedAt: customer.createdAt,
                // Tenant-specific stats
                totalBookings: insight?.totalBookings || appointments.length,
                totalOrders: orders.length,
                totalProductsPurchased: totalProductsPurchased,
                totalSpent: insight?.totalSpent || totalSpent,
                lastVisit: insight?.lastVisit || lastVisit,
                firstVisit: insight?.firstVisit || (firstAppointment && firstOrder
                    ? (new Date(firstAppointment) < new Date(firstOrder) ? firstAppointment : firstOrder)
                    : (firstAppointment || firstOrder || null)),
                loyaltyTier: insight?.loyaltyTier || 'bronze',
                loyaltyPoints: insight?.tenantLoyaltyPoints || 0,
                noShowCount: insight?.noShowCount || appointments.filter(a => a.status === 'no_show').length,
                cancellationCount: insight?.cancellationCount || appointments.filter(a => a.status === 'cancelled').length,
                tags: insight?.tags || [],
                notes: insight?.notes || '',
                customerType: customerType
            };
        });

        // Apply post-filters
        let filteredCustomers = enrichedCustomers;
        
        if (loyaltyTier) {
            filteredCustomers = filteredCustomers.filter(c => c.loyaltyTier === loyaltyTier);
        }
        if (parseInt(minBookings) > 0) {
            filteredCustomers = filteredCustomers.filter(c => c.totalBookings >= parseInt(minBookings));
        }
        if (parseFloat(minSpent) > 0) {
            filteredCustomers = filteredCustomers.filter(c => c.totalSpent >= parseFloat(minSpent));
        }

        // Sort enriched data
        if (sortBy === 'totalSpent') {
            filteredCustomers.sort((a, b) => sortOrder === 'DESC' ? b.totalSpent - a.totalSpent : a.totalSpent - b.totalSpent);
        } else if (sortBy === 'totalBookings') {
            filteredCustomers.sort((a, b) => sortOrder === 'DESC' ? b.totalBookings - a.totalBookings : a.totalBookings - b.totalBookings);
        } else if (sortBy === 'lastVisit') {
            filteredCustomers.sort((a, b) => {
                const dateA = a.lastVisit ? new Date(a.lastVisit) : new Date(0);
                const dateB = b.lastVisit ? new Date(b.lastVisit) : new Date(0);
                return sortOrder === 'DESC' ? dateB - dateA : dateA - dateB;
            });
        } else if (sortBy === 'firstName') {
            filteredCustomers.sort((a, b) => {
                const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                return sortOrder === 'DESC' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
            });
        }

        // Re-apply pagination after filtering
        const filteredTotal = filteredCustomers.length;
        const paginatedFiltered = filteredCustomers.slice(offset, offset + parseInt(limit));

        res.json({
            success: true,
            data: {
                customers: paginatedFiltered,
                pagination: {
                    total: filteredTotal,
                    page: safePage,
                    limit: safeLimit,
                    totalPages: Math.ceil(filteredTotal / safeLimit)
                }
            }
        });

    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customers',
            error: error.message
        });
    }
};

/**
 * Get single customer with full details
 */
exports.getCustomer = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { id } = req.params;

        // Get platform user
        const customer = await db.PlatformUser.findByPk(id, {
            attributes: [
                'id', 'firstName', 'lastName', 'email', 'phone',
                'profileImage', 'gender', 'dateOfBirth', 'preferredLanguage', 'walletBalance',
                'createdAt'
            ]
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Get all appointments for this customer at this tenant
        const appointments = await db.Appointment.findAll({
            where: { platformUserId: id },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true,
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'category', 'image']
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name', 'photo']
                }
            ],
            order: [['startTime', 'DESC']]
        });

        // Get all orders for this customer at this tenant
        const orders = await db.Order.findAll({
            where: { 
                platformUserId: id,
                tenantId 
            },
            include: [
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar', 'image', 'category']
                        }
                    ],
                    attributes: ['id', 'quantity', 'unitPrice', 'totalPrice', 'productName', 'productNameAr', 'productImage']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const [walletLedgerEntries, giftCardTransactions] = await Promise.all([
            db.TenantWalletLedgerEntry.findAll({
                where: {
                    platformUserId: id,
                    tenantId
                },
                order: [['createdAt', 'DESC']],
                limit: 10
            }),
            db.GiftCardTransaction.findAll({
                where: {
                    [Op.or]: [
                        { senderPlatformUserId: id },
                        { recipientPlatformUserId: id }
                    ]
                },
                include: [
                    {
                        model: db.GiftCardPackage,
                        as: 'package',
                        required: false,
                        attributes: ['id', 'title', 'title_en', 'title_ar', 'priceAmount', 'walletCreditAmount', 'bonusAmount']
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: 10
            })
        ]);

        // Get or create customer insight
        let insight = await db.CustomerInsight.findOne({
            where: { platformUserId: id, tenantId }
        });

        // Calculate stats from appointments
        const completedAppointments = appointments.filter(a => a.status === 'completed');
        const appointmentSpending = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
        const avgBookingValue = completedAppointments.length > 0 ? appointmentSpending / completedAppointments.length : 0;

        // Calculate stats from orders
        const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
        const orderSpending = completedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
        const totalProductsPurchased = orders.reduce((sum, o) => {
            const items = o.items || [];
            return sum + items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
        }, 0);

        // Combined totals
        const totalSpent = appointmentSpending + orderSpending;

        // Service frequency
        const serviceFrequency = {};
        appointments.forEach(a => {
            const serviceName = a.service?.name_en || 'Unknown';
            serviceFrequency[serviceName] = (serviceFrequency[serviceName] || 0) + 1;
        });

        // Staff preference
        const staffFrequency = {};
        appointments.forEach(a => {
            if (a.staff) {
                staffFrequency[a.staff.name] = (staffFrequency[a.staff.name] || 0) + 1;
            }
        });

        // Time preference analysis
        const timeSlots = { morning: 0, afternoon: 0, evening: 0 };
        appointments.forEach(a => {
            const hour = new Date(a.startTime).getHours();
            if (hour < 12) timeSlots.morning++;
            else if (hour < 17) timeSlots.afternoon++;
            else timeSlots.evening++;
        });

        // Product frequency analysis
        const productFrequency = {};
        orders.forEach(o => {
            const items = o.items || [];
            items.forEach(item => {
                const productName = item.productName || item.product?.name_en || 'Unknown';
                productFrequency[productName] = (productFrequency[productName] || 0) + (item.quantity || 0);
            });
        });

        // Delivery preference
        const deliveryTypes = { pickup: 0, delivery: 0 };
        orders.forEach(o => {
            if (o.deliveryType === 'pickup') deliveryTypes.pickup++;
            else if (o.deliveryType === 'delivery') deliveryTypes.delivery++;
        });

        // Determine last visit (most recent of appointment or order)
        const lastAppointment = appointments.length > 0 ? appointments[0].startTime : null;
        const lastOrder = orders.length > 0 ? orders[0].createdAt : null;
        const lastVisit = lastAppointment && lastOrder
            ? (new Date(lastAppointment) > new Date(lastOrder) ? lastAppointment : lastOrder)
            : (lastAppointment || lastOrder);

        // Determine first visit
        const firstAppointment = appointments.length > 0 
            ? appointments[appointments.length - 1].startTime 
            : null;
        const firstOrder = orders.length > 0
            ? orders[orders.length - 1].createdAt
            : null;
        const firstVisit = firstAppointment && firstOrder
            ? (new Date(firstAppointment) < new Date(firstOrder) ? firstAppointment : firstOrder)
            : (firstAppointment || firstOrder);

        // Determine customer type
        let customerType = 'both';
        if (appointments.length > 0 && orders.length === 0) {
            customerType = 'service_only';
        } else if (appointments.length === 0 && orders.length > 0) {
            customerType = 'product_only';
        }

        const customerJson = customer.toJSON();
        // Ensure profileImage is properly formatted
        customerJson.profileImage = buildPublicAssetUrl(customerJson.profileImage);
        const currentWalletBalance = parseFloat(customerJson.walletBalance || 0);

        const mappedWalletLedgerEntries = walletLedgerEntries.map((entry) => ({
            id: entry.id,
            type: entry.type,
            direction: entry.direction,
            amount: parseFloat(entry.amount || 0),
            currency: entry.currency || 'SAR',
            balanceBefore: parseFloat(entry.balanceBefore || 0),
            balanceAfter: parseFloat(entry.balanceAfter || 0),
            referenceType: entry.referenceType || null,
            referenceId: entry.referenceId || null,
            metadata: entry.metadata || {},
            createdAt: entry.createdAt
        }));

        const mappedGiftCardTransactions = giftCardTransactions.map((tx) => ({
            id: tx.id,
            packageId: tx.packageId,
            packageTitle: tx.package?.title_en || tx.package?.title_ar || tx.package?.title || 'Gift card',
            purchaseAmount: parseFloat(tx.purchaseAmount || 0),
            creditAmount: parseFloat(tx.creditAmount || 0),
            bonusAmount: parseFloat(tx.bonusAmount || 0),
            totalCreditAmount: parseFloat(tx.totalCreditAmount || 0),
            status: tx.status,
            deliveryChannel: tx.deliveryChannel,
            senderPlatformUserId: tx.senderPlatformUserId || null,
            recipientPlatformUserId: tx.recipientPlatformUserId || null,
            recipientEmail: tx.recipientEmail || null,
            recipientPhone: tx.recipientPhone || null,
            deliveryMode: tx.deliveryMode || null,
            createdAt: tx.createdAt,
            claimedAt: tx.claimedAt || null
        }));

        const customerData = {
            ...customerJson,
            walletBalance: currentWalletBalance,
            // Stats
            totalBookings: appointments.length,
            totalOrders: orders.length,
            completedBookings: completedAppointments.length,
            totalProductsPurchased: totalProductsPurchased,
            totalSpent,
            averageBookingValue: avgBookingValue,
            // Dates
            firstVisit: firstVisit,
            lastVisit: lastVisit,
            // Behavior
            noShowCount: appointments.filter(a => a.status === 'no_show').length,
            cancellationCount: appointments.filter(a => a.status === 'cancelled').length,
            // Preferences
            favoriteServices: Object.entries(serviceFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count })),
            favoriteProducts: Object.entries(productFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count })),
            preferredStaff: Object.entries(staffFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, count]) => ({ name, count })),
            preferredTime: Object.entries(timeSlots)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'morning',
            preferredDeliveryType: Object.entries(deliveryTypes)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'pickup',
            // Loyalty
            loyaltyTier: insight?.loyaltyTier || 'bronze',
            loyaltyPoints: insight?.tenantLoyaltyPoints || 0,
            // Custom data
            tags: insight?.tags || [],
            notes: insight?.notes || '',
            customerType: customerType,
            walletSummary: {
                currentBalance: currentWalletBalance,
                walletLedgerCount: mappedWalletLedgerEntries.length,
                sentGiftCardCount: mappedGiftCardTransactions.filter((tx) => tx.senderPlatformUserId === id).length,
                receivedGiftCardCount: mappedGiftCardTransactions.filter((tx) => tx.recipientPlatformUserId === id).length
            },
            walletLedgerEntries: mappedWalletLedgerEntries,
            giftCardTransactions: mappedGiftCardTransactions,
            // All appointments (complete history)
            allAppointments: appointments.map(a => ({
                ...normalizeAppointmentPaymentState(a, 'appointment'),
                id: a.id,
                service: a.service,
                staff: a.staff,
                date: a.startTime,
                endTime: a.endTime,
                status: a.status,
                price: a.price,
                paymentStatus: a.paymentStatus,
                paymentMethod: a.paymentMethod,
                notes: a.notes,
                bookingReference: a.bookingReference || null,
                serviceVariantName: a.serviceVariantName || null,
                serviceVariantDuration: a.serviceVariantDuration || null,
                depositAmount: a.depositAmount ?? null,
                remainderAmount: a.remainderAmount ?? null,
                totalPaid: a.totalPaid ?? null
            })),
            // All orders (complete history)
            allOrders: orders.map(o => ({
                id: o.id,
                orderNumber: o.orderNumber,
                items: o.items || [],
                status: o.status,
                paymentStatus: o.paymentStatus,
                totalAmount: o.totalAmount,
                deliveryType: o.deliveryType,
                shippingAddress: o.shippingAddress,
                trackingNumber: o.trackingNumber,
                date: o.createdAt,
                expectedDeliveryDate: o.expectedDeliveryDate
            })),
            // Recent activity (for backward compatibility)
            recentAppointments: appointments.slice(0, 10).map(a => ({
                ...normalizeAppointmentPaymentState(a, 'appointment'),
                id: a.id,
                service: a.service,
                staff: a.staff,
                date: a.startTime,
                endTime: a.endTime,
                status: a.status,
                price: a.price,
                paymentStatus: a.paymentStatus,
                paymentMethod: a.paymentMethod,
                bookingReference: a.bookingReference || null,
                serviceVariantName: a.serviceVariantName || null,
                serviceVariantDuration: a.serviceVariantDuration || null,
                depositAmount: a.depositAmount ?? null,
                remainderAmount: a.remainderAmount ?? null,
                totalPaid: a.totalPaid ?? null
            })),
            recentOrders: orders.slice(0, 10).map(o => ({
                id: o.id,
                orderNumber: o.orderNumber,
                items: o.items,
                status: o.status,
                paymentStatus: o.paymentStatus,
                totalAmount: o.totalAmount,
                deliveryType: o.deliveryType,
                date: o.createdAt
            }))
        };

        res.json({
            success: true,
            data: customerData
        });

    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer details',
            error: error.message
        });
    }
};

/**
 * Update customer notes and tags (tenant-specific)
 */
exports.updateCustomerNotes = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const { notes, tags } = req.body;

        // Find or create customer insight
        let [insight, created] = await db.CustomerInsight.findOrCreate({
            where: { platformUserId: id, tenantId },
            defaults: {
                platformUserId: id,
                tenantId,
                notes: notes || '',
                tags: tags || []
            }
        });

        if (!created) {
            // Update existing
            if (notes !== undefined) insight.notes = notes;
            if (tags !== undefined) insight.tags = tags;
            await insight.save();
        }

        res.json({
            success: true,
            message: 'Customer notes updated',
            data: {
                notes: insight.notes,
                tags: insight.tags
            }
        });

    } catch (error) {
        console.error('Update customer notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update customer notes',
            error: error.message
        });
    }
};

/**
 * Get customer statistics summary for dashboard
 */
exports.getCustomerStats = async (req, res) => {
    try {
        const tenantId = req.tenant.id;

        // Get all appointments for this tenant
        const appointments = await db.Appointment.findAll({
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true,
                    attributes: []
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id']
                }
            ],
            attributes: ['platformUserId', 'status', 'price', 'startTime']
        });

        // Unique customers
        const uniqueCustomerIds = [...new Set(appointments.map(a => a.platformUserId).filter(Boolean))];
        const totalCustomers = uniqueCustomerIds.length;

        // New customers this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const newCustomersThisMonth = appointments.filter(a => {
            return a.startTime >= startOfMonth && a.platformUserId;
        });
        const newCustomerIds = [...new Set(newCustomersThisMonth.map(a => a.platformUserId))];

        // Calculate returning customers
        const customerBookingCounts = {};
        appointments.forEach(a => {
            if (a.platformUserId) {
                customerBookingCounts[a.platformUserId] = (customerBookingCounts[a.platformUserId] || 0) + 1;
            }
        });
        const returningCustomers = Object.values(customerBookingCounts).filter(count => count > 1).length;

        // Top spenders
        const customerSpending = {};
        appointments.filter(a => a.status === 'completed').forEach(a => {
            if (a.platformUserId) {
                customerSpending[a.platformUserId] = (customerSpending[a.platformUserId] || 0) + parseFloat(a.price || 0);
            }
        });

        // Get loyalty tier distribution
        const insights = await db.CustomerInsight.findAll({
            where: { tenantId },
            attributes: ['loyaltyTier']
        });

        const tierDistribution = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
        insights.forEach(i => {
            tierDistribution[i.loyaltyTier] = (tierDistribution[i.loyaltyTier] || 0) + 1;
        });

        res.json({
            success: true,
            data: {
                totalCustomers,
                newCustomersThisMonth: newCustomerIds.length,
                returningCustomers,
                returningRate: totalCustomers > 0 ? ((returningCustomers / totalCustomers) * 100).toFixed(1) : 0,
                averageBookingsPerCustomer: totalCustomers > 0 ? (appointments.length / totalCustomers).toFixed(1) : 0,
                loyaltyTierDistribution: tierDistribution
            }
        });

    } catch (error) {
        console.error('Get customer stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer statistics',
            error: error.message
        });
    }
};

/**
 * Get unified customer history (appointments + orders)
 */
exports.getCustomerHistory = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const { type, startDate, endDate, limit = 50 } = req.query;

        // Get appointments
        const appointmentWhere = { platformUserId: id };
        const appointmentStart = parseDateValue(startDate, false);
        const appointmentEnd = parseDateValue(endDate, true);
        if (appointmentStart) appointmentWhere.startTime = { [Op.gte]: appointmentStart };
        if (appointmentEnd) appointmentWhere.startTime = { ...appointmentWhere.startTime, [Op.lte]: appointmentEnd };

        const appointments = await db.Appointment.findAll({
            where: appointmentWhere,
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    where: { tenantId },
                    required: true,
                    attributes: ['id', 'name_en', 'name_ar', 'duration', 'category', 'image']
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name', 'photo']
                }
            ],
            order: [['startTime', 'DESC']],
            limit: type === 'order' ? 0 : parseInt(limit)
        });

        // Get orders
        const orderWhere = { 
            platformUserId: id,
            tenantId 
        };
        const orderStart = parseDateValue(startDate, false);
        const orderEnd = parseDateValue(endDate, true);
        if (orderStart) orderWhere.createdAt = { [Op.gte]: orderStart };
        if (orderEnd) orderWhere.createdAt = { ...orderWhere.createdAt, [Op.lte]: orderEnd };

        const orders = await db.Order.findAll({
            where: orderWhere,
            include: [
                {
                    model: db.OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: db.Product,
                            as: 'product',
                            attributes: ['id', 'name_en', 'name_ar', 'image', 'category']
                        }
                    ],
                    attributes: ['id', 'quantity', 'unitPrice', 'totalPrice', 'productName', 'productNameAr', 'productImage']
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: type === 'appointment' ? 0 : parseInt(limit)
        });

        // Combine and sort by date
        const history = [];

        appointments.forEach(apt => {
            const normalizedPayment = normalizeAppointmentPaymentState(apt, 'appointment');
            history.push({
                type: 'appointment',
                id: apt.id,
                date: apt.startTime,
                status: apt.status,
                paymentStatus: apt.paymentStatus,
                normalizedPaymentStatus: normalizedPayment.normalizedPaymentStatus,
                paidAmount: normalizedPayment.paidAmount,
                outstandingAmount: normalizedPayment.outstandingAmount,
                paymentEvidenceSource: normalizedPayment.paymentEvidenceSource,
                amount: parseFloat(apt.price || 0),
                details: {
                    service: apt.service,
                    staff: apt.staff,
                    duration: apt.service.duration,
                    startTime: apt.startTime,
                    endTime: apt.endTime,
                    notes: apt.notes
                }
            });
        });

        orders.forEach(order => {
            const items = order.items || [];
            history.push({
                type: 'order',
                id: order.id,
                date: order.createdAt,
                status: order.status,
                paymentStatus: order.paymentStatus,
                amount: parseFloat(order.totalAmount || 0),
                details: {
                    orderNumber: order.orderNumber,
                    items: items.map(item => ({
                        product: item.product || { name_en: item.productName, name_ar: item.productNameAr },
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice
                    })),
                    deliveryType: order.deliveryType,
                    shippingAddress: order.shippingAddress,
                    trackingNumber: order.trackingNumber
                }
            });
        });

        // Sort by date (most recent first)
        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Calculate summary
        const completedAppointments = appointments.filter(a => a.status === 'completed');
        const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
        const appointmentSpending = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
        const orderSpending = completedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);

        res.json({
            success: true,
            data: {
                history: history.slice(0, parseInt(limit)),
                summary: {
                    totalInteractions: history.length,
                    totalAppointments: appointments.length,
                    totalOrders: orders.length,
                    totalSpent: appointmentSpending + orderSpending,
                    appointmentSpending: appointmentSpending,
                    orderSpending: orderSpending,
                    firstInteraction: history.length > 0 ? history[history.length - 1].date : null,
                    lastInteraction: history.length > 0 ? history[0].date : null
                }
            }
        });

    } catch (error) {
        console.error('Get customer history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer history',
            error: error.message
        });
    }
};

/**
 * Get customer financial transactions (online + at-center ledger)
 */
exports.getCustomerTransactions = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const { startDate, endDate, limit = 50 } = req.query;
        const safeLimit = Math.max(parseInt(limit, 10) || 50, 1);
        const requestId = `cust_tx_${Date.now()}_${id}`;

        const appointmentStart = parseDateValue(startDate, false);
        const appointmentEnd = parseDateValue(endDate, true);

        const appointmentWhere = { platformUserId: id };
        if (appointmentStart || appointmentEnd) {
            appointmentWhere.startTime = {};
            if (appointmentStart) appointmentWhere.startTime[Op.gte] = appointmentStart;
            if (appointmentEnd) appointmentWhere.startTime[Op.lte] = appointmentEnd;
        }

        const orderWhere = { platformUserId: id, tenantId };
        if (appointmentStart || appointmentEnd) {
            orderWhere.createdAt = {};
            if (appointmentStart) orderWhere.createdAt[Op.gte] = appointmentStart;
            if (appointmentEnd) orderWhere.createdAt[Op.lte] = appointmentEnd;
        }

        const [appointments, orders] = await Promise.all([
            db.Appointment.findAll({
                where: appointmentWhere,
                include: [
                    {
                        model: db.Service,
                        as: 'service',
                        where: { tenantId },
                        required: true,
                        attributes: ['id', 'name_en', 'name_ar', 'duration']
                    },
                    {
                        model: db.Staff,
                        as: 'staff',
                        attributes: ['id', 'name', 'photo']
                    }
                ],
                attributes: ['id', 'bookingNumber', 'paymentMethod', 'startTime', 'endTime', 'price', 'status', 'paymentStatus', 'depositAmount', 'remainderAmount', 'totalPaid', 'notes'],
                order: [['startTime', 'DESC']]
            }),
            db.Order.findAll({
                where: orderWhere,
                include: [
                    {
                        model: db.OrderItem,
                        as: 'items',
                        include: [
                            {
                                model: db.Product,
                                as: 'product',
                                attributes: ['id', 'name_en', 'name_ar', 'image', 'category']
                            }
                        ],
                        attributes: ['id', 'quantity', 'unitPrice', 'totalPrice', 'productName', 'productNameAr', 'productImage']
                    }
                ],
                attributes: ['id', 'orderNumber', 'paymentMethod', 'paymentStatus', 'status', 'totalAmount', 'createdAt', 'deliveryType', 'shippingAddress', 'trackingNumber', 'expectedDeliveryDate'],
                order: [['createdAt', 'DESC']]
            })
        ]);
        logTenantAppointmentAudit('customer_transactions_source_counts', {
            requestId,
            tenantId,
            customerId: id,
            appointmentsCount: appointments.length,
            ordersCount: orders.length,
            startDate: startDate || null,
            endDate: endDate || null
        });

        const appointmentIds = appointments.map((row) => row.id);
        const orderIds = orders.map((row) => row.id);

        const [gatewayTransactions, ledgerTransactions] = await Promise.all([
            db.Transaction.findAll({
                where: {
                    platformUserId: id,
                    tenantId,
                    ...(appointmentStart || appointmentEnd ? {
                        createdAt: {
                            ...(appointmentStart ? { [Op.gte]: appointmentStart } : {}),
                            ...(appointmentEnd ? { [Op.lte]: appointmentEnd } : {})
                        }
                    } : {})
                },
                include: [
                    {
                        model: db.Appointment,
                        as: 'appointment',
                        attributes: ['id', 'bookingNumber', 'startTime', 'endTime', 'paymentStatus', 'status', 'paymentMethod', 'price', 'depositAmount', 'remainderAmount', 'totalPaid'],
                        required: false,
                        include: [
                            {
                                model: db.Service,
                                as: 'service',
                                attributes: ['id', 'name_en', 'name_ar', 'duration'],
                                required: false
                            },
                            {
                                model: db.Staff,
                                as: 'staff',
                                attributes: ['id', 'name', 'photo'],
                                required: false
                            }
                        ]
                    },
                    {
                        model: db.Order,
                        as: 'order',
                        attributes: ['id', 'orderNumber', 'paymentStatus', 'status', 'paymentMethod', 'totalAmount', 'createdAt', 'deliveryType', 'shippingAddress', 'trackingNumber', 'expectedDeliveryDate'],
                        required: false,
                        include: [
                            {
                                model: db.OrderItem,
                                as: 'items',
                                include: [
                                    {
                                        model: db.Product,
                                        as: 'product',
                                        attributes: ['id', 'name_en', 'name_ar', 'image', 'category'],
                                        required: false
                                    }
                                ],
                                required: false
                            }
                        ]
                    },
                    {
                        model: db.PaymentMethod,
                        as: 'paymentMethod',
                        attributes: ['id', 'type', 'cardBrand', 'cardLast4'],
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']]
            }),
            db.PaymentTransaction.findAll({
                where: {
                    [Op.or]: [
                        { appointmentId: { [Op.in]: appointmentIds.length ? appointmentIds : ['00000000-0000-0000-0000-000000000000'] } },
                        { orderId: { [Op.in]: orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000'] } }
                    ],
                    paymentMethod: { [Op.in]: ['cash', 'card_pos', 'wallet', 'bank_transfer'] },
                    ...(appointmentStart || appointmentEnd ? {
                        processedAt: {
                            ...(appointmentStart ? { [Op.gte]: appointmentStart } : {}),
                            ...(appointmentEnd ? { [Op.lte]: appointmentEnd } : {})
                        }
                    } : {})
                },
                include: [
                    {
                        model: db.Appointment,
                        as: 'appointment',
                        attributes: ['id', 'bookingNumber', 'startTime', 'endTime', 'paymentStatus', 'status', 'paymentMethod', 'price', 'depositAmount', 'remainderAmount', 'totalPaid'],
                        required: false,
                        include: [
                            {
                                model: db.Service,
                                as: 'service',
                                attributes: ['id', 'name_en', 'name_ar', 'duration'],
                                required: false
                            },
                            {
                                model: db.Staff,
                                as: 'staff',
                                attributes: ['id', 'name', 'photo'],
                                required: false
                            }
                        ]
                    },
                    {
                        model: db.Order,
                        as: 'order',
                        attributes: ['id', 'orderNumber', 'paymentStatus', 'status', 'paymentMethod', 'totalAmount', 'createdAt', 'deliveryType', 'shippingAddress', 'trackingNumber', 'expectedDeliveryDate'],
                        required: false,
                        include: [
                            {
                                model: db.OrderItem,
                                as: 'items',
                                include: [
                                    {
                                        model: db.Product,
                                        as: 'product',
                                        attributes: ['id', 'name_en', 'name_ar', 'image', 'category'],
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
                order: [['processedAt', 'DESC']]
            })
        ]);
        logTenantAppointmentAudit('customer_transactions_payment_records_loaded', {
            requestId,
            tenantId,
            customerId: id,
            gatewayTransactionsCount: gatewayTransactions.length,
            ledgerTransactionsCount: ledgerTransactions.length
        });

        const transactions = [];
        const seenRecords = new Set();
        const appointmentTransactionIds = new Set();

        gatewayTransactions.forEach((transaction) => {
            const entityType = transaction.appointment ? 'appointment' : 'order';
            const entityId = transaction.appointment?.id || transaction.order?.id || transaction.id;
            const key = `gateway:${entityType}:${entityId}:${transaction.type}:${transaction.amount}:${transaction.status}`;

            if (seenRecords.has(key)) {
                return;
            }

            seenRecords.add(key);
            if (transaction.appointment?.id) {
                appointmentTransactionIds.add(transaction.appointment.id);
            }
            transactions.push(mapCustomerTransactionRecord({
                id: transaction.id,
                source: 'transaction',
                kind: entityType,
                entityId,
                appointment: transaction.appointment,
                order: transaction.order,
                reference: transaction.appointment?.bookingNumber || transaction.order?.orderNumber || transaction.transactionRef || transaction.id,
                amount: transaction.amount,
                currency: transaction.currency,
                type: transaction.type,
                status: transaction.status,
                paymentMethod: transaction.paymentMethod || transaction.appointment?.paymentMethod || transaction.order?.paymentMethod || null,
                transactionRef: transaction.stripePaymentIntentId || transaction.stripeChargeId || transaction.transactionRef || null,
                notes: transaction.failureReason || transaction.notes || null,
                processedAt: transaction.createdAt,
                processor: transaction.paymentMethod?.user || null,
                detailPath: transaction.appointment
                    ? `/dashboard/appointments/${transaction.appointment.id}`
                    : transaction.order?.id
                        ? `/dashboard/orders/${transaction.order.id}`
                        : null
            }, locale));
        });

        ledgerTransactions.forEach((transaction) => {
            const entityType = transaction.appointment ? 'appointment' : 'order';
            const entityId = transaction.appointment?.id || transaction.order?.id || transaction.id;
            const key = `ledger:${entityType}:${entityId}:${transaction.type}:${transaction.amount}:${transaction.status}`;

            if (seenRecords.has(key)) {
                return;
            }

            seenRecords.add(key);
            if (transaction.appointment?.id) {
                appointmentTransactionIds.add(transaction.appointment.id);
            }
            transactions.push(mapCustomerTransactionRecord({
                id: transaction.id,
                source: 'ledger',
                kind: entityType,
                entityId,
                appointment: transaction.appointment,
                order: transaction.order,
                reference: transaction.appointment?.bookingNumber || transaction.order?.orderNumber || transaction.transactionRef || transaction.id,
                amount: transaction.amount,
                currency: transaction.currency,
                type: transaction.type,
                status: transaction.status,
                paymentMethod: transaction.paymentMethod || transaction.appointment?.paymentMethod || transaction.order?.paymentMethod || null,
                transactionRef: transaction.transactionRef || null,
                notes: transaction.notes || null,
                processedAt: transaction.processedAt,
                processor: transaction.processor,
                detailPath: transaction.appointment
                    ? `/dashboard/appointments/${transaction.appointment.id}`
                    : transaction.order?.id
                        ? `/dashboard/orders/${transaction.order.id}`
                        : null
            }, locale));
        });

        appointments.forEach((appointment) => {
            const normalizedPaymentStatus = (appointment.paymentStatus || '').toLowerCase();
            const isPaidAppointment = ['deposit_paid', 'fully_paid', 'paid', 'refunded', 'partially_refunded'].includes(normalizedPaymentStatus);

            if (!isPaidAppointment || appointmentTransactionIds.has(appointment.id)) {
                return;
            }

            const paidAmount = Number(
                appointment.totalPaid ??
                (normalizedPaymentStatus === 'deposit_paid' ? appointment.depositAmount : null) ??
                appointment.price ??
                0
            );

            if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
                return;
            }

            const syntheticStatus = normalizedPaymentStatus === 'refunded' || normalizedPaymentStatus === 'partially_refunded'
                ? normalizedPaymentStatus
                : 'completed';
            const syntheticType = normalizedPaymentStatus === 'refunded' || normalizedPaymentStatus === 'partially_refunded'
                ? 'refund'
                : 'payment';

            const syntheticRecordKey = `appointment-derived:${appointment.id}:${syntheticType}:${paidAmount}:${syntheticStatus}`;
            if (seenRecords.has(syntheticRecordKey)) {
                return;
            }

            seenRecords.add(syntheticRecordKey);
            transactions.push(mapCustomerTransactionRecord({
                id: `appointment-derived-${appointment.id}`,
                source: 'appointment',
                kind: 'appointment',
                entityId: appointment.id,
                appointment,
                reference: appointment.bookingNumber || appointment.id,
                amount: paidAmount,
                currency: 'SAR',
                type: syntheticType,
                status: syntheticStatus,
                paymentMethod: appointment.paymentMethod || null,
                transactionRef: appointment.bookingNumber || null,
                notes: locale === 'ar'
                    ? 'مستخرج من حالة الدفع الخاصة بالموعد'
                    : 'Derived from appointment payment status',
                processedAt: appointment.endTime || appointment.startTime,
                processor: null,
                detailPath: `/dashboard/appointments/${appointment.id}`
            }, locale));
        });

        transactions.sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());

        const pagedTransactions = transactions.slice(0, safeLimit);
        const completedTotal = pagedTransactions
            .filter((item) => item.status === 'completed' || item.status === 'paid')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const refundedTotal = pagedTransactions
            .filter((item) => item.status === 'refunded' || item.type === 'refund')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const appointmentStatusCounts = appointments.reduce((acc, appointment) => {
            const key = `${appointment.paymentStatus || 'unknown'}`.toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        logTenantAppointmentAudit('customer_transactions_composed', {
            requestId,
            tenantId,
            customerId: id,
            totalComposedTransactions: transactions.length,
            returnedTransactions: pagedTransactions.length,
            appointmentStatusCounts,
            completedTotal: parseFloat(completedTotal.toFixed(2)),
            refundedTotal: parseFloat(refundedTotal.toFixed(2))
        });

        res.json({
            success: true,
            data: {
                transactions: pagedTransactions,
                summary: {
                    totalTransactions: transactions.length,
                    completedTotal: parseFloat(completedTotal.toFixed(2)),
                    refundedTotal: parseFloat(refundedTotal.toFixed(2)),
                    netTotal: parseFloat((completedTotal - refundedTotal).toFixed(2)),
                    appointmentCount: pagedTransactions.filter((item) => item.entityType === 'appointment').length,
                    orderCount: pagedTransactions.filter((item) => item.entityType === 'order').length
                }
            }
        });
    } catch (error) {
        console.error('Get customer transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer transactions',
            error: error.message
        });
    }
};

/**
 * Export customers to CSV
 */
exports.exportCustomers = async (req, res) => {
    try {
        const tenantId = req.tenant.id;

        // Get all customers with their data
        const customers = await db.PlatformUser.findAll({
            include: [
                {
                    model: db.Appointment,
                    as: 'appointments',
                    required: true,
                    include: [
                        {
                            model: db.Service,
                            as: 'service',
                            where: { tenantId },
                            required: true,
                            attributes: ['id']
                        }
                    ],
                    attributes: ['id', 'status', 'price', 'startTime']
                }
            ],
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'gender', 'createdAt']
        });

        // Get insights
        const customerIds = customers.map(c => c.id);
        const insights = await db.CustomerInsight.findAll({
            where: {
                platformUserId: { [Op.in]: customerIds },
                tenantId
            }
        });

        const insightsMap = {};
        insights.forEach(i => {
            insightsMap[i.platformUserId] = i;
        });

        // Build CSV
        const csvRows = [
            ['Name', 'Email', 'Phone', 'Gender', 'Total Bookings', 'Total Spent', 'Loyalty Tier', 'First Visit', 'Last Visit', 'Tags'].join(',')
        ];

        customers.forEach(customer => {
            const insight = insightsMap[customer.id];
            const appointments = customer.appointments || [];
            const completedAppointments = appointments.filter(a => a.status === 'completed');
            const totalSpent = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);

            csvRows.push([
                `"${customer.firstName} ${customer.lastName}"`,
                customer.email,
                customer.phone,
                customer.gender || '',
                appointments.length,
                totalSpent.toFixed(2),
                insight?.loyaltyTier || 'bronze',
                appointments.length > 0 ? new Date(appointments[appointments.length - 1].startTime).toISOString().split('T')[0] : '',
                appointments.length > 0 ? new Date(appointments[0].startTime).toISOString().split('T')[0] : '',
                `"${(insight?.tags || []).join(', ')}"`
            ].join(','));
        });

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
        res.send(csv);

    } catch (error) {
        console.error('Export customers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export customers',
            error: error.message
        });
    }
};

