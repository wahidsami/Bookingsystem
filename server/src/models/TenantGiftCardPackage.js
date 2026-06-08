'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantGiftCardPackage extends Model {
        static associate(models) {
            TenantGiftCardPackage.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            TenantGiftCardPackage.hasMany(models.TenantGiftCardTransaction, {
                foreignKey: 'packageId',
                as: 'transactions'
            });
        }
    }

    TenantGiftCardPackage.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        title_en: {
            type: DataTypes.STRING,
            allowNull: false
        },
        title_ar: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description_en: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        description_ar: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        displayOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        discountPreset: {
            type: DataTypes.STRING,
            allowNull: true
        },
        discountPercent: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0
        },
        priceAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        walletCreditAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        bonusAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        expirationPreset: {
            type: DataTypes.STRING,
            allowNull: true
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: true
        },
        thumbnailUrl: {
            type: DataTypes.STRING,
            allowNull: true
        },
        startsAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        endsAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        createdByTenantUserId: {
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'TenantGiftCardPackage',
        tableName: 'tenant_gift_card_packages',
        indexes: [
            { fields: ['tenantId', 'isActive'] },
            { fields: ['tenantId', 'displayOrder'] },
            { fields: ['startsAt', 'endsAt'] }
        ]
    });

    return TenantGiftCardPackage;
};
