'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GlobalSettings extends Model {
        static associate(models) {
            // No associations needed - this is a singleton table
        }
    }

    GlobalSettings.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // Commission rates
        serviceCommissionRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 10.00,
            comment: 'Platform commission rate for services (%)'
        },
        productCommissionRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 10.00,
            comment: 'Platform commission rate for products (%)'
        },
        // Tax rate
        taxRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 15.00,
            comment: 'Global tax rate (VAT) (%)'
        },
        // Metadata
        updatedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Super admin who last updated these settings'
        }
    }, {
        sequelize,
        modelName: 'GlobalSettings',
        tableName: 'global_settings',
        schema: 'public',
        timestamps: true,
        // Ensure only one row exists
        hooks: {
            beforeCreate: async (settings) => {
                const count = await GlobalSettings.count();
                if (count >= 1) {
                    throw new Error('GlobalSettings already exists. Use update instead.');
                }
            }
        }
    });

    return GlobalSettings;
};

