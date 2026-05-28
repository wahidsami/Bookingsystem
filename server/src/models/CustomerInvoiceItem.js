'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CustomerInvoiceItem extends Model {
        static associate(models) {
            CustomerInvoiceItem.belongsTo(models.CustomerInvoice, {
                foreignKey: 'invoiceId',
                as: 'invoice'
            });
        }
    }

    CustomerInvoiceItem.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        invoiceId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        itemType: {
            type: DataTypes.ENUM('service', 'product'),
            allowNull: false
        },
        itemRefId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        nameEn: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        nameAr: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        unitPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        lineTotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        taxAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'CustomerInvoiceItem',
        tableName: 'customer_invoice_items',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['invoiceId'], name: 'idx_customer_invoice_items_invoice' },
            { fields: ['itemRefId'], name: 'idx_customer_invoice_items_item_ref' }
        ]
    });

    return CustomerInvoiceItem;
};
