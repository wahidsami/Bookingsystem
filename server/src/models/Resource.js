'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Resource extends Model {
        static associate(models) {
            Resource.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            Resource.belongsTo(models.ResourceType, {
                foreignKey: 'resourceTypeId',
                as: 'resourceType'
            });

            Resource.hasMany(models.AppointmentResource, {
                foreignKey: 'resourceId',
                as: 'appointmentAllocations'
            });
        }
    }

    Resource.init({
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
        resourceTypeId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'resource_types',
                key: 'id'
            }
        },
        name_ar: {
            type: DataTypes.STRING(150),
            allowNull: false
        },
        name_en: {
            type: DataTypes.STRING(150),
            allowNull: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'Resource',
        tableName: 'resources',
        timestamps: true
    });

    return Resource;
};
