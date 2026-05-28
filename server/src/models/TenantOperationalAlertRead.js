'use strict';

module.exports = (sequelize, DataTypes) => {
    const TenantOperationalAlertRead = sequelize.define('TenantOperationalAlertRead', {
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
        readerId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        alertKey: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        readAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'tenant_operational_alert_reads',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['tenantId', 'readerId', 'alertKey'],
                name: 'uidx_tenant_operational_alert_reads_reader_key'
            },
            { fields: ['tenantId', 'readerId', 'readAt'], name: 'idx_tenant_operational_alert_reads_reader_time' }
        ]
    });

    TenantOperationalAlertRead.associate = (models) => {
        TenantOperationalAlertRead.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    };

    return TenantOperationalAlertRead;
};
