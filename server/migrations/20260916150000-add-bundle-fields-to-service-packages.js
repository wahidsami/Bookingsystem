'use strict';

/**
 * Migration: Add Services 2 Bundle fields to service_packages table
 * 
 * Supports Fresha-inspired bundle workflow:
 * - Bilingual descriptions (description_en, description_ar)
 * - Scheduling mode (scheduleType: 'sequence' | 'parallel')
 * - Pricing model (pricingType: 'service' | 'custom' | 'discount' | 'free')
 * - Pricing adjustments (discountPercentage, customPrice)
 * - Online booking visibility (allowOnlineBooking)
 * - Target audience gender (targetGender: 'all' | 'female' | 'male')
 * 
 * 100% Additive and backward compatible with existing legacy packages.
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('service_packages');

        if (!tableInfo.description_en) {
            await queryInterface.addColumn('service_packages', 'description_en', {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Services 2: English bundle description'
            });
        }

        if (!tableInfo.description_ar) {
            await queryInterface.addColumn('service_packages', 'description_ar', {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Services 2: Arabic bundle description'
            });
        }

        if (!tableInfo.scheduleType) {
            await queryInterface.addColumn('service_packages', 'scheduleType', {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'sequence',
                comment: 'Services 2: Scheduling execution mode: sequence or parallel'
            });
        }

        if (!tableInfo.pricingType) {
            await queryInterface.addColumn('service_packages', 'pricingType', {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'service',
                comment: 'Services 2: Pricing mode: service, custom, discount, or free'
            });
        }

        if (!tableInfo.discountPercentage) {
            await queryInterface.addColumn('service_packages', 'discountPercentage', {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: true,
                defaultValue: null,
                comment: 'Services 2: Percentage discount applied when pricingType is discount'
            });
        }

        if (!tableInfo.customPrice) {
            await queryInterface.addColumn('service_packages', 'customPrice', {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: null,
                comment: 'Services 2: Custom fixed bundle price when pricingType is custom'
            });
        }

        if (!tableInfo.allowOnlineBooking) {
            await queryInterface.addColumn('service_packages', 'allowOnlineBooking', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Services 2: Online booking visibility toggle'
            });
        }

        if (!tableInfo.targetGender) {
            await queryInterface.addColumn('service_packages', 'targetGender', {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'all',
                comment: 'Services 2: Target audience gender: all, female, or male'
            });
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('service_packages');

        if (tableInfo.targetGender) {
            await queryInterface.removeColumn('service_packages', 'targetGender');
        }
        if (tableInfo.allowOnlineBooking) {
            await queryInterface.removeColumn('service_packages', 'allowOnlineBooking');
        }
        if (tableInfo.customPrice) {
            await queryInterface.removeColumn('service_packages', 'customPrice');
        }
        if (tableInfo.discountPercentage) {
            await queryInterface.removeColumn('service_packages', 'discountPercentage');
        }
        if (tableInfo.pricingType) {
            await queryInterface.removeColumn('service_packages', 'pricingType');
        }
        if (tableInfo.scheduleType) {
            await queryInterface.removeColumn('service_packages', 'scheduleType');
        }
        if (tableInfo.description_ar) {
            await queryInterface.removeColumn('service_packages', 'description_ar');
        }
        if (tableInfo.description_en) {
            await queryInterface.removeColumn('service_packages', 'description_en');
        }
    }
};
