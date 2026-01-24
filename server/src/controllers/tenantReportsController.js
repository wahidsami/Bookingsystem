/**
 * Tenant Reports Controller
 * Generates analytics and reports for the tenant dashboard
 */

const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Get dashboard summary report
 */
exports.getDashboardSummary = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate) dateFilter[Op.gte] = new Date(startDate);
        if (endDate) dateFilter[Op.lte] = new Date(endDate);

        // Get all appointments with services for this tenant
        const appointments = await db.Appointment.findAll({
            where: {
                ...(startDate || endDate ? { startTime: dateFilter } : {})
            },
            include: [{
                model: db.Service,
                as: 'service',
                where: { tenantId },
                required: true,
                attributes: ['id']
            }],
            attributes: ['id', 'status', 'price', 'paymentStatus', 'startTime', 'platformUserId']
        });

        // Calculate metrics
        const totalBookings = appointments.length;
        const completedBookings = appointments.filter(a => a.status === 'completed').length;
        const cancelledBookings = appointments.filter(a => a.status === 'cancelled').length;
        const noShowBookings = appointments.filter(a => a.status === 'no_show').length;
        
        const completedAppointments = appointments.filter(a => a.status === 'completed');
        const totalRevenue = completedAppointments.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
        const paidRevenue = completedAppointments.filter(a => a.paymentStatus === 'paid')
            .reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
        const pendingRevenue = completedAppointments.filter(a => a.paymentStatus === 'pending')
            .reduce((sum, a) => sum + parseFloat(a.price || 0), 0);

        // Unique customers
        const uniqueCustomers = [...new Set(appointments.map(a => a.platformUserId).filter(Boolean))].length;

        // Completion rate
        const completionRate = totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0;

        // Average booking value
        const avgBookingValue = completedBookings > 0 ? (totalRevenue / completedBookings).toFixed(2) : 0;

        res.json({
            success: true,
            data: {
                totalBookings,
                completedBookings,
                cancelledBookings,
                noShowBookings,
                totalRevenue,
                paidRevenue,
                pendingRevenue,
                uniqueCustomers,
                completionRate,
                avgBookingValue
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

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const appointments = await db.Appointment.findAll({
            where: {
                startTime: {
                    [Op.gte]: start,
                    [Op.lte]: end
                }
            },
            include: [{
                model: db.Service,
                as: 'service',
                where: { tenantId },
                required: true,
                attributes: []
            }],
            attributes: ['startTime', 'status', 'price']
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

        const dateFilter = {};
        if (startDate) dateFilter[Op.gte] = new Date(startDate);
        if (endDate) dateFilter[Op.lte] = new Date(endDate);

        // Get services with their bookings
        const services = await db.Service.findAll({
            where: { tenantId },
            include: [{
                model: db.Appointment,
                as: 'appointments',
                where: startDate || endDate ? { startTime: dateFilter } : {},
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

        const dateFilter = {};
        if (startDate) dateFilter[Op.gte] = new Date(startDate);
        if (endDate) dateFilter[Op.lte] = new Date(endDate);

        // Get employees with their appointments
        const employees = await db.Staff.findAll({
            where: { tenantId },
            include: [{
                model: db.Appointment,
                as: 'appointments',
                where: startDate || endDate ? { startTime: dateFilter } : {},
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

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const appointments = await db.Appointment.findAll({
            where: {
                startTime: {
                    [Op.gte]: start,
                    [Op.lte]: end
                }
            },
            include: [{
                model: db.Service,
                as: 'service',
                where: { tenantId },
                required: true,
                attributes: []
            }],
            attributes: ['startTime', 'status']
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

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const appointments = await db.Appointment.findAll({
            where: {
                startTime: {
                    [Op.gte]: start,
                    [Op.lte]: end
                },
                platformUserId: { [Op.ne]: null }
            },
            include: [{
                model: db.Service,
                as: 'service',
                where: { tenantId },
                required: true,
                attributes: []
            }],
            attributes: ['platformUserId', 'status', 'price', 'startTime']
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

