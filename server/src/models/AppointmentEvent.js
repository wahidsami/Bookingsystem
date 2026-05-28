'use strict';

module.exports = (sequelize, DataTypes) => {
    const AppointmentEvent = sequelize.define('AppointmentEvent', {
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
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'platform_users',
                key: 'id'
            }
        },
        actorType: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'customer'
        },
        actorId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        eventType: {
            type: DataTypes.STRING(64),
            allowNull: false
        },
        payload: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        occurredAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'appointment_events',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['tenantId', 'occurredAt'], name: 'idx_appointment_events_tenant_time' },
            { fields: ['appointmentId', 'occurredAt'], name: 'idx_appointment_events_appointment_time' },
            { fields: ['eventType', 'occurredAt'], name: 'idx_appointment_events_type_time' }
        ]
    });

    AppointmentEvent.associate = (models) => {
        AppointmentEvent.belongsTo(models.Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
        AppointmentEvent.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
        AppointmentEvent.belongsTo(models.PlatformUser, { foreignKey: 'platformUserId', as: 'user' });
    };

    return AppointmentEvent;
};
