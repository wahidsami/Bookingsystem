'use strict';

const { Model } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  class TenantDashboardAccount extends Model {
    static associate(models) {
      TenantDashboardAccount.belongsTo(models.Tenant, {
        foreignKey: 'tenantId',
        as: 'tenant'
      });
    }

    async validatePassword(password) {
      return await bcrypt.compare(password, this.password);
    }
  }

  TenantDashboardAccount.init({
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
      },
      onDelete: 'CASCADE'
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    roleKey: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'custom'
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        view_dashboard: true
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    passwordResetRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastLoginIP: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'TenantDashboardAccount',
    tableName: 'tenant_dashboard_accounts',
    schema: 'public',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenantId', 'email'],
        name: 'uq_tenant_dashboard_accounts_tenant_email'
      },
      {
        fields: ['tenantId'],
        name: 'idx_tenant_dashboard_accounts_tenant'
      },
      {
        fields: ['roleKey'],
        name: 'idx_tenant_dashboard_accounts_role'
      }
    ],
    hooks: {
      beforeCreate: async (account) => {
        if (account.email) {
          account.email = account.email.trim().toLowerCase();
        }

        if (account.password) {
          const salt = await bcrypt.genSalt(10);
          account.password = await bcrypt.hash(account.password, salt);
        }
      },
      beforeUpdate: async (account) => {
        if (account.changed('email') && account.email) {
          account.email = account.email.trim().toLowerCase();
        }

        if (account.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          account.password = await bcrypt.hash(account.password, salt);
        }
      }
    }
  });

  return TenantDashboardAccount;
};
