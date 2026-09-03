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
            Appointment.belongsTo(models.BookingSession, {
                foreignKey: 'bookingSessionId',
                as: 'bookingSession',
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
            Appointment.hasMany(models.AppointmentEvent, {
                foreignKey: 'appointmentId',
                as: 'events'
            });
        }

        /**
         * Calculate revenue breakdown based on service pricing
         * @param {Object} service - Service object with pricing info
         * @param {Object} staff - Staff object with commission rate
         * @returns {Object} Revenue breakdown
         */
        static calculateRevenueBreakdown(service, staff) {
            const rawPrice = parseFloat(service.rawPrice ?? service.basePrice ?? 0);
            const taxRate = parseFloat(service.taxRate ?? 15);
            const commissionRate = parseFloat(service.commissionRate ?? 10);
            const employeeCommissionRate = parseFloat(staff?.commissionRate ?? 0);

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

        /**
         * Generate a short, human-readable booking number for reception/POS lookup.
         * Format: BKG-YYYY-XXXXXX
         */
        static async generateBookingNumber(options = {}) {
            const transaction = options?.transaction || null;
            const year = new Date().getFullYear();
            const prefix = `BKG-${year}-`;

            const lastAppointment = await Appointment.findOne({
                where: {
                    bookingNumber: {
                        [sequelize.Sequelize.Op.like]: `${prefix}%`
                    }
                },
                order: [['createdAt', 'DESC']],
                transaction
            });

            let sequence = 1;
            if (lastAppointment?.bookingNumber) {
                const lastSequence = parseInt(lastAppointment.bookingNumber.split('-')[2], 10);
                if (Number.isFinite(lastSequence)) {
                    sequence = lastSequence + 1;
                }
            }

            return `${prefix}${sequence.toString().padStart(6, '0')}`;
        }
    }

    Appointment.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        bookingNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
            comment: 'Human-friendly booking number for POS/reception lookup'
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
        requestedStaffId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'staff',
                key: 'id'
            },
            comment: 'Staff explicitly chosen by the customer. Null means any available staff.'
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
        serviceVariantId: {
            type: DataTypes.STRING(120),
            allowNull: true,
            comment: 'Selected service variant identifier'
        },
        serviceVariantName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Selected service variant label or description'
        },
        serviceVariantDescription: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Selected service variant description snapshot'
        },
        serviceVariantDuration: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Selected service variant duration snapshot'
        },
        bookingSessionId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'booking_sessions',
                key: 'id'
            },
            comment: 'Shared booking session for multi-service checkouts'
        },
        bookingReference: {
            type: DataTypes.STRING(40),
            allowNull: true,
            comment: 'Shared reference for a group of linked appointments'
        },
        bookingItemIndex: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Zero-based index of the item within a booking session'
        },
        startTime: {
            type: DataTypes.DATE,
            allowNull: false
        },
        endTime: {
            type: DataTypes.DATE,
            allowNull: false
        },
        overtimeApproval: {
            type: DataTypes.JSONB,
            allowNull: true,
            field: 'overtime_approval',
            comment: 'Booking-scoped authorized overtime approval; does not alter the staff schedule'
        },
        status: {
            type: DataTypes.ENUM(
                'pending',
                'confirmed',
                'checked_in',
                'in_service',
                'completed',
                'cancelled',
                'no_show'
            ),
            defaultValue: 'pending'
        },
        assignmentMode: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'unknown',
            validate: {
                isIn: [['unknown', 'customer_selected', 'auto_assigned', 'tenant_reassigned']]
            },
            comment: 'Tracks how the assigned staff member was chosen'
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
        customerReminderSentAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the latest customer reminder was sent'
        },
        noShowMarkedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the appointment was auto-marked or manually marked as no-show'
        },
        customerConfirmationRequired: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether customer must confirm attendance from the app'
        },
        customerConfirmationStatus: {
            type: DataTypes.STRING(24),
            allowNull: false,
            defaultValue: 'not_required',
            comment: 'Customer confirmation state: not_required, pending, confirmed, declined'
        },
        customerConfirmedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the customer responded to appointment confirmation'
        },
        inviteToken: {
            type: DataTypes.STRING(128),
            allowNull: true,
            unique: true,
            comment: 'Secure token for appointment invite deep links'
        },
        inviteExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Invite token expiry timestamp'
        },
        serviceStartedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the service actually started'
        },
        serviceCompletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the service was marked completed'
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
                    status: ['pending', 'confirmed', 'checked_in', 'in_service', 'completed']
                }
            },
            // Index for date range queries
            {
                fields: ['staffId', 'startTime'],
                name: 'idx_staff_start_time'
            },
            {
                fields: ['requestedStaffId'],
                name: 'idx_requested_staff'
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
            {
                fields: ['bookingSessionId'],
                name: 'idx_appointments_booking_session_id'
            },
            {
                fields: ['bookingReference'],
                name: 'idx_appointments_booking_reference'
            },
            // Index for tenant-based queries
            {
                fields: ['tenantId', 'startTime'],
                name: 'idx_tenant_time'
            },
            {
                fields: ['bookingNumber'],
                unique: true,
                name: 'idx_appointments_booking_number'
            },
            {
                fields: ['inviteToken'],
                unique: true,
                name: 'idx_appointments_invite_token'
            }
        ]
    });

    Appointment.beforeCreate(async (appointment) => {
        if (!appointment.bookingNumber) {
            appointment.bookingNumber = await Appointment.generateBookingNumber();
        }
    });

    return Appointment;
};
