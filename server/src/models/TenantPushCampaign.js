'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantPushCampaign extends Model {
        static associate(models) {
            TenantPushCampaign.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
            TenantPushCampaign.hasMany(models.TenantPushCampaignRecipient, { foreignKey: 'campaignId', as: 'recipients' });
        }
    }

    TenantPushCampaign.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'tenant_id',
            references: { model: 'tenants', key: 'id' },
            onDelete: 'CASCADE'
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        data: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        audienceType: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'selected',
            field: 'audience_type'
        },
        recipientCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'recipient_count'
        },
        sentAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'sent_at'
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        }
    }, {
        sequelize,
        modelName: 'TenantPushCampaign',
        tableName: 'tenant_push_campaigns',
        schema: 'public',
        timestamps: false,
        updatedAt: false,
        indexes: [
            { fields: ['tenant_id', 'sent_at'], name: 'idx_tenant_push_campaigns_tenant_sent' }
        ]
    });

    return TenantPushCampaign;
};
