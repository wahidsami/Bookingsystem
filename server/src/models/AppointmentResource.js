'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class AppointmentResource extends Model {
        static associate(models) {
            AppointmentResource.belongsTo(models.Appointment, {
                foreignKey: 'appointmentId',
                as: 'appointment'
            });

            AppointmentResource.belongsTo(models.Resource, {
                foreignKey: 'resourceId',
                as: 'resource'
            });
        }
    }

    AppointmentResource.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        appointmentId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'appointments',
                key: 'id'
            }
        },
        resourceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'resources',
                key: 'id'
            }
        }
    }, {
        sequelize,
        modelName: 'AppointmentResource',
        tableName: 'appointment_resources',
        timestamps: true
    });

    return AppointmentResource;
};
