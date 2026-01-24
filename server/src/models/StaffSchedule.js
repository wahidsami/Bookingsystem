'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StaffSchedule extends Model {
        static associate(models) {
            StaffSchedule.belongsTo(models.Staff, { foreignKey: 'staffId' });
        }
    }

    StaffSchedule.init({
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
            }
        },
        dayOfWeek: {
            type: DataTypes.INTEGER, // 0 = Sunday, 6 = Saturday
            allowNull: false,
            validate: {
                min: 0,
                max: 6
            }
        },
        startTime: {
            type: DataTypes.TIME,
            allowNull: false
        },
        endTime: {
            type: DataTypes.TIME,
            allowNull: false
        },
        isAvailable: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'StaffSchedule',
        tableName: 'staff_schedules',
        schema: 'public',
        timestamps: true
    });

    return StaffSchedule;
};
