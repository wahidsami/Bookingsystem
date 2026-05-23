/**
 * Tenant Dashboard Controller
 * Provides dashboard statistics and today's appointments
 */

const db = require('../models');
const { Op } = require('sequelize');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const {
    ACTIVE_APPOINTMENT_STATUSES,
    REVENUE_TRACKED_APPOINTMENT_STATUSES
} = require('../utils/appointmentStatus');

/**
 * Get Dashboard Statistics
 * GET /api/v1/tenant/dashboard/stats
 */
const getDashboardStats = async (req, res) => {
    try {
        const tenantId = req.tenantId;

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get today's bookings count
        const todaysBookings = await db.sequelize.query(`
            SELECT COUNT(*) as count
            FROM appointments a
            INNER JOIN staff s ON a."staffId" = s.id
            WHERE s."tenantId" = :tenantId
            AND DATE(a."startTime") = CURRENT_DATE
            AND a.status IN (:activeStatuses)
        `, {
            replacements: { tenantId, activeStatuses: ACTIVE_APPOINTMENT_STATUSES },
            type: db.sequelize.QueryTypes.SELECT,
            raw: true
        });

        const todaysBookingCount = parseInt(todaysBookings[0]?.count || 0);

        const yesterdayBookingsResult = await db.sequelize.query(`
            SELECT COUNT(*) as count
            FROM appointments a
            INNER JOIN staff s ON a."staffId" = s.id
            WHERE s."tenantId" = :tenantId
            AND DATE(a."startTime") = CURRENT_DATE - INTERVAL '1 day'
            AND a.status IN (:activeStatuses)
        `, {
            replacements: { tenantId, activeStatuses: ACTIVE_APPOINTMENT_STATUSES },
            type: db.sequelize.QueryTypes.SELECT,
            raw: true
        });

        const yesterdayBookingCount = parseInt(yesterdayBookingsResult[0]?.count || 0);

        // Get total revenue from appointments (all time)
        // Join with Staff to filter by tenant
        // Include both completed and confirmed appointments to match financial overview
        const appointmentRevenueResult = await db.sequelize.query(`
            SELECT SUM(a.price) as "totalRevenue"
            FROM appointments a
            INNER JOIN staff s ON a."staffId" = s.id
            WHERE s."tenantId" = :tenantId
            AND a.status IN (:revenueStatuses)
        `, {
            replacements: { tenantId, revenueStatuses: REVENUE_TRACKED_APPOINTMENT_STATUSES },
            type: db.sequelize.QueryTypes.SELECT,
            raw: true
        });

        const appointmentRevenue = parseFloat(appointmentRevenueResult[0]?.totalRevenue || 0);

        const todaysAppointmentRevenueResult = await db.sequelize.query(`
            SELECT SUM(a.price) as "totalRevenue"
            FROM appointments a
            INNER JOIN staff s ON a."staffId" = s.id
            WHERE s."tenantId" = :tenantId
            AND DATE(a."startTime") = CURRENT_DATE
            AND a.status IN (:revenueStatuses)
        `, {
            replacements: { tenantId, revenueStatuses: REVENUE_TRACKED_APPOINTMENT_STATUSES },
            type: db.sequelize.QueryTypes.SELECT,
            raw: true
        });

        const yesterdayAppointmentRevenueResult = await db.sequelize.query(`
            SELECT SUM(a.price) as "totalRevenue"
            FROM appointments a
            INNER JOIN staff s ON a."staffId" = s.id
            WHERE s."tenantId" = :tenantId
            AND DATE(a."startTime") = CURRENT_DATE - INTERVAL '1 day'
            AND a.status IN (:revenueStatuses)
        `, {
            replacements: { tenantId, revenueStatuses: REVENUE_TRACKED_APPOINTMENT_STATUSES },
            type: db.sequelize.QueryTypes.SELECT,
            raw: true
        });

        const todaysPurchaseRevenueResult = await db.sequelize.query(`
            SELECT
                COALESCE(SUM(o."totalAmount"), 0) - COALESCE(SUM(o."platformFee"), 0) as "totalRevenue"
            FROM orders o
            WHERE o."tenantId" = :tenantId
            AND DATE(o."createdAt") = CURRENT_DATE
            AND o.status IN ('confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed')
        `, {
            replacements: { tenantId },
            type: db.sequelize.QueryTypes.SELECT,
            raw: true
        });

        const yesterdayPurchaseRevenueResult = await db.sequelize.query(`
            SELECT
                COALESCE(SUM(o."totalAmount"), 0) - COALESCE(SUM(o."platformFee"), 0) as "totalRevenue"
            FROM orders o
            WHERE o."tenantId" = :tenantId
            AND DATE(o."createdAt") = CURRENT_DATE - INTERVAL '1 day'
            AND o.status IN ('confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed')
        `, {
            replacements: { tenantId },
            type: db.sequelize.QueryTypes.SELECT,
            raw: true
        });

        const todaysRevenue = parseFloat(todaysAppointmentRevenueResult[0]?.totalRevenue || 0) + parseFloat(todaysPurchaseRevenueResult[0]?.totalRevenue || 0);
        const yesterdayRevenue = parseFloat(yesterdayAppointmentRevenueResult[0]?.totalRevenue || 0) + parseFloat(yesterdayPurchaseRevenueResult[0]?.totalRevenue || 0);

        // Get total revenue from product purchases (all time)
        // Include all active order statuses to match financial overview
        const purchaseRevenueResult = await db.Order.findOne({
            where: {
                tenantId,
                status: { [Op.in]: ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed'] }
            },
            attributes: [
                [db.sequelize.fn('SUM', db.sequelize.col('totalAmount')), 'totalAmount'],
                [db.sequelize.fn('SUM', db.sequelize.col('platformFee')), 'platformFee']
            ],
            raw: true
        });

        const purchaseTotal = parseFloat(purchaseRevenueResult?.totalAmount || 0);
        const purchasePlatformFee = parseFloat(purchaseRevenueResult?.platformFee || 0);
        const purchaseRevenue = purchaseTotal - purchasePlatformFee;

        const totalRevenue = appointmentRevenue + purchaseRevenue;

        // Debug logging
        console.log(`[Dashboard Stats] TenantId: ${tenantId}`);
        console.log(`[Dashboard Stats] Appointment Revenue: ${appointmentRevenue}`);
        console.log(`[Dashboard Stats] Purchase Total: ${purchaseTotal}, Platform Fee: ${purchasePlatformFee}, Purchase Revenue: ${purchaseRevenue}`);
        console.log(`[Dashboard Stats] Total Revenue: ${totalRevenue}`);

        // Get active employees count
        const activeEmployees = await db.Staff.count({
            where: {
                tenantId,
                isActive: true
            }
        });

        // Get total customers count (unique platform users who booked)
        const totalCustomersResult = await db.sequelize.query(`
            SELECT COUNT(DISTINCT a."platformUserId") as count
            FROM appointments a
            INNER JOIN staff s ON a."staffId" = s.id
            WHERE s."tenantId" = :tenantId
        `, {
            replacements: { tenantId },
            type: db.sequelize.QueryTypes.SELECT,
            raw: true
        });

        const totalCustomers = parseInt(totalCustomersResult[0]?.count || 0);

        res.json({
            success: true,
            stats: {
                todaysBookings: todaysBookingCount,
                todaysRevenue,
                yesterdayBookings: yesterdayBookingCount,
                yesterdayRevenue,
                totalRevenue,
                activeEmployees,
                totalCustomers
            }
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics',
            error: error.message
        });
    }
};

/**
 * Get Today's Appointments
 * GET /api/v1/tenant/dashboard/todays-appointments
 */
const getTodaysAppointments = async (req, res) => {
    try {
        const tenantId = req.tenantId;

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const appointments = await db.Appointment.findAll({
            include: [
                {
                    model: db.Staff,
                    as: 'staff',
                    where: { tenantId },
                    attributes: ['id', 'name', 'photo']
                },
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['id', 'name_en', 'name_ar']
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['id', 'firstName', 'lastName', 'phone']
                }
            ],
            where: {
                startTime: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow
                }
            },
            order: [['startTime', 'ASC']]
        });

        // Format appointments
        const formattedAppointments = appointments.map(apt => {
            const startTime = new Date(apt.startTime);
            const endTime = new Date(apt.endTime);
            const paymentStatus = apt.paymentStatus || APPOINTMENT_PAYMENT_STATUS.PENDING;
            const price = parseFloat(apt.price || 0);
            const totalPaid = parseFloat(apt.totalPaid || 0);
            const remainderAmount = parseFloat(apt.remainderAmount || 0);
            const outstandingAmount = paymentStatus === APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID
                ? remainderAmount
                : paymentStatus === APPOINTMENT_PAYMENT_STATUS.FULLY_PAID || paymentStatus === 'paid'
                    ? 0
                    : Math.max(price - totalPaid, 0);

            return {
                id: apt.id,
                customerName: apt.user
                    ? `${apt.user.firstName} ${apt.user.lastName}`
                    : 'Unknown Customer',
                serviceName: apt.service?.name_en || 'Unknown Service',
                serviceName_ar: apt.service?.name_ar || 'خدمة غير معروفة',
                startTime: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                endTime: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                status: apt.status,
                price,
                paymentStatus,
                paymentMethod: apt.paymentMethod || null,
                depositAmount: parseFloat(apt.depositAmount || 0),
                remainderAmount,
                totalPaid,
                outstandingAmount,
                employeeName: apt.staff?.name || 'Unknown Employee'
            };
        });

        res.json({
            success: true,
            appointments: formattedAppointments
        });
    } catch (error) {
        console.error('Get todays appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch today\'s appointments',
            error: error.message
        });
    }
};

