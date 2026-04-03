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
        invoiceSellerNameAr: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Refah legal/business name in Arabic for invoice rendering'
        },
        invoiceSellerNameEn: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Refah legal/business name in English for invoice rendering'
        },
        invoiceVatNumber: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: 'Refah VAT number for official invoices'
        },
        invoiceCrNumber: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: 'Refah commercial registration number for official invoices'
        },
        invoiceAddressAr: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Refah invoice address in Arabic'
        },
        invoiceAddressEn: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Refah invoice address in English'
        },
        invoiceCity: {
            type: DataTypes.STRING,
            allowNull: true
        },
        invoiceCountry: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Saudi Arabia'
        },
        invoiceEmail: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: { isEmail: true }
        },
        invoicePhone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        invoicePrefix: {
            type: DataTypes.STRING(16),
            allowNull: false,
            defaultValue: 'INV'
        },
        invoiceFooterNoteAr: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        invoiceFooterNoteEn: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        invoiceLogoPath: {
            type: DataTypes.STRING,
            allowNull: true
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

