'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FeaturePricing extends Model {
        static associate() {
            // No associations required for the pricing master list.
        }
    }

    FeaturePricing.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        featureKey: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
            comment: 'System key for the feature (e.g. subscriptionFee, maxStaff)'
        },
        label: {
            type: DataTypes.STRING(128),
            allowNull: false,
            comment: 'Admin-facing display label'
        },
        unitLabel: {
            type: DataTypes.STRING(64),
            allowNull: false,
            comment: 'Label for the billed unit'
        },
        unitPrice: {
            type: DataTypes.DECIMAL(12, 6),
            allowNull: false,
            defaultValue: 0.000000,
            comment: 'Price per billed unit in SAR'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'FeaturePricing',
        tableName: 'FeaturePricings',
        timestamps: true
    });

    return FeaturePricing;
};
