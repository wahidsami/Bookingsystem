'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    class PlatformUser extends Model {
        static associate(models) {
            // Platform user has many appointments across all tenants
            PlatformUser.hasMany(models.Appointment, {
                foreignKey: 'platformUserId',
                as: 'appointments'
            });

            // Platform user has many payment methods
            PlatformUser.hasMany(models.PaymentMethod, {
                foreignKey: 'platformUserId',
                as: 'paymentMethods'
            });

            // Platform user has many transactions
            PlatformUser.hasMany(models.Transaction, {
                foreignKey: 'platformUserId',
                as: 'transactions'
            });

            // Platform user has many orders
            PlatformUser.hasMany(models.Order, {
                foreignKey: 'platformUserId',
                as: 'orders'
            });
        }

        // Instance method to check password
        async validatePassword(password) {
            return await bcrypt.compare(password, this.password);
        }

        // Instance method to get safe user data (no password)
        toSafeObject() {
            const { password, ...safeUser } = this.toJSON();
            return safeUser;
        }
    }

    PlatformUser.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                is: /^\+?[1-9]\d{1,14}$/ // E.164 format
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        firstName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lastName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        dateOfBirth: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        gender: {
            type: DataTypes.ENUM('male', 'female', 'other'),
            allowNull: true
        },
        profileImage: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // Address Information (for POD orders)
        addressStreet: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'address_street', // Database column is snake_case
            comment: 'Street address'
        },
        addressCity: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'address_city', // Database column is snake_case
            comment: 'City'
        },
        addressBuilding: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'address_building', // Database column is snake_case
            comment: 'Building number/name'
        },
        addressFloor: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'address_floor', // Database column is snake_case
            comment: 'Floor number'
        },
        addressApartment: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'address_apartment', // Database column is snake_case
            comment: 'Apartment number'
        },
        addressPhone: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'address_phone', // Database column is snake_case
            comment: 'Phone number for delivery'
        },
        addressNotes: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'address_notes', // Database column is snake_case
            comment: 'Additional delivery notes'
        },

        // Preferences
        preferredLanguage: {
            type: DataTypes.ENUM('en', 'ar'),
            defaultValue: 'en'
        },
        notificationPreferences: {
            type: DataTypes.JSONB,
            defaultValue: {
                email: true,
                sms: true,
                whatsapp: true,
                push: true
            }
        },

        // Platform-wide data
        walletBalance: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        loyaltyPoints: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        totalSpent: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        totalBookings: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },

        // Verification
        emailVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        phoneVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        emailVerificationToken: {
            type: DataTypes.STRING,
            allowNull: true
        },
        phoneVerificationCode: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // Auth
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true
        },
        refreshToken: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        // Status
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        isBanned: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        banReason: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'PlatformUser',
        tableName: 'platform_users',
        schema: 'public',
        timestamps: true,
        hooks: {
            beforeCreate: async (user) => {
                // Hash password before creating user
                if (user.password) {
                    const salt = await bcrypt.genSalt(12);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            },
            beforeUpdate: async (user) => {
                // Hash password if it was changed
                if (user.changed('password')) {
                    const salt = await bcrypt.genSalt(12);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            }
        }
    });

    return PlatformUser;
};
