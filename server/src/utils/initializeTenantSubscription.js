const db = require('../models');

/**
 * Initialize subscription and usage for a newly approved tenant
 * This is called when a tenant is approved by the admin
 */
async function initializeTenantSubscription(tenantId, packageSlug = 'free-trial') {
    try {
        // Check if subscription already exists
        const existingSubscription = await db.TenantSubscription.findOne({
            where: { tenantId }
        });

        if (existingSubscription) {
            console.log(`Subscription already exists for tenant ${tenantId}`);
            return existingSubscription;
        }

        // Get the package
        const package = await db.SubscriptionPackage.findOne({
            where: { slug: packageSlug, isActive: true }
        });

        if (!package) {
            throw new Error(`Package ${packageSlug} not found or inactive`);
        }

        // Calculate period dates
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + 30); // 30-day trial

        let periodEnd = new Date(now);
        if (packageSlug === 'free-trial') {
            periodEnd = trialEnd;
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month for paid plans
        }

        // Create subscription
        const subscription = await db.TenantSubscription.create({
            tenantId,
            packageId: package.id,
            billingCycle: 'monthly',
            amount: package.monthlyPrice,
            status: packageSlug === 'free-trial' ? 'trial' : 'active',
            trialEndsAt: packageSlug === 'free-trial' ? trialEnd : null,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd,
            gracePeriodEnds: null,
            autoRenew: true
        });

        // Create usage record
        await db.TenantUsage.create({
            tenantId,
            currentPeriod: now.toISOString().substring(0, 7), // YYYY-MM
            bookingsThisMonth: 0,
            bookingsTotal: 0,
            activeStaff: 0,
            activeServices: 0,
            activeProducts: 0,
            storageUsedMB: 0,
            emailCampaignsThisMonth: 0,
            smsCampaignsThisMonth: 0,
            apiCallsThisMonth: 0,
            lastResetDate: now
        });

        console.log(`✅ Initialized ${packageSlug} subscription for tenant ${tenantId}`);
        return subscription;
    } catch (error) {
        console.error(`Failed to initialize subscription for tenant ${tenantId}:`, error);
        throw error;
    }
}

/**
 * Reset monthly usage counters for all tenants
 * This should be run as a cron job on the 1st of each month
 */
async function resetMonthlyUsage() {
    try {
        const currentPeriod = new Date().toISOString().substring(0, 7);
        
        const allUsage = await db.TenantUsage.findAll();
        
        for (const usage of allUsage) {
            // Store historical data
            const historicalData = usage.historicalUsage || {};
            historicalData[usage.currentPeriod] = {
                bookings: usage.bookingsThisMonth,
                emailCampaigns: usage.emailCampaignsThisMonth,
                smsCampaigns: usage.smsCampaignsThisMonth,
                apiCalls: usage.apiCallsThisMonth
            };
            
            await usage.update({
                currentPeriod,
                bookingsThisMonth: 0,
                emailCampaignsThisMonth: 0,
                smsCampaignsThisMonth: 0,
                apiCallsThisMonth: 0,
                lastResetDate: new Date(),
                historicalUsage: historicalData
            });
        }
        
        console.log(`✅ Reset monthly usage for ${allUsage.length} tenants`);
    } catch (error) {
        console.error('Failed to reset monthly usage:', error);
        throw error;
    }
}

/**
 * Check for expiring subscriptions and send alerts
 * This should be run as a daily cron job
 */
async function checkExpiringSubscriptions() {
    try {
        const today = new Date();
        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);
        const in3Days = new Date(today);
        in3Days.setDate(in3Days.getDate() + 3);
        const in1Day = new Date(today);
        in1Day.setDate(in1Day.getDate() + 1);

        // Find subscriptions expiring soon
        const expiringSubscriptions = await db.TenantSubscription.findAll({
            where: {
                status: { [db.Sequelize.Op.in]: ['active', 'trial'] },
                currentPeriodEnd: {
                    [db.Sequelize.Op.between]: [today, in7Days]
                },
                autoRenew: false // Only alert if not auto-renewing
            },
            include: [{ model: db.Tenant, as: 'tenant' }]
        });

        for (const subscription of expiringSubscriptions) {
            const daysLeft = Math.ceil((subscription.currentPeriodEnd - today) / (1000 * 60 * 60 * 24));
            let alertType;
            
            if (daysLeft <= 1) alertType = 'renewal_due_1';
            else if (daysLeft <= 3) alertType = 'renewal_due_3';
            else if (daysLeft <= 7) alertType = 'renewal_due_7';
            else continue;

            // Check if alert already sent
            const existingAlert = await db.UsageAlert.findOne({
                where: {
                    tenantId: subscription.tenantId,
                    alertType,
                    sentAt: {
                        [db.Sequelize.Op.gte]: new Date(today.setHours(0, 0, 0, 0))
                    }
                }
            });

            if (!existingAlert) {
                await db.UsageAlert.create({
                    tenantId: subscription.tenantId,
                    alertType,
                    resourceType: 'subscription',
                    title: `Subscription Renewal Due in ${daysLeft} Day${daysLeft > 1 ? 's' : ''}`,
                    message: `Your subscription will expire on ${subscription.currentPeriodEnd.toLocaleDateString()}. Please renew to continue using our services.`,
                    title_ar: `تجديد الاشتراك مستحق خلال ${daysLeft} ${daysLeft > 1 ? 'أيام' : 'يوم'}`,
                    message_ar: `سينتهي اشتراكك في ${subscription.currentPeriodEnd.toLocaleDateString()}. يرجى التجديد لمواصلة استخدام خدماتنا.`,
                    priority: daysLeft <= 1 ? 'critical' : daysLeft <= 3 ? 'high' : 'medium',
                    sentVia: ['in-app', 'email']
                });
            }
        }

        console.log(`✅ Checked ${expiringSubscriptions.length} expiring subscriptions`);
    } catch (error) {
        console.error('Failed to check expiring subscriptions:', error);
        throw error;
    }
}

module.exports = {
    initializeTenantSubscription,
    resetMonthlyUsage,
    checkExpiringSubscriptions
};

