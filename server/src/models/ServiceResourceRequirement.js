'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ServiceResourceRequirement extends Model {
        static associate(models) {
            ServiceResourceRequirement.belongsTo(models.Service, {
                foreignKey: 'serviceId',
                as: 'service'
            });

            ServiceResourceRequirement.belongsTo(models.ResourceType, {
                foreignKey: 'resourceTypeId',
                as: 'resourceType'
            });
        }
    }

    ServiceResourceRequirement.init({
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
            }
        },
        variantId: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        resourceTypeId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'resource_types',
                key: 'id'
            }
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            validate: {
                min: 1
            }
        }
    }, {
        sequelize,
        modelName: 'ServiceResourceRequirement',
        tableName: 'service_resource_requirements',
        timestamps: true
    });

    return ServiceResourceRequirement;
};
