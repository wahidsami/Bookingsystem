const { Op } = require('sequelize');
const db = require('../models');
const { getActiveSubscriptionForTenant } = require('./tenantSubscriptionService');
const { normalizePackageEntitlements, toNumericEntitlement, isFeatureEnabled } = require('../utils/packageEntitlements');

const THRESHOLDS = [
    { minimum: 100, alertType: 'limit_reached', status: 'limit_reached', priority: 'high' },
    { minimum: 95, alertType: 'warning_95', status: 'critical', priority: 'medium' },
    { minimum: 80, alertType: 'warning_80', status: 'near_limit', priority: 'low' }
];

const RESOURCE_METRICS = [
    {
        key: 'staff',
        metricType: 'resource',
        resourceType: 'staff',
        limitKey: 'maxStaff',
        labelEn: 'Staff members',
        labelAr: 'الموظفون',
        getConsumed: (tenantId) => db.Staff.count({ where: { tenantId } })
    },
    {
        key: 'services',
        metricType: 'resource',
        resourceType: 'services',
        limitKey: 'maxServices',
        labelEn: 'Services',
        labelAr: 'الخدمات',
        getConsumed: (tenantId) => db.Service.count({ where: { tenantId } })
    },
    {
        key: 'products',
        metricType: 'resource',
        resourceType: 'products',
        limitKey: 'maxProducts',
        labelEn: 'Products',
        labelAr: 'المنتجات',
        getConsumed: (tenantId) => db.Product.count({ where: { tenantId } })
    },
    {
        key: 'bookings',
        metricType: 'resource',
        resourceType: 'bookings',
        limitKey: 'maxBookingsPerMonth',
        labelEn: 'Monthly bookings',
        labelAr: 'حجوزات هذا الشهر',
        getConsumed: (tenantId, context) => db.Appointment.count({
            where: {
                tenantId,
                createdAt: { [Op.gte]: context.startOfMonth }
            }
        })
    },
    {
        key: 'storage',
        metricType: 'resource',
        resourceType: 'storage',
        limitKey: 'storageGB',
        labelEn: 'Storage',
        labelAr: 'المساحة التخزينية',
        unitEn: 'MB',
        unitAr: 'م.ب',
        resolveLimit: (limits) => {
            const storageGB = Number(limits.storageGB);
            return Number.isFinite(storageGB) ? Math.round(storageGB * 1024) : 0;
        },
        getConsumed: async (tenantId) => {
            const usage = await db.TenantUsage.findOne({ where: { tenantId } });
            return usage ? Math.round(Number(usage.storageUsedMB || 0)) : 0;
        }
    }
];

const QUOTA_METRICS = [
    {
        key: 'aiContentAssistant',
        metricType: 'quota',
        resourceType: 'subscription',
        limitKey: 'aiContentAssistant',
        usageKey: 'aiContentAssistant',
        labelEn: 'AI assistant usage',
        labelAr: 'استخدام مساعد الذكاء الاصطناعي'
    },
    {
        key: 'inAppMarketingNotifications',
        metricType: 'quota',
        resourceType: 'subscription',
        limitKey: 'inAppMarketingNotifications',
        labelEn: 'Customer push notifications',
        labelAr: 'إشعارات العملاء',
        getConsumed: async (tenantId, context) => {
            const usage = await db.TenantPushUsage.findOne({
                where: { tenantId, month: context.currentMonth }
            });
            return usage ? Number(usage.count || 0) : 0;
        }
    },
    {
        key: 'whatsappNotifications',
        metricType: 'quota',
        resourceType: 'subscription',
        limitKey: 'whatsappNotifications',
        usageKey: 'whatsappNotifications',
        labelEn: 'WhatsApp notifications',
        labelAr: 'إشعارات واتساب'
    },
    {
        key: 'promotionalEmails',
        metricType: 'quota',
        resourceType: 'subscription',
        limitKey: 'promotionalEmails',
        usageKey: 'promotionalEmails',
        labelEn: 'Promotional emails',
        labelAr: 'الإيميلات التسويقية'
    },
    {
        key: 'maxHotDeals',
        metricType: 'quota',
        resourceType: 'subscription',
        limitKey: 'maxHotDeals',
        labelEn: 'Hot Deals',
        labelAr: 'العروض الساخنة',
        getConsumed: (tenantId) => db.HotDeal.count({
            where: {
                tenantId,
                status: { [Op.in]: ['pending', 'active'] }
            }
        })
    },
    {
        key: 'featuredProducts',
        metricType: 'quota',
        resourceType: 'subscription',
        limitKey: 'featuredProducts',
        usageKey: 'featuredProducts',
        labelEn: 'Featured products',
        labelAr: 'المنتجات المميزة'
    }
];

