'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Staff extends Model {
        static associate(models) {
            // Staff belongs to a Tenant
            Staff.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            // Staff can be assigned to many Services through ServiceEmployee
            Staff.belongsToMany(models.Service, {
                through: 'ServiceEmployee',
                foreignKey: 'staffId',
                otherKey: 'serviceId',
                as: 'services'
            });

            // Legacy: Keep StaffServices for backward compatibility
            Staff.belongsToMany(models.Service, {
                through: 'StaffServices',
                foreignKey: 'staffId',
                otherKey: 'serviceId',
                as: 'legacyServices'
            });

            Staff.hasMany(models.StaffSchedule, { 
                foreignKey: 'staffId',
                as: 'schedules'
            });

            Staff.hasMany(models.StaffShift, {
                foreignKey: 'staffId',
                as: 'shifts'
            });

            Staff.hasMany(models.StaffBreak, {
                foreignKey: 'staffId',
                as: 'breaks'
            });

            Staff.hasMany(models.StaffTimeOff, {
                foreignKey: 'staffId',
                as: 'timeOff'
            });

            Staff.hasMany(models.StaffScheduleOverride, {
                foreignKey: 'staffId',
                as: 'scheduleOverrides'
            });

            Staff.hasMany(models.Appointment, { 
                foreignKey: 'staffId',
                as: 'appointments'
            });
        }
    }

    Staff.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isEmail: true
            }
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        nationality: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Employee nationality (e.g., "Saudi", "Egyptian", "Filipino")'
        },
        bio: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Short biography or description'
        },
        experience: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Years of experience (e.g., "5 years" or just "5")'
        },
        skills: {
            type: DataTypes.JSONB, // Changed from JSON to JSONB for better Sequelize support
            defaultValue: [],
            comment: 'Array of skills (e.g., ["Haircut", "Coloring", "Styling"])'
        },
        photo: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Employee photo path/URL'
        },
        rating: {
            type: DataTypes.DECIMAL(3, 2),
            defaultValue: 5.0,
            validate: {
                min: 0,
                max: 5
            }
        },
        totalBookings: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        // Financial fields
        salary: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Monthly base salary (SAR)'
        },
        commissionRate: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0.00,
            comment: 'Commission percentage per service (e.g., 10.00 for 10%)'
        },
        // Legacy commission field (for backward compatibility)
        commission: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0.00
        },
        // Working hours and availability
        workingHours: {
            type: DataTypes.JSONB, // Changed from JSON to JSONB for better Sequelize support
            allowNull: true,
            defaultValue: {},
            comment: 'Working schedule: { "sunday": { "start": "09:00", "end": "18:00" }, ... }'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'Staff',
        tableName: 'staff',
        schema: 'public',
        timestamps: true
    });

    return Staff;
};
