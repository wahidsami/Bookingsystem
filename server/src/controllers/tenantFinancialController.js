/**
 * Tenant Financial Controller
 * Handles financial reporting and analytics for authenticated tenants
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { isAppointmentFullyPaid } = require('../utils/appointmentPaymentStatus');

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

/**
 * Get financial overview/summary
 * GET /api/v1/tenant/financial/overview
 */
exports.getFinancialOverview = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;

        // Build date filter for appointments
        const dateFilter = buildDateRangeWhere('startTime', startDate, endDate);

        // Build date filter for orders
        const orderDateFilter = buildDateRangeWhere('createdAt', startDate, endDate);

        // Get all appointments for KPI counters (status distribution, unique customers, completion rate)
        const allAppointments = await db.Appointment.findAll({
            where: {
                ...buildTenantAppointmentScope(tenantId),
                ...dateFilter
            },
            include: getTenantAppointmentIncludes(),
            attributes: ['id', 'status', 'platformUserId', 'startTime', 'tenantId'],
            subQuery: false
        });

        // Get monetized appointments with financials
        const appointments = await db.Appointment.findAll({
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
        
        const orders = await db.Order.findAll({
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

        const giftCards = await db.TenantGiftCardTransaction.findAll({
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
        const overview = {
            // Combined totals
            totalRevenue: appointmentTotals.totalRevenue + orderTotals.totalRevenue + giftCardTotals.totalRevenue,
            totalRawPrice: appointmentTotals.totalRawPrice, // Only from appointments
            totalTax: appointmentTotals.totalTax, // Only from appointments
            totalPlatformFees: appointmentTotals.totalPlatformFees + orderTotals.totalPlatformFees,
            totalTenantRevenue: appointmentTotals.totalTenantRevenue + orderTotals.totalTenantRevenue + giftCardTotals.totalRevenue,
            totalEmployeeCommissions: appointmentTotals.totalEmployeeCommissions, // Only from appointments
            netRevenue: (appointmentTotals.totalTenantRevenue + orderTotals.totalTenantRevenue + giftCardTotals.totalRevenue) - appointmentTotals.totalEmployeeCommissions,
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
            totalDiscountAmount: parseFloat((appointmentTotals.totalDiscountAmount + orderTotals.totalDiscountAmount).toFixed(2)),
            appointmentDiscountAmount: parseFloat(appointmentTotals.totalDiscountAmount.toFixed(2)),
            orderDiscountAmount: parseFloat(orderTotals.totalDiscountAmount.toFixed(2)),
            discountedBookings: appointmentTotals.discountedBookings,
            discountedOrders: orderTotals.discountedOrders,
            // Separate breakdowns
            appointmentRevenue: appointmentTotals.totalRevenue,
            orderRevenue: orderTotals.totalRevenue,
            giftCardRevenue: giftCardTotals.totalRevenue,
            giftCardTransactions: giftCardTotals.totalTransactions,
            appointmentTenantRevenue: appointmentTotals.totalTenantRevenue,
            orderTenantRevenue: orderTotals.totalTenantRevenue,
            giftCardTenantRevenue: giftCardTotals.totalRevenue,
            discountTotals: {
                totalDiscountAmount: parseFloat((appointmentTotals.totalDiscountAmount + orderTotals.totalDiscountAmount).toFixed(2)),
                appointmentDiscountAmount: parseFloat(appointmentTotals.totalDiscountAmount.toFixed(2)),
                orderDiscountAmount: parseFloat(orderTotals.totalDiscountAmount.toFixed(2)),
                discountedBookings: appointmentTotals.discountedBookings,
                discountedOrders: orderTotals.discountedOrders,
                averageDiscountAmount: parseFloat(((appointmentTotals.totalDiscountAmount + orderTotals.totalDiscountAmount) / Math.max(appointmentTotals.discountedBookings + orderTotals.discountedOrders, 1)).toFixed(2)),
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
 * Get employee revenue breakdown
 * GET /api/v1/tenant/financial/employees
 */
exports.getEmployeeRevenue = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate, staffId } = req.query;

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

            const stats = {
                id: employee.id,
                name: employee.name,
                photo: employee.photo,
                baseSalary: parseFloat(employee.salary || 0),
                commissionRate: parseFloat(employee.commissionRate || 0),
                totalBookings: appointments.length,
                paidBookings: 0,
                totalRevenueGenerated: 0,
                totalCommission: 0,
                totalEarnings: 0
            };

            appointments.forEach(appt => {
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

        // Build date filter
        const dateFilter = buildDateRangeWhere('startTime', startDate, endDate);

        // Get all services for this tenant
        const services = await db.Service.findAll({
            where: { tenantId },
            attributes: ['id', 'name_en', 'name_ar', 'category', 'rawPrice', 'finalPrice'],
            order: [['name_en', 'ASC']]
        });

        const serviceRevenue = [];

        for (const service of services) {
            const appointments = await db.Appointment.findAll({
                where: {
                    serviceId: service.id,
                    ...dateFilter,
                    status: { [Op.in]: ['completed', 'confirmed'] }
                },
                attributes: ['id', 'price', 'rawPrice', 'taxAmount', 'platformFee', 'tenantRevenue']
            });

            const stats = {
                id: service.id,
                name_en: service.name_en,
                name_ar: service.name_ar,
                category: service.category,
                servicePrice: parseFloat(service.finalPrice || 0),
                totalBookings: appointments.length,
                totalRevenue: 0,
                totalTax: 0,
                totalPlatformFees: 0,
                totalTenantRevenue: 0
            };

            appointments.forEach(appt => {
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

        // Default to last 30 days
        const fallbackEnd = new Date();
        fallbackEnd.setHours(23, 59, 59, 999);
        const end = parseDateValue(endDate, true) || fallbackEnd;
        const fallbackStart = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        fallbackStart.setHours(0, 0, 0, 0);
        const start = parseDateValue(startDate, false) || fallbackStart;

        const appointments = await db.Appointment.findAll({
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
        });

        // Get orders in the date range
        const orders = await db.Order.findAll({
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
        });

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
 * Get revenue by product
 * GET /api/v1/tenant/financial/products
 */
exports.getProductRevenue = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;

        // Build date filter for orders
        const orderDateFilter = buildDateRangeWhere('createdAt', startDate, endDate);

        // Get all products for this tenant
        const products = await db.Product.findAll({
            where: { tenantId },
            attributes: ['id', 'name_en', 'name_ar', 'category', 'price'],
            order: [['name_en', 'ASC']]
        });

        const productRevenue = [];

        for (const product of products) {
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
                totalOrders: 0,
                totalQuantity: 0,
                totalRevenue: 0,
                totalPlatformFees: 0,
                totalTenantRevenue: 0
            };

            // Track unique orders
            const orderIds = new Set();

            orderItems.forEach(item => {
                if (item.order) {
                    orderIds.add(item.order.id);
                    stats.totalQuantity += item.quantity || 0;
                    stats.totalRevenue += parseFloat(item.totalPrice || 0);
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
            totalTenantRevenue: productRevenue.reduce((sum, p) => sum + p.totalTenantRevenue, 0)
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

