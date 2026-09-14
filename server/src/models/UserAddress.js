'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class UserAddress extends Model {
        static associate(models) {
            UserAddress.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });
            if (models.PlatformUser && !models.PlatformUser.associations.addresses) {
                models.PlatformUser.hasMany(UserAddress, {
                    foreignKey: 'platformUserId',
                    as: 'addresses'
                });
            }
        }
    }
    UserAddress.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'platform_user_id',
            references: {
                model: {
                    tableName: 'platform_users',
                    schema: 'public'
                },
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false, // e.g., 'Home', 'Work'
            defaultValue: 'Home'
        },
        street: {
            type: DataTypes.STRING,
            allowNull: false
        },
        city: {
            type: DataTypes.STRING,
            allowNull: false
        },
        building: {
            type: DataTypes.STRING,
            allowNull: true
        },
        floor: {
            type: DataTypes.STRING,
            allowNull: true
        },
        apartment: {
            type: DataTypes.STRING,
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_default'
        }
    }, {
        sequelize,
        modelName: 'UserAddress',
        tableName: 'user_addresses',
        schema: 'public',
        timestamps: true,
        underscored: true,
    });
    return UserAddress;
};
