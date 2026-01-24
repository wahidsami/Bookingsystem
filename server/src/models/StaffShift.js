/**
 * Staff Shift Model
 * Supports multiple shifts per day (morning/evening)
 * Recurring or date-specific
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StaffShift extends Model {
        static associate(models) {
            StaffShift.belongsTo(models.Staff, {
                foreignKey: 'staffId',
                as: 'staff'
            });
        }
    }

    StaffShift.init({
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
            field: 'staff_id' // Map to snake_case column
        },
        dayOfWeek: {
            type: DataTypes.INTEGER, // 0 = Sunday, 6 = Saturday, null = date-specific
            allowNull: true,
            validate: {
                min: 0,
                max: 6
            },
            comment: 'Day of week for recurring shifts. null = date-specific shift',
            field: 'day_of_week' // Map to snake_case column
        },
        specificDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Specific date for one-time shifts. null = recurring',
            field: 'specific_date' // Map to snake_case column
        },
        startTime: {
            type: DataTypes.TIME,
            allowNull: false,
            field: 'start_time' // Map to snake_case column
        },
        endTime: {
            type: DataTypes.TIME,
            allowNull: false,
            field: 'end_time' // Map to snake_case column
        },
        isRecurring: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'If true, shift repeats weekly. If false, use specificDate',
            field: 'is_recurring' // Map to snake_case column
        },
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Start date for recurring shifts (null = starts immediately)',
            field: 'start_date' // Map to snake_case column
        },
        endDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'End date for recurring shifts (null = no end date)',
            field: 'end_date' // Map to snake_case column
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active' // Map to snake_case column
        },
        label: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Optional label: "Morning Shift", "Evening Shift", etc.'
        }
    }, {
        sequelize,
        modelName: 'StaffShift',
        tableName: 'staff_shifts',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['staff_id', 'day_of_week']
            },
            {
                fields: ['staff_id', 'specific_date']
            },
            {
                fields: ['is_active']
            }
        ]
    });

    return StaffShift;
};

