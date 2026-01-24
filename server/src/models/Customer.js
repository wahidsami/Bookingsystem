'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Customer extends Model {
        static associate(models) {
            Customer.hasMany(models.Appointment, { foreignKey: 'customerId' });
        }
    }

    Customer.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isEmail: true
            }
        },
        preferences: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        totalSpent: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        loyaltyPoints: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        totalBookings: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'Customer',
        tableName: 'customers',
        schema: 'public',
        timestamps: true
    });

    return Customer;
};
