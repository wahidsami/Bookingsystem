'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class UsageAlert extends Model {
        static associate(models) {
            UsageAlert.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }

    UsageAlert.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        
        // Alert Details
        alertType: {
            type: DataTypes.ENUM(
                'warning_80',           // 80% of limit reached
                'warning_95',           // 95% of limit reached
                'limit_reached',        // 100% limit reached
                'limit_exceeded',       // Over 100% (soft limit)
                'renewal_due_7',        // Renewal in 7 days
                'renewal_due_3',        // Renewal in 3 days
                'renewal_due_1',        // Renewal in 1 day
                'renewal_overdue',      // Subscription expired
                'grace_period',         // In grace period
                'subscription_cancelled', // Subscription cancelled
                'payment_failed'        // Payment failed
            ),
            allowNull: false
        },
        resourceType: {
            type: DataTypes.ENUM('bookings', 'staff', 'services', 'products', 'storage', 'subscription', 'payment'),
            allowNull: false
        },
        
        // Alert Content
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Alert title'
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Alert message'
        },
        title_ar: {
            type: DataTypes.STRING,
            allowNull: true
        },
        message_ar: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        
        // Alert Data
        currentValue: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Current usage value'
        },
        limitValue: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Limit value'
        },
        percentage: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Usage percentage'
        },
        
        // Notification Status
        sentAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        sentVia: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
            comment: 'Channels used to send notification: ["email", "sms", "in-app", "whatsapp"]'
        },
        acknowledged: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Has tenant acknowledged this alert?'
        },
        acknowledgedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        
        // Action Tracking
        actionTaken: {
            type: DataTypes.ENUM('none', 'upgraded', 'renewed', 'dismissed', 'ignored'),
            allowNull: false,
            defaultValue: 'none'
        },
        actionTakenAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        
        // Priority
        priority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
            allowNull: false,
            defaultValue: 'medium'
        },
        
        // Metadata
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {},
            comment: 'Additional alert metadata'
        }
    }, {
        sequelize,
        modelName: 'UsageAlert',
        tableName: 'usage_alerts',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['tenantId'] },
            { fields: ['alertType'] },
            { fields: ['resourceType'] },
            { fields: ['acknowledged'] },
            { fields: ['sentAt'] },
            { fields: ['tenantId', 'acknowledged'] }
        ]
    });

    return UsageAlert;
};

