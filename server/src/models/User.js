'use strict';
const {
    Model
} = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        static associate(models) {
            User.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
        }

        async validatePassword(password) {
            return await bcrypt.compare(password, this.password);
        }
    }
    User.init({
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
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('superadmin', 'owner', 'manager', 'staff'),
            defaultValue: 'owner'
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: true, // Superadmins might not belong to a tenant
            references: {
                model: 'tenants',
                key: 'id'
            }
        }
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'auth_users',
        schema: 'public', // Shared schema
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            }
        }
    });
    return User;
};
