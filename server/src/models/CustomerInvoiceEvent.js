'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CustomerInvoiceEvent extends Model {
        static associate(models) {
            CustomerInvoiceEvent.belongsTo(models.CustomerInvoice, {
                foreignKey: 'invoiceId',
                as: 'invoice'
            });
        }
    }

    CustomerInvoiceEvent.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        invoiceId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        eventType: {
            type: DataTypes.STRING(64),
            allowNull: false
        },
        fromStatus: {
            type: DataTypes.ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'VOID'),
            allowNull: true
        },
        toStatus: {
            type: DataTypes.ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'VOID'),
            allowNull: true
        },
        triggerSource: {
            type: DataTypes.STRING(64),
            allowNull: false
        },
        actorType: {
            type: DataTypes.STRING(32),
            allowNull: true
        },
        actorId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        payload: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'CustomerInvoiceEvent',
        tableName: 'customer_invoice_events',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['invoiceId'], name: 'idx_customer_invoice_events_invoice' },
            { fields: ['eventType'], name: 'idx_customer_invoice_events_type' }
        ]
    });

    return CustomerInvoiceEvent;
};
