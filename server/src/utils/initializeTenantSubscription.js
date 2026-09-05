const db = require('../models');
const { getTenantDashboardBaseUrl } = require('./url');
const {
    BILL_STATUS,
    PAYABLE_BILL_STATUSES
} = require('./billStatus');

function getPeriodEndForBillingCycle(startDate, billingCycle = 'monthly') {
    const periodEnd = new Date(startDate);

    if (billingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else if (billingCycle === 'sixMonth') {
        periodEnd.setMonth(periodEnd.getMonth() + 6);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    return periodEnd;
}

function mapPackageSlugToLegacyTenantPlan(packageSlug) {
    const normalizedSlug = (packageSlug || '').toString().trim().toLowerCase();

    if (normalizedSlug === 'free-trial' || normalizedSlug === 'free_trial') return 'free_trial';
    if (normalizedSlug === 'basic') return 'basic';
    if (['pro', 'professional', 'standard', 'premium'].includes(normalizedSlug)) return 'pro';
    if (normalizedSlug === 'enterprise') return 'enterprise';

    return null;
}

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

        const periodEnd = packageSlug === 'free-trial'
            ? trialEnd
            : getPeriodEndForBillingCycle(now, 'monthly');

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

        // Find subscriptions expiring soon or in grace period
        const targetSubscriptions = await db.TenantSubscription.findAll({
            where: {
                [db.Sequelize.Op.or]: [
                    {
                        status: { [db.Sequelize.Op.in]: ['active', 'trial'] },
                        currentPeriodEnd: {
                            [db.Sequelize.Op.between]: [
                                new Date(today.getTime() - 24 * 60 * 60 * 1000), // Include just expired
                                in7Days
                            ]
                        },
                        autoRenew: false
                    },
                    {
                        status: 'expired',
                        gracePeriodEnds: {
                            [db.Sequelize.Op.gte]: today
                        }
                    }
                ]
            },
            include: [{ model: db.Tenant, as: 'tenant' }]
        });

        const { sendEmail } = require('./emailService');

        for (const subscription of targetSubscriptions) {
            const timeDiff = subscription.currentPeriodEnd - today;
            const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            let alertType;
            let priority;
            let title, message, titleAr, messageAr;

            if (subscription.status === 'expired' && subscription.gracePeriodEnds && subscription.gracePeriodEnds >= today) {
                const graceDaysLeft = Math.ceil((subscription.gracePeriodEnds - today) / (1000 * 60 * 60 * 24));
                alertType = 'grace_period_warning';
                priority = 'critical';
                title = `Grace Period Ends in ${graceDaysLeft} Day${graceDaysLeft !== 1 ? 's' : ''}`;
                message = `Your subscription has expired, but you are in a grace period. It ends on ${subscription.gracePeriodEnds.toLocaleDateString()}.`;
                titleAr = `فترة السماح تنتهي خلال ${graceDaysLeft} يوم`;
                messageAr = `لقد انتهى اشتراكك، ولكنك في فترة سماح. تنتهي في ${subscription.gracePeriodEnds.toLocaleDateString()}.`;
            } else if (daysLeft <= 0) {
                alertType = 'renewal_due_0';
                priority = 'critical';
                title = 'Subscription Expired';
                message = 'Your subscription expired today. Please renew immediately to avoid service interruption.';
                titleAr = 'انتهى الاشتراك';
                messageAr = 'انتهى اشتراكك اليوم. يرجى التجديد فوراً لتجنب انقطاع الخدمة.';
            } else if (daysLeft <= 1) {
                alertType = 'renewal_due_1';
                priority = 'critical';
                title = 'Subscription Expiring Tomorrow';
                message = 'Your subscription will expire tomorrow. Please renew to continue using our services.';
                titleAr = 'الاشتراك ينتهي غداً';
                messageAr = 'سينتهي اشتراكك غداً. يرجى التجديد لمواصلة استخدام خدماتنا.';
            } else if (daysLeft <= 3) {
                alertType = 'renewal_due_3';
                priority = 'high';
                title = `Subscription Expiring in ${daysLeft} Days`;
                message = `Your subscription will expire on ${subscription.currentPeriodEnd.toLocaleDateString()}. Please renew soon.`;
                titleAr = `الاشتراك ينتهي خلال ${daysLeft} أيام`;
                messageAr = `سينتهي اشتراكك في ${subscription.currentPeriodEnd.toLocaleDateString()}. يرجى التجديد قريباً.`;
            } else if (daysLeft <= 7) {
                alertType = 'renewal_due_7';
                priority = 'medium';
                title = `Subscription Expiring in ${daysLeft} Days`;
                message = `Your subscription will expire on ${subscription.currentPeriodEnd.toLocaleDateString()}.`;
                titleAr = `الاشتراك ينتهي خلال ${daysLeft} أيام`;
                messageAr = `سينتهي اشتراكك في ${subscription.currentPeriodEnd.toLocaleDateString()}.`;
            } else {
                continue;
            }

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
                    title,
                    message,
                    title_ar: titleAr,
                    message_ar: messageAr,
                    priority,
                    sentVia: ['in-app', 'email']
                });

                // Actual email dispatch
                if (subscription.tenant?.email) {
                    try {
                        const isAr = subscription.tenant?.settings?.language === 'ar';
                        await sendEmail({
                            to: subscription.tenant.email,
                            subject: isAr ? titleAr : title,
                            template: 'tenant_notification',
                            data: {
                                lang: isAr ? 'ar' : 'en',
                                dir: isAr ? 'rtl' : 'ltr',
                                title: isAr ? titleAr : title,
                                greeting: isAr ? 'مرحباً' : 'Hello',
                                tenantName: isAr ? (subscription.tenant.name_ar || subscription.tenant.nameAr || subscription.tenant.name) : (subscription.tenant.name_en || subscription.tenant.name),
                                message: isAr ? messageAr : message,
                                footerText: isAr ? 'منصة رفاه' : 'Refah Platform'
                            }
                        });
                    } catch (emailError) {
                        console.error(`Failed to dispatch expiry email for tenant ${subscription.tenantId}:`, emailError);
                    }
                }
            }
        }

        console.log(`✅ Checked ${targetSubscriptions.length} subscriptions for expiry/grace period warnings`);
    } catch (error) {
        console.error('Failed to check expiring subscriptions:', error);
        throw error;
    }
}

