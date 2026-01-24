const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get platform dashboard statistics
 */
const getDashboardStats = async (req, res) => {
    try {
        // Get date ranges
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

        // Tenant stats
        const totalTenants = await db.Tenant.count();
        const pendingTenants = await db.Tenant.count({ where: { status: 'pending' } });
        const approvedTenants = await db.Tenant.count({ where: { status: 'approved' } });
        const suspendedTenants = await db.Tenant.count({ where: { status: 'suspended' } });

        const newTenantsThisMonth = await db.Tenant.count({
            where: {
                createdAt: { [Op.gte]: thisMonthStart }
            }
        });

        const newTenantsLastMonth = await db.Tenant.count({
            where: {
                createdAt: {
                    [Op.gte]: lastMonthStart,
                    [Op.lt]: thisMonthStart
                }
            }
        });

        // User stats
        const totalUsers = await db.PlatformUser.count();
        const newUsersThisMonth = await db.PlatformUser.count({
            where: {
                createdAt: { [Op.gte]: thisMonthStart }
            }
        });

        const newUsersLastMonth = await db.PlatformUser.count({
            where: {
                createdAt: {
                    [Op.gte]: lastMonthStart,
                    [Op.lt]: thisMonthStart
                }
            }
        });

        // Transaction stats
        const totalTransactions = await db.Transaction.count();
        const totalRevenue = await db.Transaction.sum('platformFee', {
            where: { status: 'completed' }
        }) || 0;

        const revenueThisMonth = await db.Transaction.sum('platformFee', {
            where: {
                status: 'completed',
                createdAt: { [Op.gte]: thisMonthStart }
            }
        }) || 0;

        const revenueLastMonth = await db.Transaction.sum('platformFee', {
            where: {
                status: 'completed',
                createdAt: {
                    [Op.gte]: lastMonthStart,
                    [Op.lt]: thisMonthStart
                }
            }
        }) || 0;

        // Booking stats
        const totalBookings = await db.Appointment.count();
        const bookingsThisMonth = await db.Appointment.count({
            where: {
                createdAt: { [Op.gte]: thisMonthStart }
            }
        });

        const bookingsLastMonth = await db.Appointment.count({
            where: {
                createdAt: {
                    [Op.gte]: lastMonthStart,
                    [Op.lt]: thisMonthStart
                }
            }
        });

        // Tenant by type breakdown
        const tenantsByType = await db.Tenant.findAll({
            attributes: [
                'businessType',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: { status: 'approved' },
            group: ['businessType']
        });

        // Tenant by plan breakdown
        const tenantsByPlan = await db.Tenant.findAll({
            attributes: [
                'plan',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: { status: 'approved' },
            group: ['plan']
        });

        // Calculate growth percentages
        const tenantGrowth = newTenantsLastMonth > 0 
            ? ((newTenantsThisMonth - newTenantsLastMonth) / newTenantsLastMonth * 100).toFixed(1)
            : newTenantsThisMonth > 0 ? 100 : 0;

        const userGrowth = newUsersLastMonth > 0
            ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(1)
            : newUsersThisMonth > 0 ? 100 : 0;

        const revenueGrowth = revenueLastMonth > 0
            ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100).toFixed(1)
            : revenueThisMonth > 0 ? 100 : 0;

        const bookingGrowth = bookingsLastMonth > 0
            ? ((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth * 100).toFixed(1)
            : bookingsThisMonth > 0 ? 100 : 0;

        res.json({
            success: true,
            stats: {
                tenants: {
                    total: totalTenants,
                    pending: pendingTenants,
                    approved: approvedTenants,
                    suspended: suspendedTenants,
                    newThisMonth: newTenantsThisMonth,
                    growth: parseFloat(tenantGrowth)
                },
                users: {
                    total: totalUsers,
                    newThisMonth: newUsersThisMonth,
                    growth: parseFloat(userGrowth)
                },
                bookings: {
                    total: totalBookings,
                    thisMonth: bookingsThisMonth,
                    growth: parseFloat(bookingGrowth)
                },
                revenue: {
                    total: parseFloat(totalRevenue.toFixed(2)),
                    thisMonth: parseFloat(revenueThisMonth.toFixed(2)),
                    growth: parseFloat(revenueGrowth)
                },
                breakdowns: {
                    tenantsByType: tenantsByType.map(t => ({
                        type: t.businessType,
                        count: parseInt(t.getDataValue('count'))
                    })),
                    tenantsByPlan: tenantsByPlan.map(t => ({
                        plan: t.plan,
                        count: parseInt(t.getDataValue('count'))
                    }))
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
        
        // Calculate date range
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get daily user registrations
        const userRegistrations = await db.PlatformUser.findAll({
            attributes: [
                [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: {
                createdAt: { [Op.gte]: startDate }
            },
            group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
            order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
        });

        // Get daily tenant registrations
        const tenantRegistrations = await db.Tenant.findAll({
            attributes: [
                [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: {
                createdAt: { [Op.gte]: startDate }
            },
            group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
            order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
        });

        // Get daily bookings
        const bookings = await db.Appointment.findAll({
            attributes: [
                [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: {
                createdAt: { [Op.gte]: startDate }
            },
            group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
            order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
        });

        res.json({
            success: true,
            chartData: {
                period,
                userRegistrations: userRegistrations.map(r => ({
                    date: r.getDataValue('date'),
                    count: parseInt(r.getDataValue('count'))
                })),
                tenantRegistrations: tenantRegistrations.map(r => ({
                    date: r.getDataValue('date'),
                    count: parseInt(r.getDataValue('count'))
                })),
                bookings: bookings.map(r => ({
                    date: r.getDataValue('date'),
                    count: parseInt(r.getDataValue('count'))
                }))
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

