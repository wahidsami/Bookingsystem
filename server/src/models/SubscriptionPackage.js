'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SubscriptionPackage extends Model {
        static associate(models) {
            SubscriptionPackage.hasMany(models.TenantSubscription, {
                foreignKey: 'packageId',
                as: 'subscriptions'
            });
        }
    }

    SubscriptionPackage.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // Package Identity
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Package name in English (Free, Basic, Standard, Premium, Enterprise)'
        },
        name_ar: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Package name in Arabic'
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: 'URL-friendly identifier (free, basic, standard, premium, enterprise)'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Package description in English'
        },
        description_ar: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Package description in Arabic'
        },
        
        // Pricing
        monthlyPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Price per month for monthly billing'
        },
        sixMonthPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Total price for 6 months (with discount)'
        },
        annualPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Total price for 12 months (with discount)'
        },
        
        // Calculated savings (for display)
        sixMonthSavings: {
            type: DataTypes.VIRTUAL,
            get() {
                const monthly = parseFloat(this.monthlyPrice) * 6;
                const sixMonth = parseFloat(this.sixMonthPrice);
                return monthly - sixMonth;
            }
        },
        annualSavings: {
            type: DataTypes.VIRTUAL,
            get() {
                const monthly = parseFloat(this.monthlyPrice) * 12;
                const annual = parseFloat(this.annualPrice);
                return monthly - annual;
            }
        },
        sixMonthPerMonth: {
            type: DataTypes.VIRTUAL,
            get() {
                return parseFloat(this.sixMonthPrice) / 6;
            }
        },
        annualPerMonth: {
            type: DataTypes.VIRTUAL,
            get() {
                return parseFloat(this.annualPrice) / 12;
            }
        },
        
        // Limits (JSONB for flexibility)
        limits: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
            comment: 'Package limits and features',
            /*
            Example structure:
            {
                // Core Limits
                maxBookingsPerMonth: 50,          // -1 = unlimited
                maxStaff: 5,
                maxServices: 20,
                maxProducts: 0,
                storageGB: 1,
                
                // Features
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
                
                // Advanced Features
                customDomain: false,
                whiteLabel: false,
                advancedAnalytics: false,
                dataExport: false,
                
                // Booking Features
                maxAdvanceBookingDays: 30,        // How far in advance can customers book
                allowWaitlist: false,
                allowGroupBookings: false,
                allowMemberships: false,
                
                // Marketing
                emailMarketingCampaigns: 0,       // Per month
                smsMarketingCampaigns: 0,
                
                // Support
                supportChannels: ['email'],       // ['email', 'chat', 'phone', 'dedicated']
                supportResponseTime: '48h',       // '48h', '24h', '4h', '1h'
            }
            */
        },
        
        // Commission
        platformCommission: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 5.00,
            comment: 'Platform commission percentage for this package'
        },
        
        // Display & Status
        displayOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Order in which packages are displayed'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Whether this package is available for new subscriptions'
        },
        isFeatured: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Highlight this package (Most Popular)'
        },
        isCustom: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Is this a custom package for specific tenant?'
        },
        customTenantId: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'If custom package, which tenant is it for?'
        },
        
        // Metadata
        createdBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Super admin who created this package'
        },
        updatedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Super admin who last updated this package'
        }
    }, {
        sequelize,
        modelName: 'SubscriptionPackage',
        tableName: 'subscription_packages',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['slug'], unique: true },
            { fields: ['isActive'] },
            { fields: ['displayOrder'] },
            { fields: ['isCustom', 'customTenantId'] }
        ]
    });

    return SubscriptionPackage;
};

