const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const SuperAdmin = sequelize.define('SuperAdmin', {
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
        firstName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lastName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('super_admin', 'admin', 'support'),
            defaultValue: 'admin'
        },
        permissions: {
            type: DataTypes.JSONB,
            defaultValue: {
                tenants: { view: true, create: true, edit: true, delete: false, approve: true },
                users: { view: true, create: false, edit: true, delete: false },
                financial: { view: true, export: true, refund: false },
                settings: { view: true, edit: false }
            }
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        lastLoginAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastLoginIP: {
            type: DataTypes.STRING,
            allowNull: true
        },
        profileImage: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'super_admins',
        timestamps: true,
        hooks: {
            beforeCreate: async (admin) => {
                if (admin.password) {
                    const salt = await bcrypt.genSalt(12);
                    admin.password = await bcrypt.hash(admin.password, salt);
                }
            },
            beforeUpdate: async (admin) => {
                if (admin.changed('password')) {
                    const salt = await bcrypt.genSalt(12);
                    admin.password = await bcrypt.hash(admin.password, salt);
                }
            }
        }
    });

    // Instance method to verify password
    SuperAdmin.prototype.verifyPassword = async function(password) {
        return bcrypt.compare(password, this.password);
    };

    // Instance method to get safe user data (without password)
    SuperAdmin.prototype.toSafeObject = function() {
        const { password, ...safeData } = this.toJSON();
        return safeData;
    };

    return SuperAdmin;
};

