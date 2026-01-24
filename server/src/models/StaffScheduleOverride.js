/**
 * Staff Schedule Override Model
 * Date-specific schedule exceptions (special hours, day off, Ramadan hours, etc.)
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StaffScheduleOverride extends Model {
        static associate(models) {
            StaffScheduleOverride.belongsTo(models.Staff, {
                foreignKey: 'staffId',
                as: 'staff'
            });
        }
    }

    StaffScheduleOverride.init({
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
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            comment: 'Specific date for this override'
        },
        type: {
            type: DataTypes.ENUM('override', 'exception'),
            defaultValue: 'override',
            comment: 'override = replace normal schedule, exception = add special hours'
        },
        startTime: {
            type: DataTypes.TIME,
            allowNull: true,
            comment: 'Override start time. null = day off',
            field: 'start_time'
        },
        endTime: {
            type: DataTypes.TIME,
            allowNull: true,
            comment: 'Override end time. null = day off',
            field: 'end_time'
        },
        isAvailable: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'false = day off, true = available (with override hours if provided)',
            field: 'is_available'
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Reason for override: "Ramadan hours", "Holiday", "Special event", etc.'
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
        modelName: 'StaffScheduleOverride',
        tableName: 'staff_schedule_overrides',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['staff_id', 'date'],
                name: 'unique_staff_date_override'
            },
            {
                fields: ['staff_id', 'date']
            },
            {
                fields: ['is_available']
            }
        ]
    });

    return StaffScheduleOverride;
};

