'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ResourceType extends Model {
        static associate(models) {
            ResourceType.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            ResourceType.hasMany(models.Resource, {
                foreignKey: 'resourceTypeId',
                as: 'resources'
            });

            ResourceType.hasMany(models.ServiceResourceRequirement, {
                foreignKey: 'resourceTypeId',
                as: 'serviceRequirements'
            });
        }
    }

    ResourceType.init({
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
        modelName: 'ResourceType',
        tableName: 'resource_types',
        timestamps: true
    });

    return ResourceType;
};
