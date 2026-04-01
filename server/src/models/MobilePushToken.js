'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class MobilePushToken extends Model {
        static associate(models) {
            MobilePushToken.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'platformUser'
            });

            MobilePushToken.belongsTo(models.User, {
                foreignKey: 'staffUserId',
                as: 'staffUser'
            });

            MobilePushToken.belongsTo(models.Staff, {
                foreignKey: 'staffId',
                as: 'staff'
            });

            MobilePushToken.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }

    MobilePushToken.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        token: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        appType: {
            type: DataTypes.ENUM('customer', 'staff'),
            allowNull: false
        },
        platform: {
            type: DataTypes.ENUM('ios', 'android', 'web', 'unknown'),
            allowNull: false,
            defaultValue: 'unknown'
        },
        appVersion: {
            type: DataTypes.STRING,
            allowNull: true
        },
        deviceName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'platform_users',
                key: 'id'
            }
        },
        staffUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'auth_users',
                key: 'id'
            }
        },
        staffId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'staff',
                key: 'id'
            }
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        lastRegisteredAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        lastSeenAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        sequelize,
        modelName: 'MobilePushToken',
        tableName: 'mobile_push_tokens',
        schema: 'public',
        timestamps: true,
        indexes: [
            { unique: true, fields: ['token'] },
            { fields: ['platformUserId'] },
            { fields: ['staffId'] },
            { fields: ['staffUserId'] },
            { fields: ['tenantId'] },
            { fields: ['appType', 'isActive'] }
        ]
    });

    return MobilePushToken;
};
