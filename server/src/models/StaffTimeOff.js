/**
 * Staff Time Off Model
 * Date-specific time off (vacation, sick day, personal, training, etc.)
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StaffTimeOff extends Model {
        static associate(models) {
            StaffTimeOff.belongsTo(models.Staff, {
                foreignKey: 'staffId',
                as: 'staff'
            });
        }
    }

    StaffTimeOff.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        staffId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'staff',
                key: 'id'
            },
            onDelete: 'CASCADE',
            field: 'staff_id'
        },
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            comment: 'Start date of time off',
            field: 'start_date'
        },
        endDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            comment: 'End date of time off (inclusive)',
            field: 'end_date'
        },
        type: {
            type: DataTypes.ENUM('vacation', 'sick', 'personal', 'training', 'other'),
            defaultValue: 'vacation',
            comment: 'Type of time off'
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Reason for time off'
        },
        isApproved: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'For future approval workflow',
            field: 'is_approved'
        },
        approvedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Tenant user ID who approved (for future)',
            field: 'approved_by'
        },
        approvedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'approved_at'
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
        modelName: 'StaffTimeOff',
        tableName: 'staff_time_off',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['staff_id', 'start_date', 'end_date']
            },
            {
                fields: ['is_approved']
            }
        ]
    });

    return StaffTimeOff;
};

