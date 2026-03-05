const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get platform dashboard statistics - fault-tolerant version
 * Every query is individually guarded so a single table issue never causes a 500
 */
const getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

        // Safe helpers
        const safeCount = async (model, opts = {}) => {
            try { return await model.count(opts); } catch (e) { console.warn('safeCount error:', e.message); return 0; }
        };
        const safeSum = async (model, col, opts = {}) => {
            try { return (await model.sum(col, opts)) || 0; } catch (e) { console.warn('safeSum error:', e.message); return 0; }
        };

        // Tenant stats
        const [totalTenants, pendingTenants, approvedTenants, suspendedTenants, newTenantsThisMonth, newTenantsLastMonth] = await Promise.all([
            safeCount(db.Tenant),
            safeCount(db.Tenant, { where: { status: 'pending' } }),
            safeCount(db.Tenant, { where: { status: 'approved' } }),
            safeCount(db.Tenant, { where: { status: 'suspended' } }),
            safeCount(db.Tenant, { where: { createdAt: { [Op.gte]: thisMonthStart } } }),
            safeCount(db.Tenant, { where: { createdAt: { [Op.gte]: lastMonthStart, [Op.lt]: thisMonthStart } } }),
        ]);

        // User stats
        const [totalUsers, newUsersThisMonth, newUsersLastMonth] = await Promise.all([
            safeCount(db.PlatformUser),
            safeCount(db.PlatformUser, { where: { createdAt: { [Op.gte]: thisMonthStart } } }),
            safeCount(db.PlatformUser, { where: { createdAt: { [Op.gte]: lastMonthStart, [Op.lt]: thisMonthStart } } }),
        ]);

        // Transaction stats
        const [totalRevenue, revenueThisMonth, revenueLastMonth] = await Promise.all([
            safeSum(db.Transaction, 'platformFee', { where: { status: 'completed' } }),
            safeSum(db.Transaction, 'platformFee', { where: { status: 'completed', createdAt: { [Op.gte]: thisMonthStart } } }),
            safeSum(db.Transaction, 'platformFee', { where: { status: 'completed', createdAt: { [Op.gte]: lastMonthStart, [Op.lt]: thisMonthStart } } }),
        ]);

        // Booking stats
        const [totalBookings, bookingsThisMonth, bookingsLastMonth] = await Promise.all([
            safeCount(db.Appointment),
            safeCount(db.Appointment, { where: { createdAt: { [Op.gte]: thisMonthStart } } }),
            safeCount(db.Appointment, { where: { createdAt: { [Op.gte]: lastMonthStart, [Op.lt]: thisMonthStart } } }),
        ]);

        // Tenant by type breakdown
        let tenantsByType = [];
        try {
            const rows = await db.Tenant.findAll({
                attributes: ['businessType', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
                where: { status: 'approved' },
                group: ['businessType']
            });
            tenantsByType = rows.map(t => ({ type: t.businessType, count: parseInt(t.getDataValue('count')) }));
        } catch (e) {
            console.warn('tenantsByType query failed:', e.message);
        }

        // Growth calc helper
        const calcGrowth = (cur, last) => last > 0
            ? parseFloat(((cur - last) / last * 100).toFixed(1))
            : (cur > 0 ? 100 : 0);

        res.json({
            success: true,
            stats: {
                tenants: {
                    total: totalTenants,
                    pending: pendingTenants,
                    approved: approvedTenants,
                    suspended: suspendedTenants,
                    newThisMonth: newTenantsThisMonth,
                    growth: calcGrowth(newTenantsThisMonth, newTenantsLastMonth)
                },
                users: {
                    total: totalUsers,
                    newThisMonth: newUsersThisMonth,
                    growth: calcGrowth(newUsersThisMonth, newUsersLastMonth)
                },
                bookings: {
                    total: totalBookings,
                    thisMonth: bookingsThisMonth,
                    growth: calcGrowth(bookingsThisMonth, bookingsLastMonth)
                },
                revenue: {
                    total: parseFloat(Number(totalRevenue).toFixed(2)),
                    thisMonth: parseFloat(Number(revenueThisMonth).toFixed(2)),
                    growth: calcGrowth(revenueThisMonth, revenueLastMonth)
                },
                breakdowns: {
                    tenantsByType,
                    tenantsByPlan: []
                }
            }
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

/**
 * Get recent activities across platform
 */
const getRecentActivities = async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const activities = await db.ActivityLog.findAll({
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            activities
        });

    } catch (error) {
        console.error('Get recent activities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activities'
        });
    }
};

/**
 * Get chart data for dashboard
 */
const getChartData = async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        let startDate;
        switch (period) {
            case '7d': startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); break;
            case '90d': startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); break;
            default: startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        const safeChartQuery = async (model) => {
            try {
                return await model.findAll({
                    attributes: [
                        [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
                    ],
                    where: { createdAt: { [Op.gte]: startDate } },
                    group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
                    order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
                });
            } catch (e) {
                console.warn('Chart query failed for', model.name, ':', e.message);
                return [];
            }
        };

        const [userRows, tenantRows, bookingRows] = await Promise.all([
            safeChartQuery(db.PlatformUser),
            safeChartQuery(db.Tenant),
            safeChartQuery(db.Appointment),
        ]);

        const mapRows = rows => rows.map(r => ({ date: r.getDataValue('date'), count: parseInt(r.getDataValue('count')) }));

        res.json({
            success: true,
            chartData: {
                period,
                userRegistrations: mapRows(userRows),
                tenantRegistrations: mapRows(tenantRows),
                bookings: mapRows(bookingRows)
            }
        });

    } catch (error) {
        console.error('Get chart data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch chart data',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardStats,
    getRecentActivities,
    getChartData
};
