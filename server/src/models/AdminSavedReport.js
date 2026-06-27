'use strict';

module.exports = (sequelize, DataTypes) => {
    const AdminSavedReport = sequelize.define('AdminSavedReport', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        createdByAdminId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'super_admins',
                key: 'id'
            }
        },
        reportType: {
            type: DataTypes.STRING(64),
            allowNull: false,
            defaultValue: 'custom'
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        dimensions: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        metrics: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        grouping: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        filters: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        outputType: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'table'
        },
        chartType: {
            type: DataTypes.STRING(32),
            allowNull: true
        },
        reportConfig: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        scheduleConfig: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        isFavorite: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        lastRunAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        nextRunAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastRunResult: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
        },
        runHistory: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: []
        },
        duplicatedFromId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'admin_saved_reports',
                key: 'id'
            }
        }
    }, {
        tableName: 'admin_saved_reports',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['createdByAdminId', 'updatedAt'] },
            { fields: ['isFavorite'] },
            { fields: ['nextRunAt'] }
        ]
    });

    AdminSavedReport.associate = (models) => {
        AdminSavedReport.belongsTo(models.SuperAdmin, {
            foreignKey: 'createdByAdminId',
            as: 'creator'
        });

        AdminSavedReport.belongsTo(AdminSavedReport, {
            foreignKey: 'duplicatedFromId',
            as: 'duplicatedFrom'
        });
    };

    return AdminSavedReport;
};
