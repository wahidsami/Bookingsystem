const db = require('../models');

const DEFAULT_FEATURES = [
    { featureKey: 'subscriptionFee', label: 'Subscription Fee', unitLabel: 'per month' },
    { featureKey: 'bookingsPerMonth', label: 'Bookings / Month', unitLabel: 'per booking' },
    { featureKey: 'maxStaff', label: 'Max Staff', unitLabel: 'per staff member' },
    { featureKey: 'maxServices', label: 'Max Services', unitLabel: 'per service' },
    { featureKey: 'maxProducts', label: 'Max Products', unitLabel: 'per product' },
    { featureKey: 'storage', label: 'Storage', unitLabel: 'per MB' },
    { featureKey: 'productsAndOrders', label: 'Products & Orders (E-commerce)', unitLabel: 'per month' },
    { featureKey: 'internalMessaging', label: 'Internal Messaging', unitLabel: 'per month' },
    { featureKey: 'reports', label: 'Reports & Analytics', unitLabel: 'per month' },
    { featureKey: 'payroll', label: 'Payroll Management', unitLabel: 'per month' },
    { featureKey: 'publicPageCustomization', label: 'Public Page Customization', unitLabel: 'per month' },
    { featureKey: 'hotDeals', label: 'Hot Deals', unitLabel: 'per hot deal' },
    { featureKey: 'whatsappNotifications', label: 'WhatsApp Notifications', unitLabel: 'per message' },
    { featureKey: 'inAppMarketingNotifications', label: 'Marketing Notifications', unitLabel: 'per message' },
    { featureKey: 'aiContentAssistant', label: 'AI Content Assistant', unitLabel: 'per 1K tokens' },
    { featureKey: 'promotionalEmails', label: 'Promotional Emails', unitLabel: 'per email' },
    { featureKey: 'searchRankingBoost', label: 'Search Ranking Boost', unitLabel: 'per month' },
    { featureKey: 'newToRefah', label: 'New to Refah Tag', unitLabel: 'per day' }
];

async function seedFeaturePricing() {
    try {
        for (const feature of DEFAULT_FEATURES) {
            const [record, created] = await db.FeaturePricing.findOrCreate({
                where: { featureKey: feature.featureKey },
                defaults: {
                    ...feature,
                    unitPrice: 0,
                    isActive: true
                }
            });

            if (!created) {
                let changed = false;
                if (record.label !== feature.label) {
                    record.label = feature.label;
                    changed = true;
                }
                if (record.unitLabel !== feature.unitLabel) {
                    record.unitLabel = feature.unitLabel;
                    changed = true;
                }
                if (record.isActive !== true) {
                    record.isActive = true;
                    changed = true;
                }
                if (changed) {
                    await record.save();
                }
            }
        }

        console.log(`✅ Feature pricing master list ready (${DEFAULT_FEATURES.length} items).`);
    } catch (error) {
        console.error('❌ Error seeding feature pricing:', error);
    }
}

module.exports = { seedFeaturePricing };
