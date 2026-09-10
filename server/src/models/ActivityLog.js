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
    },
    // New audit tracking identifiers
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    requestId: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    operationId: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    correlationId: {
      type: DataTypes.STRING(64),
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
    ],
    hooks: {
      beforeUpdate: (instance, options) => {
        throw new Error('ActivityLog updates are prohibited');
      },
      beforeBulkUpdate: (options) => {
        throw new Error('ActivityLog bulk updates are prohibited');
      },
      beforeDestroy: (instance, options) => {
        if (!options.trustedContext) {
          throw new Error('ActivityLog deletion is prohibited');
        }
      },
      beforeBulkDestroy: (options) => {
        if (!options.trustedContext) {
          throw new Error('ActivityLog bulk deletion is prohibited');
        }
      }
    }
  });

  return ActivityLog;
};
