module.exports = (sequelize, DataTypes) => {
    const ActivityLog = sequelize.define('ActivityLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // What entity was affected
        entityType: {
            type: DataTypes.ENUM(
                'tenant', 
                'platform_user', 
                'appointment', 
                'transaction', 
                'service', 
                'staff',
                'super_admin',
                'system',
                'package'
            ),
            allowNull: false
        },
        entityId: {
            type: DataTypes.UUID,
            allowNull: true // null for system-wide actions
        },
        // What action was performed
        action: {
            type: DataTypes.ENUM(
                'created',
                'updated',
                'deleted',
                'approved',
                'rejected',
                'suspended',
                'activated',
                'login',
                'logout',
                'password_change',
                'settings_change',
                'payment_received',
                'refund_issued',
                'document_uploaded',
                'document_verified'
            ),
            allowNull: false
        },
        // Who performed the action
        performedByType: {
            type: DataTypes.ENUM('super_admin', 'tenant_user', 'platform_user', 'system'),
            allowNull: false
        },
        performedById: {
            type: DataTypes.UUID,
            allowNull: true // null for system actions
        },
        performedByName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Additional details
        details: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        // For tracking changes
        previousValue: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        newValue: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        // IP address for security
        ipAddress: {
            type: DataTypes.STRING,
            allowNull: true
        },
        userAgent: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'activity_logs',
        timestamps: true,
        updatedAt: false, // Logs are immutable
        indexes: [
            { fields: ['entityType', 'entityId'] },
            { fields: ['performedByType', 'performedById'] },
            { fields: ['action'] },
            { fields: ['createdAt'] }
        ]
    });

    return ActivityLog;
};

