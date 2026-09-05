'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ServicePackageItem extends Model {
        static associate(models) {
            ServicePackageItem.belongsTo(models.ServicePackage, {
                foreignKey: 'packageId',
                as: 'package'
            });

            ServicePackageItem.belongsTo(models.Service, {
                foreignKey: 'serviceId',
                as: 'service'
            });

            ServicePackageItem.belongsTo(models.Staff, {
                foreignKey: 'defaultStaffId',
                as: 'defaultStaff'
            });
        }
    }

    ServicePackageItem.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        packageId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'service_packages',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        serviceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'services',
                key: 'id'
            }
        },
        variantId: {
            type: DataTypes.STRING, // Depending on variant implementation, often string or UUID
            allowNull: true,
            comment: 'Optional variant ID if the service has variants'
        },
        defaultStaffId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'staff',
                key: 'id'
            }
        },
        sequenceOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Order of execution in the package'
        }
    }, {
        sequelize,
        modelName: 'ServicePackageItem',
        tableName: 'service_package_items',
        schema: 'public',
        timestamps: true
    });

    return ServicePackageItem;
};