const FEATURE_FLAGS = [
    {
        key: 'productsAndOrders',
        metricType: 'feature',
        resourceType: 'subscription',
        labelEn: 'Products & Orders',
        labelAr: 'المنتجات والطلبات',
        isEnabled: (limits) => isFeatureEnabled(limits.productsAndOrders || limits.hasProductsAndOrders || limits.maxProducts)
    },
    {
        key: 'internalMessaging',
        metricType: 'feature',
        resourceType: 'subscription',
        labelEn: 'Internal Messages',
        labelAr: 'الرسائل الداخلية',
        isEnabled: (limits) => isFeatureEnabled(limits.internalMessaging || limits.hasInternalMessaging)
    },
    {
        key: 'reports',
        metricType: 'feature',
        resourceType: 'subscription',
        labelEn: 'Reports & Analytics',
        labelAr: 'التقارير والتحليلات',
        isEnabled: (limits) => isFeatureEnabled(limits.reports || limits.hasAdvancedReports || limits.advancedAnalytics)
    },
    {
        key: 'payroll',
        metricType: 'feature',
        resourceType: 'subscription',
        labelEn: 'Payroll',
        labelAr: 'الرواتب',
        isEnabled: (limits) => isFeatureEnabled(limits.payroll || limits.hasPayroll)
    },
    {
        key: 'publicPageCustomization',
        metricType: 'feature',
        resourceType: 'subscription',
        labelEn: 'Public Page Customization',
        labelAr: 'تخصيص الصفحة العامة',
        isEnabled: (limits) => isFeatureEnabled(limits.publicPageCustomization || limits.hasCustomBranding || limits.whiteLabel)
    }
];

function getCurrentMonthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getConsumptionStatus({ enabled, unlimited, limit, percentage, metricType }) {
    if (!enabled) return 'disabled';
    if (metricType === 'feature' || unlimited) return 'healthy';
    if (limit <= 0) return 'disabled';
    if (percentage >= 100) return 'limit_reached';
    if (percentage >= 95) return 'critical';
    if (percentage >= 80) return 'near_limit';
    return 'healthy';
}

function buildMetricRow(definition, limits, consumed) {
    const rawLimit = definition.resolveLimit
        ? definition.resolveLimit(limits)
        : toNumericEntitlement(limits[definition.limitKey], 0);
    const unlimited = rawLimit === -1;
    const enabled = definition.metricType === 'feature'
        ? !!definition.isEnabled(limits)
        : rawLimit === -1 || rawLimit > 0;
    const safeConsumed = Number.isFinite(Number(consumed)) ? Number(consumed) : 0;
    const percentage = enabled && !unlimited && rawLimit > 0
        ? Math.min(100, Math.round((safeConsumed / rawLimit) * 100))
        : 0;
    const remaining = enabled && !unlimited && rawLimit > 0
        ? Math.max(0, rawLimit - safeConsumed)
        : null;

    return {
        key: definition.key,
        labelEn: definition.labelEn,
        labelAr: definition.labelAr,
        metricType: definition.metricType,
        resourceType: definition.resourceType,
        unitEn: definition.unitEn || null,
        unitAr: definition.unitAr || null,
        enabled,
        unlimited,
        total: definition.metricType === 'feature' ? (enabled ? 1 : 0) : rawLimit,
        consumed: definition.metricType === 'feature' ? (enabled ? 1 : 0) : safeConsumed,
        left: definition.metricType === 'feature' ? null : remaining,
        percentage,
        status: getConsumptionStatus({
            enabled,
            unlimited,
            limit: definition.metricType === 'feature' ? (enabled ? 1 : 0) : rawLimit,
            percentage,
            metricType: definition.metricType
        })
    };
}

