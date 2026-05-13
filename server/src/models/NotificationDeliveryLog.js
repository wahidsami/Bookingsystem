module.exports = (sequelize, DataTypes) => {
    const NotificationDeliveryLog = sequelize.define('NotificationDeliveryLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        eventType: {
            type: DataTypes.STRING(120),
            allowNull: false
        },
        recipientType: {
            type: DataTypes.ENUM('customer', 'staff'),
            allowNull: false
        },
        recipientId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        channel: {
            type: DataTypes.ENUM('push', 'inbox', 'staff_message'),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('queued', 'sent', 'failed', 'skipped'),
            allowNull: false,
            defaultValue: 'queued'
        },
        reason: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        payload: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        response: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    }, {
        tableName: 'notification_delivery_logs',
        timestamps: true,
        indexes: [
            { fields: ['eventType'] },
            { fields: ['recipientType', 'recipientId'] },
            { fields: ['tenantId'] },
            { fields: ['channel', 'status'] },
            { fields: ['createdAt'] }
        ]
    });

    return NotificationDeliveryLog;
};

