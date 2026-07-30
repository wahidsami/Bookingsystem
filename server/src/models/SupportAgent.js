'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SupportAgent extends Model {
        static associate(models) {
            SupportAgent.belongsTo(models.SuperAdmin, {
                foreignKey: 'superAdminId',
                as: 'superAdmin'
            });

            SupportAgent.hasMany(models.SupportTicket, {
                foreignKey: 'assignedSupportAgentId',
                as: 'assignedTickets'
            });

            SupportAgent.hasMany(models.SupportMessage, {
                foreignKey: 'supportAgentId',
                as: 'sentMessages'
            });

            SupportAgent.hasMany(models.SupportTicketEvent, {
                foreignKey: 'supportAgentId',
                as: 'events'
            });
        }
    }

    SupportAgent.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        superAdminId: {
            type: DataTypes.UUID,
            allowNull: true,
            unique: true,
            references: { model: 'super_admins', key: 'id' },
            onDelete: 'SET NULL'
        },
        displayName: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        displayNameAr: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        title: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        avatarUrl: {
            type: DataTypes.STRING(1000),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'suspended'),
            allowNull: false,
            defaultValue: 'active'
        },
        presenceStatus: {
            type: DataTypes.ENUM('offline', 'online', 'away', 'busy'),
            allowNull: false,
            defaultValue: 'offline'
        },
        supportedLanguages: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: ['ar', 'en']
        },
        skills: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        lastSeenAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'SupportAgent',
        tableName: 'support_agents',
        schema: 'public',
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['superAdminId'], unique: true, name: 'uidx_support_agents_super_admin' },
            { fields: ['status'], name: 'idx_support_agents_status' },
            { fields: ['presenceStatus'], name: 'idx_support_agents_presence_status' }
        ]
    });

    return SupportAgent;
};
