'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Review extends Model {
        static associate(models) {
            Review.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
            Review.belongsTo(models.Staff, { foreignKey: 'staffId', as: 'staff' });
            Review.belongsTo(models.Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
            Review.belongsTo(models.PlatformUser, { foreignKey: 'platformUserId', as: 'platformUser' });
        }
    }

    Review.init({
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
        staffId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'staff_id',
            references: { model: 'staff', key: 'id' },
            onDelete: 'SET NULL'
        },
        appointmentId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'appointment_id',
            references: { model: 'appointments', key: 'id' },
            onDelete: 'SET NULL'
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'platform_user_id',
            references: { model: 'platform_users', key: 'id' },
            onDelete: 'SET NULL'
        },
        customerName: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'customer_name'
        },
        rating: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            validate: { min: 1, max: 5 }
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        staffReply: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'staff_reply'
        },
        staffRepliedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'staff_replied_at'
        },
        isVisible: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'is_visible'
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'updated_at'
        }
    }, {
        sequelize,
        modelName: 'Review',
        tableName: 'reviews',
        schema: 'public',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['tenant_id', 'staff_id'] },
            { fields: ['tenant_id', 'created_at'] }
        ]
    });

    return Review;
};
