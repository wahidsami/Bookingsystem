'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ServiceEmployee extends Model {
        static associate(models) {
            // Junction table associations are handled by Service and Staff models
        }
    }

    ServiceEmployee.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        serviceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'services',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        staffId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'staff',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        commissionRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Custom commission rate for this employee on this service (overrides default)'
        },
        isPrimary: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Whether this employee is the primary provider for this service'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Additional notes about this employee-service assignment'
        }
    }, {
        sequelize,
        modelName: 'ServiceEmployee',
        tableName: 'service_employees',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['serviceId']
            },
            {
                fields: ['staffId']
            },
            {
                unique: true,
                fields: ['serviceId', 'staffId']
            }
        ]
    });

    return ServiceEmployee;
};

