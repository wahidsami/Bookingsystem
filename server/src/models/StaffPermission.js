'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StaffPermission extends Model {
        static associate(models) {
            StaffPermission.belongsTo(models.Staff, {
                foreignKey: 'staffId',
                as: 'staff'
            });
        }
    }

    StaffPermission.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        staffId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: {
                model: 'staff',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        permissions: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {
                view_earnings: false,
                view_reviews: true,
                reply_reviews: false,
                view_clients: false,
                view_booking_notes: false
            }
        }
    }, {
        sequelize,
        modelName: 'StaffPermission',
        tableName: 'staff_permissions',
        schema: 'public',
        timestamps: true
    });

    return StaffPermission;
};
