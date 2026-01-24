'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class HotDeal extends Model {
        static associate(models) {
            HotDeal.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
            HotDeal.belongsTo(models.Service, {
                foreignKey: 'serviceId',
                as: 'service'
            });
            HotDeal.belongsTo(models.SuperAdmin, {
                foreignKey: 'approvedBy',
                as: 'approver'
            });
        }

        /**
         * Check if deal is currently valid
         */
        isValid() {
            const now = new Date();
            return this.status === 'active' &&
                this.isActive &&
                now >= this.validFrom &&
                now <= this.validUntil;
        }

        /**
         * Check if deal can still be redeemed
         */
        canRedeem() {
            if (!this.isValid()) return false;
            if (this.maxRedemptions === -1) return true;
            return this.currentRedemptions < this.maxRedemptions;
        }

        /**
         * Increment redemption count
         */
        async redeem() {
            if (!this.canRedeem()) {
                throw new Error('Deal cannot be redeemed');
            }
            this.currentRedemptions += 1;
            await this.save();
        }
    }

    HotDeal.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },

        // Ownership
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'tenants',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        serviceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'services',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },

        // Deal Content (Bilingual)
        title_en: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        title_ar: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        description_en: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        description_ar: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        // Pricing
        discountType: {
            type: DataTypes.ENUM('percentage', 'fixed_amount'),
            allowNull: false,
            comment: 'percentage = % off, fixed_amount = SAR off'
        },
        discountValue: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0.01
            }
        },
        originalPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0
            }
        },
        discountedPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0
            }
        },

        // Validity
        validFrom: {
            type: DataTypes.DATE,
            allowNull: false
        },
        validUntil: {
            type: DataTypes.DATE,
            allowNull: false,
            validate: {
                isAfterStart(value) {
                    if (this.validFrom && value <= this.validFrom) {
                        throw new Error('Valid until must be after valid from');
                    }
                }
            }
        },

        // Usage Limits
        maxRedemptions: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: -1,
            comment: '-1 = unlimited'
        },
        currentRedemptions: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0
            }
        },

        // Approval Workflow
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'active', 'expired', 'rejected', 'paused'),
            allowNull: false,
            defaultValue: 'pending'
        },
        rejectionReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        approvedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'super_admins',
                key: 'id'
            }
        },
        approvedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },

        // Visibility
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'HotDeal',
        tableName: 'hot_deals',
        schema: 'public',
        timestamps: true,
        underscored: true,
        indexes: [
            { fields: ['tenant_id'] },
            { fields: ['service_id'] },
            { fields: ['status'] },
            { fields: ['valid_from', 'valid_until'] },
            {
                fields: ['status', 'is_active', 'valid_until'],
                where: { status: 'active', is_active: true }
            }
        ]
    });

    return HotDeal;
};
