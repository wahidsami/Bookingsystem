'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ServicePackage extends Model {
        static associate(models) {
            ServicePackage.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            ServicePackage.hasMany(models.ServicePackageItem, {
                foreignKey: 'packageId',
                as: 'items'
            });

            ServicePackage.hasMany(models.Appointment, {
                foreignKey: 'packageId',
                as: 'appointments'
            });
        }
    }

    ServicePackage.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        name_en: {
            type: DataTypes.STRING,
            allowNull: false
        },
        name_ar: {
            type: DataTypes.STRING,
            allowNull: false
        },
        image: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Package thumbnail image path'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        totalDuration: {
            type: DataTypes.INTEGER, // in minutes
            allowNull: false,
            defaultValue: 0,
            comment: 'Derived sum of package item durations'
        },
        totalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Derived sum of package item prices'
        }
    }, {
        sequelize,
        modelName: 'ServicePackage',
        tableName: 'service_packages',
        schema: 'public',
        timestamps: true
    });

    return ServicePackage;
};