/**
 * Get Revenue Chart Data (Last 7 days)
 * GET /api/v1/tenant/dashboard/revenue-chart
 */
const getRevenueChartData = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { days = 7 } = req.query;

        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        daysAgo.setHours(0, 0, 0, 0);

        // Get appointment revenue data
        const appointmentData = await db.Appointment.findAll({
            include: [{
                model: db.Staff,
                as: 'staff',
                where: { tenantId },
                attributes: []
            }],
            attributes: [
                [db.sequelize.fn('DATE', db.sequelize.col('startTime')), 'date'],
                [db.sequelize.fn('SUM', db.sequelize.col('tenantRevenue')), 'revenue'],
                [db.sequelize.fn('COUNT', db.sequelize.col('Appointment.id')), 'bookings']
            ],
            where: {
                startTime: {
                    [Op.gte]: daysAgo
                },
                status: 'completed',
                paymentStatus: APPOINTMENT_PAYMENT_STATUS.FULLY_PAID
            },
            group: [db.sequelize.fn('DATE', db.sequelize.col('startTime'))],
            raw: true
        });

        // Get product purchase revenue data
        // Tenant revenue = totalAmount - platformFee
        const purchaseData = await db.Order.findAll({
            where: {
                tenantId,
                status: 'completed',
                paymentStatus: 'paid',
                createdAt: {
                    [Op.gte]: daysAgo
                }
            },
            attributes: [
                [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                [db.sequelize.fn('SUM', db.sequelize.col('totalAmount')), 'totalAmount'],
                [db.sequelize.fn('SUM', db.sequelize.col('platformFee')), 'platformFee']
            ],
            group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
            raw: true
        });

        // Combine and merge the data by date
        const mergedData = {};

        appointmentData.forEach(item => {
            if (!mergedData[item.date]) {
                mergedData[item.date] = { date: item.date, revenue: 0, bookings: 0 };
            }
            mergedData[item.date].revenue += parseFloat(item.revenue || 0);
            mergedData[item.date].bookings += parseInt(item.bookings || 0);
        });

        purchaseData.forEach(item => {
            if (!mergedData[item.date]) {
                mergedData[item.date] = { date: item.date, revenue: 0, bookings: 0 };
            }
            const purchaseRevenue = parseFloat(item.totalAmount || 0) - parseFloat(item.platformFee || 0);
            mergedData[item.date].revenue += purchaseRevenue;
        });

        // Convert to sorted array
        const revenueData = Object.values(mergedData).sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );

        res.json({
            success: true,
            chartData: revenueData
        });
    } catch (error) {
        console.error('Get revenue chart data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue chart data',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardStats,
    getTodaysAppointments,
    getRevenueChartData
};

