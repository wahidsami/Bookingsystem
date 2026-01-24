/**
 * Tenant Financial Controller
 * Handles financial reporting and analytics for authenticated tenants
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Get financial overview/summary
 * GET /api/v1/tenant/financial/overview
 */
exports.getFinancialOverview = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;

        // Build date filter for appointments
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.startTime = {};
            if (startDate) dateFilter.startTime[Op.gte] = new Date(startDate);
            if (endDate) dateFilter.startTime[Op.lte] = new Date(endDate);
        }

        // Build date filter for orders
        const orderDateFilter = {};
        if (startDate || endDate) {
            orderDateFilter.createdAt = {};
            if (startDate) orderDateFilter.createdAt[Op.gte] = new Date(startDate);
            if (endDate) orderDateFilter.createdAt[Op.lte] = new Date(endDate);
        }

        // Get completed appointments with financials
        const appointments = await db.Appointment.findAll({
            where: {
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
                'id', 'price', 'rawPrice', 'taxAmount', 'platformFee', 
                'tenantRevenue', 'employeeCommission', 'paymentStatus', 'status'
            ]
        });

        // Get product orders with financials
        const orderWhere = {
            tenantId,
            status: { [Op.in]: ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed'] }
        };
        
        // Add date filter if provided
        if (orderDateFilter.createdAt && Object.keys(orderDateFilter.createdAt).length > 0) {
            orderWhere.createdAt = orderDateFilter.createdAt;
        }
        
        const orders = await db.Order.findAll({
            where: orderWhere,
            attributes: [
                'id', 'totalAmount', 'platformFee', 
                'paymentStatus', 'status', 'createdAt'
            ]
        });

        // Calculate totals from appointments
        const appointmentTotals = {
            totalRevenue: 0,
            totalRawPrice: 0,
            totalTax: 0,
            totalPlatformFees: 0,
            totalTenantRevenue: 0,
            totalEmployeeCommissions: 0,
            totalBookings: appointments.length,
            paidBookings: 0,
            pendingPayments: 0,
            completedBookings: 0
        };

        appointments.forEach(appt => {
            appointmentTotals.totalRevenue += parseFloat(appt.price || 0);
            appointmentTotals.totalRawPrice += parseFloat(appt.rawPrice || 0);
            appointmentTotals.totalTax += parseFloat(appt.taxAmount || 0);
            appointmentTotals.totalPlatformFees += parseFloat(appt.platformFee || 0);
            appointmentTotals.totalTenantRevenue += parseFloat(appt.tenantRevenue || 0);
            appointmentTotals.totalEmployeeCommissions += parseFloat(appt.employeeCommission || 0);

            if (appt.paymentStatus === 'paid') {
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
            totalOrders: orders.length,
            paidOrders: 0,
            pendingPayments: 0,
            completedOrders: 0
        };

        orders.forEach(order => {
            const totalAmount = parseFloat(order.totalAmount || 0);
            const platformFee = parseFloat(order.platformFee || 0);
            const tenantRevenue = totalAmount - platformFee;
            
            orderTotals.totalRevenue += totalAmount;
            orderTotals.totalPlatformFees += platformFee;
            orderTotals.totalTenantRevenue += tenantRevenue;

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
            totalRevenue: appointmentTotals.totalRevenue + orderTotals.totalRevenue,
            totalRawPrice: appointmentTotals.totalRawPrice, // Only from appointments
            totalTax: appointmentTotals.totalTax, // Only from appointments
            totalPlatformFees: appointmentTotals.totalPlatformFees + orderTotals.totalPlatformFees,
            totalTenantRevenue: appointmentTotals.totalTenantRevenue + orderTotals.totalTenantRevenue,
            totalEmployeeCommissions: appointmentTotals.totalEmployeeCommissions, // Only from appointments
            netRevenue: (appointmentTotals.totalTenantRevenue + orderTotals.totalTenantRevenue) - appointmentTotals.totalEmployeeCommissions,
            // Booking/Order counts
            totalBookings: appointmentTotals.totalBookings,
            totalOrders: orderTotals.totalOrders,
            paidBookings: appointmentTotals.paidBookings,
            paidOrders: orderTotals.paidOrders,
            pendingPayments: appointmentTotals.pendingPayments + orderTotals.pendingPayments,
            completedBookings: appointmentTotals.completedBookings,
            completedOrders: orderTotals.completedOrders,
            // Separate breakdowns
            appointmentRevenue: appointmentTotals.totalRevenue,
            orderRevenue: orderTotals.totalRevenue,
            appointmentTenantRevenue: appointmentTotals.totalTenantRevenue,
            orderTenantRevenue: orderTotals.totalTenantRevenue
        };

        // Round all values
        Object.keys(overview).forEach(key => {
            if (typeof overview[key] === 'number' && 
                key !== 'totalBookings' && key !== 'totalOrders' &&
                key !== 'paidBookings' && key !== 'paidOrders' &&
                key !== 'completedBookings' && key !== 'completedOrders') {
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
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.startTime = {};
            if (startDate) dateFilter.startTime[Op.gte] = new Date(startDate);
            if (endDate) dateFilter.startTime[Op.lte] = new Date(endDate);
        }

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
                if (appt.paymentStatus === 'paid') {
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
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.startTime = {};
            if (startDate) dateFilter.startTime[Op.gte] = new Date(startDate);
            if (endDate) dateFilter.startTime[Op.lte] = new Date(endDate);
        }

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
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

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

        // Fill in missing dates with zeros
        const result = [];
        let current = new Date(start);
        while (current <= end) {
            const dateKey = current.toISOString().split('T')[0];
            result.push(dailyData[dateKey] || {
                date: dateKey,
                bookings: 0,
                orders: 0,
                revenue: 0,
                tenantRevenue: 0
            });
            current.setDate(current.getDate() + 1);
        }

        // Round values
        result.forEach(day => {
            day.revenue = parseFloat(day.revenue.toFixed(2));
            day.tenantRevenue = parseFloat(day.tenantRevenue.toFixed(2));
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
        const orderDateFilter = {};
        if (startDate || endDate) {
            orderDateFilter.createdAt = {};
            if (startDate) orderDateFilter.createdAt[Op.gte] = new Date(startDate);
            if (endDate) orderDateFilter.createdAt[Op.lte] = new Date(endDate);
        }

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
            if (orderDateFilter.createdAt && Object.keys(orderDateFilter.createdAt).length > 0) {
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
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.startTime = {};
            if (startDate) dateFilter.startTime[Op.gte] = new Date(startDate);
            if (endDate) dateFilter.startTime[Op.lte] = new Date(endDate);
        }

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
            paidBookings: appointments.filter(a => a.paymentStatus === 'paid').length,
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