async function getMonthlyFeatureUsageCount(tenantId, featureKey, month = getCurrentMonthKey()) {
    const usage = await db.TenantFeatureUsage.findOne({
        where: { tenantId, featureKey, month }
    });
    return usage ? Number(usage.count || 0) : 0;
}

async function incrementMonthlyFeatureUsage(tenantId, featureKey, amount = 1) {
    const month = getCurrentMonthKey();
    const [usage] = await db.TenantFeatureUsage.findOrCreate({
        where: { tenantId, featureKey, month },
        defaults: { tenantId, featureKey, month, count: 0 }
    });

    await usage.increment('count', { by: amount });
    await usage.reload();
    return usage;
}

async function sendConsumptionAlert(tenantId, metric) {
    if (metric.metricType === 'feature' || !metric.enabled || metric.unlimited || metric.total <= 0) {
        return;
    }

    const threshold = THRESHOLDS.find((entry) => metric.percentage >= entry.minimum);
    if (!threshold) return;

    const recentAlerts = await db.UsageAlert.findAll({
        where: {
            tenantId,
            alertType: threshold.alertType,
            resourceType: metric.resourceType,
            sentAt: {
                [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        },
        order: [['sentAt', 'DESC']],
        limit: 25
    });

    const duplicateAlert = recentAlerts.find((alert) => alert?.metadata?.metricKey === metric.key);
    if (duplicateAlert) return;

    const metricNameEn = metric.labelEn;
    const metricNameAr = metric.labelAr;

    await db.UsageAlert.create({
        tenantId,
        alertType: threshold.alertType,
        resourceType: metric.resourceType,
        title: threshold.alertType === 'limit_reached'
            ? `${metricNameEn} limit reached`
            : `${metric.percentage}% of ${metricNameEn} used`,
        message: threshold.alertType === 'limit_reached'
            ? `You have reached your ${metricNameEn} allowance. Please upgrade your package to continue.`
            : `You have used ${metric.consumed} of ${metric.total} ${metricNameEn}. Consider upgrading soon.`,
        title_ar: threshold.alertType === 'limit_reached'
            ? `تم الوصول إلى حد ${metricNameAr}`
            : `تم استخدام ${metric.percentage}% من ${metricNameAr}`,
        message_ar: threshold.alertType === 'limit_reached'
            ? `لقد وصلت إلى الحد المتاح من ${metricNameAr}. يرجى ترقية الباقة للمتابعة.`
            : `لقد استخدمت ${metric.consumed} من أصل ${metric.total} من ${metricNameAr}. ننصح بترقية الباقة قريباً.`,
        currentValue: Math.round(metric.consumed),
        limitValue: metric.unlimited ? null : Math.round(metric.total),
        percentage: metric.percentage,
        priority: threshold.priority,
        sentVia: ['in-app'],
        metadata: {
            metricKey: metric.key,
            metricType: metric.metricType,
            metricLabelEn: metric.labelEn,
            metricLabelAr: metric.labelAr,
            status: metric.status
        }
    });
}

async function buildSubscriptionConsumption(tenantId) {
    const result = await getActiveSubscriptionForTenant(tenantId, {
        statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE', 'past_due']
    });

    if (!result?.subscription || !result?.package) {
        return null;
    }

    const currentMonth = getCurrentMonthKey();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const limits = normalizePackageEntitlements(result.package.limits || {});
    const queryContext = { currentMonth, startOfMonth };

    const resourceRows = await Promise.all(
        RESOURCE_METRICS.map(async (definition) => {
            const consumed = await definition.getConsumed(tenantId, queryContext);
            return buildMetricRow(definition, limits, consumed);
        })
    );

    const quotaRows = await Promise.all(
        QUOTA_METRICS.map(async (definition) => {
            const consumed = definition.getConsumed
                ? await definition.getConsumed(tenantId, queryContext)
                : await getMonthlyFeatureUsageCount(tenantId, definition.usageKey || definition.key, currentMonth);
            return buildMetricRow(definition, limits, consumed);
        })
    );

    const featureRows = FEATURE_FLAGS.map((definition) => buildMetricRow(definition, limits, 0));
    const rows = [...resourceRows, ...quotaRows, ...featureRows];

    await Promise.all(rows.map((metric) => sendConsumptionAlert(tenantId, metric)));

    const alerts = await db.UsageAlert.findAll({
        where: {
            tenantId,
            acknowledged: false
        },
        order: [['sentAt', 'DESC']],
        limit: 10
    });

    return {
        subscription: {
            id: result.subscription.id,
            status: result.subscription.status,
            billingCycle: result.subscription.billingCycle,
            currentPeriodStart: result.subscription.currentPeriodStart,
            currentPeriodEnd: result.subscription.currentPeriodEnd,
            nextBillingDate: result.subscription.nextBillingDate,
            packageId: result.package.id,
            packageName: result.package.name,
            packageNameAr: result.package.name_ar || result.package.name,
            currency: result.subscription.currency || 'SAR'
        },
        currentMonth,
        limits,
        rows,
        alerts: alerts.map((alert) => ({
            id: alert.id,
            alertType: alert.alertType,
            resourceType: alert.resourceType,
            title: alert.title,
            message: alert.message,
            title_ar: alert.title_ar,
            message_ar: alert.message_ar,
            currentValue: alert.currentValue,
            limitValue: alert.limitValue,
            percentage: Number(alert.percentage || 0),
            priority: alert.priority,
            sentAt: alert.sentAt,
            acknowledged: alert.acknowledged,
            metadata: alert.metadata || {}
        }))
    };
}

async function assertFeatureQuotaAvailable(tenantId, featureKey, amount = 1) {
    const result = await getActiveSubscriptionForTenant(tenantId, {
        statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE', 'past_due']
    });

    if (!result?.package) {
        return {
            allowed: false,
            statusCode: 403,
            message: 'No active subscription found. Please subscribe to continue.'
        };
    }

    const limits = normalizePackageEntitlements(result.package.limits || {});
    const quota = toNumericEntitlement(limits[featureKey], 0);

    if (quota === -1) {
        return {
            allowed: true,
            limit: quota,
            consumed: 0,
            remaining: null
        };
    }

    if (quota <= 0) {
        return {
            allowed: false,
            statusCode: 403,
            message: 'This feature is not included in your current package. Please upgrade your plan.'
        };
    }

    const consumed = await getMonthlyFeatureUsageCount(tenantId, featureKey);
    if (consumed + amount > quota) {
        await sendConsumptionAlert(tenantId, buildMetricRow(
            {
                key: featureKey,
                metricType: 'quota',
                resourceType: 'subscription',
                limitKey: featureKey,
                labelEn: featureKey,
                labelAr: featureKey
            },
            limits,
            consumed
        ));

        return {
            allowed: false,
            statusCode: 403,
            message: 'Monthly feature quota reached. Please upgrade your package to continue.',
            limit: quota,
            consumed,
            remaining: 0
        };
    }

    return {
        allowed: true,
        limit: quota,
        consumed,
        remaining: quota - consumed
    };
}

module.exports = {
    buildSubscriptionConsumption,
    getCurrentMonthKey,
    getMonthlyFeatureUsageCount,
    incrementMonthlyFeatureUsage,
    assertFeatureQuotaAvailable
};
