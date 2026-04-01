'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ServiceCategory extends Model {
        static associate() {
            // Categories are referenced by slug in Service.category for now.
        }
    }

    ServiceCategory.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name_en: {
            type: DataTypes.STRING,
            allowNull: false
        },
        name_ar: {
            type: DataTypes.STRING,
            allowNull: false
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: true
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'ServiceCategory',
        tableName: 'service_categories',
        schema: 'public',
        timestamps: true,
        hooks: {
            beforeValidate: (instance) => {
                if (instance.name_en && !instance.slug) {
                    instance.slug = instance.name_en
                        .toLowerCase()
                        .replace(/[&]/g, 'and')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '');
                }
            }
        }
    });

    return ServiceCategory;
};
