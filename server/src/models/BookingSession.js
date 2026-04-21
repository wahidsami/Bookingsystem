'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class BookingSession extends Model {
        static associate(models) {
            BookingSession.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });

            BookingSession.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });

            BookingSession.hasMany(models.Appointment, {
                foreignKey: 'bookingSessionId',
                as: 'appointments'
            });
        }

        static async generateBookingReference() {
            const year = new Date().getFullYear();
            const prefix = `BKS-${year}-`;

            const lastSession = await BookingSession.findOne({
                where: {
                    bookingReference: {
                        [sequelize.Sequelize.Op.like]: `${prefix}%`
                    }
                },
                order: [['createdAt', 'DESC']]
            });

            let sequence = 1;
            if (lastSession?.bookingReference) {
                const lastSequence = parseInt(lastSession.bookingReference.split('-')[2], 10);
                if (Number.isFinite(lastSequence)) {
                    sequence = lastSequence + 1;
                }
            }

            return `${prefix}${sequence.toString().padStart(6, '0')}`;
        }
    }

    BookingSession.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        bookingReference: {
            type: DataTypes.STRING(40),
            allowNull: false,
            unique: true,
            comment: 'Shared reference for related appointments in the same customer booking'
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            }
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'platform_users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('draft', 'confirmed', 'completed', 'cancelled'),
            allowNull: false,
            defaultValue: 'draft'
        },
        itemCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        taxAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        platformFee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        paymentMethod: {
            type: DataTypes.STRING,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'BookingSession',
        tableName: 'booking_sessions',
        schema: 'public',
        timestamps: true,
        indexes: [
            {
                fields: ['tenantId', 'createdAt'],
                name: 'idx_booking_sessions_tenant_created_at'
            },
            {
                fields: ['platformUserId'],
                name: 'idx_booking_sessions_platform_user'
            },
            {
                fields: ['bookingReference'],
                unique: true,
                name: 'idx_booking_sessions_reference'
            }
        ],
        hooks: {
            beforeCreate: async (session) => {
                if (!session.bookingReference) {
                    session.bookingReference = await BookingSession.generateBookingReference();
                }
            }
        }
    });

    return BookingSession;
};
