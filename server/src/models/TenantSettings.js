'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantSettings extends Model {
        static associate(models) {
            // TenantSettings belongs to a Tenant
            TenantSettings.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }

    TenantSettings.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        // Financial settings
        commissionRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Tenant-specific commission rate (overrides global rate)'
        },
        taxRate: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 15.00,
            comment: 'Tax rate (default 15% for Saudi VAT)'
        },
        currency: {
            type: DataTypes.STRING(3),
            defaultValue: 'SAR',
            comment: 'Currency code (ISO 4217)'
        },
        // Business hours
        businessHours: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {},
            comment: 'Operating hours: { "sunday": { "open": "09:00", "close": "21:00", "isOpen": true }, ... }'
        },
        timezone: {
            type: DataTypes.STRING,
            defaultValue: 'Asia/Riyadh',
            comment: 'Timezone for scheduling'
        },
        // Booking settings
        bookingSettings: {
            type: DataTypes.JSONB,
            defaultValue: {
                slotInterval: 15, // 5, 10, or 15 minutes
                defaultBufferBefore: 5, // minutes before service
                defaultBufferAfter: 5, // minutes after service
                allowAnyStaff: true, // Allow "Any available staff" option
                maxBookingsPerCustomerPerDay: null, // null = unlimited, or number
                requirePhoneVerification: false, // Future
                allowWalkInBooking: true, // Tenant can create booking from dashboard
                cancellationWindow: 24, // hours before appointment (future)
                noShowPolicy: 'warn' // 'warn', 'penalty', 'ban' (future)
            },
            comment: 'Booking preferences: slot interval, buffers, policies, etc.'
        },
        autoApproveBookings: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Auto-approve bookings or require manual approval'
        },
        bufferTime: {
            type: DataTypes.INTEGER,
            defaultValue: 15,
            comment: 'Buffer time between appointments (minutes)'
        },
        maxAdvanceBookingDays: {
            type: DataTypes.INTEGER,
            defaultValue: 30,
            comment: 'Maximum days in advance for bookings'
        },
        cancellationPolicy: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Cancellation policy text'
        },
        cancellationHours: {
            type: DataTypes.INTEGER,
            defaultValue: 24,
            comment: 'Minimum hours before appointment for cancellation'
        },
        // Payment settings
        paymentSettings: {
            type: DataTypes.JSON,
            defaultValue: {},
            comment: 'Payment methods and preferences'
        },
        acceptCash: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        acceptCard: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        acceptWallet: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        payoutBankAccount: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Bank account details for payouts'
        },
        // Notification settings
        notificationSettings: {
            type: DataTypes.JSON,
            defaultValue: {},
            comment: 'Notification preferences'
        },
        enableEmailNotifications: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        enableSmsNotifications: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        enableWhatsAppNotifications: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        enableVoiceAlerts: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Voice notification for new appointments'
        },
        // Feature access (subscription-based)
        features: {
            type: DataTypes.JSON,
            defaultValue: {},
            comment: 'Enabled features: { "whatsapp": true, "sms": false, "analytics": true }'
        },
        subscriptionTier: {
            type: DataTypes.ENUM('basic', 'pro', 'premium'),
            defaultValue: 'basic',
            comment: 'Subscription tier'
        },
        subscriptionExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Subscription expiry date'
        },
        // Localization
        defaultLanguage: {
            type: DataTypes.STRING(2),
            defaultValue: 'ar',
            comment: 'Default language (ar or en)'
        },
        supportedLanguages: {
            type: DataTypes.JSON,
            defaultValue: ['ar', 'en'],
            comment: 'Supported languages'
        }
    }, {
        sequelize,
        modelName: 'TenantSettings',
        tableName: 'tenant_settings',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['tenantId']
            }
        ]
    });

    return TenantSettings;
};

