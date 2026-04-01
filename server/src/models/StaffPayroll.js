'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StaffPayroll extends Model {
        static associate(models) {
            StaffPayroll.belongsTo(models.Staff, { foreignKey: 'staffId', as: 'staff' });
            StaffPayroll.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
        }
    }

    StaffPayroll.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        staffId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'staff_id',
            references: { model: 'staff', key: 'id' },
            onDelete: 'CASCADE'
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'tenant_id',
            references: { model: 'tenants', key: 'id' },
            onDelete: 'CASCADE'
        },
        periodStart: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            field: 'period_start'
        },
        periodEnd: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            field: 'period_end'
        },
        baseSalary: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
            field: 'base_salary'
        },
        commission: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        tipsTotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
            field: 'tips_total'
        },
        bonuses: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        deductions: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        totalNet: {
            type: DataTypes.VIRTUAL,
            get() {
                return (
                    parseFloat(this.baseSalary || 0) +
                    parseFloat(this.commission || 0) +
                    parseFloat(this.tipsTotal || 0) +
                    parseFloat(this.bonuses || 0) -
                    parseFloat(this.deductions || 0)
                );
            }
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'draft',
            validate: { isIn: [['draft', 'processed', 'paid']] }
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'paid_at'
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'updated_at'
        }
    }, {
        sequelize,
        modelName: 'StaffPayroll',
        tableName: 'staff_payrolls',
        schema: 'public',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['staff_id', 'period_start'] }
        ]
    });

    return StaffPayroll;
};
