/**
 * Tenant Customer Controller
 * Manages customers (platform users who have booked with this tenant)
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Get all customers who have booked with this tenant
 */
exports.getCustomers = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
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

        const offset = (parseInt(page) - 1) * parseInt(limit);
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
                    attributes: ['id', 'startTime', 'status', 'price']
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

        // Apply pagination
        const total = allCustomers.length;
        const paginatedCustomers = allCustomers.slice(offset, offset + parseInt(limit));

        // Enrich with customer insights
        const customerIds = paginatedCustomers.map(c => c.id);
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

        // Calculate stats for each customer
        const enrichedCustomers = paginatedCustomers.map(customer => {
            const appointments = customer.appointments || [];
            const orders = customer.orders || [];
            const insight = insightsMap[customer.id];

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
            
            // Determine last visit (most recent of appointment or order)
            const lastAppointment = appointments.length > 0 
                ? appointments.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0]?.startTime 
                : null;
            const lastOrder = orders.length > 0
                ? orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt
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
            let photoUrl = customer.profileImage;
            if (photoUrl && !photoUrl.startsWith('http')) {
                if (photoUrl.startsWith('/')) {
                    photoUrl = `http://localhost:5000${photoUrl}`;
                } else if (photoUrl.startsWith('profiles/')) {
                    photoUrl = `http://localhost:5000/uploads/${photoUrl}`;
                } else {
                    photoUrl = `http://localhost:5000/uploads/profiles/${photoUrl}`;
                }
            }

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
                firstVisit: insight?.firstVisit || (appointments.length > 0 
                    ? appointments.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0].startTime 
                    : (orders.length > 0 ? orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0].createdAt : null)),
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
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(filteredTotal / parseInt(limit))
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
                'profileImage', 'gender', 'dateOfBirth', 'preferredLanguage',
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
        if (customerJson.profileImage && !customerJson.profileImage.startsWith('http')) {
            // Handle both /uploads/profiles/ and /uploads/ paths
            if (customerJson.profileImage.startsWith('/')) {
                customerJson.profileImage = `http://localhost:5000${customerJson.profileImage}`;
            } else if (customerJson.profileImage.startsWith('profiles/')) {
                customerJson.profileImage = `http://localhost:5000/uploads/${customerJson.profileImage}`;
            } else {
                customerJson.profileImage = `http://localhost:5000/uploads/profiles/${customerJson.profileImage}`;
            }
        }

        const customerData = {
            ...customerJson,
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
            // All appointments (complete history)
            allAppointments: appointments.map(a => ({
                id: a.id,
                service: a.service,
                staff: a.staff,
                date: a.startTime,
                endTime: a.endTime,
                status: a.status,
                price: a.price,
                paymentStatus: a.paymentStatus,
                notes: a.notes
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
                id: a.id,
                service: a.service,
                staff: a.staff,
                date: a.startTime,
                status: a.status,
                price: a.price,
                paymentStatus: a.paymentStatus
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
        if (startDate) appointmentWhere.startTime = { [Op.gte]: new Date(startDate) };
        if (endDate) appointmentWhere.startTime = { ...appointmentWhere.startTime, [Op.lte]: new Date(endDate) };

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
        if (startDate) orderWhere.createdAt = { [Op.gte]: new Date(startDate) };
        if (endDate) orderWhere.createdAt = { ...orderWhere.createdAt, [Op.lte]: new Date(endDate) };

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
            history.push({
                type: 'appointment',
                id: apt.id,
                date: apt.startTime,
                status: apt.status,
                paymentStatus: apt.paymentStatus,
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

