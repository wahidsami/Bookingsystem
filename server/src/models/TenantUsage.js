'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantUsage extends Model {
        static associate(models) {
            TenantUsage.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }

        // Instance method: Check if limit exceeded
        isLimitExceeded(resourceType, limit) {
            if (limit === -1) return false; // -1 = unlimited
            
            const usageMap = {
                'bookings': this.bookingsThisMonth,
                'staff': this.activeStaff,
                'services': this.activeServices,
                'products': this.activeProducts,
                'storage': this.storageUsedMB
            };
            
            const current = usageMap[resourceType] || 0;
            return current >= limit;
        }

        // Instance method: Get usage percentage
        getUsagePercentage(resourceType, limit) {
            if (limit === -1) return 0; // Unlimited
            if (limit === 0) return 100; // Not allowed
            
            const usageMap = {
                'bookings': this.bookingsThisMonth,
                'staff': this.activeStaff,
                'services': this.activeServices,
                'products': this.activeProducts,
                'storage': this.storageUsedMB
            };
            
            const current = usageMap[resourceType] || 0;
            return Math.min((current / limit) * 100, 100);
        }
    }

    TenantUsage.init({
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
            },
            onDelete: 'CASCADE'
        },
        
        // Current Period Tracking
        currentPeriod: {
            type: DataTypes.STRING(7),
            allowNull: false,
            comment: 'Current tracking period (YYYY-MM)'
        },
        
        // Bookings
        bookingsThisMonth: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Number of bookings created this month'
        },
        bookingsTotal: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Total bookings all-time'
        },
        
        // Staff
        activeStaff: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Current number of active staff members'
        },
        
        // Services
        activeServices: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Current number of active services'
        },
        
        // Products
        activeProducts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Current number of active products'
        },
        
        // Storage
        storageUsedMB: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Storage used in megabytes'
        },
        
        // Marketing Usage
        emailCampaignsThisMonth: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        smsCampaignsThisMonth: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        
        // API Calls (if they have API access)
        apiCallsThisMonth: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        
        // Reset Tracking
        lastResetDate: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When monthly counters were last reset'
        },
        
        // Historical Data (JSONB for flexibility)
        historicalUsage: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {},
            comment: 'Historical usage data by month'
            /*
            Example:
            {
                "2024-10": {
                    "bookings": 145,
                    "revenue": 15234.50,
                    "storage": 2340.45
                },
                "2024-11": {
                    "bookings": 156,
                    "revenue": 16789.30,
                    "storage": 2567.89
                }
            }
            */
        }
    }, {
        sequelize,
        modelName: 'TenantUsage',
        tableName: 'tenant_usage',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['tenantId'], unique: true },
            { fields: ['currentPeriod'] }
        ]
    });

    return TenantUsage;
};

