'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TenantPushCampaignRecipient extends Model {
        static associate(models) {
            TenantPushCampaignRecipient.belongsTo(models.TenantPushCampaign, { foreignKey: 'campaignId', as: 'campaign' });
            TenantPushCampaignRecipient.belongsTo(models.PlatformUser, { foreignKey: 'platformUserId', as: 'platformUser' });
        }
    }

    TenantPushCampaignRecipient.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        campaignId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'campaign_id',
            references: { model: 'tenant_push_campaigns', key: 'id' },
            onDelete: 'CASCADE'
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'platform_user_id',
            references: { model: 'platform_users', key: 'id' },
            onDelete: 'CASCADE'
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        }
    }, {
        sequelize,
        modelName: 'TenantPushCampaignRecipient',
        tableName: 'tenant_push_campaign_recipients',
        schema: 'public',
        timestamps: false,
        updatedAt: false,
        indexes: [
            { fields: ['campaign_id'], name: 'idx_tenant_push_campaign_recipients_campaign' }
        ]
    });

    return TenantPushCampaignRecipient;
};
