const db = require('../models');

/**
 * Seed default subscription packages
 */
const seedDefaultPackages = async () => {
    try {
        // Check if packages already exist
        const existingPackages = await db.SubscriptionPackage.count();
        if (existingPackages > 0) {
            console.log('📦 Subscription packages already seeded.');
            return;
        }

        const packages = [
            {
                name: 'Free Trial',
                name_ar: 'تجربة مجانية',
                slug: 'free-trial',
                description: 'Start with a 30-day free trial. Perfect for testing our platform.',
                description_ar: 'ابدأ بفترة تجريبية مجانية لمدة 30 يومًا. مثالي لاختبار منصتنا.',
                monthlyPrice: 0.00,
                sixMonthPrice: 0.00,
                annualPrice: 0.00,
                limits: {
                    maxBookingsPerMonth: 20,
                    maxStaff: 2,
                    maxServices: 5,
                    maxProducts: 0,
                    storageGB: 0.5,
                    hasAdvancedReports: false,
                    hasWhatsAppNotifications: false,
                    hasSMSNotifications: false,
                    hasEmailNotifications: true,
                    hasVoiceNotifications: false,
                    hasMultiLocation: false,
                    hasInventoryManagement: false,
                    hasLoyaltyProgram: false,
                    hasGiftCards: false,
                    hasOnlinePayments: true,
                    hasCustomBranding: false,
                    hasAPIAccess: false,
                    hasPrioritySupport: false,
                    hasDedicatedAccountManager: false,
                    customDomain: false,
                    whiteLabel: false,
                    advancedAnalytics: false,
                    dataExport: false,
                    maxAdvanceBookingDays: 14,
                    allowWaitlist: false,
                    allowGroupBookings: false,
                    allowMemberships: false,
                    emailMarketingCampaigns: 0,
                    smsMarketingCampaigns: 0,
                    supportChannels: ['email'],
                    supportResponseTime: '48h'
                },
                platformCommission: 8.00,
                displayOrder: 0,
                isActive: true,
                isFeatured: false
            },
            {
                name: 'Basic',
                name_ar: 'أساسي',
                slug: 'basic',
                description: 'Essential features for small businesses just getting started.',
                description_ar: 'الميزات الأساسية للشركات الصغيرة التي بدأت للتو.',
                monthlyPrice: 299.00,
                sixMonthPrice: 1620.00, // 10% discount (299 * 6 * 0.9)
                annualPrice: 2990.00,   // 17% discount (299 * 12 * 0.83)
                limits: {
                    maxBookingsPerMonth: 100,
                    maxStaff: 5,
                    maxServices: 20,
                    maxProducts: 10,
                    storageGB: 2,
                    hasAdvancedReports: false,
                    hasWhatsAppNotifications: false,
                    hasSMSNotifications: false,
                    hasEmailNotifications: true,
                    hasVoiceNotifications: false,
                    hasMultiLocation: false,
                    hasInventoryManagement: false,
                    hasLoyaltyProgram: false,
                    hasGiftCards: false,
                    hasOnlinePayments: true,
                    hasCustomBranding: false,
                    hasAPIAccess: false,
                    hasPrioritySupport: false,
                    hasDedicatedAccountManager: false,
                    customDomain: false,
                    whiteLabel: false,
                    advancedAnalytics: false,
                    dataExport: false,
                    maxAdvanceBookingDays: 30,
                    allowWaitlist: false,
                    allowGroupBookings: false,
                    allowMemberships: false,
                    emailMarketingCampaigns: 5,
                    smsMarketingCampaigns: 0,
                    supportChannels: ['email'],
                    supportResponseTime: '24h'
                },
                platformCommission: 7.00,
                displayOrder: 1,
                isActive: true,
                isFeatured: false
            },
            {
                name: 'Standard',
                name_ar: 'قياسي',
                slug: 'standard',
                description: 'Most popular! Perfect for growing businesses.',
                description_ar: 'الأكثر شيوعًا! مثالي للشركات النامية.',
                monthlyPrice: 599.00,
                sixMonthPrice: 3234.00, // 10% discount
                annualPrice: 5990.00,   // 17% discount
                limits: {
                    maxBookingsPerMonth: 300,
                    maxStaff: 15,
                    maxServices: 50,
                    maxProducts: 50,
                    storageGB: 10,
                    hasAdvancedReports: true,
                    hasWhatsAppNotifications: true,
                    hasSMSNotifications: true,
                    hasEmailNotifications: true,
                    hasVoiceNotifications: false,
                    hasMultiLocation: false,
                    hasInventoryManagement: true,
                    hasLoyaltyProgram: true,
                    hasGiftCards: true,
                    hasOnlinePayments: true,
                    hasCustomBranding: false,
                    hasAPIAccess: false,
                    hasPrioritySupport: true,
                    hasDedicatedAccountManager: false,
                    customDomain: false,
                    whiteLabel: false,
                    advancedAnalytics: true,
                    dataExport: true,
                    maxAdvanceBookingDays: 60,
                    allowWaitlist: true,
                    allowGroupBookings: true,
                    allowMemberships: true,
                    emailMarketingCampaigns: 20,
                    smsMarketingCampaigns: 10,
                    supportChannels: ['email', 'chat'],
                    supportResponseTime: '4h'
                },
                platformCommission: 5.00,
                displayOrder: 2,
                isActive: true,
                isFeatured: true // Most Popular
            },
            {
                name: 'Premium',
                name_ar: 'مميز',
                slug: 'premium',
                description: 'Advanced features for established businesses.',
                description_ar: 'ميزات متقدمة للشركات القائمة.',
                monthlyPrice: 999.00,
                sixMonthPrice: 5394.00, // 10% discount
                annualPrice: 9990.00,   // 17% discount
                limits: {
                    maxBookingsPerMonth: 1000,
                    maxStaff: 30,
                    maxServices: 100,
                    maxProducts: 200,
                    storageGB: 50,
                    hasAdvancedReports: true,
                    hasWhatsAppNotifications: true,
                    hasSMSNotifications: true,
                    hasEmailNotifications: true,
                    hasVoiceNotifications: true,
                    hasMultiLocation: true,
                    hasInventoryManagement: true,
                    hasLoyaltyProgram: true,
                    hasGiftCards: true,
                    hasOnlinePayments: true,
                    hasCustomBranding: true,
                    hasAPIAccess: true,
                    hasPrioritySupport: true,
                    hasDedicatedAccountManager: false,
                    customDomain: true,
                    whiteLabel: false,
                    advancedAnalytics: true,
                    dataExport: true,
                    maxAdvanceBookingDays: 90,
                    allowWaitlist: true,
                    allowGroupBookings: true,
                    allowMemberships: true,
                    emailMarketingCampaigns: 100,
                    smsMarketingCampaigns: 50,
                    supportChannels: ['email', 'chat', 'phone'],
                    supportResponseTime: '1h'
                },
                platformCommission: 3.50,
                displayOrder: 3,
                isActive: true,
                isFeatured: false
            },
            {
                name: 'Enterprise',
                name_ar: 'مؤسسي',
                slug: 'enterprise',
                description: 'Unlimited everything for large organizations with custom needs.',
                description_ar: 'كل شيء غير محدود للمؤسسات الكبيرة ذات الاحتياجات المخصصة.',
                monthlyPrice: 2499.00,
                sixMonthPrice: 13494.00, // 10% discount
                annualPrice: 24990.00,   // 17% discount
                limits: {
                    maxBookingsPerMonth: -1, // Unlimited
                    maxStaff: -1,
                    maxServices: -1,
                    maxProducts: -1,
                    storageGB: 200,
                    hasAdvancedReports: true,
                    hasWhatsAppNotifications: true,
                    hasSMSNotifications: true,
                    hasEmailNotifications: true,
                    hasVoiceNotifications: true,
                    hasMultiLocation: true,
                    hasInventoryManagement: true,
                    hasLoyaltyProgram: true,
                    hasGiftCards: true,
                    hasOnlinePayments: true,
                    hasCustomBranding: true,
                    hasAPIAccess: true,
                    hasPrioritySupport: true,
                    hasDedicatedAccountManager: true,
                    customDomain: true,
                    whiteLabel: true,
                    advancedAnalytics: true,
                    dataExport: true,
                    maxAdvanceBookingDays: 180,
                    allowWaitlist: true,
                    allowGroupBookings: true,
                    allowMemberships: true,
                    emailMarketingCampaigns: -1,
                    smsMarketingCampaigns: -1,
                    supportChannels: ['email', 'chat', 'phone', 'dedicated'],
                    supportResponseTime: 'immediate'
                },
                platformCommission: 2.50,
                displayOrder: 4,
                isActive: true,
                isFeatured: false
            }
        ];

        await db.SubscriptionPackage.bulkCreate(packages);
        console.log('✅ Successfully seeded 5 default subscription packages.');
    } catch (error) {
        console.error('❌ Error seeding packages:', error);
    }
};

module.exports = { seedDefaultPackages };

