'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GiftCardPackage extends Model {
        static associate(models) {
            GiftCardPackage.hasMany(models.GiftCardTransaction, {
                foreignKey: 'packageId',
                as: 'transactions'
            });
        }
    }

    GiftCardPackage.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
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
        imageUrl: {
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
        createdByAdminId: {
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'GiftCardPackage',
        tableName: 'gift_card_packages',
        indexes: [
            { fields: ['isActive'] },
            { fields: ['displayOrder'] },
            { fields: ['startsAt'] },
            { fields: ['endsAt'] }
        ]
    });

    return GiftCardPackage;
};