/**
 * Activate tenant after successful subscription payment (set subscription active, create usage, set tenant active)
 */
async function activateTenantAfterPayment(tenantId) {
    const now = new Date();
    const tenant = await db.Tenant.findByPk(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    const subscription = await db.TenantSubscription.findOne({
        where: { tenantId },
        include: [{ model: db.SubscriptionPackage, as: 'package' }]
    });

    let currentPeriodStart = now;
    let currentPeriodEnd = now;
    let legacyPlan = null;

    if (subscription) {
        const periodEnd = getPeriodEndForBillingCycle(now, subscription.billingCycle);
        await subscription.update({
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextBillingDate: periodEnd
        });

        currentPeriodStart = now;
        currentPeriodEnd = periodEnd;
        legacyPlan = mapPackageSlugToLegacyTenantPlan(subscription.package?.slug);
    } else {
        const initializedSubscription = await initializeTenantSubscription(tenantId, 'free-trial');
        currentPeriodStart = initializedSubscription.currentPeriodStart || now;
        currentPeriodEnd = initializedSubscription.currentPeriodEnd || now;
        legacyPlan = mapPackageSlugToLegacyTenantPlan('free-trial');
    }
    let usage = await db.TenantUsage.findOne({ where: { tenantId } });
    if (!usage) {
        await db.TenantUsage.create({
            tenantId,
            currentPeriod: now.toISOString().substring(0, 7),
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
    }

    const tenantUpdates = {
        status: 'active',
        planStartDate: currentPeriodStart,
        planEndDate: currentPeriodEnd
    };

    if (legacyPlan) {
        tenantUpdates.plan = legacyPlan;
    }

    await tenant.update(tenantUpdates);
    console.log(`[Subscription] Activated tenant ${tenantId} after payment`);
}

/**
 * Expire tenants in payment_pending whose paymentDueAt has passed (set status to payment_expired)
 * Run periodically (e.g. every hour)
 */
async function expirePaymentPendingTenants() {
    try {
        const now = new Date();
        const reminderWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const {
            sendPaymentExpiredEmail,
            sendPaymentReminderEmail
        } = require('./emailService');

        const billsDueSoon = await db.Bill.findAll({
            where: {
                status: {
                    [db.Sequelize.Op.in]: PAYABLE_BILL_STATUSES
                },
                paymentTokenExpiresAt: {
                    [db.Sequelize.Op.gte]: now,
                    [db.Sequelize.Op.lte]: reminderWindowEnd
                }
            },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant'
                },
                {
                    model: db.TenantSubscription,
                    as: 'subscription',
                    required: false,
                    include: [{ model: db.SubscriptionPackage, as: 'package' }]
                }
            ]
        });

        let remindersSent = 0;
        for (const bill of billsDueSoon) {
            const metadata = bill.metadata && typeof bill.metadata === 'object'
                ? bill.metadata
                : {};

            if (metadata.paymentReminderSentAt) {
                continue;
            }

            const tenant = bill.tenant;
            if (!tenant?.email) {
                continue;
            }

            const reminderResult = await sendPaymentReminderEmail(tenant, {
                bill,
                billingCycle: bill.planSnapshot?.billingCycle || bill.subscription?.billingCycle,
                packageName: bill.planSnapshot?.packageNameAr || bill.planSnapshot?.packageName,
                paymentUrl: bill.metadata?.paymentUrl || buildBillPaymentUrl(bill, tenant),
                paymentDueAt: bill.paymentTokenExpiresAt || tenant.paymentDueAt
            });

            if (reminderResult?.success) {
                await bill.update({
                    metadata: {
                        ...metadata,
                        paymentReminderSentAt: now.toISOString(),
                        paymentReminderMessageId: reminderResult.messageId || null
                    }
                });
                remindersSent += 1;
            } else {
                console.error(
                    '[Cron] Payment reminder email failed:',
                    reminderResult?.error || 'Unknown email delivery error'
                );
            }
        }

        const tenants = await db.Tenant.findAll({
            where: {
                status: 'payment_pending',
                paymentDueAt: { [db.Sequelize.Op.lt]: now }
            }
        });

        for (const t of tenants) {
            await t.update({ status: 'payment_expired' });
            await db.Bill.update(
                {
                    status: BILL_STATUS.EXPIRED,
                    paymentFailureReason: 'Payment window expired before completion'
                },
                {
                    where: {
                        tenantId: t.id,
                        status: {
                            [db.Sequelize.Op.in]: PAYABLE_BILL_STATUSES
                        }
                    }
                }
            );
            sendPaymentExpiredEmail(t).catch(err => console.error('[Cron] Payment expired email failed:', err.message));
        }
        if (remindersSent > 0) {
            console.log(`[Cron] Sent ${remindersSent} payment reminder email(s)`);
        }
        if (tenants.length > 0) {
            console.log(`[Cron] Expired ${tenants.length} tenant(s) payment window (payment_pending → payment_expired)`);
        }
        return tenants.length;
    } catch (error) {
        console.error('expirePaymentPendingTenants error:', error);
        return 0;
    }
}

module.exports = {
    initializeTenantSubscription,
    activateTenantAfterPayment,
    resetMonthlyUsage,
    checkExpiringSubscriptions,
    expirePaymentPendingTenants
};

function buildBillPaymentUrl(bill, tenant) {
    if (!bill?.paymentToken) {
        return '';
    }

    const locale = tenant?.settings?.language === 'en' ? 'en' : 'ar';
    const baseUrl = getTenantDashboardBaseUrl();
    const paymentPath = `/${locale}/payment?token=${bill.paymentToken}`;

    return baseUrl ? `${baseUrl}${paymentPath}` : paymentPath;
}
