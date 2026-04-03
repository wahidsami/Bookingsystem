module.exports = (sequelize, DataTypes) => {
    const AdminNotification = sequelize.define('AdminNotification', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        severity: {
            type: DataTypes.ENUM('info', 'success', 'warning', 'danger'),
            allowNull: false,
            defaultValue: 'info'
        },
        titleAr: {
            type: DataTypes.STRING,
            allowNull: false
        },
        titleEn: {
            type: DataTypes.STRING,
            allowNull: false
        },
        messageAr: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        messageEn: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        entityType: {
            type: DataTypes.STRING,
            allowNull: true
        },
        entityId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        actionUrl: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        readAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        dedupeKey: {
            type: DataTypes.STRING,
            allowNull: false
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    }, {
        tableName: 'admin_notifications',
        timestamps: true,
        indexes: [
            { fields: ['type'] },
            { fields: ['severity'] },
            { fields: ['isRead'] },
            { fields: ['entityType', 'entityId'] },
            { fields: ['createdAt'] },
            {
                unique: true,
                fields: ['dedupeKey']
            }
        ]
    });

    return AdminNotification;
};
