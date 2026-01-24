'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CustomerInsight extends Model {
        static associate(models) {
            CustomerInsight.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });

            CustomerInsight.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }

    CustomerInsight.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'platform_users',
                key: 'id'
            }
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        totalBookings: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        totalSpent: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        averageRating: {
            type: DataTypes.DECIMAL(3, 2),
            allowNull: true
        },
        lastVisit: {
            type: DataTypes.DATE,
            allowNull: true
        },
        firstVisit: {
            type: DataTypes.DATE,
            allowNull: true
        },
        favoriteServices: {
            type: DataTypes.ARRAY(DataTypes.UUID),
            defaultValue: []
        },
        favoriteStaff: {
            type: DataTypes.ARRAY(DataTypes.UUID),
            defaultValue: []
        },
        preferredTimes: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: []
        },
        loyaltyTier: {
            type: DataTypes.ENUM('bronze', 'silver', 'gold', 'platinum'),
            defaultValue: 'bronze'
        },
        tenantLoyaltyPoints: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        tags: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: []
        },
        noShowCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        cancellationCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        averageBookingValue: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        }
    }, {
        sequelize,
        modelName: 'CustomerInsight',
        tableName: 'customer_insights',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['platformUserId', 'tenantId']
            }
        ]
    });

    return CustomerInsight;
};
