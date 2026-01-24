'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantSubscription extends Model {
        static associate(models) {
            TenantSubscription.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            TenantSubscription.belongsTo(models.SubscriptionPackage, {
                foreignKey: 'packageId',
                as: 'package'
            });
        }

        // Instance method: Check if subscription is active
        isCurrentlyActive() {
            return this.status === 'active' && new Date() <= this.currentPeriodEnd;
        }

        // Instance method: Check if in grace period
        isInGracePeriod() {
            return this.status === 'expired' && 
                   this.gracePeriodEnds && 
                   new Date() <= this.gracePeriodEnds;
        }

        // Instance method: Get days until renewal
        daysUntilRenewal() {
            if (!this.currentPeriodEnd) return null;
            const diff = this.currentPeriodEnd - new Date();
            return Math.ceil(diff / (1000 * 60 * 60 * 24));
        }
    }

    TenantSubscription.init({
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
        packageId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'subscription_packages',
                key: 'id'
            }
        },
        
        // Billing
        billingCycle: {
            type: DataTypes.ENUM('monthly', 'sixMonth', 'annual'),
            allowNull: false,
            defaultValue: 'monthly',
            comment: 'How often they are billed'
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Amount paid for this subscription period'
        },
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'SAR'
        },
        
        // Subscription Period
        status: {
            type: DataTypes.ENUM('trial', 'active', 'past_due', 'expired', 'cancelled', 'suspended'),
            allowNull: false,
            defaultValue: 'trial',
            comment: 'Current subscription status'
        },
        trialEndsAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When trial period ends (if applicable)'
        },
        currentPeriodStart: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: 'Start of current billing period'
        },
        currentPeriodEnd: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: 'End of current billing period'
        },
        
        // Renewal
        autoRenew: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Automatically renew at end of period'
        },
        nextBillingDate: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When next payment will be charged'
        },
        
        // Grace Period
        gracePeriodEnds: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Grace period expiry (usually 7 days after currentPeriodEnd)'
        },
        
        // Cancellation
        cancelledAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When subscription was cancelled'
        },
        cancelledBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Who cancelled (tenant user or admin)'
        },
        cancellationReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        cancelAtPeriodEnd: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'If true, subscription will not renew at period end'
        },
        
        // Payment Integration
        stripeSubscriptionId: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Stripe subscription ID (for future payment integration)'
        },
        stripeCustomerId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        lastPaymentStatus: {
            type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'refunded'),
            allowNull: true
        },
        lastPaymentDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastPaymentAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        
        // Metadata
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {},
            comment: 'Additional subscription metadata'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Admin notes about this subscription'
        }
    }, {
        sequelize,
        modelName: 'TenantSubscription',
        tableName: 'tenant_subscriptions',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['tenantId'] },
            { fields: ['packageId'] },
            { fields: ['status'] },
            { fields: ['currentPeriodEnd'] },
            { fields: ['nextBillingDate'] },
            { fields: ['tenantId', 'status'] }
        ]
    });

    return TenantSubscription;
};

