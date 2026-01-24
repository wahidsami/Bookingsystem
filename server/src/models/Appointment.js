'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Appointment extends Model {
        static associate(models) {
            Appointment.belongsTo(models.Service, {
                foreignKey: 'serviceId',
                as: 'service'
            });
            Appointment.belongsTo(models.Staff, {
                foreignKey: 'staffId',
                as: 'staff'
            });
            Appointment.belongsTo(models.PlatformUser, {
                foreignKey: 'platformUserId',
                as: 'user'
            });
            Appointment.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant',
                required: false
            });
            // Keep Customer for backward compatibility (will be deprecated)
            Appointment.belongsTo(models.Customer, {
                foreignKey: 'customerId',
                as: 'legacyCustomer'
            });
            // Payment Transactions
            Appointment.hasMany(models.PaymentTransaction, {
                foreignKey: 'appointmentId',
                as: 'paymentTransactions'
            });
        }

        /**
         * Calculate revenue breakdown based on service pricing
         * @param {Object} service - Service object with pricing info
         * @param {Object} staff - Staff object with commission rate
         * @returns {Object} Revenue breakdown
         */
        static calculateRevenueBreakdown(service, staff) {
            const rawPrice = parseFloat(service.rawPrice || service.basePrice || 0);
            const taxRate = parseFloat(service.taxRate || 15);
            const commissionRate = parseFloat(service.commissionRate || 10);
            const employeeCommissionRate = parseFloat(staff?.commissionRate || 0);

            const taxAmount = rawPrice * (taxRate / 100);
            const platformFee = rawPrice * (commissionRate / 100);
            const finalPrice = rawPrice + taxAmount + platformFee;

            const tenantRevenue = rawPrice + taxAmount; // Tenant gets raw + tax
            const employeeRevenue = rawPrice; // Employee commission is calculated on raw price
            const employeeCommission = employeeRevenue * (employeeCommissionRate / 100);

            return {
                price: parseFloat(finalPrice.toFixed(2)),
                rawPrice: parseFloat(rawPrice.toFixed(2)),
                taxAmount: parseFloat(taxAmount.toFixed(2)),
                platformFee: parseFloat(platformFee.toFixed(2)),
                tenantRevenue: parseFloat(tenantRevenue.toFixed(2)),
                employeeRevenue: parseFloat(employeeRevenue.toFixed(2)),
                employeeCommissionRate: parseFloat(employeeCommissionRate.toFixed(2)),
                employeeCommission: parseFloat(employeeCommission.toFixed(2))
            };
        }
    }

    Appointment.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        serviceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'services',
                key: 'id'
            }
        },
        staffId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'staff',
                key: 'id'
            }
        },
        platformUserId: {
            type: DataTypes.UUID,
            allowNull: true, // Nullable for migration period
            references: {
                model: 'platform_users',
                key: 'id'
            }
        },
        customerId: {
            type: DataTypes.UUID,
            allowNull: true, // Now optional (legacy)
            references: {
                model: 'customers',
                key: 'id'
            }
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: true, // Can be derived from service/staff, but store for performance
            references: {
                model: 'tenants',
                key: 'id'
            },
            comment: 'Tenant ID for faster queries (denormalized)'
        },
        startTime: {
            type: DataTypes.DATE,
            allowNull: false
        },
        endTime: {
            type: DataTypes.DATE,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show'),
            defaultValue: 'pending'
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Final price charged to customer'
        },
        // Revenue tracking fields
        rawPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Service base price (before tax and commission)'
        },
        taxAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Tax amount (15% Saudi VAT)'
        },
        platformFee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Commission taken by Rifah platform'
        },
        tenantRevenue: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Revenue for tenant (after platform fee, before employee commission)'
        },
        employeeRevenue: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Revenue attributed to employee (for commission calculation)'
        },
        employeeCommissionRate: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Commission rate for employee at time of booking'
        },
        employeeCommission: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Commission amount for employee'
        },
        // Payment tracking
        paymentStatus: {
            type: DataTypes.ENUM('pending', 'deposit_paid', 'fully_paid', 'refunded', 'partially_refunded'),
            defaultValue: 'pending',
            comment: 'pending = no payment, deposit_paid = deposit paid, fully_paid = all paid'
        },
        paymentMethod: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Payment method used (cash, card, wallet)'
        },
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Split Payment Support
        depositAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
            comment: 'Amount to be paid as deposit (e.g., 25% of price)'
        },
        depositPaid: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether deposit has been paid'
        },
        remainderAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
            comment: 'Amount to be paid at salon'
        },
        remainderPaid: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether remainder has been paid at salon'
        },
        totalPaid: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
            comment: 'Total amount paid so far'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        aiScore: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Appointment',
        tableName: 'appointments',
        schema: 'public',
        timestamps: true,
        indexes: [
            // Primary index for conflict detection (Phase 6.3)
            {
                fields: ['staffId', 'startTime', 'endTime', 'status'],
                name: 'idx_staff_time_status',
                where: {
                    status: ['pending', 'confirmed', 'completed']
                }
            },
            // Index for date range queries
            {
                fields: ['staffId', 'startTime'],
                name: 'idx_staff_start_time'
            },
            {
                fields: ['startTime', 'endTime'],
                name: 'idx_time_range'
            },
            {
                fields: ['customerId'],
                name: 'idx_customer'
            },
            {
                fields: ['platformUserId'],
                name: 'idx_platform_user'
            },
            {
                fields: ['platformUserId', 'startTime'],
                name: 'idx_platform_user_time'
            },
            // Index for tenant-based queries
            {
                fields: ['tenantId', 'startTime'],
                name: 'idx_tenant_time'
            }
        ]
    });

    return Appointment;
};
