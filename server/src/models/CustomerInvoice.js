'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CustomerInvoice extends Model {
        static associate(models) {
            CustomerInvoice.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            CustomerInvoice.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'platformUser'
            });
            CustomerInvoice.hasMany(models.CustomerInvoiceItem, {
                foreignKey: 'invoiceId',
                as: 'items'
            });
            CustomerInvoice.hasMany(models.CustomerInvoiceEvent, {
                foreignKey: 'invoiceId',
                as: 'events'
            });
        }
    }

    CustomerInvoice.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        invoiceNumber: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        entityType: {
            type: DataTypes.ENUM('appointment', 'order'),
            allowNull: false
        },
        entityId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'VOID'),
            allowNull: false,
            defaultValue: 'UNPAID'
        },
        currency: {
            type: DataTypes.STRING(8),
            allowNull: false,
            defaultValue: 'SAR'
        },
        subtotalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        vatAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        paidAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        dueAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        paymentMethodSnapshot: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        paymentStatusSnapshot: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        invoicePdfPath: {
            type: DataTypes.STRING(1000),
            allowNull: true
        },
        receiptPdfPath: {
            type: DataTypes.STRING(1000),
            allowNull: true
        },
        issuedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastEmailedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'CustomerInvoice',
        tableName: 'customer_invoices',
        schema: 'public',
        timestamps: true,
        indexes: [
            { unique: true, fields: ['invoiceNumber'], name: 'uidx_customer_invoices_invoice_number' },
            { unique: true, fields: ['entityType', 'entityId'], name: 'uidx_customer_invoices_entity' },
            { fields: ['tenantId', 'issuedAt'], name: 'idx_customer_invoices_tenant_date' },
            { fields: ['platformUserId', 'issuedAt'], name: 'idx_customer_invoices_platform_user_date' },
            { fields: ['status'], name: 'idx_customer_invoices_status' }
        ]
    });

    return CustomerInvoice;
};
