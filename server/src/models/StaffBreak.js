/**
 * Staff Break Model
 * Recurring or date-specific breaks (lunch, prayer, cleaning, etc.)
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StaffBreak extends Model {
        static associate(models) {
            StaffBreak.belongsTo(models.Staff, {
                foreignKey: 'staffId',
                as: 'staff'
            });
        }
    }

    StaffBreak.init({
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
        dayOfWeek: {
            type: DataTypes.INTEGER, // 0 = Sunday, 6 = Saturday, null = date-specific
            allowNull: true,
            validate: {
                min: 0,
                max: 6
            },
            comment: 'Day of week for recurring breaks. null = date-specific break',
            field: 'day_of_week'
        },
        specificDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Specific date for one-time breaks. null = recurring',
            field: 'specific_date'
        },
        startTime: {
            type: DataTypes.TIME,
            allowNull: false,
            field: 'start_time'
        },
        endTime: {
            type: DataTypes.TIME,
            allowNull: false,
            field: 'end_time'
        },
        type: {
            type: DataTypes.STRING,
            defaultValue: 'lunch',
            allowNull: false,
            validate: {
                isIn: [['lunch', 'prayer', 'cleaning', 'other']]
            },
            comment: 'Type of break: lunch, prayer, cleaning, other'
        },
        label: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Break label: "Lunch Break", "Prayer Time", "Cleaning Time", etc.'
        },
        isRecurring: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'If true, break repeats weekly. If false, use specificDate',
            field: 'is_recurring'
        },
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Start date for recurring breaks (null = starts immediately)',
            field: 'start_date'
        },
        endDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'End date for recurring breaks (null = no end date)',
            field: 'end_date'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
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
        modelName: 'StaffBreak',
        tableName: 'staff_breaks',
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

    return StaffBreak;
};

