'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class OrderItem extends Model {
        static associate(models) {
            // OrderItem belongs to Order
            OrderItem.belongsTo(models.Order, {
                foreignKey: 'orderId',
                as: 'order'
            });

            // OrderItem belongs to Product (reference only, product may be deleted)
            OrderItem.belongsTo(models.Product, {
                foreignKey: 'productId',
                as: 'product',
                required: false // Product might be deleted later
            });
        }
    }

    OrderItem.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'orders',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'products',
                key: 'id'
            }
        },
        // Product Snapshot (at time of order)
        productName: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Product name at time of order (snapshot)'
        },
        productNameAr: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Product name in Arabic (snapshot)'
        },
        productPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Product price at time of order (snapshot)'
        },
        productImage: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Product image at time of order (snapshot)'
        },
        productSku: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Product SKU at time of order (snapshot)'
        },
        // Order Details
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: 'Quantity ordered'
        },
        unitPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Price per unit at time of order'
        },
        totalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Total price for this line item (quantity * unitPrice)'
        }
    }, {
        sequelize,
        modelName: 'OrderItem',
        tableName: 'order_items',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['orderId']
            },
            {
                fields: ['productId']
            }
        ]
    });

    return OrderItem;
};
